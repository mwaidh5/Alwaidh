import { useEffect, useState } from 'react';
import { listAllMedia, deleteMedia, type MediaItem } from '../../lib/mediaStore';
import { productStorageMode } from '../../lib/productStore';

export default function AdminMedia() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [copied, setCopied] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems(await listAllMedia());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load media.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
    if (!confirm(`Delete this image?\n${item.name}\n\nIf a product or page still uses it, the image will go blank.`))
      return;
    try {
      await deleteMedia(item.path);
      setItems((prev) => (prev ? prev.filter((i) => i.path !== item.path) : prev));
      if (preview?.path === item.path) setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  const local = productStorageMode() === 'local';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Media library</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every image uploaded to your store. Click to preview, copy a link to reuse it, or delete.
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

      {items && items.length === 0 && !loading ? (
        <p className="card p-10 text-center text-sm text-slate-500">No images uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {(items ?? []).map((item) => (
            <div key={item.path} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setPreview(item)}
                className="block aspect-square w-full overflow-hidden bg-slate-100"
              >
                <img src={item.url} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
              </button>
              <div className="space-y-2 p-2">
                <p className="truncate text-xs text-slate-500" title={item.path}>
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
                    onClick={() => remove(item)}
                    className="text-xs font-semibold text-red-700 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="max-h-[90vh] max-w-3xl overflow-hidden rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
            <img src={preview.url} alt={preview.name} className="max-h-[75vh] w-full object-contain bg-slate-100" />
            <div className="flex items-center justify-between gap-3 p-3">
              <p className="truncate text-xs text-slate-500">{preview.path}</p>
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
    </div>
  );
}
