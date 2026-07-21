import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createProduct,
  deleteProduct,
  resetProductsToSeed,
  subscribeProducts,
  upsertProduct,
} from '../../lib/productStore';
import { uploadProductImage } from '../../lib/imageUpload';
import { categories } from '../../data/categories';
import { formatPrice } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import type { Product, CategorySlug } from '../../types/product';

type FormState = Omit<Product, 'specs'> & { specsText: string };

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  category: 'computers',
  brand: '',
  price: 0,
  currency: 'IQD',
  image: '',
  images: [],
  rating: 0,
  inStock: true,
  shortDescription: '',
  description: '',
  specsText: '',
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [filter, setFilter] = useState<'all' | CategorySlug>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { isAdmin, isComputerStaff, isSolarStaff } = useAuth();
  const allowedCategories = useMemo<CategorySlug[]>(
    () =>
      isAdmin
        ? categories.map((c) => c.slug)
        : [
            ...(isComputerStaff ? (['computers', 'tiandy-cameras'] as CategorySlug[]) : []),
            ...(isSolarStaff ? (['solar'] as CategorySlug[]) : []),
          ],
    [isAdmin, isComputerStaff, isSolarStaff],
  );
  const categoryOptions = categories.filter((c) => allowedCategories.includes(c.slug));

  useEffect(() => {
    return subscribeProducts((list) => setProducts(list));
  }, []);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const ids = filtered.map((p) => p.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function applyToSelected(label: string, transform: (p: Product) => Product) {
    if (selected.size === 0) return;
    setError('');
    setBusy(true);
    try {
      const list = products ?? [];
      await Promise.all(
        [...selected].map((id) => {
          const p = list.find((x) => x.id === id);
          return p ? upsertProduct(transform(p)) : Promise.resolve();
        }),
      );
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected product(s)? This cannot be undone.`)) return;
    setError('');
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => deleteProduct(id)));
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk delete failed.');
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const list = products ?? [];
    return list.filter((p) => {
      if (!allowedCategories.includes(p.category)) return false;
      if (filter !== 'all' && p.category !== filter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, filter, query, allowedCategories]);

  function startCreate() {
    setError('');
    setEditing({ ...EMPTY_FORM, category: allowedCategories[0] ?? 'computers' });
  }

  function startEdit(p: Product) {
    setError('');
    setEditing({
      ...p,
      specsText: Object.entries(p.specs)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n'),
    });
  }

  async function handleSave() {
    if (!editing) return;
    setError('');
    setBusy(true);
    try {
      const specs = parseSpecs(editing.specsText);
      const isNew = !editing.id;
      const images = editing.images.map((s) => s.trim()).filter(Boolean);
      const payload = {
        name: editing.name.trim(),
        category: editing.category,
        brand: editing.brand.trim(),
        price: Number(editing.price) || 0,
        currency: editing.currency.trim().toUpperCase() || 'IQD',
        image: images[0] ?? '',
        images,
        rating: Math.max(0, Math.min(5, Number(editing.rating) || 0)),
        inStock: editing.inStock,
        shortDescription: editing.shortDescription.trim(),
        description: editing.description.trim(),
        specs,
      };
      if (!payload.name) throw new Error('Name is required.');
      if (isNew) {
        await createProduct(payload);
      } else {
        await upsertProduct({ id: editing.id, ...payload });
      }
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return;
    try {
      await deleteProduct(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  async function handleReset() {
    if (!confirm('Reset all products back to the built-in seed catalogue? This deletes any custom products.')) return;
    setBusy(true);
    try {
      await resetProductsToSeed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-600">
            {products ? `${products.length} total · ${filtered.length} shown` : 'Loading…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button type="button" onClick={handleReset} disabled={busy} className="btn-secondary">
              Reset to seed
            </button>
          )}
          <button type="button" onClick={startCreate} className="btn-primary">
            + Add product
          </button>
        </div>
      </header>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, brand, or id"
            className="input max-w-xs"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="input max-w-xs"
          >
            <option value="all">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm">
          <span className="font-semibold text-brand-800">{selected.size} selected</span>
          <span className="text-slate-400">·</span>
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1"
            value=""
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value as CategorySlug;
              if (v) applyToSelected('Set category', (p) => ({ ...p, category: v }));
            }}
          >
            <option value="">Set category…</option>
            {categoryOptions.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyToSelected('Set stock', (p) => ({ ...p, inStock: true }))}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-50"
          >
            In stock
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyToSelected('Set stock', (p) => ({ ...p, inStock: false }))}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-50"
          >
            Out of stock
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyToSelected('Set currency', (p) => ({ ...p, currency: 'IQD' }))}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-50"
          >
            Set currency → IQD
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const f = prompt('Multiply selected prices by (e.g. 1310 to convert USD → IQD):');
              const factor = Number(f);
              if (f && factor > 0) {
                applyToSelected('Adjust price', (p) => ({ ...p, price: Math.round(p.price * factor) }));
              }
            }}
            className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-50"
          >
            Multiply price ×…
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={deleteSelected}
            className="rounded border border-red-300 bg-white px-2 py-1 font-semibold text-red-700 hover:bg-red-50"
          >
            Delete
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

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {products === null ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">No products match.</p>
      ) : (
        <>
        {/* Phone: tap-friendly cards with big Edit / Delete buttons. */}
        <div className="space-y-3 md:hidden">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`card p-3 ${selected.has(p.id) ? 'ring-2 ring-brand-400' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Select ${p.name}`}
                  checked={selected.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300"
                />
                {p.image ? (
                  <img
                    src={p.image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-md bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-slate-900">{p.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{p.brand}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {formatPrice(p.price, p.currency)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {p.inStock ? 'In stock' : 'Out'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="btn-primary w-full py-2.5"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="w-full rounded-lg border border-red-300 bg-white py-2.5 font-semibold text-red-700 active:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Larger screens: full table. */}
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((p) => (
                <tr key={p.id} className={selected.has(p.id) ? 'bg-brand-50/40' : undefined}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-slate-100" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.brand} · {p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.category}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatPrice(p.price, p.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {p.inStock ? 'In stock' : 'Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="ml-3 text-sm font-semibold text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {editing && (
        <ProductDialog
          state={editing}
          setState={setEditing}
          busy={busy}
          categoryOptions={categoryOptions}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function ProductDialog({
  state,
  setState,
  busy,
  categoryOptions,
  onCancel,
  onSave,
}: {
  state: FormState;
  setState: (s: FormState) => void;
  busy: boolean;
  categoryOptions: { slug: CategorySlug; name: string }[];
  onCancel: () => void;
  onSave: () => void;
}) {
  const isNew = !state.id;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [removingBg, setRemovingBg] = useState(false);
  // Bytes of images uploaded in this dialog, keyed by their URL — lets
  // "Remove background" work on them without re-downloading (no CORS,
  // no network, no cache surprises).
  const uploadedFiles = useRef<Map<string, File>>(new Map());

  async function handleUpload(files: FileList) {
    setUploadError('');
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const { url, file: stored } = await uploadProductImage(file, state.id || undefined);
        if (stored) uploadedFiles.current.set(url, stored);
        uploaded.push(url);
      }
      setState({ ...state, images: [...state.images, ...uploaded] });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function addImageUrl(url: string) {
    const clean = url.trim();
    if (clean) setState({ ...state, images: [...state.images, clean] });
  }

  function removeImageAt(i: number) {
    setState({ ...state, images: state.images.filter((_, idx) => idx !== i) });
  }

  function makePrimary(i: number) {
    if (i === 0) return;
    const next = [...state.images];
    const [chosen] = next.splice(i, 1);
    setState({ ...state, images: [chosen, ...next] });
  }

  /** Get the primary image's bytes: prefer the copy kept from this dialog's
   *  own upload, else download it — with a cache-busting retry and errors
   *  that name the actual problem. */
  async function readSourceImage(target: string): Promise<Blob> {
    const inMemory = uploadedFiles.current.get(target);
    if (inMemory) return inMemory;
    const attempt = async (url: string) => {
      // no-store: never reuse a cached copy saved without CORS headers.
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
      return resp.blob();
    };
    const isStorage = /firebasestorage\.googleapis\.com|\.firebasestorage\.app/.test(target);
    try {
      return await attempt(target);
    } catch (first) {
      // Stale caches can survive no-store on some browsers — retry once with
      // a cache-busting query param before giving up.
      if (isStorage) {
        try {
          return await attempt(`${target}${target.includes('?') ? '&' : '?'}cb=${Date.now()}`);
        } catch {
          /* report based on the first failure below */
        }
      }
      const raw = first instanceof Error ? first.message : String(first);
      const httpStatus = /^HTTP_(\d+)$/.exec(raw)?.[1];
      if (httpStatus) {
        throw new Error(
          `SOURCE_UNREADABLE: Could not open this image (error ${httpStatus}) — its link may have expired or the file was deleted. Upload the photo again, then retry.`,
        );
      }
      throw new Error(
        isStorage
          ? `SOURCE_UNREADABLE: Could not read this image from Storage even though it displays fine (${raw}). A firewall, antivirus, or proxy on this network may be blocking downloads — try another browser or network, or re-upload the photo and run Remove background straight away.`
          : 'SOURCE_UNREADABLE: This image comes from another website that does not allow downloading it. Save the photo to your device and upload it here instead.',
      );
    }
  }

  async function handleRemoveBackground() {
    const target = state.images[0];
    if (!target) return;
    setUploadError('');
    setRemovingBg(true);
    try {
      const source = await readSourceImage(target);
      const { removeBackground } = await import('@imgly/background-removal');
      // The AI model is served from our own origin (see public/imgly-data,
      // populated by scripts/copy-imgly-assets.mjs) rather than the flaky
      // third-party CDN. 'small' keeps the one-time download light (~42 MB).
      const blob = await removeBackground(source, {
        publicPath: `${window.location.origin}/imgly-data/`,
        model: 'small',
      });
      const file = new File([blob], 'bg-removed.png', { type: 'image/png' });
      const { url } = await uploadProductImage(file, state.id || undefined);
      // Replace the primary image with the cut-out version.
      setState({ ...state, images: [url, ...state.images.slice(1)] });
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Background removal failed.';
      setUploadError(
        // Reading the source image failed — never report this as a model problem.
        raw.startsWith('SOURCE_UNREADABLE:')
          ? raw.slice('SOURCE_UNREADABLE:'.length).trim()
          : /load failed|failed to fetch|network|fetching of the wasm|dynamically imported module/i.test(raw)
            ? 'Background removal could not load its AI model. Check your internet connection and try again — a computer with a stable connection works best.'
            : /memory|aborted/i.test(raw)
              ? 'This device ran out of memory running the AI. Try on a computer instead.'
              : raw,
      );
    } finally {
      setRemovingBg(false);
    }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl max-h-[90vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">{isNew ? 'New product' : 'Edit product'}</h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Name" full>
            <input
              className="input"
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
            />
          </Field>
          <Field label="Brand">
            <input
              className="input"
              value={state.brand}
              onChange={(e) => setState({ ...state, brand: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <select
              className="input"
              value={state.category}
              onChange={(e) =>
                setState({ ...state, category: e.target.value as CategorySlug })
              }
            >
              {categoryOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price">
            <input
              type="number"
              min={0}
              className="input"
              value={state.price}
              onChange={(e) => setState({ ...state, price: Number(e.target.value) })}
            />
          </Field>
          <Field label="Currency">
            <input
              className="input"
              value={state.currency}
              onChange={(e) => setState({ ...state, currency: e.target.value })}
            />
          </Field>
          <Field label="Rating (0–5)">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className="input"
              value={state.rating}
              onChange={(e) => setState({ ...state, rating: Number(e.target.value) })}
            />
          </Field>
          <Field label="In stock">
            <label className="flex items-center gap-2 pt-2 text-sm">
              <input
                type="checkbox"
                checked={state.inStock}
                onChange={(e) => setState({ ...state, inStock: e.target.checked })}
              />
              Available for purchase
            </label>
          </Field>
          <Field label="Product images" full>
            <div className="space-y-3">
              {state.images.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {state.images.map((img, i) => (
                    <div
                      key={`${img}-${i}`}
                      className="group relative h-24 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                    >
                      <img src={img} alt="" className="h-full w-full object-cover" />
                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Main
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-slate-900/60 px-1 py-0.5 opacity-0 transition group-hover:opacity-100">
                        {i !== 0 ? (
                          <button
                            type="button"
                            onClick={() => makePrimary(i)}
                            className="text-[10px] font-semibold text-white hover:underline"
                            title="Make this the main image"
                          >
                            ★ Main
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={() => removeImageAt(i)}
                          className="text-[10px] font-semibold text-red-300 hover:underline"
                          title="Remove this image"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading || removingBg}
                  className="btn-secondary"
                >
                  {uploading ? 'Uploading…' : state.images.length ? '+ Add images' : 'Upload images'}
                </button>
                {state.images.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveBackground}
                    disabled={uploading || removingBg}
                    className="btn-secondary"
                  >
                    {removingBg ? 'Removing…' : 'Remove background (main)'}
                  </button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length) handleUpload(files);
                }}
              />
              <input
                className="input"
                defaultValue=""
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addImageUrl((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
                onBlur={(e) => {
                  addImageUrl(e.target.value);
                  e.target.value = '';
                }}
                placeholder="…or paste an image URL and press Enter"
              />
              {uploadError && <p className="text-xs text-red-700">{uploadError}</p>}
              <p className="text-xs text-slate-500">
                JPG, PNG, WEBP, AVIF, or GIF · max 5 MB each. The first image is the main one shown
                in listings — hover a thumbnail to reorder or remove. “Remove background” runs an
                in-browser AI on the main image.
              </p>
            </div>
          </Field>
          <Field label="Short description" full>
            <input
              className="input"
              value={state.shortDescription}
              onChange={(e) => setState({ ...state, shortDescription: e.target.value })}
            />
          </Field>
          <Field label="Description" full>
            <textarea
              className="input min-h-[100px]"
              value={state.description}
              onChange={(e) => setState({ ...state, description: e.target.value })}
            />
          </Field>
          <Field label="Specs (one per line, key: value)" full>
            <textarea
              className="input min-h-[120px] font-mono"
              value={state.specsText}
              onChange={(e) => setState({ ...state, specsText: e.target.value })}
              placeholder={'CPU: Intel Core i7\nRAM: 16 GB'}
            />
          </Field>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={onSave} className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function parseSpecs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}
