import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_EMAILS } from '../../firebase';
import { subscribeSettings, type SiteSettings } from '../../lib/settingsStore';

// access: which role may see each page. 'admin' = admins only,
// 'products' = product editors (computer or solar staff), 'solar' = solar staff.
type Access = 'admin' | 'products' | 'solar';
const navItems: { to: string; label: string; icon: string; end?: boolean; access: Access }[] = [
  { to: '/admin', label: 'Overview', icon: '📊', end: true, access: 'admin' },
  { to: '/admin/products', label: 'Products', icon: '📦', access: 'products' },
  { to: '/admin/prices', label: 'Solar Prices', icon: '💲', access: 'solar' },
  { to: '/admin/jobs', label: 'Solar Jobs', icon: '🛠️', access: 'solar' },
  { to: '/admin/media', label: 'Media', icon: '🖼️', access: 'admin' },
  { to: '/admin/orders', label: 'Orders', icon: '🧾', access: 'admin' },
  { to: '/admin/users', label: 'Users', icon: '👥', access: 'admin' },
  { to: '/admin/submissions', label: 'Submissions', icon: '✉️', access: 'admin' },
  { to: '/admin/analytics', label: 'Analytics', icon: '📈', access: 'admin' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️', access: 'admin' },
];

export default function AdminLayout() {
  const { user, loading, isAdmin, isComputerStaff, isSolarStaff, hasAdminAccess, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => subscribeSettings(setSettings), []);
  useEffect(() => setOpen(false), [location.pathname]);

  if (loading) {
    return <p className="container-page py-16 text-center text-slate-500">Loading…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const extra = settings?.extraAdminEmails ?? [];

  if (!hasAdminAccess) {
    return <NotAuthorized email={user.email} extraAdmins={extra} />;
  }

  const canSee = (access: Access) => {
    if (isAdmin) return true;
    if (access === 'products') return isComputerStaff || isSolarStaff;
    if (access === 'solar') return isSolarStaff;
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
    <div className="bg-slate-50">
      <div className="container-page py-6">
        <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
                <p className="text-xs uppercase tracking-wider text-slate-300">Admin</p>
                <p className="truncate text-sm font-semibold">{settings?.storeName ?? 'Alwaidh'}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 lg:hidden"
                aria-expanded={open}
              >
                Menu
                <span>{open ? '▴' : '▾'}</span>
              </button>
              <nav className={`${open ? 'block' : 'hidden'} lg:block`}>
                <ul className="py-2">
                  {visibleItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
                            isActive
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`
                        }
                      >
                        <span aria-hidden>{item.icon}</span>
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
                  <p className="truncate">
                    Signed in as <span className="font-semibold text-slate-700">{user.email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Sign out
                  </button>
                </div>
              </nav>
            </div>
          </aside>

          <section className="min-w-0">
            <Outlet />
          </section>
        </div>
      </div>
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
