import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLang } from '../lib/i18n';
import LangSwitch from './LangSwitch';
import { closeDrawer, useDrawerOpen } from '../lib/drawer';

/**
 * The phone menu, drawer-style: the whole page slides aside and shrinks
 * into a card, revealing this full-screen panel beneath it — the way the
 * good shopping apps do it, instead of a dropdown list under the header.
 *
 * This layer sits UNDER the page in the stacking order; the reveal is the
 * page moving, not the menu arriving. The page's own slide lives in
 * Layout, driven by the same store as the header's button.
 */
export default function MobileDrawer() {
  const open = useDrawerOpen();
  const { user, hasAdminAccess, isAdmin, signOut } = useAuth();
  const { itemCount } = useCart();
  const { t, dir } = useLang();
  const location = useLocation();

  // Going anywhere closes it, whichever link did the navigating.
  useEffect(() => {
    closeDrawer();
  }, [location.pathname]);

  // The page behind is a decorative card while the menu is up. The scroll
  // lock has to outlive the close by the length of the slide home: freeing
  // it immediately lets iOS scroll or rubber-band the page while it is
  // still translated, which shows as a sideways jump mid-animation.
  const unlockTimer = useRef(0);
  useEffect(() => {
    if (!open) return;
    window.clearTimeout(unlockTimer.current);
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unlockTimer.current = window.setTimeout(() => {
        document.body.style.overflow = '';
      }, 560);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: { to: string; label: string; icon: JSX.Element; badge?: number }[] = [
    { to: '/', label: 'Home', icon: <HomeIcon /> },
    { to: '/shop', label: 'Shop', icon: <ShopIcon /> },
    { to: '/solar-prices', label: 'Solar Prices', icon: <SunIcon /> },
    { to: '/blog', label: 'Articles', icon: <span className="text-base">📝</span> },
    { to: '/cart', label: 'Cart', icon: <CartIcon />, badge: itemCount },
    ...(hasAdminAccess
      ? [{ to: '/admin', label: isAdmin ? 'Admin' : 'Dashboard', icon: <GridIcon /> }]
      : []),
    { to: '/about', label: 'About', icon: <InfoIcon /> },
    { to: '/privacy', label: 'Privacy', icon: <ShieldIcon /> },
  ];

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-30 bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700 transition-opacity duration-300 md:hidden ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* a soft glow so the flat gradient has some life */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(340px 260px at 18% 12%, rgba(96,165,250,.25), transparent 65%), radial-gradient(300px 240px at 70% 95%, rgba(251,191,36,.14), transparent 60%)',
        }}
      />

      <div
        className="relative flex h-full w-[74%] max-w-xs flex-col px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-base font-bold text-white ring-1 ring-inset ring-white/20">
            {(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}
          </span>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label={t('Close')}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/20"
          >
            ✕
          </button>
        </div>

        <nav className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
          {items.map((item, i) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] font-semibold text-white/90 transition-all duration-300 active:bg-white/10 ${
                open ? 'translate-x-0 opacity-100' : `${dir === 'rtl' ? 'translate-x-4' : '-translate-x-4'} opacity-0`
              }`}
              style={{ transitionDelay: open ? `${120 + i * 45}ms` : '0ms' }}
            >
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-white/10 text-white/90">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
              {!!item.badge && item.badge > 0 && (
                <span className="grid h-5 min-w-5 flex-none place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-slate-900">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div
          className={`flex flex-col gap-2 border-t border-white/15 pt-4 transition-all duration-300 ${
            open ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
          }`}
          style={{ transitionDelay: open ? '380ms' : '0ms' }}
        >
          <Link
            to={user ? '/account' : '/login'}
            className="flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] font-semibold text-white/90 active:bg-white/10"
          >
            <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-white/10">
              <UserIcon />
            </span>
            {t(user ? 'My account' : 'Sign in')}
          </Link>
          <div className="flex items-center gap-2 px-3">
            <LangSwitch frosted />
            {user && (
              <button
                type="button"
                onClick={() => {
                  closeDrawer();
                  signOut();
                }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white/70"
              >
                {t('Sign out')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const stroke = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
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
function InfoIcon() {
  return (
    <svg {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.2" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg {...stroke} aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z" />
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
