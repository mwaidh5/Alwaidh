import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';

/**
 * Renders a PDF as sharp page images sized to the container and the
 * device's pixel density (browsers' built-in PDF frames come out blurry,
 * and the iOS webview shows only a low-res first page).
 */
export default function PdfView({ url, className }: { url: string; className?: string }) {
  const { t } = useLang();
  const holder = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        // iPhones showed Arabic PDFs as shuffled, unjoined letters: iOS
        // refuses some of the fonts pdf.js installs through the FontFace
        // API, and the fallback font cannot shape Arabic. disableFontFace
        // makes pdf.js draw the glyph outlines itself — slower, but it
        // owes nothing to the platform's font engine. Desktops keep the
        // fast path; the cMaps and base-14 fonts are served from our own
        // origin either way (see scripts/copy-pdf-assets.mjs).
        const iOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const docPdf = await pdfjs.getDocument({
          url,
          cMapUrl: '/pdf-assets/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdf-assets/standard_fonts/',
          disableFontFace: iOS,
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
  }, [url]);

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
