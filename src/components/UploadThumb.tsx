/**
 * A file on its way up: the preview, a ring that fills as the bytes go,
 * a spinner while the phone is still shrinking the photo, and a tick
 * when it has landed. Shared by the CRM notes and the job comments so
 * an upload looks the same everywhere.
 */
export type UploadPhase = 'waiting' | 'preparing' | 'uploading' | 'done' | 'failed';

export default function UploadThumb({
  src,
  name,
  kind = 'image',
  phase = 'waiting',
  percent = 0,
  onRemove,
}: {
  src?: string;
  name?: string;
  kind?: 'image' | 'pdf';
  phase?: UploadPhase;
  percent?: number;
  onRemove?: () => void;
}) {
  const busy = phase === 'preparing' || phase === 'uploading';
  const r = 14;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, percent));
  return (
    <span
      title={name}
      className={`relative block h-16 w-16 overflow-hidden rounded-lg bg-slate-100 ring-1 ${
        phase === 'failed' ? 'ring-red-400' : phase === 'done' ? 'ring-green-400' : 'ring-slate-200'
      }`}
    >
      {kind === 'image' && src ? (
        <img
          src={src}
          alt=""
          className={`h-full w-full object-cover transition duration-300 ${busy ? 'scale-105 opacity-60 blur-[1px]' : ''}`}
        />
      ) : (
        <span className="grid h-full w-full place-items-center text-2xl">📄</span>
      )}

      {busy && (
        <span className="absolute inset-0 grid place-items-center bg-slate-900/35">
          <svg viewBox="0 0 36 36" className={`h-9 w-9 ${phase === 'preparing' ? 'animate-spin' : ''}`}>
            <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3.5" />
            <circle
              cx="18"
              cy="18"
              r={r}
              fill="none"
              stroke="#fff"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={phase === 'preparing' ? c * 0.72 : c * (1 - shown / 100)}
              transform="rotate(-90 18 18)"
              style={{ transition: 'stroke-dashoffset 250ms ease-out' }}
            />
          </svg>
          {phase === 'uploading' && (
            <span className="absolute bottom-1 inset-x-0 text-center text-[10px] font-black text-white drop-shadow">
              {Math.round(shown)}%
            </span>
          )}
        </span>
      )}

      {phase === 'done' && (
        <span className="absolute inset-0 grid place-items-center bg-green-500/25">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-green-500 text-sm font-black text-white shadow">✓</span>
        </span>
      )}
      {phase === 'failed' && (
        <span className="absolute inset-0 grid place-items-center bg-red-500/25 text-lg">⚠️</span>
      )}

      {onRemove && !busy && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="remove"
          className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-slate-900/70 text-[11px] text-white"
        >
          ✕
        </button>
      )}
    </span>
  );
}
