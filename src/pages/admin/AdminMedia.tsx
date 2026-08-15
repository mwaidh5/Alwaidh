import { useEffect, useMemo, useState } from 'react';
import { listAllMedia, deleteMedia, storagePathFromUrl, type MediaItem } from '../../lib/mediaStore';
import {
  productStorageMode,
  subscribeDeletedProducts,
  subscribeProducts,
  updateProductMedia,
} from '../../lib/productStore';
import { updateSettingsField, type SiteSettings } from '../../lib/settingsStore';
import { uploadImage } from '../../lib/imageUpload';
import ImageEditor from '../../components/ImageEditor';
import { useSettings } from '../../lib/useSettings';
import type { Product } from '../../types/product';

type Filter = 'all' | 'used' | 'unused';

export default function AdminMedia() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [copied, setCopied] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [notice, setNotice] = useState('');

  // Everything that can reference an image, so we can show what's in use.
  const settings = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [trashed, setTrashed] = useState<Product[]>([]);
  useEffect(() => subscribeProducts(setProducts), []);
  useEffect(() => subscribeDeletedProducts(setTrashed), []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems(await listAllMedia());
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load media.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /** path → human-readable list of places using it. */
  const usage = useMemo(() => {
    const map = new Map<string, string[]>();
    const add = (url: string | undefined, label: string) => {
      const path = url ? storagePathFromUrl(url) : null;
      if (!path) return;
      const list = map.get(path) ?? [];
      if (!list.includes(label)) list.push(label);
      map.set(path, list);
    };
    for (const p of products) {
      const name = p.name || 'Untitled product';
      p.images.forEach((u) => add(u, name));
      add(p.datasheet, `${name} — datasheet`);
      add(p.manual, `${name} — manual`);
    }
    // Trashed products still reference their images; deleting those would
    // break the product if it is ever restored.
    for (const p of trashed) {
      const name = `${p.name || 'Untitled product'} (in Trash)`;
      p.images.forEach((u) => add(u, name));
      add(p.datasheet, `${name} — datasheet`);
      add(p.manual, `${name} — manual`);
    }
    add(settings.logoImage, 'Site logo');
    add(settings.heroImage, 'Homepage hero');
    add(settings.solarBannerImage, 'Solar banner');
    add(settings.tiandyLogo, 'Tiandy logo');
    add(settings.solarLogo, 'Solar logo');
    Object.entries(settings.categoryLogos ?? {}).forEach(([slug, u]) =>
      add(u, `Category tile — ${slug}`),
    );
    Object.entries(settings.brandLogos ?? {}).forEach(([slug, u]) => add(u, `Brand logo — ${slug}`));
    return map;
  }, [products, trashed, settings]);

  const visible = useMemo(() => {
    const list = items ?? [];
    if (filter === 'used') return list.filter((i) => usage.has(i.path));
    if (filter === 'unused') return list.filter((i) => !usage.has(i.path));
    return list;
  }, [items, filter, usage]);

  const usedCount = (items ?? []).filter((i) => usage.has(i.path)).length;
  const unusedCount = (items ?? []).length - usedCount;
  const selectedInUse = [...selected].filter((p) => usage.has(p)).length;

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectAllVisible() {
    const paths = visible.map((i) => i.path);
    const allSelected = paths.length > 0 && paths.every((p) => selected.has(p));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) paths.forEach((p) => next.delete(p));
      else paths.forEach((p) => next.add(p));
      return next;
    });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function remove(item: MediaItem) {
    const where = usage.get(item.path);
    const warning = where?.length
      ? `\n\n⚠️ This image is still used by:\n• ${where.join('\n• ')}\nIt will go blank there.`
      : '';
    if (!confirm(`Delete this image?\n${item.name}${warning}`)) return;
    try {
      await deleteMedia(item.path);
      setItems((prev) => (prev ? prev.filter((i) => i.path !== item.path) : prev));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.path);
        return next;
      });
      if (preview?.path === item.path) setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const warning = selectedInUse
      ? `\n\n⚠️ ${selectedInUse} of them ${selectedInUse === 1 ? 'is' : 'are'} still in use and will go blank where they appear.`
      : '';
    if (!confirm(`Delete ${selected.size} image(s)? This cannot be undone.${warning}`)) return;
    setDeleting(true);
    setError('');
    const paths = [...selected];
    const failed: string[] = [];
    await Promise.all(
      paths.map((p) =>
        deleteMedia(p).catch(() => {
          failed.push(p);
        }),
      ),
    );
    const removed = new Set(paths.filter((p) => !failed.includes(p)));
    setItems((prev) => (prev ? prev.filter((i) => !removed.has(i.path)) : prev));
    setSelected(new Set(failed));
    if (failed.length) setError(`${failed.length} image(s) could not be deleted.`);
    setDeleting(false);
  }

  /** Bytes of the image being edited (the bucket allows CORS reads). */
  async function fetchOriginal(item: MediaItem): Promise<Blob> {
    const resp = await fetch(item.url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Could not open this image (error ${resp.status}).`);
    return resp.blob();
  }

  /**
   * Upload the edited copy next to the original, then re-point every product
   * and site setting that used the old file — so the edit shows up wherever
   * the image appears, not just in the library.
   */
  async function saveEdited(item: MediaItem, file: File) {
    const folder = item.path.split('/').slice(0, -1).join('/') || 'site';
    const { url } = await uploadImage(file, folder);
    const matches = (u?: string) => Boolean(u) && storagePathFromUrl(u as string) === item.path;
    let updated = 0;

    for (const p of [...products, ...trashed]) {
      const images = p.images.map((u) => (matches(u) ? url : u));
      const updates: Partial<Pick<Product, 'image' | 'images' | 'datasheet' | 'manual'>> = {};
      if (images.some((u, i) => u !== p.images[i])) {
        updates.images = images;
        updates.image = images[0] ?? '';
      }
      if (matches(p.datasheet)) updates.datasheet = url;
      if (matches(p.manual)) updates.manual = url;
      if (Object.keys(updates).length) {
        await updateProductMedia(p.id, updates);
        updated++;
      }
    }

    for (const key of [
      'logoImage',
      'heroImage',
      'solarBannerImage',
      'tiandyLogo',
      'solarLogo',
    ] as const) {
      if (matches(settings[key])) {
        await updateSettingsField(key, url);
        updated++;
      }
    }
    for (const key of ['categoryLogos', 'brandLogos'] as const) {
      const rec: SiteSettings[typeof key] = settings[key] ?? {};
      if (Object.values(rec).some((u) => matches(u))) {
        await updateSettingsField(
          key,
          Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, matches(v) ? url : v])),
        );
        updated++;
      }
    }

    setEditing(null);
    setPreview(null);
    setNotice(
      updated
        ? `✅ Image edited — ${updated} place${updated === 1 ? '' : 's'} now show the new version.`
        : '✅ Edited copy saved to the library.',
    );
    window.setTimeout(() => setNotice(''), 5000);
    await load();
  }

  const local = productStorageMode() === 'local';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Media library</h1>
          <p className="mt-1 text-sm text-slate-600">
            {items
              ? `${items.length} images · ${usedCount} in use · ${unusedCount} unused`
              : 'Every image uploaded to your store.'}
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="btn-secondary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {local && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Firebase isn’t connected, so there’s no media storage to list here.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}
      {notice && (
        <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      )}

      {!loading && items && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm font-semibold">
            {(
              [
                { key: 'all', label: `All (${items.length})` },
                { key: 'used', label: `In use (${usedCount})` },
                { key: 'unused', label: `Unused (${unusedCount})` },
              ] as { key: Filter; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-3 py-1.5 transition ${
                  filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={selectAllVisible}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            {visible.length > 0 && visible.every((i) => selected.has(i.path))
              ? 'Clear selection'
              : `Select all shown (${visible.length})`}
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm shadow-sm">
          <span className="font-semibold text-brand-800">{selected.size} selected</span>
          {selectedInUse > 0 && (
            <span className="text-amber-800">⚠️ {selectedInUse} still in use</span>
          )}
          <button
            type="button"
            onClick={deleteSelected}
            disabled={deleting}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : `Delete ${selected.size} selected`}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-slate-500 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <p className="card p-10 text-center text-sm text-slate-500">Loading images…</p>
      ) : items && items.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">No images uploaded yet.</p>
      ) : visible.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">
          No {filter === 'used' ? 'used' : 'unused'} images.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => {
            const where = usage.get(item.path);
            const isSelected = selected.has(item.path);
            return (
              <div
                key={item.path}
                className={`card overflow-hidden ${isSelected ? 'ring-2 ring-brand-500' : ''}`}
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPreview(item)}
                    className="block aspect-square w-full overflow-hidden bg-slate-100"
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <label
                    className="absolute left-2 top-2 flex cursor-pointer items-center rounded-md bg-white/90 p-1 shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(item.path)}
                      aria-label={`Select ${item.name}`}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>
                  <span
                    title={where?.length ? `Used by:\n• ${where.join('\n• ')}` : 'Not used anywhere'}
                    className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      where?.length ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {where?.length ? 'In use' : 'Unused'}
                  </span>
                </div>
                <div className="space-y-2 p-2">
                  {where?.length ? (
                    <p className="truncate text-xs font-medium text-slate-700" title={where.join(', ')}>
                      {where[0]}
                      {where.length > 1 && ` +${where.length - 1}`}
                    </p>
                  ) : (
                    <p className="truncate text-xs text-slate-400">Not used anywhere</p>
                  )}
                  <p className="truncate text-[11px] text-slate-400" title={item.path}>
                    {item.path}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => copy(item.url)}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      {copied === item.url ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      title="Crop, rotate, or remove the background"
                      className="text-xs font-semibold text-slate-700 hover:underline"
                    >
                      ✎ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-h-[90vh] max-w-3xl overflow-hidden rounded-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={preview.url}
              alt={preview.name}
              className="max-h-[75vh] w-full bg-slate-100 object-contain"
            />
            <div className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-500">{preview.path}</p>
                <p className="truncate text-xs font-medium text-slate-700">
                  {usage.get(preview.path)?.join(', ') || 'Not used anywhere'}
                </p>
              </div>
              <div className="flex flex-none gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => copy(preview.url)}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  {copied === preview.url ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(preview)}
                  className="font-semibold text-slate-700 hover:underline"
                >
                  ✎ Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="font-semibold text-slate-600 hover:underline"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <ImageEditor
          getSource={() => fetchOriginal(editing)}
          sourceUrl={editing.url}
          onCancel={() => setEditing(null)}
          onSave={(file) => saveEdited(editing, file)}
        />
      )}
    </div>
  );
}
