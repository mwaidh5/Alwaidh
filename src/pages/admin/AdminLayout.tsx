import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_EMAILS, auth } from '../../firebase';
import { subscribeSettings, type SiteSettings } from '../../lib/settingsStore';
import { useLang } from '../../lib/i18n';
import { useOthersViewing } from '../../lib/presence';
import { markSeen, useStaffAlerts, type AlertKey } from '../../lib/useStaffAlerts';
import {
  clearDeliveredNotifications,
  isChannelOn,
  isNativeApp,
  pushState,
  syncSubscriptions,
  type NotificationKey,
  type PushState,
} from '../../lib/push';
import NotificationSettings from '../../components/NotificationSettings';
import { AdminIcon } from './adminIcons';
import { ADMIN_NAV, ALERT_FOR, canOpen } from '../../lib/adminNav';
import { smoothNavigate } from '../../lib/smoothNav';
import { sendAccountEmail } from '../../lib/accountEmail';

// access: which role may see each page. 'admin' = admins only,
// 'products' = product editors (computer or solar staff), 'solar' = solar
// staff, 'jobs' = solar staff plus installers (who see only their own jobs),
// 'staff' = every staff role except installers, 'team' = anyone who works
// here, installers included.
export default function AdminLayout() {
  const {
    user,
    loading,
    isAdmin,
    isComputerStaff,
    isSolarStaff,
    isShopManager,
    isInstaller,
    can,
    hasAdminAccess,
    viewAs,
    realIsAdmin,
    setViewAsEmail,
    signOut,
  } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const alerts = useStaffAlerts();
  const [push, setPush] = useState<PushState>('unsupported');
  const [notifOpen, setNotifOpen] = useState(false);
  // The laptop's sidebar is a rail of icons; a click on it opens the
  // names, a click anywhere else (or a page change) closes them again.
  const [railOpen, setRailOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!railOpen) return;
    const away = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setRailOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [railOpen]);

  // Notification permission state. (Tap handling lives in Layout, so a
  // notification can cold-start the app and still land on its page.)
  useEffect(() => {
    pushState().then(setPush);
  }, []);
  const location = useLocation();
  useEffect(() => setRailOpen(false), [location.pathname]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  // Website notifications: while a dashboard tab is open (even in the
  // background), anything new fires a browser notification, honouring the
  // same switches as the app. The native app skips this — FCM pings it.
  // What this person's other devices are showing: the phone with the
  // chat open means the laptop's alert about that chat can stay silent.
  const others = useOthersViewing();
  const othersRef = useRef(others);
  othersRef.current = others;

  const previous = useRef<Record<AlertKey, number> | null>(null);
  useEffect(() => {
    const prev = previous.current;
    previous.current = { ...alerts };
    if (!prev) return; // first load: nothing to compare against
    if (isNativeApp() || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const rules: { key: AlertKey; channel: NotificationKey; path: string; title: string }[] = [
      { key: 'chat', channel: 'messages', path: '/admin/chat', title: 'New chat message' },
      { key: 'team', channel: 'team', path: '/admin/team', title: 'New team message' },
      { key: 'jobs', channel: 'jobs', path: '/admin/jobs', title: 'New solar job' },
      { key: 'orders', channel: 'orders', path: '/admin/orders', title: 'New order' },
      { key: 'submissions', channel: 'messages', path: '/admin/submissions', title: 'New enquiry' },
    ];
    for (const rule of rules) {
      if (alerts[rule.key] <= prev[rule.key]) continue; // nothing new here
      if (!isChannelOn(rule.channel)) continue; // switched off
      // Looking at that page right now — no need to interrupt.
      if (location.pathname === rule.path && !document.hidden) continue;
      // Or looking at it on another device.
      if (seenElsewhere(rule.key, othersRef.current)) continue;
      try {
        const n = new Notification(t(rule.title), {
          body: t('Open the dashboard to take a look.'),
          tag: `alwaidh-${rule.key}`, // newer ones replace the old bubble
          // Buzzes on the phones whose browsers support it; ignored elsewhere.
          vibrate: [180, 90, 180],
        } as NotificationOptions & { vibrate: number[] });
        n.onclick = () => {
          window.focus();
          navigate(rule.path);
          n.close();
        };
      } catch {
        /* some browsers only allow notifications from a service worker */
      }
    }
  }, [alerts, location.pathname, navigate, t]);

  // Notifications follow the real account, never the previewed one —
  // otherwise stepping into someone else's view would quietly unsubscribe
  // this device from topics that person doesn't have.
  const notifyRoles = {
    isAdmin: realIsAdmin,
    isComputerStaff: realIsAdmin || isComputerStaff,
    isSolarStaff: realIsAdmin || isSolarStaff,
    isShopManager: realIsAdmin || isShopManager,
    isInstaller: !viewAs && isInstaller,
  };

  // Keep this device's topic subscriptions in step with its switches: they
  // are lost on reinstall or when the push token is refreshed.
  useEffect(() => {
    if (push !== 'granted') return;
    syncSubscriptions(notifyRoles, user?.email ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push, realIsAdmin, isComputerStaff, isSolarStaff, isShopManager, isInstaller, viewAs, user]);

  useEffect(() => subscribeSettings(setSettings), []);

  // Opening a section marks it read on this device — and being in the
  // dashboard at all empties the phone's notification tray: the person
  // is looking at the news, the reminders have done their job.
  useEffect(() => {
    const key = ALERT_FOR[location.pathname];
    if (key) markSeen(key);
    clearDeliveredNotifications();
  }, [location.pathname]);

  // And again whenever the dashboard comes back into view: a phone that
  // was already on the chat page and is simply brought to the front never
  // changes route, and its tray stayed full.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === 'visible') clearDeliveredNotifications();
    };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, []);

  if (loading) {
    return <p className="container-page py-16 text-center text-slate-500">Loading…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Roles come from the settings doc; don't judge access (or flash
  // "Not authorised") until it has loaded.
  if (settings === null) {
    return <p className="container-page py-16 text-center text-slate-500">Loading…</p>;
  }

  const extra = settings?.extraAdminEmails ?? [];

  if (!hasAdminAccess) {
    return <NotAuthorized email={user.email} extraAdmins={extra} />;
  }

  const visibleItems = ADMIN_NAV.filter((i) => canOpen(i.access, isAdmin, can));

  // Keep staff out of pages they can't see (also handles the /admin index).
  const path = location.pathname;
  const pathAllowed = visibleItems.some(
    (i) => i.to === path || (i.to !== '/admin' && path.startsWith(i.to)),
  );
  if (!pathAllowed) {
    return <Navigate to={visibleItems[0]?.to ?? '/'} replace />;
  }

  return (
    <div className="hpanel min-h-screen">
      {/* Full-bleed like hPanel: the dashboard uses the whole window width
          instead of the shop's centred column. */}
      <div className="w-full px-4 py-6 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[4.5rem,minmax(0,1fr)]">
          <aside
            ref={railRef}
            className="relative hidden md:sticky md:top-20 md:block md:self-start"
            // The rail: 4.5rem of icons in the page's flow. Open, the same
            // card grows to 15rem and lies OVER the content instead of
            // pushing it, so nothing on the page moves.
            style={{ minHeight: railOpen ? 0 : undefined }}
          >
            <div
              className={`card overflow-hidden transition-[width,box-shadow] duration-200 ${
                railOpen ? 'absolute inset-y-0 start-0 z-40 w-60 shadow-2xl' : 'w-[4.5rem]'
              }`}
              onClick={(e) => {
                // A click on the rail's own body opens it; the icons are
                // links and go straight to their page instead.
                if (!railOpen && !(e.target as HTMLElement).closest('a,button')) setRailOpen(true);
              }}
            >
              <button
                type="button"
                onClick={() => setRailOpen((v) => !v)}
                title={railOpen ? t('Collapse') : t('Expand')}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-start ${railOpen ? '' : 'justify-center'}`}
              >
                <span
                  className="grid h-9 w-9 flex-none place-items-center rounded-full text-sm font-bold text-white"
                  style={{ background: 'var(--hp)' }}
                >
                  {(settings?.storeName ?? 'A').charAt(0).toUpperCase()}
                </span>
                {railOpen && (
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('Admin')}</span>
                    <span className="block truncate text-sm font-bold" style={{ color: 'var(--hp-ink)' }}>
                      {settings?.storeName ?? 'Alwaidh'}
                    </span>
                  </span>
                )}
              </button>
              <nav>
                {[...new Set(visibleItems.map((i) => i.group))].map((group) => (
                  <ul key={group} className="space-y-0.5 p-2 pt-1 [&+ul]:border-t [&+ul]:border-slate-100">
                    {railOpen && (
                      <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        {t(String(group))}
                      </li>
                    )}
                    {visibleItems
                      .filter((i) => i.group === group)
                      .map((item) => {
                        const key = ALERT_FOR[item.to];
                        const count = key ? alerts[key] : 0;
                        return (
                          <li key={item.to}>
                            <NavLink
                              to={item.to}
                              end={item.end}
                              title={railOpen ? undefined : t(item.label)}
                              onClick={(e) => {
                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                                e.preventDefault();
                                smoothNavigate(navigate, item.to);
                              }}
                              className={({ isActive }) =>
                                `relative flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition ${
                                  railOpen ? 'px-3' : 'justify-center px-0'
                                } ${
                                  isActive
                                    ? 'bg-brand-50 font-semibold text-brand-700'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`
                              }
                            >
                              <AdminIcon to={item.to} size={20} />
                              {railOpen && <span className="flex-1">{t(item.label)}</span>}
                              {count > 0 &&
                                (railOpen ? (
                                  <span
                                    title={t('New since you last looked')}
                                    className="grid h-5 min-w-5 flex-none place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white"
                                  >
                                    {count > 99 ? '99+' : count}
                                  </span>
                                ) : (
                                  <span className="absolute end-2 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                    {count > 9 ? '9+' : count}
                                  </span>
                                ))}
                            </NavLink>
                          </li>
                        );
                      })}
                  </ul>
                ))}
                <div className={`border-t border-slate-200 text-xs text-slate-500 ${railOpen ? 'p-3' : 'p-2'}`}>
                  {railOpen && (
                    <>
                      <p className="mb-1 text-[10px] text-slate-400" dir="ltr" title="The build this browser is running">
                        v{__APP_BUILD__}
                      </p>
                      <p className="truncate">
                        {t('Signed in as')} <span className="font-semibold text-slate-700">{user.email}</span>
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifOpen(true)}
                    title={push === 'granted' ? t('Notifications') : push === 'denied' ? t('Notifications blocked') : t('Turn on notifications')}
                    className={`mt-2 flex w-full items-center justify-center gap-2 rounded-md border py-1.5 text-sm font-semibold ${railOpen ? 'px-3' : 'px-0'} ${
                      push === 'granted'
                        ? 'border-green-300 bg-green-50 text-green-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span aria-hidden>{push === 'denied' ? '🔕' : '🔔'}</span>
                    {railOpen &&
                      (push === 'granted'
                        ? t('Notifications')
                        : push === 'denied'
                          ? t('Notifications blocked')
                          : t('Turn on notifications'))}
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    title={t('Sign out')}
                    className={`mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${railOpen ? 'px-3' : 'px-0'}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
                      <path d="m15 8 4 4-4 4M19 12H9" />
                    </svg>
                    {railOpen && t('Sign out')}
                  </button>
                </div>
              </nav>
            </div>
          </aside>

          {notifOpen && (
            <NotificationSettings
              roles={notifyRoles}
              email={user.email}
              onClose={() => {
                setNotifOpen(false);
                pushState().then(setPush);
              }}
            />
          )}

          <section className="min-w-0">
            {viewAs && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>
                  👁 {t('Viewing the dashboard as')}{' '}
                  <span className="font-bold">{viewAs}</span>.{' '}
                  <span className="text-amber-800">
                    {t('Anything you do is still recorded as you.')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setViewAsEmail(null);
                    navigate('/admin/users');
                  }}
                  className="ms-auto rounded-md border border-amber-400 bg-white px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-100"
                >
                  {t('Back to my own view')}
                </button>
              </div>
            )}
            {!user.emailVerified && <UnverifiedBanner email={user.email} />}
            {/* The page changes; the shell around it does not. */}
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function UnverifiedBanner({ email }: { email: string | null }) {
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    setError('');
    try {
      if (!auth?.currentUser) throw new Error('Not signed in.');
      await sendAccountEmail('verify', auth.currentUser.email ?? '');
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace('Firebase: ', '') : 'Could not send email.');
    }
  }

  // Pull the latest status and mint a fresh token, then reload so every
  // listener reconnects with the verified claim.
  async function handleRecheck() {
    setError('');
    setChecking(true);
    try {
      if (!auth?.currentUser) throw new Error('Not signed in.');
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) {
        setError('Still not verified. Open the email and click the link, then try again.');
        return;
      }
      await auth.currentUser.getIdToken(true);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace('Firebase: ', '') : 'Could not refresh.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-bold">⚠️ Your email isn't verified — data won't load.</p>
      <p className="mt-1">
        The database only trusts verified accounts, so pages here will appear empty and saves will
        fail. Verify <span className="font-semibold">{email}</span> to fix it:
      </p>
      {sent && (
        <p className="mt-2 font-semibold">
          ✅ Verification email sent — open it and click the link (check spam too), then press
          “I've clicked the link” below. Open the <strong>newest</strong> email: asking for
          another one cancels the link in the previous email.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSend}
          className="rounded-md border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          {sent ? 'Resend email' : 'Send verification email'}
        </button>
        <button
          type="button"
          onClick={handleRecheck}
          disabled={checking}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {checking ? 'Checking…' : "I've clicked the link — refresh"}
        </button>
      </div>
      {error && <p className="mt-2 text-red-700">{error}</p>}
    </div>
  );
}

function NotAuthorized({ email, extraAdmins }: { email: string | null; extraAdmins: string[] }) {
  const { signOut } = useAuth();
  return (
    <section className="container-page py-16">
      <div className="mx-auto max-w-md card p-7 text-center">
        <h1 className="text-xl font-extrabold text-slate-900">Not authorised</h1>
        <p className="mt-2 text-sm text-slate-600">
          You're signed in as <span className="font-semibold">{email ?? 'unknown user'}</span>, but
          this account isn't allowed to view the admin dashboard.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Admin access is restricted to: {[...ADMIN_EMAILS, ...extraAdmins].join(', ') || '—'}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/" className="btn-secondary">
            Back home
          </Link>
          <button type="button" onClick={() => signOut()} className="btn-primary">
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
}

/** True when another of this person's devices is showing what the alert is about. */
function seenElsewhere(key: string, keys: Set<string>): boolean {
  for (const k of keys) {
    if (key === 'chat' && (k === 'messages' || k.startsWith('chat:'))) return true;
    if (key === 'jobs' && (k === 'jobs' || k.startsWith('job:'))) return true;
    if (key === 'team' && (k === 'team' || k.startsWith('team:'))) return true;
    if (key === 'submissions' && k === 'submissions') return true;
    if (key === 'orders' && k === 'orders') return true;
  }
  return false;
}
