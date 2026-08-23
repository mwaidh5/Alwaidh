import { useSyncExternalStore } from 'react';

/**
 * Which jobs you have looked at since they last changed.
 *
 * The dashboard could already tell you *that* something happened — a count
 * on Solar Jobs — but not *where*, so finding it meant opening cards until
 * you recognised the one. This marks the individual job instead.
 *
 * Per device, not per account: it answers "have I seen this", and the
 * honest answer differs between someone's phone and the office computer.
 */
const KEY = 'alwaidh.seenJobs.v1';

interface Marks {
  /** When this device first used the feature. Everything older counts as
   *  seen — otherwise the first visit dots every job on the board. */
  since: number;
  /** job id → when it was last opened here. */
  items: Record<string, number>;
}

let cache: Marks | null = null;
const listeners = new Set<() => void>();

function read(): Marks {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Marks>;
      cache = {
        since: Number(parsed.since) || Date.now(),
        items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
      };
      return cache;
    }
  } catch {
    /* unreadable — start fresh below */
  }
  cache = { since: Date.now(), items: {} };
  write(cache);
  return cache;
}

function write(marks: Marks): void {
  cache = marks;
  try {
    localStorage.setItem(KEY, JSON.stringify(marks));
  } catch {
    /* private mode: the marks just won't survive a reload */
  }
  for (const fn of listeners) fn();
}

/** When a job last changed — the number the marks are compared against. */
export function changedAt(job: { updatedAtMs: number | null; createdAtMs: number | null }): number {
  return job.updatedAtMs ?? job.createdAtMs ?? 0;
}

/**
 * Note that this job has been looked at.
 *
 * What is recorded is the *version* seen, not the time of looking. Those
 * are nearly the same thing, and would be identical if every clock agreed
 * — but the change time comes from the server and the time of looking from
 * the device. A device running a few seconds behind would fail to clear
 * its own dots, and there would be no way to make them go away.
 */
export function markJobSeen(id: string, changed: number): void {
  const marks = read();
  const already = marks.items[id] ?? 0;
  if (changed <= already) return;
  write({ ...marks, items: { ...marks.items, [id]: changed } });
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export interface JobSeenState {
  /** True when this job changed after the last time it was opened here —
   *  and somebody else made the change. */
  isNew: (job: {
    id: string;
    updatedAtMs: number | null;
    createdAtMs: number | null;
    updatedBy?: string;
    createdBy?: string;
  }) => boolean;
}

/**
 * @param myEmail the signed-in address, so your own edits don't come back
 *   to you as something new to look at.
 */
export function useSeenJobs(myEmail: string | null): JobSeenState {
  const marks = useSyncExternalStore(subscribe, read, () => ({ since: 0, items: {} }) as Marks);
  return {
    isNew: (job) => {
      const changed = changedAt(job);
      if (!changed) return false;
      const by = (job.updatedBy || job.createdBy || '').toLowerCase();
      if (myEmail && by === myEmail.toLowerCase()) return false;
      return changed > Math.max(marks.since, marks.items[job.id] ?? 0);
    },
  };
}
