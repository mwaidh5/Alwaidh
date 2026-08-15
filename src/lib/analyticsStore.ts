import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'analytics_events';
const SESSION_KEY = 'alwaidh.session.v1';
const SOURCE_KEY = 'alwaidh.source.v1';

export interface AnalyticsEvent {
  id: string;
  path: string;
  referrer: string;
  source: string;
  sessionId: string;
  at: Date | null;
}

export interface AnalyticsSummary {
  totalViews: number;
  uniqueSessions: number;
  /** Views per day across the range, oldest first — one bar per day. */
  perDay: { key: string; count: number }[];
  busiestDay: { key: string; count: number } | null;
  topPages: { key: string; count: number }[];
  topSources: { key: string; count: number }[];
  recent: AnalyticsEvent[];
}

/** How far back to look. 'all' keeps every event we fetched. */
export type AnalyticsRange = 'today' | '7d' | '30d' | 'all';

export const RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

/** The moment a range starts, or 0 for "all time". */
export function rangeStart(range: AnalyticsRange, now = new Date()): number {
  if (range === 'all') return 0;
  if (range === 'today') {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return midnight.getTime();
  }
  const days = range === '7d' ? 7 : 30;
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.floor(performance.now()).toString(36)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-session';
  }
}

/**
 * Work out where this visitor came from, once per session, and remember it.
 * Prefers an explicit ?utm_source=… then the referring site's hostname,
 * otherwise "Direct".
 */
function resolveSource(): { source: string; referrer: string } {
  let referrer = '';
  try {
    referrer = document.referrer || '';
  } catch {
    referrer = '';
  }
  try {
    const stored = sessionStorage.getItem(SOURCE_KEY);
    if (stored) return { source: stored, referrer };

    const params = new URLSearchParams(window.location.search);
    const utm = params.get('utm_source');
    let source = 'Direct';
    if (utm) {
      source = utm;
    } else if (referrer) {
      try {
        const host = new URL(referrer).hostname.replace(/^www\./, '');
        if (host && host !== window.location.hostname) source = host;
      } catch {
        /* keep Direct */
      }
    }
    sessionStorage.setItem(SOURCE_KEY, source);
    return { source, referrer };
  } catch {
    return { source: 'Direct', referrer };
  }
}

export async function recordPageView(path: string): Promise<void> {
  if (!db) return;
  const { source, referrer } = resolveSource();
  try {
    await addDoc(collection(db, COLLECTION), {
      path,
      referrer,
      source,
      sessionId: getSessionId(),
      at: serverTimestamp(),
    });
  } catch {
    /* analytics is best-effort; never block the page */
  }
}

function tally(items: string[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Every recorded view, newest first. Fetched once; the page then slices it
 * by range on the spot, so switching between Today and Last 30 days is
 * instant and costs no extra reads.
 */
export async function fetchAnalyticsEvents(max = 2000): Promise<AnalyticsEvent[]> {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const ts = data.at as { toDate?: () => Date } | undefined;
    return {
      id: d.id,
      path: String(data.path ?? ''),
      referrer: String(data.referrer ?? ''),
      source: String(data.source ?? 'Direct'),
      sessionId: String(data.sessionId ?? ''),
      at: ts?.toDate ? ts.toDate() : null,
    };
  });
}

/** Short day label used for the per-day bars, e.g. "12 Aug". */
function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Crunch a set of events into the numbers the page shows. */
export function summarize(events: AnalyticsEvent[], range: AnalyticsRange): AnalyticsSummary {
  const since = rangeStart(range);
  const inRange = events.filter((e) => e.at && e.at.getTime() >= since);

  // Counted in date order so the bars read left to right through time
  // (the events arrive newest first, hence the reverse).
  const byDay = new Map<string, number>();
  for (let i = inRange.length - 1; i >= 0; i--) {
    const at = inRange[i].at;
    if (!at) continue;
    const key = dayLabel(at);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const perDay = [...byDay.entries()].map(([key, count]) => ({ key, count }));
  const busiest = perDay.reduce<{ key: string; count: number } | null>(
    (best, d) => (!best || d.count > best.count ? d : best),
    null,
  );

  return {
    totalViews: inRange.length,
    uniqueSessions: new Set(inRange.map((e) => e.sessionId)).size,
    perDay,
    busiestDay: busiest,
    topPages: tally(inRange.map((e) => e.path)).slice(0, 8),
    topSources: tally(inRange.map((e) => e.source)).slice(0, 8),
    recent: inRange.slice(0, 25),
  };
}
