import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';

/**
 * Renders a PDF as sharp page images sized to the container and the
 * device's pixel density (browsers' built-in PDF frames come out blurry,
 * and the iOS webview shows only a low-res first page).
 */
/**
 * iPhones and iPads keep refusing the fonts pdf.js installs — Arabic came
 * out shuffled, English came out with letters missing — and no rendering
 * option fixed both. Their own PDF viewer draws every file perfectly, so
 * on those devices we hand the file over instead of drawing it ourselves.
 */
function isApplePhone(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export default function PdfView({ url, className }: { url: string; className?: string }) {
  const { t } = useLang();
  const holder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [handOver] = useState(isApplePhone);

  useEffect(() => {
    if (handOver) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        // The character maps and the base-14 fonts come from our own
        // origin (see scripts/copy-pdf-assets.mjs), so a file that leans
        // on either never depends on somebody else's CDN.
        const docPdf = await pdfjs.getDocument({
          url,
          cMapUrl: '/pdf-assets/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdf-assets/standard_fonts/',
        }).promise;
        if (cancelled || !holder.current) return;
        const el = holder.current;
        el.innerHTML = '';
        const width = el.clientWidth || 800;
        // Render at up to 2x pixel density for crispness without huge memory.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= docPdf.numPages; n++) {
          const page = await docPdf.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.style.display = 'block';
          if (n > 1) canvas.style.borderTop = '1px solid #e2e8f0';
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          el.appendChild(canvas);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, handOver]);

  if (handOver) {
    return (
      <div className="p-8 text-center">
        <p className="text-5xl">📕</p>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
          {t('Open the file to read it — your phone shows PDFs best.')}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white hover:bg-brand-700"
        >
          {t('Open the file')} ↗
        </a>
      </div>
    );
  }

  if (status === 'error') {
    // Rendering failed (e.g. corrupted file) — fall back to the browser frame.
    return <iframe src={url} title="PDF" className="h-[75vh] w-full" />;
  }
  return (
    <div className={className ?? 'max-h-[80vh] overflow-y-auto'}>
      {status === 'loading' && (
        <p className="p-8 text-center text-sm text-slate-500">{t('Loading…')}</p>
      )}
      <div ref={holder} />
    </div>
  );
}
