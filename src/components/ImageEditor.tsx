import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';
import { hasOriginalBackup, restoreOriginal } from '../lib/mediaStore';
import ImageTouchUp from './ImageTouchUp';

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
/**
 * Second route to the pixels: let the browser load the picture as an
 * ordinary image and copy it off a canvas.
 *
 * Some security extensions and antivirus web shields block a page's
 * download requests while still letting images render — which is exactly
 * how this failed on one PC but not the phone. An <img> load is a
 * different kind of request and usually sails past them.
 */
async function blobFromImageElement(url: string): Promise<Blob> {
  const img = new Image();
  // Needed to read the pixels back out; the bucket allows it.
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not load this image.'));
    img.src = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot edit images.');
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not read this image.'))),
      'image/png',
    ),
  );
}

export default function ImageEditor({
  getSource,
  sourceUrl,
  onCancel,
  onSave,
  restore,
}: {
  /** Fetches the original bytes (the caller knows how to reach Storage). */
  getSource: () => Promise<Blob>;
  /** The image's address, used as a fallback route when the download fails. */
  sourceUrl?: string;
  onCancel: () => void;
  /** Receives the edited image; the caller uploads and swaps it in. */
  onSave: (file: File) => Promise<void>;
  /**
   * Lets an edit be undone long after it was saved. Give the Storage path
   * of the picture; if an untouched copy was kept, a "Back to original"
   * button appears and `onRestored` gets the address it's at now.
   */
  restore?: { path: string; onRestored: (url: string) => void | Promise<void> };
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
  const localInput = useRef<HTMLInputElement>(null);
  const [touchUp, setTouchUp] = useState(false);
  const [touchUpSource, setTouchUpSource] = useState<Blob | null>(null);
  // Whether this picture has an untouched copy kept from an earlier edit.
  const [canRestore, setCanRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!restore) return;
    let cancelled = false;
    hasOriginalBackup(restore.path).then((yes) => {
      if (!cancelled) setCanRestore(yes);
    });
    return () => {
      cancelled = true;
    };
  }, [restore?.path]);

  async function handleRestore() {
    if (!restore) return;
    if (!confirm(t('Put the original photo back? Your edits to it will be lost.'))) return;
    setError('');
    setRestoring(true);
    try {
      const url = await restoreOriginal(restore.path);
      await restore.onRestored(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not put the original back.');
      setRestoring(false);
    }
  }

  /** Open the hand tools on the picture as it stands, crop included. */
  async function openTouchUp() {
    setError('');
    try {
      setTouchUpSource(await toBlob(draw(crop), true));
      setTouchUp(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the tools.');
    }
  }

  // Load the original into a local working copy.
  useEffect(() => {
    let url = '';
    let cancelled = false;
    getSource()
      // The download was refused — try loading it as a plain image instead.
      .catch((first) => {
        if (!sourceUrl) throw first;
        return blobFromImageElement(sourceUrl);
      })
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
        const friendly = raw.startsWith('SOURCE_UNREADABLE:') ? raw.slice(18).trim() : raw;
        // "Failed to fetch" means nothing to the person reading it.
        setError(
          /failed to fetch|networkerror|load failed/i.test(friendly)
            ? 'Could not download this image — it may come from another website, or a firewall or antivirus is blocking it. Pick the photo from this device instead.'
            : friendly,
        );
        setBusy(null);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fallback when the original can't be downloaded: edit a local copy. */
  function useLocalFile(file: File) {
    setError('');
    setWorkUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    setIsPng(file.type === 'image/png');
    setCrop(FULL);
    setDirty(true);
  }

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
            <div className="py-12 text-center">
              <p className="mx-auto max-w-sm text-sm text-slate-600">
                {error || t('Could not open the image.')}
              </p>
              <button
                type="button"
                onClick={() => localInput.current?.click()}
                className="btn-secondary mt-4"
              >
                📁 {t('Choose the photo from this device')}
              </button>
            </div>
          )}
          <input
            ref={localInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) useLocalFile(f);
            }}
          />

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
                <button
                  type="button"
                  onClick={openTouchUp}
                  disabled={working}
                  className="btn-secondary py-1.5 text-sm"
                >
                  ✏️ {t('Touch up')}
                </button>
                {cropped && (
                  <button type="button" onClick={() => setCrop(FULL)} disabled={working} className="btn-secondary py-1.5 text-sm">
                    {t('Reset crop')}
                  </button>
                )}
              </div>
            </>
          )}
          {/* Once something is loaded, errors sit under the toolbar. */}
          {error && workUrl && <p className="mt-3 text-center text-xs text-red-700">{error}</p>}
        </div>

        {touchUp && workUrl && touchUpSource && (
          <ImageTouchUp
            source={touchUpSource}
            onCancel={() => setTouchUp(false)}
            onApply={(blob) => {
              swapWork(blob);
              setTouchUp(false);
            }}
          />
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          {/* An edit is never final: the untouched photo is kept the first
              time one is saved, and this puts it back. */}
          {canRestore && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={working || restoring}
              className="me-auto rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              {restoring ? t('Putting it back…') : `↩ ${t('Back to original')}`}
            </button>
          )}
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
