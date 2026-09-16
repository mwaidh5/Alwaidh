import { startTransition, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../../lib/i18n';
import { useAnyModalOpen } from '../../lib/useScrollLock';
import { useDrawerOpen } from '../../lib/drawer';
import type { NavItem } from './AdminMobileNav';
import { AdminIcon, MoreIcon } from './adminIcons';

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
                <AdminIcon to={item.to} />
                <Badge n={badge(item.to)} />
              </span>
              {t(item.short ?? item.label)}
            </Link>
          );
        })}
        <button type="button" onClick={onMore} className={shape(false)} style={{ width: `${slot}%` }}>
          <span className="relative">
            <MoreIcon />
            <Badge n={restWaiting} />
          </span>
          {t('More')}
        </button>
      </div>
    </nav>,
    document.body,
  );
}
