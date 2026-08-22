import { useEffect, useMemo, useState } from 'react';
import {
  fetchAnalyticsEvents,
  RANGE_LABELS,
  summarize,
  type AnalyticsEvent,
  type AnalyticsRange,
} from '../../lib/analyticsStore';
import { productStorageMode } from '../../lib/productStore';
import { useLang } from '../../lib/i18n';

const GA_DASHBOARD = 'https://analytics.google.com/';
const RANGES: AnalyticsRange[] = ['today', '7d', '30d', 'all'];

export default function AdminAnalytics() {
  const { t } = useLang();
  const [events, setEvents] = useState<AnalyticsEvent[] | null>(null);
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setEvents(await fetchAnalyticsEvents());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Everything is recomputed here, so switching range is instant.
  const summary = useMemo(() => (events ? summarize(events, range) : null), [events, range]);
  const local = productStorageMode() === 'local';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('Analytics')}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {t('How visitors are using the site and where they came from.')}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={loading} className="btn-secondary">
            {loading ? t('Loading…') : t('Refresh')}
          </button>
          <a href={GA_DASHBOARD} target="_blank" rel="noreferrer" className="btn-primary">
            {t('Open Google Analytics')}
          </a>
        </div>
      </header>

      {/* Range picker — every number below follows it. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm font-semibold">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 transition ${
                range === r ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t(RANGE_LABELS[r])}
            </button>
          ))}
        </div>
        {summary && (
          <p className="text-sm text-slate-500">
            {summary.totalViews.toLocaleString('en-GB')} {t('views in this period')}
          </p>
        )}
      </div>

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
            <Stat label="Page views" value={summary.totalViews} />
            <Stat label="Visitors" value={summary.uniqueSessions} />
            <Stat
              label="Busiest day"
              value={summary.busiestDay?.count ?? 0}
              caption={summary.busiestDay?.key}
            />
          </div>

          {summary.perDay.length > 1 && (
            <Panel title="Views by day">
              <BarList items={summary.perDay} empty="No page views in this period." />
            </Panel>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Where visitors came from">
              <BarList items={summary.topSources} empty="No traffic in this period." />
            </Panel>
            <Panel title="Most viewed pages">
              <BarList items={summary.topPages} empty="No page views in this period." />
            </Panel>
          </div>

          <Panel title="Recent activity">
            {summary.recent.length === 0 ? (
              <p className="text-sm text-slate-500">{t('Nothing in this period.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">{t('When')}</th>
                      <th className="py-2 pr-4">{t('Page')}</th>
                      <th className="py-2">{t('Source')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.recent.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 pr-4 text-slate-500">
                          {e.at ? e.at.toLocaleString('en-GB') : '—'}
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

function Stat({ label, value, caption }: { label: string; value: number; caption?: string }) {
  const { t } = useLang();
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{t(label)}</p>
      <p className="mt-1 text-3xl font-extrabold text-slate-900">{value.toLocaleString('en-GB')}</p>
      {caption && <p className="mt-0.5 text-xs font-medium text-slate-500">{caption}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useLang();
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-bold text-slate-900">{t(title)}</h2>
      {children}
    </div>
  );
}

function BarList({ items, empty }: { items: { key: string; count: number }[]; empty: string }) {
  const { t } = useLang();
  if (items.length === 0) return <p className="text-sm text-slate-500">{t(empty)}</p>;
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
