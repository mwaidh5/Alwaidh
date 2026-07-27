import { useEffect, useState } from 'react';
import { subscribeJobs } from './jobsStore';
import { subscribeOrders } from './orderStore';
import { subscribeContactSubmissions } from './contactSubmissions';

export type AlertKey = 'jobs' | 'orders' | 'submissions';

/** Counts of items that arrived since this device last opened each page. */
export type StaffAlerts = Record<AlertKey, number>;

const SEEN_KEY = 'alwaidh.seen.v1';

type SeenMap = Partial<Record<AlertKey, number>>;

function readSeen(): SeenMap {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as SeenMap;
  } catch {
    return {};
  }
}

/**
 * Mark a section as read — call it when the staff member opens that page.
 * Stored per device, so one person reading doesn't clear it for everyone.
 */
export function markSeen(key: AlertKey): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [key]: Date.now() }));
    window.dispatchEvent(new CustomEvent('alwaidh:seen'));
  } catch {
    /* private mode — badges just won't persist */
  }
}

/**
 * Live "what's new" counters for the staff dashboard: solar jobs, orders,
 * and customer messages added since this device last looked.
 *
 * First run has no baseline, so it records "now" and starts from zero
 * rather than announcing the entire history as new.
 */
export function useStaffAlerts(): StaffAlerts {
  const [alerts, setAlerts] = useState<StaffAlerts>({ jobs: 0, orders: 0, submissions: 0 });
  const [seenTick, setSeenTick] = useState(0);

  useEffect(() => {
    const onSeen = () => setSeenTick((n) => n + 1);
    window.addEventListener('alwaidh:seen', onSeen);
    return () => window.removeEventListener('alwaidh:seen', onSeen);
  }, []);

  useEffect(() => {
    const seen = readSeen();
    const baseline = (key: AlertKey): number => {
      if (typeof seen[key] === 'number') return seen[key] as number;
      // Nothing recorded yet: treat everything existing as already seen.
      const now = Date.now();
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [key]: now }));
      } catch {
        /* ignore */
      }
      return now;
    };

    const since = {
      jobs: baseline('jobs'),
      orders: baseline('orders'),
      submissions: baseline('submissions'),
    };

    const unsubs = [
      subscribeJobs((list) =>
        setAlerts((a) => ({
          ...a,
          jobs: list.filter((j) => (j.createdAtMs ?? 0) > since.jobs).length,
        })),
      ),
      subscribeOrders((list) =>
        setAlerts((a) => ({
          ...a,
          orders: list.filter((o) => o.createdAt > since.orders).length,
        })),
      ),
      subscribeContactSubmissions((list) =>
        setAlerts((a) => ({
          ...a,
          submissions: list.filter((m) => m.createdAt > since.submissions).length,
        })),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [seenTick]);

  return alerts;
}
