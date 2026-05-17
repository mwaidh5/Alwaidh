import { useEffect, useMemo, useState } from 'react';
import {
  deleteOrder,
  listOrders,
  ORDER_STATUSES,
  setOrderStatus,
  type Order,
  type OrderStatus,
} from '../../lib/orderStore';
import { formatPrice } from '../../lib/format';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listOrders()
      .then((list) => {
        if (!cancelled) setOrders(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.');
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const totals = useMemo(() => {
    const counts: Record<string, number> = { all: orders?.length ?? 0 };
    for (const s of ORDER_STATUSES) {
      counts[s] = orders?.filter((o) => o.status === s).length ?? 0;
    }
    return counts;
  }, [orders]);

  async function handleStatus(id: string, status: OrderStatus) {
    try {
      await setOrderStatus(id, status);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this order?')) return;
    try {
      await deleteOrder(id);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            {orders ? `${orders.length} total` : 'Loading…'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefresh((n) => n + 1)}
          className="btn-secondary"
        >
          Refresh
        </button>
      </header>

      <div className="card p-3">
        <div className="flex flex-wrap gap-2">
          <FilterPill
            label="All"
            count={totals.all}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          {ORDER_STATUSES.map((s) => (
            <FilterPill
              key={s}
              label={s}
              count={totals[s] ?? 0}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {orders === null ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">No orders.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => {
            const open = expanded === o.id;
            return (
              <li key={o.id} className="card">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : o.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-900">
                      {o.customerName}{' '}
                      <span className="text-xs font-medium text-slate-500">
                        · {new Date(o.createdAt).toLocaleString()}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {o.customerEmail} · {o.lines.length} item(s) · order #{o.id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={o.status} />
                    <span className="font-bold text-brand-700">
                      {formatPrice(o.subtotal, o.currency)}
                    </span>
                    <span className="text-slate-400">{open ? '▴' : '▾'}</span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-slate-200 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Customer</h3>
                        <p className="mt-1 text-sm text-slate-700">{o.customerName}</p>
                        <p className="text-sm text-slate-500">{o.customerEmail}</p>
                        {o.customerPhone && (
                          <p className="text-sm text-slate-500">{o.customerPhone}</p>
                        )}
                        {o.shippingAddress && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                            {o.shippingAddress}
                          </p>
                        )}
                        {o.notes && (
                          <p className="mt-2 whitespace-pre-wrap text-sm italic text-slate-600">
                            "{o.notes}"
                          </p>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Lines</h3>
                        <ul className="mt-1 divide-y divide-slate-200 rounded-md border border-slate-200">
                          {o.lines.map((line, i) => (
                            <li key={i} className="flex justify-between p-3 text-sm">
                              <span>
                                <span className="font-semibold">{line.name}</span>
                                <span className="text-slate-500"> × {line.quantity}</span>
                              </span>
                              <span className="font-semibold">
                                {formatPrice(line.price * line.quantity, o.currency)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="text-sm text-slate-600">Status</label>
                      <select
                        value={o.status}
                        onChange={(e) => handleStatus(o.id, e.target.value as OrderStatus)}
                        className="input max-w-xs"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDelete(o.id)}
                        className="ml-auto text-sm font-semibold text-red-700 hover:underline"
                      >
                        Delete order
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold capitalize transition ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 ${
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    paid: 'bg-blue-100 text-blue-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${map[status]}`}
    >
      {status}
    </span>
  );
}
