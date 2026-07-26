import { useEffect, useMemo, useState } from 'react';
import { listAllMedia, storagePathFromUrl, type MediaItem } from '../lib/mediaStore';
import { listProducts } from '../lib/productStore';
import { loadSettings } from '../lib/settingsStore';

/**
 * Pick images that are already on the site instead of uploading again.
 *
 * Normally this lists the whole media library. If Storage listing is
 * unavailable (some networks/antivirus block it), it falls back to the
 * images already referenced by products and site settings — those come
 * from the database, so the picker still works.
 */
export default function MediaPicker({
  open,
  multiple = false,
  title = 'Choose from the website',
  onClose,
  onSelect,
}: {
  open: boolean;
  multiple?: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (urls: string[]) => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState('');
  const [limited, setLimited] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems(null);
    setError('');
    setLimited(false);
    setPicked([]);
    (async () => {
      try {
        const media = await listAllMedia();
        if (!cancelled) setItems(media);
      } catch {
        // Storage listing unavailable — show what the site already uses.
        try {
          const [products, settings] = await Promise.all([listProducts(), loadSettings()]);
          const urls = new Set<string>();
          products.forEach((p) => p.images.forEach((u) => u && urls.add(u)));
          [
            settings.logoImage,
            settings.heroImage,
            settings.solarBannerImage,
            settings.tiandyLogo,
            settings.solarLogo,
            ...Object.values(settings.categoryLogos ?? {}),
            ...Object.values(settings.brandLogos ?? {}),
          ].forEach((u) => u && urls.add(u));
          if (cancelled) return;
          setItems(
            [...urls].map((url) => {
              const path = storagePathFromUrl(url) ?? url;
              return { url, path, name: path.split('/').pop() ?? path };
            }),
          );
          setLimited(true);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load images.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const visible = useMemo(() => {
    const list = items ?? [];
    const q = query.trim().toLowerCase();
    return q ? list.filter((i) => i.path.toLowerCase().includes(q)) : list;
  }, [items, query]);

  if (!open) return null;

  function toggle(url: string) {
    setPicked((prev) =>
      multiple
        ? prev.includes(url)
          ? prev.filter((u) => u !== url)
          : [...prev, url]
        : [url],
    );
  }

  function confirm() {
    if (picked.length) onSelect(picked);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or folder…"
            className="input"
          />
          {limited && (
            <p className="mt-2 text-xs text-amber-700">
              Showing images already used on the site — the full library couldn’t be listed on this
              device.
            </p>
          )}
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto p-5">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          ) : items === null ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading images…</p>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              {items.length === 0 ? 'No images on the site yet.' : 'No images match that search.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {visible.map((item) => {
                const isPicked = picked.includes(item.url);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => toggle(item.url)}
                    title={item.path}
                    className={`overflow-hidden rounded-lg border-2 bg-slate-100 transition ${
                      isPicked ? 'border-brand-600 ring-2 ring-brand-200' : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <span className="relative block aspect-square">
                      <img
                        src={item.url}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {isPicked && (
                        <span className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                          ✓
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <span className="text-sm text-slate-500">
            {picked.length > 0
              ? `${picked.length} selected`
              : multiple
                ? 'Tap images to select'
                : 'Tap an image to select'}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={picked.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              {multiple && picked.length > 1 ? `Use ${picked.length} images` : 'Use image'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
