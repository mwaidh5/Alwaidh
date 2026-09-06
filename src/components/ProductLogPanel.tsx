import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { subscribeProductLog, type ProductLogEntry } from '../lib/productLog';
import { useStaffName } from '../lib/staffDirectory';
import { useScrollLock } from '../lib/useScrollLock';
import { useLang } from '../lib/i18n';

/**
 * The product diary, read back: who added, changed, trashed or restored
 * each item, and the fields that moved. Opened from the Products page,
 * or from a single product's editor with `productId` set.
 */

const LOOK: Record<ProductLogEntry['action'], { icon: string; label: string; cls: string }> = {
  added: { icon: '➕', label: 'Added', cls: 'bg-green-100 text-green-800' },
  edited: { icon: '✏️', label: 'Edited', cls: 'bg-blue-100 text-blue-800' },
  photos: { icon: '🖼', label: 'Photos', cls: 'bg-violet-100 text-violet-800' },
  trashed: { icon: '🗑️', label: 'Trashed', cls: 'bg-amber-100 text-amber-800' },
  restored: { icon: '↩️', label: 'Restored', cls: 'bg-slate-200 text-slate-700' },
  deleted: { icon: '⛔', label: 'Deleted', cls: 'bg-red-100 text-red-800' },
};

function when(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function ProductLogPanel({
  productId,
  onClose,
}: {
  /** Set to show one product's history instead of the whole diary. */
  productId?: string;
  onClose: () => void;
}) {
  useScrollLock();
  const { t } = useLang();
  const staffName = useStaffName();
  const [entries, setEntries] = useState<ProductLogEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [who, setWho] = useState('all');

  useEffect(() => subscribeProductLog(setEntries, { productId }), [productId]);

  const people = useMemo(
    () => [...new Set((entries ?? []).map((e) => e.by).filter(Boolean))].sort(),
    [entries],
  );
  const shown = useMemo(() => {
    let list = entries ?? [];
    if (who !== 'all') list = list.filter((e) => e.by === who);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        [e.productName, e.by, e.action, ...e.changes].some((v) => v.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [entries, who, query]);

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-xl"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="font-bold text-slate-900">📜 {productId ? t('This product’s history') : t('Product log')}</h2>
            <p className="text-xs text-slate-500">{t('Who added or changed what, and when.')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 flex-none place-items-center rounded-full text-lg text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {!productId && (
          <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search product, person or field')}
              className="input min-w-[12rem] flex-1"
            />
            <select value={who} onChange={(e) => setWho(e.target.value)} className="input w-auto">
              <option value="all">{t('Everyone')}</option>
              {people.map((p) => (
                <option key={p} value={p}>
                  {staffName(p)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {entries === null ? (
            <p className="p-6 text-center text-sm text-slate-500">{t('Loading…')}</p>
          ) : shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
              {t('Nothing recorded yet.')}
            </p>
          ) : (
            <ol className="space-y-2.5">
              {shown.map((e) => {
                const look = LOOK[e.action];
                return (
                  <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${look.cls}`}>
                        {look.icon} {t(look.label)}
                      </span>
                      {!productId && (
                        <span className="min-w-0 truncate text-sm font-bold text-slate-900">{e.productName}</span>
                      )}
                      <span className="ms-auto flex-none text-[11px] text-slate-400">{when(e.atMs)}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">👤 {staffName(e.by) || '—'}</p>
                    {e.changes.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-dashed border-slate-200 pt-2">
                        {e.changes.map((c, i) => (
                          <li key={i} dir="auto" className="bidi break-words text-[13px] text-slate-700">
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
