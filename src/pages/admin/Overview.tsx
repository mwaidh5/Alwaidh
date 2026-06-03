import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { listProducts, productStorageMode } from '../../lib/productStore';
import { listOrders, type Order } from '../../lib/orderStore';
import { listUsers, type AppUser } from '../../lib/userStore';
import { listContactSubmissions, type ContactSubmission } from '../../lib/contactSubmissions';
import { formatPrice } from '../../lib/format';
import type { Product } from '../../types/product';

export default function Overview() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listProducts(), listOrders(), listUsers(), listContactSubmissions()])
      .then(([p, o, u, s]) => {
        if (cancelled) return;
        setProducts(p);
        setOrders(o);
        setUsers(u);
        setSubmissions(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const revenue = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.subtotal, 0);
    const pending = orders.filter((o) => o.status === 'pending').length;
    const lowStock = products.filter((p) => !p.inStock).length;
    return { revenue, pending, lowStock };
  }, [orders, products]);

  const mode = productStorageMode();
  const currency = orders[0]?.currency ?? 'IQD';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Storage:{' '}
            <span className="font-semibold">
              {mode === 'firestore' ? 'Firestore' : 'Local (this browser only)'}
            </span>
          </p>
        </div>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={loading ? '…' : formatPrice(stats.revenue, currency)}
          accent="from-brand-700 to-brand-500"
        />
        <StatCard
          label="Orders"
          value={loading ? '…' : String(orders.length)}
          accent="from-emerald-600 to-emerald-400"
          hint={stats.pending ? `${stats.pending} pending` : undefined}
        />
        <StatCard
          label="Products"
          value={loading ? '…' : String(products.length)}
          accent="from-sky-600 to-sky-400"
          hint={stats.lowStock ? `${stats.lowStock} out of stock` : undefined}
        />
        <StatCard
          label="Users"
          value={loading ? '…' : String(users.length)}
          accent="from-fuchsia-600 to-fuchsia-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Recent orders"
          action={<Link to="/admin/orders" className="text-sm text-brand-700 hover:underline">View all →</Link>}
        >
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{o.customerName}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(o.createdAt).toLocaleString()} · {o.lines.length} item(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-700">
                      {formatPrice(o.subtotal, o.currency)}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{o.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent enquiries"
          action={<Link to="/admin/submissions" className="text-sm text-brand-700 hover:underline">View all →</Link>}
        >
          {submissions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No submissions yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {submissions.slice(0, 5).map((s) => (
                <li key={s.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-slate-900">{s.name}</p>
                    <p className="shrink-0 text-xs text-slate-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="truncate text-slate-600">{s.subject || s.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Quick actions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction to="/admin/products" label="Add product" hint="Create a new listing" icon="➕" />
          <QuickAction to="/admin/users" label="Invite user" hint="Grant staff or admin role" icon="👤" />
          <QuickAction to="/admin/orders" label="Process orders" hint="Update statuses" icon="🧾" />
          <QuickAction to="/admin/settings" label="Edit settings" hint="Currency, tax, banner" icon="⚙️" />
        </div>
      </Panel>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className={`bg-gradient-to-br ${accent} px-4 py-3 text-white`}>
        <p className="text-xs uppercase tracking-wider opacity-90">{label}</p>
      </div>
      <div className="px-4 py-4">
        <p className="text-2xl font-extrabold text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function QuickAction({
  to,
  label,
  hint,
  icon,
}: {
  to: string;
  label: string;
  hint: string;
  icon: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-brand-50"
    >
      <p className="text-lg" aria-hidden>
        {icon}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{label}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </Link>
  );
}
