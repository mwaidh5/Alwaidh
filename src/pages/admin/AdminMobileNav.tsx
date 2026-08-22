import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useLang } from '../../lib/i18n';
import { useScrollLock } from '../../lib/useScrollLock';
import type { AlertKey, StaffAlerts } from '../../lib/useStaffAlerts';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  /** Which heading it sits under in the phone menu. */
  group: string;
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
  alerts: StaffAlerts;
  alertFor: Record<string, AlertKey>;
  storeName: string;
  email: string | null;
  onNotifications: () => void;
  onLanguage: () => void;
  onSignOut: () => void;
  language: string;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const badge = (to: string) => {
    const key = alertFor[to];
    return key ? alerts[key] : 0;
  };
  const waiting = items.reduce((n, i) => n + badge(i.to), 0);

  return (
    <div className="lg:hidden">
      <div className="card flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-start active:bg-slate-100"
        >
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
            {(storeName || 'A').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold" style={{ color: 'var(--hp-ink)' }}>
              {storeName}
            </span>
            <span className="block truncate text-[11px] text-slate-500">{t('Dashboard')}</span>
          </span>
          <span className="flex-none text-slate-400" aria-hidden>
            ⌄
          </span>
        </button>
        {waiting > 0 && (
          <span className="grid h-6 min-w-6 flex-none place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
            {waiting > 99 ? '99+' : waiting}
          </span>
        )}
      </div>

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
  const { t } = useLang();
  const [folded, setFolded] = useState<Record<string, boolean>>({});

  const groups = [...new Set(items.map((i) => i.group))].sort(
    (a, b) =>
      (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99) ||
      a.localeCompare(b),
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/40" onClick={onClose}>
      <div
        className="mt-auto flex max-h-[88vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* The grab handle every sheet has, so it reads as one. */}
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {(storeName || 'A').charAt(0).toUpperCase()}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{storeName}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {groups.map((group) => {
            const inGroup = items.filter((i) => i.group === group);
            const shut = folded[group];
            const groupWaiting = inGroup.reduce((n, i) => n + badge(i.to), 0);
            return (
              <section key={group} className="mb-1">
                <button
                  type="button"
                  onClick={() => setFolded((f) => ({ ...f, [group]: !f[group] }))}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  {t(group)}
                  <span aria-hidden className={shut ? '-rotate-90' : ''}>
                    ⌄
                  </span>
                  {shut && groupWaiting > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {groupWaiting}
                    </span>
                  )}
                </button>
                {!shut &&
                  inGroup.map((item) => {
                    const count = badge(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] transition ${
                            isActive
                              ? 'bg-brand-50 font-semibold text-brand-700'
                              : 'font-medium text-slate-700 active:bg-slate-100'
                          }`
                        }
                      >
                        <span className="w-6 flex-none text-center text-lg" aria-hidden>
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{t(item.label)}</span>
                        {count > 0 && (
                          <span className="grid h-5 min-w-5 flex-none place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
              </section>
            );
          })}

          <div className="mt-2 border-t border-slate-100 px-3 pt-3">
            <p className="truncate text-xs text-slate-500">
              {t('Signed in as')} <span className="font-semibold text-slate-700">{email}</span>
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNotifications();
                }}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"
              >
                🔔 {t('Notifications')}
              </button>
              <button
                type="button"
                onClick={onLanguage}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"
              >
                {language === 'ar' ? 'English' : 'العربية'}
              </button>
              <Link
                to="/"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700"
              >
                🏬 {t('The shop')}
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"
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
