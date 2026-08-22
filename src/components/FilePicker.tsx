import { useEffect, useMemo, useState } from 'react';
import { listAllMedia } from '../lib/mediaStore';
import { subscribeLibrary, formatFileSize, type LibraryFile } from '../lib/libraryStore';
import { useLang } from '../lib/i18n';
import { useScrollLock } from '../lib/useScrollLock';

interface Choice {
  url: string;
  name: string;
  where: string; // which shelf it came from, shown under the name
  detail: string;
  isPdf: boolean;
}

/**
 * Pick a document that is already on the website — a datasheet uploaded
 * for another product, or a catalogue from the team's Files shelf —
 * instead of hunting for the same PDF and uploading it twice.
 */
export default function FilePicker({
  open,
  allowImages = false,
  title = 'Choose a file already on the website',
  onClose,
  onSelect,
}: {
  open: boolean;
  /** Datasheets are often scans, so images count there but not for manuals. */
  allowImages?: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  useScrollLock(open);
  const { t } = useLang();
  const [uploads, setUploads] = useState<Choice[] | null>(null);
  const [shelf, setShelf] = useState<LibraryFile[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  // The team's Files shelf — live, and quietly skipped if this account
  // isn't allowed to read it.
  useEffect(() => {
    if (!open) return;
    return subscribeLibrary(setShelf, () => setShelf([]));
  }, [open]);

  // Everything uploaded against a product or the site.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setUploads(null);
    setError('');
    setQuery('');
    listAllMedia()
      .then((media) => {
        if (cancelled) return;
        setUploads(
          media
            .map((m) => ({
              url: m.url,
              name: prettyName(m.name),
              where: t('Uploaded to a product'),
              detail: m.path,
              isPdf: /\.pdf$/i.test(m.name),
            }))
            .filter((c) => c.isPdf || (allowImages && /\.(jpe?g|png|webp|avif|gif)$/i.test(c.detail))),
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setUploads([]);
        setError(e instanceof Error ? e.message : t('Could not list the files.'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, allowImages, t]);

  const choices = useMemo(() => {
    const fromShelf: Choice[] = shelf
      .filter((f) => /pdf/i.test(f.contentType) || (allowImages && /image/i.test(f.contentType)))
      .map((f) => ({
        url: f.url,
        name: f.name,
        where: t('Files'),
        detail: [f.note, formatFileSize(f.size)].filter(Boolean).join(' · '),
        isPdf: /pdf/i.test(f.contentType),
      }));
    const all = [...fromShelf, ...(uploads ?? [])];
    const q = query.trim().toLowerCase();
    return q ? all.filter((c) => `${c.name} ${c.detail}`.toLowerCase().includes(q)) : all;
  }, [shelf, uploads, query, allowImages, t]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4"
      onClick={onClose}
    >
      <div
        className="mt-10 w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
          <h2 className="min-w-0 flex-1 font-bold text-slate-900">{t(title)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search files…')}
            className="input w-full"
          />

          {uploads === null ? (
            <p className="py-10 text-center text-sm text-slate-500">{t('Loading…')}</p>
          ) : choices.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              {error || t('No files to choose from yet.')}
            </p>
          ) : (
            <ul className="mt-3 max-h-[55vh] divide-y divide-slate-100 overflow-y-auto">
              {choices.map((c) => (
                <li key={c.url}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(c.url);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 px-1 py-3 text-start hover:bg-slate-50"
                  >
                    <span className="text-2xl" aria-hidden>
                      {c.isPdf ? '📕' : '🖼️'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{c.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {c.where}
                        {c.detail ? ` · ${c.detail}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** "1734020112345-deye-8kw-datasheet.pdf" → "deye 8kw datasheet.pdf" */
function prettyName(fileName: string): string {
  return fileName.replace(/^\d{10,}-/, '').replace(/[-_]+/g, ' ');
}
