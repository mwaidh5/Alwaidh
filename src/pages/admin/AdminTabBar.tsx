import { startTransition, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../../lib/i18n';
import { useAnyModalOpen } from '../../lib/useScrollLock';
import { useDrawerOpen } from '../../lib/drawer';
import type { NavItem } from './AdminMobileNav';

/**
 * The dashboard's bar on a phone: the same floating glass the shop uses,
 * carrying this person's four most-used pages and a More tab for the rest.
 *
 * The shop's bar used to stay under the dashboard — Home, Shop, Solar,
 * Account — none of which anyone in the dashboard wants, while the pages
 * they switch between all day sat behind a sheet at the top. Now the bar
 * changes with the room: in the dashboard it holds the dashboard.
 *
 * Which four depends on who is looking: an installer sees their jobs and
 * the team; a salesperson the inbox and the CRM; the owner the overview.
 * Whatever is waiting on a page shows as a count on its tab, and the
 * More tab carries the count of everything behind it.
 *
 * A portal to <body>, for the same reason the shop's bar sits outside
 * the page wrapper: inside it, `position: fixed` measures from the
 * transformed page and the bar ends up off-screen while the menu is open.
 */
export default function AdminTabBar({
  items,
  favorites,
  badge,
  onMore,
}: {
  items: NavItem[];
  /** Paths in order of preference; the first four this person can see are the tabs. */
  favorites: string[];
  badge: (to: string) => number;
  onMore: () => void;
}) {
  const { t, dir } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const modalOpen = useAnyModalOpen();
  const drawerOpen = useDrawerOpen();

  const tabs = favorites
    .map((to) => items.find((i) => i.to === to))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 4);
  const rest = items.filter((i) => !tabs.includes(i));
  const restWaiting = rest.reduce((n, i) => n + badge(i.to), 0);

  const routeIndex = tabs.findIndex((it) =>
    it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + '/'),
  );
  // Where the pill is: the tab just tapped, until the route catches up.
  const [pressed, setPressed] = useState<number | null>(null);
  useEffect(() => setPressed(null), [pathname]);
  const active = pressed ?? routeIndex;

  if (modalOpen) return null;

  const count = tabs.length + 1;
  const slot = 100 / count;
  const shift = active < 0 ? 0 : active * 100 * (dir === 'rtl' ? -1 : 1);

  const shape = (current: boolean) =>
    `relative z-10 flex flex-col items-center gap-0.5 whitespace-nowrap rounded-xl py-2 text-[11px] font-semibold transition-[color,transform] duration-200 active:scale-95 ${
      current ? 'text-brand-700' : 'text-slate-600'
    }`;

  const Badge = ({ n }: { n: number }) =>
    n > 0 ? (
      <span className="absolute -end-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
        {n > 9 ? '9+' : n}
      </span>
    ) : null;

  return createPortal(
    <nav
      className="bar-in fixed inset-x-0 bottom-0 z-40 px-3 pb-3 lg:hidden"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
        transform: drawerOpen ? 'translateY(130%) translateZ(0)' : 'translateY(0) translateZ(0)',
        transition: 'transform 500ms cubic-bezier(.32,.72,0,1)',
        willChange: 'transform',
      }}
      aria-hidden={drawerOpen || undefined}
      aria-label={t('Dashboard')}
    >
      <div className="liquid-glass relative mx-auto flex max-w-md items-stretch justify-around rounded-[1.5rem] p-1.5">
        <span
          aria-hidden
          className={`liquid-pill absolute inset-y-1.5 start-1.5 rounded-[1.1rem] ${
            active < 0 ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ width: `calc((100% - 0.75rem) / ${count})`, transform: `translateX(${shift}%)` }}
        />
        {tabs.map((item, i) => {
          const Icon = ICONS[item.to] ?? DotsIcon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={i === active ? 'page' : undefined}
              className={shape(i === active)}
              style={{ width: `${slot}%` }}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                setPressed(i);
                startTransition(() => navigate(item.to));
              }}
            >
              <span className="relative">
                <Icon />
                <Badge n={badge(item.to)} />
              </span>
              {t(item.short ?? item.label)}
            </Link>
          );
        })}
        <button type="button" onClick={onMore} className={shape(false)} style={{ width: `${slot}%` }}>
          <span className="relative">
            <DotsIcon />
            <Badge n={restWaiting} />
          </span>
          {t('More')}
        </button>
      </div>
    </nav>,
    document.body,
  );
}

/* Line icons, the same weight as the shop's bar — emoji are a different
   shape and colour on every phone. */
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

const OverviewIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </svg>
);
const JobsIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <path d="M14.5 6.5a4 4 0 0 0 5 5L9 22l-3-3L16.5 8.5" />
    <path d="M14.5 6.5 17 4l3 3-2.5 2.5" />
  </svg>
);
const ChatIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <path d="M20 12a7.5 7.5 0 0 1-7.8 7.5c-1 0-2-.2-2.9-.5L4 20.5l1.5-4.6A7.5 7.5 0 1 1 20 12Z" />
  </svg>
);
const CrmIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16c.5-1.5 1.7-2.2 3-2.2s2.5.7 3 2.2M14.5 10h3.5M14.5 13.5h3.5" />
  </svg>
);
const OrdersIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);
const ProductsIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="M12 12l8-4.5M12 12v9M12 12 4 7.5" />
  </svg>
);
const PricesIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </svg>
);
const TeamIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <path d="M14 15.5a6 6 0 0 0 5.5-5.7A6 6 0 0 0 8 8.3" />
    <path d="M4 20l1.2-3.5A5.5 5.5 0 1 1 7.5 19c-.8 0-1.6-.2-2.3-.5L4 20Z" />
  </svg>
);
const FilesIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </svg>
);
const DotsIcon = () => (
  <svg {...stroke} aria-hidden="true">
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

const ICONS: Record<string, () => JSX.Element> = {
  '/admin': OverviewIcon,
  '/admin/jobs': JobsIcon,
  '/admin/chat': ChatIcon,
  '/admin/crm': CrmIcon,
  '/admin/orders': OrdersIcon,
  '/admin/products': ProductsIcon,
  '/admin/prices': PricesIcon,
  '/admin/team': TeamIcon,
  '/admin/files': FilesIcon,
};
