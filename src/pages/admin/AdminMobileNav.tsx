import { useState, type CSSProperties } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useLang } from '../../lib/i18n';
import { useScrollLock } from '../../lib/useScrollLock';
import type { AlertKey, StaffAlerts } from '../../lib/useStaffAlerts';
import { AdminIcon } from './adminIcons';
import AdminTabBar from './AdminTabBar';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  /** Which heading it sits under in the phone menu. */
  group: string;
  /** A one-word version for the bar, where the full label would wrap. */
  short?: string;
}

/** The order sections appear in; anything else falls to the end. */
const GROUP_ORDER = ['Work', 'Shop', 'Solar', 'Team', 'Manage'];

/**
 * The dashboard's navigation on a phone.
 *
 * A dozen pages behind a "Menu" dropdown meant a scroll and a guess every
 * time. This is the shape phone apps settled on instead: a compact bar
 * that says where you are, and a sheet of grouped sections when you want
 * to be somewhere else — related pages together, each group foldable, and
 * whatever is waiting for you shown as a count on the way in.
 */
export default function AdminMobileNav({
  items,
  favorites,
  alerts,
  alertFor,
  storeName,
  email,
  onNotifications,
  onLanguage,
  onSignOut,
  language,
}: {
  items: NavItem[];
  /** This person's tabs, most wanted first — see AdminTabBar. */
  favorites: string[];
  alerts: StaffAlerts;
  alertFor: Record<string, AlertKey>;
  storeName: string;
  email: string | null;
  onNotifications: () => void;
  onLanguage: () => void;
  onSignOut: () => void;
  language: string;
}) {
  const [open, setOpen] = useState(false);

  const badge = (to: string) => {
    const key = alertFor[to];
    return key ? alerts[key] : 0;
  };

  // The bar at the bottom is the navigation now; the sheet is what its
  // More tab opens — every page, grouped, plus the account actions.
  return (
    <div className="lg:hidden">
      <AdminTabBar items={items} favorites={favorites} badge={badge} onMore={() => setOpen(true)} />

      {open && (
        <Sheet
          items={items}
          badge={badge}
          storeName={storeName}
          email={email}
          language={language}
          onClose={() => setOpen(false)}
          onNotifications={onNotifications}
          onLanguage={onLanguage}
          onSignOut={onSignOut}
        />
      )}
    </div>
  );
}

function Sheet({
  items,
  badge,
  storeName,
  email,
  language,
  onClose,
  onNotifications,
  onLanguage,
  onSignOut,
}: {
  items: NavItem[];
  badge: (to: string) => number;
  storeName: string;
  email: string | null;
  language: string;
  onClose: () => void;
  onNotifications: () => void;
  onLanguage: () => void;
  onSignOut: () => void;
}) {
  useScrollLock();
  const { t, dir } = useLang();
  const rtl = dir === 'rtl';

  const groups = [...new Set(items.map((i) => i.group))].sort(
    (a, b) =>
      (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99) ||
      a.localeCompare(b),
  );

  // The white tab's two curved shoulders, where it meets the page: a
  // clear square whose shadow paints the concave corner. The shadow has
  // to fall towards the tab, so its x flips with the reading direction.
  const shoulder = (where: 'top' | 'bottom') => ({
    position: 'absolute' as const,
    insetInlineEnd: 0,
    [where]: '-0.75rem',
    width: '0.75rem',
    height: '0.75rem',
    background: 'transparent',
    borderEndEndRadius: where === 'top' ? '0.75rem' : undefined,
    borderStartEndRadius: where === 'bottom' ? '0.75rem' : undefined,
    boxShadow: `${rtl ? '-' : ''}0.4rem ${where === 'top' ? '' : '-'}0.4rem 0 0.4rem #fff`,
  });

  const pill =
    'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold text-white/90 transition active:bg-white/20';

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-slate-900/30" onClick={onClose}>
      {/* The rail: a card of deep purple on the reading edge, the page
          still visible beside it; the current row is a white tab that
          runs out over the edge onto the page. */}
      <div
        className="rail-in absolute inset-y-0 start-0 flex max-w-[86vw]"
        style={{ '--rail-from': rtl ? '100%' : '-100%' } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          // 17rem of purple plus a 1rem clear gutter on the page side: the
          // gradient is its own layer under the first 17rem, and the
          // current row's white tab runs out into the gutter — inside the
          // scroll box, so it is never clipped and the list cannot be
          // dragged sideways.
          className="relative flex w-[18rem] flex-col text-white"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 start-0 w-[17rem] rounded-e-[1.75rem] shadow-2xl"
            style={{
              background:
                'radial-gradient(120% 60% at 100% 0%, rgba(255,255,255,0.14), transparent 55%), linear-gradient(180deg, var(--hp-dark) 0%, var(--hp-ink) 100%)',
            }}
          />
          <div className="relative flex items-center gap-3 pb-3 pe-8 ps-4 pt-5">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/15 text-base font-bold ring-1 ring-white/25">
              {(storeName || 'A').charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{storeName}</span>
              <span className="block truncate text-[11px] text-white/60">{t('Dashboard')}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('Close')}
              className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/15 text-white/90 ring-1 ring-white/20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={rtl ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} />
              </svg>
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-2 pe-4 ps-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groups.map((group) => (
              <section key={group} className="mb-1">
                <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
                  {t(group)}
                </p>
                <ul className="space-y-1">
                  {items
                    .filter((i) => i.group === group)
                    .map((item) => {
                      const count = badge(item.to);
                      return (
                        <li key={item.to}>
                          <NavLink to={item.to} end={item.end} onClick={onClose}>
                            {({ isActive }) =>
                              isActive ? (
                                // The current page: a white tab that runs off the
                                // rail into the page, shoulders and all.
                                <span className="relative z-10 -me-4 flex items-center gap-3 rounded-s-2xl bg-white py-2.5 pe-6 ps-3 text-[15px] font-bold shadow-[0_6px_18px_rgba(15,23,42,0.18)]" style={{ color: 'var(--hp-ink)' }}>
                                  <span aria-hidden style={shoulder('top')} />
                                  <span aria-hidden style={shoulder('bottom')} />
                                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full" style={{ background: 'var(--hp-50)', color: 'var(--hp)' }}>
                                    <AdminIcon to={item.to} size={19} />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                                </span>
                              ) : (
                                <span className={`${pill} me-3 bg-white/10`}>
                                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-white/10">
                                    <AdminIcon to={item.to} size={19} />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                                  {count > 0 && (
                                    <span className="grid h-5 min-w-5 flex-none place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                                      {count > 99 ? '99+' : count}
                                    </span>
                                  )}
                                </span>
                              )
                            }
                          </NavLink>
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))}
          </div>

          <div className="relative me-4 border-t border-white/15 px-3 pb-3 pt-3">
            <p className="truncate px-1 text-[11px] text-white/60">{email}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[13px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNotifications();
                }}
                className="rounded-xl bg-white/10 px-3 py-2.5 text-white/90 active:bg-white/20"
              >
                {t('Notifications')}
              </button>
              <button
                type="button"
                onClick={onLanguage}
                className="rounded-xl bg-white/10 px-3 py-2.5 text-white/90 active:bg-white/20"
              >
                {language === 'ar' ? 'English' : 'العربية'}
              </button>
              <Link
                to="/"
                onClick={onClose}
                className="rounded-xl bg-white/10 px-3 py-2.5 text-center text-white/90 active:bg-white/20"
              >
                {t('The shop')}
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-xl bg-white/10 px-3 py-2.5 text-white/90 active:bg-white/20"
              >
                {t('Sign out')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
