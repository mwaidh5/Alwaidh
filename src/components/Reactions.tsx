import { useState } from 'react';
import { auth } from '../firebase';
import { useStaffName } from '../lib/staffDirectory';

/** The short row everyone actually uses; anything fancier is noise. */
const QUICK = ['👍', '❤️', '😂', '😮', '✅', '🙏'];

/**
 * WhatsApp-style reactions: one per person, tap to swap, tap your own to
 * take it back. Chips group by emoji and name the reactors on hover; the
 * little + opens the picker. `dark` restyles for the sender's brand-blue
 * bubbles in team chat.
 */
export default function Reactions({
  reactions,
  onToggle,
  dark = false,
}: {
  reactions: Record<string, string>;
  onToggle: (emoji: string | null) => void;
  dark?: boolean;
}) {
  const me = auth?.currentUser?.email?.toLowerCase() ?? '';
  const staffName = useStaffName();
  const [open, setOpen] = useState(false);
  const mine = reactions[me] ?? null;

  const groups = new Map<string, string[]>();
  for (const [email, emoji] of Object.entries(reactions)) {
    groups.set(emoji, [...(groups.get(emoji) ?? []), email]);
  }

  function pick(emoji: string) {
    onToggle(mine === emoji ? null : emoji);
    setOpen(false);
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {[...groups.entries()].map(([emoji, people]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => pick(emoji)}
          title={people.map((p) => staffName(p)).join('، ')}
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-semibold transition ${
            people.includes(me)
              ? 'border-brand-400 bg-brand-50 text-brand-800'
              : dark
                ? 'border-white/30 bg-white/15 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span className="text-sm leading-none">{emoji}</span>
          {people.length > 1 && people.length}
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="React"
          className={`grid h-6 w-6 place-items-center rounded-full border text-xs leading-none transition ${
            dark
              ? 'border-white/30 text-white/70 hover:bg-white/15'
              : 'border-slate-200 text-slate-400 hover:bg-slate-50'
          }`}
        >
          {open ? '✕' : '+'}
        </button>
        {open && (
          <div className="absolute bottom-full start-0 z-20 mb-1 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
            {QUICK.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pick(e)}
                className={`text-lg leading-none transition hover:scale-125 ${
                  mine === e ? 'rounded-full bg-brand-100' : ''
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
