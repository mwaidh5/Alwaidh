import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';
import { brandedFileUrl } from '../lib/brandedFiles';

/**
 * Renders a PDF as sharp page images sized to the container and the
 * device's pixel density (browsers' built-in PDF frames come out blurry,
 * and the iOS webview shows only a low-res first page).
 */
/** Phones get lighter pages: outline drawing is slower than handing
 *  fonts to the browser, and a phone has less to spend. */
function isPhone(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

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
        // The character maps and the base-14 fonts come from our own
        // origin (see scripts/copy-pdf-assets.mjs), so a file that leans
        // on either never depends on somebody else's CDN.
        //
        // The two flags are what make a page look the same everywhere.
        // useSystemFonts: false stops a font the PDF names but doesn't
        // embed from being filled in with whatever that computer has
        // installed. disableFontFace goes further: pdf.js stops handing
        // fonts to the browser at all and paints the letter shapes
        // itself, so nothing depends on the browser accepting them. Both
        // were reported broken by the owner on different machines — a
        // laptop with chopped English, an iPhone with unjoined Arabic —
        // while the same files rendered cleanly here. Drawing the
        // outlines ourselves is slower per page and immune to both.
        const docPdf = await pdfjs.getDocument({
          url,
          cMapUrl: '/pdf-assets/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdf-assets/standard_fonts/',
          useSystemFonts: false,
          disableFontFace: true,
        }).promise;
        if (cancelled || !holder.current) return;
        const el = holder.current;
        el.innerHTML = '';
        const width = el.clientWidth || 800;
        // Crisp without being wasteful — and gentler on a phone, which is
        // drawing every letter as an outline.
        const dpr = Math.min(window.devicePixelRatio || 1, isPhone() ? 1.5 : 2);
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
      {status === 'ready' && (
        <div className="p-3 text-center">
          <a
            href={brandedFileUrl(url)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            {t('Open the file')} ↗
          </a>
        </div>
      )}
    </div>
  );
}
