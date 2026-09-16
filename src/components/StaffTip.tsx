import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../lib/i18n';

/**
 * A one-time note for staff on a phone: where things went after the
 * navigation rework. Four lines and a button; shown once per device, a
 * moment after the first screen settles, and never on a laptop, where
 * nothing moved.
 */
const SEEN_KEY = 'alwaidh.tip.nav.v1';

export default function StaffTip() {
  const { hasAdminAccess, loading } = useAuth();
  const { t } = useLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (loading || !hasAdminAccess) return;
    if (window.innerWidth >= 768) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }
    const id = window.setTimeout(() => setShow(true), 1500);
    return () => window.clearTimeout(id);
  }, [loading, hasAdminAccess]);

  if (!show) return null;

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode: it will show again, which is fine */
    }
    setShow(false);
  };

  const lines: [string, string][] = [
    ['☰', t('Your dashboard pages are in the menu, under “Dashboard”. Tap “More” for the rest.')],
    ['⌂', t('Already inside? Tapping “Dashboard” in the bottom bar opens the same menu.')],
    ['🌐', t('Language is at the bottom of the menu.')],
    ['🔔', t('Notification settings are in “My account”.')],
  ];

  return (
    <div className="modal-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 md:hidden" onClick={close}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        style={{ marginBottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-extrabold text-slate-900">{t('A few things moved')}</p>
        <ul className="mt-3 space-y-2.5">
          {lines.map(([icon, text]) => (
            <li key={text} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-brand-50 text-base text-brand-700" aria-hidden>
                {icon}
              </span>
              <span dir="auto" className="bidi">{text}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={close} className="btn-primary mt-4 w-full py-2.5">
          {t('Got it')}
        </button>
      </div>
    </div>
  );
}
