import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

/** Email of the signed-in staff member (audit trail). */
function currentEmail(): string {
  return auth?.currentUser?.email ?? '';
}

export type JobStatus = 'new' | 'scheduled' | 'in_progress' | 'done' | 'cancelled';
export type JobType = 'install' | 'repair';

export interface Job {
  id: string;
  customer: string;
  phone: string;
  address: string;
  mapUrl: string; // Google Maps link pasted by staff; Waze link is derived
  type: JobType;
  system: string; // e.g. "6 kW rooftop system"
  installer: string; // technician assigned to the job
  notes: string;
  invoiceUrl: string; // attached PDF invoice (Storage URL)
  invoiceName: string; // original filename of the invoice
  status: JobStatus;
  order: number; // position within its column
  createdBy: string; // email of who added the job
  createdAtMs: number | null; // when it was added (ms epoch)
  updatedBy: string; // email of the last person who changed it
  updatedAtMs: number | null; // when it was last changed (ms epoch)
}

export const JOB_STATUSES: { key: JobStatus; label: string }[] = [
  { key: 'new', label: 'New Requests' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled / Delayed' },
];

const COLLECTION = 'jobs';
const LS_KEY = 'alwaidh.jobs.v1';

function readLocal(): Job[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Job[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: Job[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY }));
  } catch {
    /* ignore */
  }
}

function normalize(data: Record<string, unknown>, id: string): Job {
  return {
    id,
    customer: String(data.customer ?? ''),
    phone: String(data.phone ?? ''),
    address: String(data.address ?? ''),
    mapUrl: String(data.mapUrl ?? ''),
    type: (data.type as JobType) === 'repair' ? 'repair' : 'install',
    system: String(data.system ?? ''),
    installer: String(data.installer ?? ''),
    notes: String(data.notes ?? ''),
    invoiceUrl: String(data.invoiceUrl ?? ''),
    invoiceName: String(data.invoiceName ?? ''),
    status: (['new', 'scheduled', 'in_progress', 'done', 'cancelled'].includes(String(data.status))
      ? data.status
      : 'new') as JobStatus,
    order: Number(data.order ?? 0),
    createdBy: String(data.createdBy ?? ''),
    createdAtMs: toMillis(data.createdAt),
    updatedBy: String(data.updatedBy ?? ''),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

/**
 * Build a Waze navigation link from a pasted Google Maps link.
 * Tries the precise pin (!3d…!4d…), then the ?q=lat,lng form, then the
 * @lat,lng viewport; if the link hides its coordinates (e.g. maps.app.goo.gl
 * short links), falls back to a Waze search for the place name or address.
 * Returns '' when there is nothing usable.
 */
export function wazeFromGoogleMaps(mapUrl: string, addressFallback = ''): string {
  const url = mapUrl.trim();
  // No map link at all (e.g. jobs created before the field existed):
  // fall back to a Waze search for the written address.
  if (!url) {
    const q = addressFallback.trim();
    return q ? `https://www.waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes` : '';
  }
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    /* keep raw */
  }
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(decoded);
  const q = /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/.exec(decoded);
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(decoded);
  const coords = pin ?? q ?? at;
  if (coords) {
    return `https://www.waze.com/ul?ll=${coords[1]},${coords[2]}&navigate=yes`;
  }
  const place = /\/maps\/place\/([^/@?]+)/.exec(decoded);
  const query = place ? place[1].replace(/\+/g, ' ') : addressFallback.trim();
  if (query) return `https://www.waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
  return '';
}

/** Firestore Timestamp (or ms number from the local fallback) → ms epoch. */
function toMillis(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const ts = v as { toMillis?: () => number } | null;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : null;
}

export function subscribeJobs(
  cb: (list: Job[]) => void,
  onError?: (message: string) => void,
): () => void {
  const database = db;
  if (database) {
    return onSnapshot(
      query(collection(database, COLLECTION), orderBy('order', 'asc')),
      (snap) => cb(snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id))),
      (err) => {
        cb([]);
        onError?.(err.message);
      },
    );
  }
  cb(readLocal());
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) cb(readLocal());
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** Fields the store stamps itself — callers never provide them. */
type JobInput = Omit<Job, 'id' | 'createdBy' | 'createdAtMs' | 'updatedBy' | 'updatedAtMs'>;

export async function createJob(input: JobInput): Promise<void> {
  const database = db;
  if (database) {
    await addDoc(collection(database, COLLECTION), {
      ...input,
      createdAt: serverTimestamp(),
      createdBy: currentEmail(),
    });
    return;
  }
  const list = readLocal();
  list.push({
    ...input,
    id: `local-${Date.now()}`,
    createdBy: currentEmail(),
    createdAtMs: Date.now(),
    updatedBy: '',
    updatedAtMs: null,
  });
  writeLocal(list);
}

export async function upsertJob(job: Job): Promise<void> {
  const database = db;
  if (database) {
    // Never write the audit fields from the client copy: merge keeps the
    // original createdAt/createdBy intact and we re-stamp the "updated" pair.
    const { id, createdBy, createdAtMs, updatedBy, updatedAtMs, ...rest } = job;
    await setDoc(
      doc(database, COLLECTION, id),
      { ...rest, updatedAt: serverTimestamp(), updatedBy: currentEmail() },
      { merge: true },
    );
    return;
  }
  const list = readLocal();
  const idx = list.findIndex((j) => j.id === job.id);
  const stamped = { ...job, updatedBy: currentEmail(), updatedAtMs: Date.now() };
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  writeLocal(list);
}

/** Move a job to a new status column (used by drag-and-drop). */
export async function setJobStatus(id: string, status: JobStatus, order: number): Promise<void> {
  const database = db;
  if (database) {
    await updateDoc(doc(database, COLLECTION, id), {
      status,
      order,
      updatedAt: serverTimestamp(),
      updatedBy: currentEmail(),
    });
    return;
  }
  const list = readLocal();
  const idx = list.findIndex((j) => j.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], status, order };
    writeLocal(list);
  }
}

export async function deleteJob(id: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((j) => j.id !== id));
}
