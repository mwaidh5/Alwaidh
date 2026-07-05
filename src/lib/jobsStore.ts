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
import { db } from '../firebase';

export type JobStatus = 'new' | 'scheduled' | 'in_progress' | 'done';
export type JobType = 'install' | 'repair';

export interface Job {
  id: string;
  customer: string;
  phone: string;
  address: string;
  type: JobType;
  system: string; // e.g. "6 kW rooftop system"
  notes: string;
  status: JobStatus;
  order: number; // position within its column
}

export const JOB_STATUSES: { key: JobStatus; label: string }[] = [
  { key: 'new', label: 'New Requests' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Completed' },
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
    type: (data.type as JobType) === 'repair' ? 'repair' : 'install',
    system: String(data.system ?? ''),
    notes: String(data.notes ?? ''),
    status: (['new', 'scheduled', 'in_progress', 'done'].includes(String(data.status))
      ? data.status
      : 'new') as JobStatus,
    order: Number(data.order ?? 0),
  };
}

export function subscribeJobs(cb: (list: Job[]) => void): () => void {
  const database = db;
  if (database) {
    return onSnapshot(
      query(collection(database, COLLECTION), orderBy('order', 'asc')),
      (snap) => cb(snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id))),
      () => cb([]),
    );
  }
  cb(readLocal());
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) cb(readLocal());
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export async function createJob(input: Omit<Job, 'id'>): Promise<void> {
  const database = db;
  if (database) {
    await addDoc(collection(database, COLLECTION), { ...input, createdAt: serverTimestamp() });
    return;
  }
  const list = readLocal();
  list.push({ ...input, id: `local-${Date.now()}` });
  writeLocal(list);
}

export async function upsertJob(job: Job): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(doc(database, COLLECTION, job.id), { ...job, updatedAt: serverTimestamp() });
    return;
  }
  const list = readLocal();
  const idx = list.findIndex((j) => j.id === job.id);
  if (idx >= 0) list[idx] = job;
  else list.push(job);
  writeLocal(list);
}

/** Move a job to a new status column (used by drag-and-drop). */
export async function setJobStatus(id: string, status: JobStatus, order: number): Promise<void> {
  const database = db;
  if (database) {
    await updateDoc(doc(database, COLLECTION, id), { status, order, updatedAt: serverTimestamp() });
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
