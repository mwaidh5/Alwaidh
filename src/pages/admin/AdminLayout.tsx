import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_EMAILS, auth } from '../../firebase';
import { subscribeSettings, type SiteSettings } from '../../lib/settingsStore';
import { useLang } from '../../lib/i18n';
import { markSeen, useStaffAlerts, type AlertKey } from '../../lib/useStaffAlerts';
import {
  handlePushTaps,
  isChannelOn,
  isNativeApp,
  pushState,
  syncSubscriptions,
  type NotificationKey,
  type PushState,
} from '../../lib/push';
import NotificationSettings from '../../components/NotificationSettings';
import AdminMobileNav, { type NavItem } from './AdminMobileNav';
import { sendAccountEmail } from '../../lib/accountEmail';

// access: which role may see each page. 'admin' = admins only,
// 'products' = product editors (computer or solar staff), 'solar' = solar
// staff, 'jobs' = solar staff plus installers (who see only their own jobs),
// 'staff' = every staff role except installers, 'team' = anyone who works
// here, installers included.
type Access = 'admin' | 'products' | 'solar' | 'jobs' | 'staff' | 'team';
/** Routes that carry a "what's new" badge. */
const ALERT_FOR: Record<string, AlertKey> = {
  '/admin/jobs': 'jobs',
  '/admin/orders': 'orders',
  '/admin/submissions': 'submissions',
  '/admin/chat': 'chat',
  '/admin/team': 'team',
};

// `group` is only used by the phone menu, which shows related pages
// together rather than one long list.
const navItems: (NavItem & { access: Access })[] = [
  { to: '/admin', label: 'Overview', icon: '📊', end: true, access: 'admin', group: 'Work' },
  { to: '/admin/jobs', label: 'Solar Jobs', icon: '🛠️', access: 'jobs', group: 'Work' },
  { to: '/admin/orders', label: 'Orders', icon: '🧾', access: 'admin', group: 'Work' },
  { to: '/admin/products', label: 'Products', icon: '📦', access: 'products', group: 'Shop' },
  { to: '/admin/prices', label: 'Solar Prices', icon: '💲', access: 'solar', group: 'Shop' },
  { to: '/admin/media', label: 'Media', icon: '🖼️', access: 'admin', group: 'Shop' },
  { to: '/admin/blog', label: 'Blog', icon: '📝', access: 'products', group: 'Shop' },
  { to: '/admin/chat', label: 'Messages', icon: '💬', access: 'staff', group: 'Team' },
  { to: '/admin/team', label: 'Team chat', icon: '🗨️', access: 'team', group: 'Team' },
  { to: '/admin/files', label: 'Files', icon: '📁', access: 'team', group: 'Team' },
  { to: '/admin/submissions', label: 'Submissions', icon: '✉️', access: 'admin', group: 'Team' },
  { to: '/admin/users', label: 'Users', icon: '👥', access: 'admin', group: 'Manage' },
  { to: '/admin/analytics', label: 'Analytics', icon: '📈', access: 'admin', group: 'Manage' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️', access: 'admin', group: 'Manage' },
];

export default function AdminLayout() {
  const {
    user,
    loading,
    isAdmin,
    isComputerStaff,
    isSolarStaff,
    isShopManager,
    isInstaller,
    hasAdminAccess,
    viewAs,
    realIsAdmin,
    setViewAsEmail,
    signOut,
  } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const alerts = useStaffAlerts();
  const [push, setPush] = useState<PushState>('unsupported');
  const [notifOpen, setNotifOpen] = useState(false);

  // Notification permission state, and tapping a notification opens its page.
  useEffect(() => {
    pushState().then(setPush);
    let cleanup: (() => void) | undefined;
    handlePushTaps((path) => navigate(path)).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [navigate]);
  const location = useLocation();
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  // Website notifications: while a dashboard tab is open (even in the
  // background), anything new fires a browser notification, honouring the
  // same switches as the app. The native app skips this — FCM pings it.
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

  // Opening a section marks it read on this device.
  useEffect(() => {
    const key = ALERT_FOR[location.pathname];
    if (key) markSeen(key);
  }, [location.pathname]);

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

  const canSee = (access: Access) => {
    if (isAdmin) return true;
    if (access === 'products') return isComputerStaff || isSolarStaff || isShopManager;
    if (access === 'solar') return isSolarStaff;
    if (access === 'jobs') return isSolarStaff || isInstaller;
    if (access === 'staff') return isComputerStaff || isSolarStaff || isShopManager;
    if (access === 'team') return true; // any signed-in staff role
    return false;
  };
  const visibleItems = navItems.filter((i) => canSee(i.access));

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
        <div className="grid gap-6 lg:grid-cols-[240px,minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <AdminMobileNav
              items={visibleItems}
              alerts={alerts}
              alertFor={ALERT_FOR}
              storeName={settings?.storeName ?? 'Alwaidh'}
              email={user.email}
              language={lang}
              onNotifications={() => setNotifOpen(true)}
              onLanguage={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              onSignOut={() => signOut()}
            />
            <div className="card hidden overflow-hidden lg:block">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('Admin')}
                </p>
                <p className="truncate text-sm font-bold" style={{ color: 'var(--hp-ink)' }}>
                  {settings?.storeName ?? 'Alwaidh'}
                </p>
              </div>
              <nav>
                <ul className="space-y-0.5 p-2">
                  {visibleItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            isActive
                              ? 'bg-brand-50 font-semibold text-brand-700'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`
                        }
                      >
                        <span aria-hidden>{item.icon}</span>
                        <span className="flex-1">{t(item.label)}</span>
                        {(() => {
                          const key = ALERT_FOR[item.to];
                          const count = key ? alerts[key] : 0;
                          return count > 0 ? (
                            <span
                              title={t('New since you last looked')}
                              className="grid h-5 min-w-5 flex-none place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white"
                            >
                              {count > 99 ? '99+' : count}
                            </span>
                          ) : null;
                        })()}
                      </NavLink>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
                  <p className="truncate">
                    {t('Signed in as')} <span className="font-semibold text-slate-700">{user.email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(true)}
                    className={`mt-2 w-full rounded-md border px-3 py-1.5 text-sm font-semibold ${
                      push === 'granted'
                        ? 'border-green-300 bg-green-50 text-green-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {push === 'granted'
                      ? `🔔 ${t('Notifications')}`
                      : push === 'denied'
                        ? `🔕 ${t('Notifications blocked')}`
                        : `🔔 ${t('Turn on notifications')}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {lang === 'ar' ? 'English' : 'العربية'}
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t('Sign out')}
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
            <Outlet />
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
