import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../lib/i18n';
import { useAnyModalOpen } from '../lib/useScrollLock';
import { openChat, useChatUnread } from '../lib/chatPanel';

/**
 * The phone's main navigation: a floating glass bar over the page, the way
 * a native app does it, instead of everything hiding behind a hamburger at
 * the top — the far corner of a screen you're holding one-handed.
 *
 * It floats rather than spanning the full width so the page stays visible
 * underneath and the bar reads as a control rather than a page edge, and it
 * clears the iPhone home indicator on its own: `position: fixed` ignores
 * the padding on <body>, so the safe area is added here.
 */
export default function BottomNav() {
  const { user, hasAdminAccess } = useAuth();
  const { t } = useLang();
  // A pop-up is a screen of its own: leaving the bar floating over it
  // makes the pop-up look like a card wedged between two bars, and puts
  // navigation under a thumb that is trying to close something.
  const modalOpen = useAnyModalOpen();
  const chatUnread = useChatUnread();

  // No Cart: it already sits in the header on every screen, with its count,
  // and five is where a bar of these stops being readable.
  //
  // The fourth slot goes to whoever is looking. Staff get the dashboard —
  // the thing they open every day, and they answer customers from its
  // inbox rather than this chat. Everyone else gets chat, which used to be
  // a bubble floating over the page.
  const items: Item[] = [
    { to: '/', end: true, label: 'Home', icon: HomeIcon },
    { to: '/shop', label: 'Shop', icon: ShopIcon },
    { to: '/solar-prices', label: 'Solar', icon: SunIcon },
    hasAdminAccess
      ? { to: '/admin', label: 'Dashboard', icon: GridIcon }
      : { onClick: openChat, label: 'Chat', icon: ChatIcon, badge: chatUnread },
    { to: user ? '/account' : '/login', label: user ? 'Account' : 'Sign in', icon: UserIcon },
  ];

  if (modalOpen) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 md:hidden"
      // translateZ pins the bar to its own compositor layer: without it,
      // WebKit repaints fixed elements a frame late during momentum
      // scrolling and the bar visibly drifts up before snapping back.
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
      aria-label={t('Main')}
    >
      <div className="relative mx-auto flex max-w-md items-stretch justify-around gap-1 overflow-hidden rounded-[1.35rem] border border-white/50 bg-white/60 p-1.5 shadow-[0_10px_36px_rgba(15,23,42,.22)] ring-1 ring-black/5 backdrop-blur-2xl backdrop-saturate-150">
        {/* the glass edge: a hairline of light along the top */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
        />
        {items.map((item) => {
          const { label, icon: Icon, badge } = item;
          const inside = (
            <>
              <span className="relative">
                <Icon />
                {!!badge && badge > 0 && (
                  <span className="absolute -end-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {t(label)}
            </>
          );
          const shape =
            'relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition';
          return 'to' in item ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `${shape} ${
                  isActive
                    ? 'bg-white/95 text-brand-700 shadow-[0_2px_10px_rgba(15,23,42,.14)]'
                    : 'text-slate-600 active:bg-white/60'
                }`
              }
            >
              {inside}
            </NavLink>
          ) : (
            <button
              key={label}
              type="button"
              onClick={item.onClick}
              className={`${shape} text-slate-600 active:bg-white/60`}
            >
              {inside}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** A tab is either somewhere to go or something to do. */
type Item = {
  label: string;
  icon: () => JSX.Element;
  badge?: number;
} & ({ to: string; end?: boolean } | { onClick: () => void });

/* Line icons rather than emoji: emoji are a different shape, weight and
   colour on every phone, which is exactly what a navigation bar shouldn't
   be. These inherit the link's colour. */
const stroke = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function HomeIcon() {
  return (
    <svg {...stroke} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg {...stroke} aria-hidden="true">
      <path d="M4 8h16l-1 12H5L4 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg {...stroke} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg {...stroke} aria-hidden="true">
      <path d="M20 12a7.5 7.5 0 0 1-7.8 7.5c-1 0-2-.2-2.9-.5L4 20.5l1.5-4.6A7.5 7.5 0 1 1 20 12Z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...stroke} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
    </svg>
  );
}
