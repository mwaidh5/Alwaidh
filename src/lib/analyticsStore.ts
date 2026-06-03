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
  viewsLast7Days: number;
  topPages: { key: string; count: number }[];
  topSources: { key: string; count: number }[];
  recent: AnalyticsEvent[];
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

export async function getAnalyticsSummary(max = 1000): Promise<AnalyticsSummary> {
  if (!db) {
    return {
      totalViews: 0,
      uniqueSessions: 0,
      viewsLast7Days: 0,
      topPages: [],
      topSources: [],
      recent: [],
    };
  }
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy('at', 'desc'), limit(max)),
  );
  const events: AnalyticsEvent[] = snap.docs.map((d) => {
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

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return {
    totalViews: events.length,
    uniqueSessions: new Set(events.map((e) => e.sessionId)).size,
    viewsLast7Days: events.filter((e) => e.at && e.at.getTime() >= weekAgo).length,
    topPages: tally(events.map((e) => e.path)).slice(0, 8),
    topSources: tally(events.map((e) => e.source)).slice(0, 8),
    recent: events.slice(0, 25),
  };
}
