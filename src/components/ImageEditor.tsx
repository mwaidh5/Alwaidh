import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';

/** Normalized crop rectangle: 0..1 of the working image, so it survives
 *  rotation and window resizes without recalculating pixels. */
interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };
const MIN_SIZE = 0.05; // a crop can't collapse below 5% of the image

type DragMode =
  | { kind: 'move'; startX: number; startY: number; rect: CropRect }
  | { kind: 'resize'; corner: 'nw' | 'ne' | 'sw' | 'se' };

/**
 * A small image editor: crop by dragging, rotate in quarter turns, and cut
 * the background out — all on a working copy. Nothing touches the product
 * until Save, which hands the finished bytes back to the caller.
 */
export default function ImageEditor({
  getSource,
  onCancel,
  onSave,
}: {
  /** Fetches the original bytes (the caller knows how to reach Storage). */
  getSource: () => Promise<Blob>;
  onCancel: () => void;
  /** Receives the edited image; the caller uploads and swaps it in. */
  onSave: (file: File) => Promise<void>;
}) {
  const { t } = useLang();
  const [workUrl, setWorkUrl] = useState('');
  // PNG survives transparency (needed after background removal); everything
  // else exports as JPEG so a phone photo doesn't balloon.
  const [isPng, setIsPng] = useState(false);
  const [crop, setCrop] = useState<CropRect>(FULL);
  const [busy, setBusy] = useState<'loading' | 'bg' | 'saving' | null>('loading');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragMode | null>(null);

  // Load the original into a local working copy.
  useEffect(() => {
    let url = '';
    let cancelled = false;
    getSource()
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setIsPng(blob.type === 'image/png');
        setWorkUrl(url);
        setBusy(null);
      })
      .catch((e) => {
        if (cancelled) return;
        const raw = e instanceof Error ? e.message : 'Could not open the image.';
        setError(raw.startsWith('SOURCE_UNREADABLE:') ? raw.slice(18).trim() : raw);
        setBusy(null);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function swapWork(blob: Blob) {
    setWorkUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
    setIsPng(blob.type === 'image/png');
    setCrop(FULL);
    setDirty(true);
  }

  /** Draw the current working image (optionally cropped) onto a canvas. */
  function draw(cropTo: CropRect): HTMLCanvasElement {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) throw new Error('The image is not ready yet.');
    const sx = Math.round(cropTo.x * img.naturalWidth);
    const sy = Math.round(cropTo.y * img.naturalHeight);
    const sw = Math.max(1, Math.round(cropTo.w * img.naturalWidth));
    const sh = Math.max(1, Math.round(cropTo.h * img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot edit images.');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas;
  }

  function toBlob(canvas: HTMLCanvasElement, png: boolean): Promise<Blob> {
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not export the image.'))),
        png ? 'image/png' : 'image/jpeg',
        0.92,
      ),
    );
  }

  async function rotate(clockwise: boolean) {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    setError('');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(((clockwise ? 90 : -90) * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    swapWork(await toBlob(canvas, isPng));
  }

  /** Apply the pending crop to the working copy (so rotate/bg act on it). */
  async function applyCrop() {
    if (crop === FULL || (crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1)) return;
    setError('');
    swapWork(await toBlob(draw(crop), isPng));
  }

  async function removeBg() {
    setError('');
    setBusy('bg');
    try {
      // Work on what's shown, crop included.
      const current = await toBlob(draw(crop), isPng);
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(current, {
        publicPath: `${window.location.origin}/imgly-data/`,
        model: 'small',
      });
      swapWork(blob);
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Background removal failed.';
      setError(
        /load failed|failed to fetch|network|fetching of the wasm/i.test(raw)
          ? t(
              'Background removal could not load its AI model. Check your internet connection and try again.',
            )
          : /memory|aborted/i.test(raw)
            ? t('This device ran out of memory running the AI. Try on a computer instead.')
            : raw,
      );
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setError('');
    setBusy('saving');
    try {
      const blob = await toBlob(draw(crop), isPng);
      const file = new File([blob], isPng ? 'edited.png' : 'edited.jpg', { type: blob.type });
      await onSave(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setBusy(null);
    }
  }

  // ---- crop drag handling (mouse + touch via pointer events) ----

  function clientToNorm(clientX: number, clientY: number) {
    const box = imgRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (clientY - box.top) / box.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = clientToNorm(e.clientX, e.clientY);
    drag.current =
      mode === 'move'
        ? { kind: 'move', startX: p.x, startY: p.y, rect: crop }
        : { kind: 'resize', corner: mode };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const p = clientToNorm(e.clientX, e.clientY);
    if (d.kind === 'move') {
      const nx = Math.min(1 - d.rect.w, Math.max(0, d.rect.x + (p.x - d.startX)));
      const ny = Math.min(1 - d.rect.h, Math.max(0, d.rect.y + (p.y - d.startY)));
      setCrop({ ...d.rect, x: nx, y: ny });
      return;
    }
    setCrop((c) => {
      // Opposite corner stays pinned; the dragged one follows the pointer.
      const right = c.x + c.w;
      const bottom = c.y + c.h;
      let { x, y } = c;
      let r = right;
      let b = bottom;
      if (d.corner === 'nw') {
        x = Math.min(p.x, right - MIN_SIZE);
        y = Math.min(p.y, bottom - MIN_SIZE);
      } else if (d.corner === 'ne') {
        r = Math.max(p.x, c.x + MIN_SIZE);
        y = Math.min(p.y, bottom - MIN_SIZE);
      } else if (d.corner === 'sw') {
        x = Math.min(p.x, right - MIN_SIZE);
        b = Math.max(p.y, c.y + MIN_SIZE);
      } else {
        r = Math.max(p.x, c.x + MIN_SIZE);
        b = Math.max(p.y, c.y + MIN_SIZE);
      }
      return { x, y, w: r - x, h: b - y };
    });
  }

  function onPointerUp() {
    drag.current = null;
  }

  const cropped = crop.x > 0 || crop.y > 0 || crop.w < 1 || crop.h < 1;
  const working = busy !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      onClick={busy === 'loading' ? undefined : onCancel}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">🖼️ {t('Edit image')}</h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {busy === 'loading' ? (
            <p className="py-16 text-center text-sm text-slate-500">{t('Loading…')}</p>
          ) : workUrl ? (
            <div
              ref={frameRef}
              className="relative mx-auto w-fit touch-none select-none"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* checkerboard so transparency is visible after bg removal */}
              <img
                ref={imgRef}
                src={workUrl}
                alt=""
                draggable={false}
                className="max-h-[48vh] w-auto max-w-full rounded-md [background:repeating-conic-gradient(#e2e8f0_0%_25%,#f8fafc_0%_50%)_0_0/16px_16px]"
              />
              {/* dimmed outside the crop */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  boxShadow: '0 0 0 9999px transparent',
                  background: `linear-gradient(rgba(15,23,42,.5),rgba(15,23,42,.5))`,
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${crop.y * 100}%, ${crop.x * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${crop.y * 100}%, 0 ${crop.y * 100}%)`,
                }}
              />
              {/* the crop rectangle itself */}
              <div
                className="absolute cursor-move border-2 border-white/90 shadow-[0_0_0_1px_rgba(15,23,42,.6)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
                onPointerDown={(e) => onPointerDown(e, 'move')}
              >
                {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                  <span
                    key={corner}
                    onPointerDown={(e) => onPointerDown(e, corner)}
                    className={`absolute h-5 w-5 rounded-full border-2 border-white bg-brand-600 shadow ${
                      corner === 'nw'
                        ? '-left-2.5 -top-2.5 cursor-nwse-resize'
                        : corner === 'ne'
                          ? '-right-2.5 -top-2.5 cursor-nesw-resize'
                          : corner === 'sw'
                            ? '-bottom-2.5 -left-2.5 cursor-nesw-resize'
                            : '-bottom-2.5 -right-2.5 cursor-nwse-resize'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">{t('Could not open the image.')}</p>
          )}

          {workUrl && (
            <>
              <p className="mt-3 text-center text-xs text-slate-500">
                {t('Drag the corners to crop. The rest is dimmed and will be cut away.')}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => rotate(false)} disabled={working} className="btn-secondary py-1.5 text-sm">
                  ↺ {t('Rotate left')}
                </button>
                <button type="button" onClick={() => rotate(true)} disabled={working} className="btn-secondary py-1.5 text-sm">
                  ↻ {t('Rotate right')}
                </button>
                <button type="button" onClick={applyCrop} disabled={working || !cropped} className="btn-secondary py-1.5 text-sm">
                  ✂️ {t('Apply crop')}
                </button>
                <button type="button" onClick={removeBg} disabled={working} className="btn-secondary py-1.5 text-sm">
                  {busy === 'bg' ? t('Removing…') : `✨ ${t('Remove background')}`}
                </button>
                {cropped && (
                  <button type="button" onClick={() => setCrop(FULL)} disabled={working} className="btn-secondary py-1.5 text-sm">
                    {t('Reset crop')}
                  </button>
                )}
              </div>
            </>
          )}
          {error && <p className="mt-3 text-center text-xs text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onCancel} disabled={busy === 'saving'} className="btn-secondary">
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={working || !workUrl || (!dirty && !cropped)}
            className="btn-primary"
          >
            {busy === 'saving' ? t('Saving…') : t('Save image')}
          </button>
        </div>
      </div>
    </div>
  );
}
