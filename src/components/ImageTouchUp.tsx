import { useEffect, useRef, useState } from 'react';
import { buildEdgeMap, snapToEdge, type Point } from '../lib/edgeSnap';
import { useLang } from '../lib/i18n';

type Tool = 'erase' | 'restore' | 'lasso' | 'magnet' | 'wand';

/** How many steps back Undo can go. Snapshots are full frames, so this is
 *  a memory/usefulness trade rather than a technical limit. */
const HISTORY = 12;

/**
 * Hand tools for cleaning up a photo: rub parts away, paint them back,
 * draw around something to cut it out, or click a colour to drop it.
 *
 * Everything happens on a canvas at the picture's real size; what's on
 * screen is only a scaled view, so quality never depends on the window.
 */
export default function ImageTouchUp({
  source,
  onCancel,
  onApply,
}: {
  source: Blob;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}) {
  const { t } = useLang();
  const [tool, setTool] = useState<Tool>('erase');
  const [brush, setBrush] = useState(40);
  const [tolerance, setTolerance] = useState(32);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canUndo, setCanUndo] = useState(false);

  // The picture being edited, at full size, plus an untouched copy so the
  // restore brush has something to paint back from.
  const workRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const originalRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const viewRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const drawing = useRef(false);
  const lasso = useRef<Point[]>([]);
  const lastPoint = useRef<Point | null>(null);
  const [hasLoop, setHasLoop] = useState(false);
  /** Where the colours change sharply — how the magnetic lasso finds an
   *  edge. Built from the picture as it stands, and thrown away whenever
   *  the picture changes. */
  const edges = useRef<Float32Array | null>(null);

  /** Both loop tools behave the same; only the snapping differs. */
  const isLoopTool = tool === 'lasso' || tool === 'magnet';

  /** Paint the working canvas into the visible one, plus any live lasso. */
  function repaint() {
    const view = viewRef.current;
    const work = workRef.current;
    if (!view) return;
    view.width = work.width;
    view.height = work.height;
    const ctx = view.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(work, 0, 0);
    const path = lasso.current;
    if (path.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = Math.max(2, work.width / 400);
      ctx.setLineDash([ctx.lineWidth * 4, ctx.lineWidth * 3]);
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  useEffect(() => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => {
      for (const canvas of [workRef.current, originalRef.current]) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
      }
      setReady(true);
      repaint();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError(t('Could not open the image.'));
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Remember the current frame so it can be undone. */
  function snapshot() {
    const work = workRef.current;
    const ctx = work.getContext('2d');
    if (!ctx) return;
    history.current.push(ctx.getImageData(0, 0, work.width, work.height));
    if (history.current.length > HISTORY) history.current.shift();
    // The picture is about to change, so any edge map is now out of date.
    edges.current = null;
    setCanUndo(true);
  }

  function undo() {
    const previous = history.current.pop();
    if (!previous) return;
    workRef.current.getContext('2d')?.putImageData(previous, 0, 0);
    edges.current = null;
    setCanUndo(history.current.length > 0);
    repaint();
  }

  /** Screen position → a pixel in the full-size picture. */
  function toImage(e: React.PointerEvent): Point {
    const view = viewRef.current;
    if (!view) return { x: 0, y: 0 };
    const box = view.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * view.width,
      y: ((e.clientY - box.top) / box.height) * view.height,
    };
  }

  /** Rub out, or paint back, along the stroke. */
  function paint(from: Point, to: Point) {
    const ctx = workRef.current.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush;
    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else {
      // Restore: clip to the stroke and redraw that part of the original.
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke = ctx.stroke;
      ctx.lineWidth = brush;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.beginPath();
      ctx.arc(to.x, to.y, brush / 2, 0, Math.PI * 2);
      ctx.arc(from.x, from.y, brush / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(originalRef.current, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    repaint();
  }

  /**
   * Magic wand: from the clicked pixel, spread out over neighbours of a
   * similar colour and clear them. Tolerance decides how similar counts.
   */
  function wandAt(point: Point) {
    const work = workRef.current;
    const ctx = work.getContext('2d');
    if (!ctx) return;
    const { width, height } = work;
    const x0 = Math.floor(point.x);
    const y0 = Math.floor(point.y);
    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;

    const frame = ctx.getImageData(0, 0, width, height);
    const px = frame.data;
    const at = (x: number, y: number) => (y * width + x) * 4;
    const seed = at(x0, y0);
    const [sr, sg, sb, sa] = [px[seed], px[seed + 1], px[seed + 2], px[seed + 3]];
    // Compare on the same scale the slider implies, so 0 means exact match.
    const limit = tolerance * 4;

    const seen = new Uint8Array(width * height);
    const queue = [x0, y0];
    while (queue.length) {
      const y = queue.pop() as number;
      const x = queue.pop() as number;
      const flat = y * width + x;
      if (seen[flat]) continue;
      seen[flat] = 1;
      const i = flat * 4;
      if (px[i + 3] === 0 && sa === 0) continue;
      const diff =
        Math.abs(px[i] - sr) +
        Math.abs(px[i + 1] - sg) +
        Math.abs(px[i + 2] - sb) +
        Math.abs(px[i + 3] - sa);
      if (diff > limit) continue;
      px[i + 3] = 0; // clear it
      if (x > 0) queue.push(x - 1, y);
      if (x < width - 1) queue.push(x + 1, y);
      if (y > 0) queue.push(x, y - 1);
      if (y < height - 1) queue.push(x, y + 1);
    }
    ctx.putImageData(frame, 0, 0);
    repaint();
  }

  /** Read the edges of the picture as it stands. */
  function buildEdges(): Float32Array | null {
    const work = workRef.current;
    const ctx = work.getContext('2d');
    if (!ctx || !work.width || !work.height) return null;
    return buildEdgeMap(ctx.getImageData(0, 0, work.width, work.height).data, work.width, work.height);
  }

  /** Pull a point onto the nearest edge, if there is one worth having. */
  function snap(point: Point): Point {
    const map = edges.current;
    if (!map) return point;
    const { width, height } = workRef.current;
    return snapToEdge(map, width, height, point);
  }

  /** Finish a lasso: clear what's inside it, or everything outside. */
  function applyLasso(keepInside: boolean) {
    const path = lasso.current;
    lasso.current = [];
    setHasLoop(false);
    if (path.length < 3) {
      repaint();
      return;
    }
    const ctx = workRef.current.getContext('2d');
    if (!ctx) return;
    snapshot();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (const p of path.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    if (keepInside) {
      // Everything outside the loop goes.
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = '#000';
      ctx.fill();
    } else {
      ctx.clip();
      ctx.clearRect(0, 0, workRef.current.width, workRef.current.height);
    }
    ctx.restore();
    repaint();
  }

  function onDown(e: React.PointerEvent) {
    if (!ready) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const point = toImage(e);
    if (tool === 'wand') {
      snapshot();
      wandAt(point);
      return;
    }
    drawing.current = true;
    if (isLoopTool) {
      if (tool === 'magnet') {
        // Read the edges once, here, so the drag itself stays smooth.
        if (!edges.current) edges.current = buildEdges();
        lasso.current = [snap(point)];
      } else {
        lasso.current = [point];
      }
      setHasLoop(false);
      return;
    }
    snapshot();
    lastPoint.current = point;
    paint(point, point);
  }

  function onMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const point = toImage(e);
    if (isLoopTool) {
      lasso.current.push(tool === 'magnet' ? snap(point) : point);
      repaint();
      return;
    }
    paint(lastPoint.current ?? point, point);
    lastPoint.current = point;
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    // A closed lasso is only a selection until it's acted on — the buttons
    // under the picture decide what happens to it.
    if (isLoopTool) {
      setHasLoop(lasso.current.length > 2);
      repaint();
    }
  }

  async function apply() {
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        // Always PNG: erased areas are transparent, which JPEG can't hold.
        workRef.current.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('Could not save the image.');
      onApply(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the image.');
      setBusy(false);
    }
  }

  const tools: { key: Tool; icon: string; label: string }[] = [
    { key: 'erase', icon: '🧽', label: 'Rub out' },
    { key: 'restore', icon: '↩️', label: 'Bring back' },
    { key: 'lasso', icon: '➰', label: 'Draw around' },
    { key: 'magnet', icon: '🧲', label: 'Snap to edges' },
    { key: 'wand', icon: '✨', label: 'Click a colour' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-4">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">✏️ {t('Touch up')}</h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>

        {/* Tools */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          {tools.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                lasso.current = [];
                setHasLoop(false);
                setTool(item.key);
                repaint();
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tool === item.key
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.icon} {t(item.label)}
            </button>
          ))}
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="ms-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            ↶ {t('Undo')}
          </button>
        </div>

        {/* Settings for the chosen tool */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-5 py-2.5 text-xs text-slate-600">
          {(tool === 'erase' || tool === 'restore') && (
            <label className="flex items-center gap-2">
              <span className="font-semibold">{t('Brush size')}</span>
              <input
                type="range"
                min={8}
                max={200}
                value={brush}
                onChange={(e) => setBrush(Number(e.target.value))}
              />
              <span className="w-8">{brush}</span>
            </label>
          )}
          {tool === 'wand' && (
            <label className="flex items-center gap-2">
              <span className="font-semibold">{t('How similar')}</span>
              <input
                type="range"
                min={2}
                max={120}
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
              />
              <span className="w-8">{tolerance}</span>
            </label>
          )}
          {isLoopTool && hasLoop && (
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyLasso(false)}
                className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white"
              >
                {t('Delete inside')}
              </button>
              <button
                type="button"
                onClick={() => applyLasso(true)}
                className="rounded-md bg-brand-600 px-2.5 py-1 font-semibold text-white"
              >
                {t('Keep only this')}
              </button>
            </span>
          )}
          <span className="ms-auto text-slate-400">
            {tool === 'erase' && t('Drag over what you want gone.')}
            {tool === 'restore' && t('Drag to paint the picture back.')}
            {tool === 'lasso' && t('Draw a loop, then choose what happens to it.')}
            {tool === 'magnet' && t('Trace around the edge — the line sticks to it as you go.')}
            {tool === 'wand' && t('Click a colour to drop it — the slider widens the match.')}
          </span>
        </div>

        {/* The picture. Checks show through wherever it's transparent. */}
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
          {error ? (
            <p className="py-10 text-center text-sm text-red-700">{error}</p>
          ) : (
            <canvas
              ref={viewRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="mx-auto max-h-[52vh] w-auto max-w-full cursor-crosshair touch-none rounded-lg [background:repeating-conic-gradient(#e2e8f0_0%_25%,#f8fafc_0%_50%)_0_0/16px_16px]"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
            {t('Cancel')}
          </button>
          <button type="button" onClick={apply} className="btn-primary" disabled={busy || !ready}>
            {busy ? t('Saving…') : t('Done')}
          </button>
        </div>
      </div>
    </div>
  );
}
