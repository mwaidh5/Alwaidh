import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Who is coming to the event.
 *
 * A public form takes a name, a company and a phone; the office sees the
 * list, ticks people off at the door, and prints it. Temporary by
 * design: one event at a time, named here, and the page can be closed
 * from the dashboard the day after.
 */

export const EVENT_ID = 'tiandy-2026';
const COLLECTION = 'eventRegistrations';

export interface EventConfig {
  title: string;
  date: string;
  place: string;
  note: string;
  open: boolean;
}

export interface EventRegistration {
  id: string;
  name: string;
  company: string;
  phone: string;
  people: number;
  arrived: boolean;
  createdAtMs: number;
}

const ms = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | null;
  return typeof t?.toMillis === 'function' ? t.toMillis() : 0;
};

/** The event's details as the office wrote them; defaults until then. */
export function subscribeEventConfig(cb: (cfg: EventConfig) => void): () => void {
  const fallback: EventConfig = { title: '', date: '', place: '', note: '', open: true };
  if (!db) {
    cb(fallback);
    return () => undefined;
  }
  return onSnapshot(
    doc(db, 'settings', 'event'),
    (snap) => {
      const v = snap.data() ?? {};
      cb({
        title: String(v.title ?? ''),
        date: String(v.date ?? ''),
        place: String(v.place ?? ''),
        note: String(v.note ?? ''),
        open: v.open !== false,
      });
    },
    () => cb(fallback),
  );
}

export async function saveEventConfig(cfg: EventConfig): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await setDoc(doc(db, 'settings', 'event'), cfg, { merge: true });
}

/** Iraqi mobile numbers: 07xx xxx xxxx, spaces and dashes tolerated. */
export function cleanPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '').replace(/^964/, '0');
  return digits;
}

export function phoneLooksRight(raw: string): boolean {
  const d = cleanPhone(raw);
  return /^07\d{9}$/.test(d);
}

/** The public form's one write. The rules check the shape and sizes. */
export async function registerForEvent(input: {
  name: string;
  company: string;
  phone: string;
  people: number;
}): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await addDoc(collection(db, COLLECTION), {
    event: EVENT_ID,
    name: input.name.trim().slice(0, 80),
    company: input.company.trim().slice(0, 80),
    phone: cleanPhone(input.phone),
    people: Math.min(10, Math.max(1, Math.round(input.people) || 1)),
    arrived: false,
    createdAt: serverTimestamp(),
  });
}

/** Everyone registered, oldest first — the order they signed up. */
export function subscribeEventRegistrations(
  cb: (list: EventRegistration[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  if (!db) return () => undefined;
  // No orderBy beside the where: that would want a composite index; the
  // list is small enough to sort here.
  const q = query(collection(db, COLLECTION), where('event', '==', EVENT_ID));
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs
          .map((d) => {
            const v = d.data();
            return {
              id: d.id,
              name: String(v.name ?? ''),
              company: String(v.company ?? ''),
              phone: String(v.phone ?? ''),
              people: Number(v.people ?? 1),
              arrived: Boolean(v.arrived),
              createdAtMs: ms(v.createdAt),
            };
          })
          .sort((a, b) => a.createdAtMs - b.createdAtMs),
      ),
    (e) => onError?.(e),
  );
}

/** Ticked off at the door. */
export async function setArrived(id: string, arrived: boolean): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await updateDoc(doc(db, COLLECTION, id), { arrived, arrivedAt: arrived ? serverTimestamp() : null });
}

export async function deleteRegistration(id: string): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await deleteDoc(doc(db, COLLECTION, id));
}
