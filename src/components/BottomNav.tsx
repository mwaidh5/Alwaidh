import { NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../lib/i18n';

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
  const { itemCount } = useCart();
  const { user } = useAuth();
  const { t } = useLang();

  const items = [
    { to: '/', end: true, label: 'Home', icon: HomeIcon },
    { to: '/shop', label: 'Shop', icon: ShopIcon },
    { to: '/solar-prices', label: 'Solar', icon: SunIcon },
    { to: '/cart', label: 'Cart', icon: CartIcon, badge: itemCount },
    { to: user ? '/account' : '/login', label: user ? 'Account' : 'Sign in', icon: UserIcon },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      aria-label={t('Main')}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around gap-1 rounded-2xl border border-white/60 bg-white/80 p-1.5 shadow-[0_8px_30px_rgba(15,23,42,.18)] backdrop-blur-xl">
        {items.map(({ to, end, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold transition ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 active:bg-slate-100'
              }`
            }
          >
            <span className="relative">
              <Icon />
              {!!badge && badge > 0 && (
                <span className="absolute -end-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            {t(label)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

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

function CartIcon() {
  return (
    <svg {...stroke} aria-hidden="true">
      <path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h6.7a2 2 0 0 0 2-1.5L20 7H6" />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
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
