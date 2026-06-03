import { useEffect, useState } from 'react';
import { getAnalyticsSummary, type AnalyticsSummary } from '../../lib/analyticsStore';
import { productStorageMode } from '../../lib/productStore';

const GA_DASHBOARD = 'https://analytics.google.com/';

export default function AdminAnalytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setSummary(await getAnalyticsSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const local = productStorageMode() === 'local';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-600">
            How visitors are using the site and where they came from.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={loading} className="btn-secondary">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <a href={GA_DASHBOARD} target="_blank" rel="noreferrer" className="btn-primary">
            Open Google Analytics
          </a>
        </div>
      </header>

      {local && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Firebase isn’t connected, so analytics are not being recorded. Deploy with Firebase
          configured to collect visit data.
        </p>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Total page views" value={summary.totalViews} />
            <Stat label="Unique visitors" value={summary.uniqueSessions} />
            <Stat label="Views (last 7 days)" value={summary.viewsLast7Days} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Where visitors came from">
              <BarList items={summary.topSources} empty="No traffic recorded yet." />
            </Panel>
            <Panel title="Most viewed pages">
              <BarList items={summary.topPages} empty="No page views recorded yet." />
            </Panel>
          </div>

          <Panel title="Recent activity">
            {summary.recent.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">When</th>
                      <th className="py-2 pr-4">Page</th>
                      <th className="py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.recent.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 pr-4 text-slate-500">
                          {e.at ? e.at.toLocaleString() : '—'}
                        </td>
                        <td className="py-2 pr-4 font-medium text-slate-800">{e.path}</td>
                        <td className="py-2 text-slate-600">{e.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-slate-900">{value.toLocaleString()}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-bold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function BarList({ items, empty }: { items: { key: string; count: number }[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium text-slate-700">{item.key || 'Direct'}</span>
            <span className="ml-2 flex-none text-slate-500">{item.count}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
