import { createPortal } from 'react-dom';
import PdfView from './PdfView';
import { useLang } from '../lib/i18n';
import { useScrollLock } from '../lib/useScrollLock';

/**
 * A PDF, full screen, drawn by our own viewer.
 *
 * It used to be an iframe on desktop and window.open on phones. The
 * Android app's webview can't show a PDF at all — the frame stayed
 * blank and the new window went to a download nobody saw — so the pages
 * are painted here instead, the same on every device. The link to open
 * it outside is kept for anyone who wants to save or print.
 */
export default function PdfPreviewModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title?: string;
  onClose: () => void;
}) {
  useScrollLock();
  const { t } = useLang();
  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-50 flex bg-slate-900/80 p-2 sm:p-4" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <span className="truncate text-sm font-semibold text-slate-800">{title || t('Invoice preview')}</span>
          <div className="flex flex-none gap-4 text-sm">
            <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
              {t('Open in new tab')}
            </a>
            <button type="button" onClick={onClose} className="font-semibold text-slate-600 hover:underline">
              {t('Close')}
            </button>
          </div>
        </div>
        <PdfView url={url} className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-2" />
      </div>
    </div>,
    document.body,
  );
}
