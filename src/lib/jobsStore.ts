import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  FieldPath,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
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
  installer: string; // technician names, shown on the card
  installerEmails: string[]; // the installer accounts this job belongs to
  notes: string;
  invoiceUrl: string; // attached PDF invoice (Storage URL)
  invoiceName: string; // original filename of the invoice
  status: JobStatus;
  order: number; // position within its column
  createdBy: string; // email of who added the job
  createdAtMs: number | null; // when it was added (ms epoch)
  updatedBy: string; // email of the last person who changed it
  updatedAtMs: number | null; // when it was last changed (ms epoch)
  deletedAtMs: number | null; // set = the job is in the Trash
  deletedBy: string; // who moved it to the Trash
}

/**
 * One line in a job's history: who did what, and when. Comments live here
 * too, so the whole story of a job reads in one list.
 */
export type JobEventKind = 'created' | 'edited' | 'status' | 'comment';

/** A photo or PDF attached to a comment. */
export interface JobAttachment {
  url: string;
  name: string;
  kind: 'image' | 'pdf';
}

export interface JobEvent {
  id: string;
  kind: JobEventKind;
  by: string;          // email of the staff member
  atMs: number | null;
  text: string;        // comment body, or a short description of the change
  mentions: string[];  // emails tagged in a comment
  attachments: JobAttachment[]; // photos and PDFs posted with the comment
  reactions: Record<string, string>; // email → emoji, one per person
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
    installerEmails: readInstallerEmails(data),
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
    deletedAtMs: toMillis(data.deletedAt),
    deletedBy: String(data.deletedBy ?? ''),
  };
}

/**
 * Assigned installers, reading the single-installer field that jobs used
 * before a job could have a whole crew on it.
 */
function readInstallerEmails(data: Record<string, unknown>): string[] {
  const list = Array.isArray(data.installerEmails)
    ? data.installerEmails
    : data.installerEmail
      ? [data.installerEmail]
      : [];
  return [...new Set(list.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
}

/**
 * Bring an old single-installer job up to date, so its installer keeps
 * seeing it: their query matches on the list, not the old field. Runs once
 * per job per session, best-effort — only staff ever read jobs unfiltered.
 */
const backfilled = new Set<string>();
function backfillInstallers(database: Firestore, id: string, data: Record<string, unknown>): void {
  if (backfilled.has(id) || Array.isArray(data.installerEmails)) return;
  const legacy = readInstallerEmails(data);
  if (!legacy.length) return;
  backfilled.add(id);
  updateDoc(doc(database, COLLECTION, id), { installerEmails: legacy }).catch(() => {
    /* not allowed to write, or gone — the board still shows it correctly */
  });
}

/**
 * Build a Waze navigation link from a pasted Google Maps link.
 * Tries the precise pin (!3d…!4d…), then the ?q=lat,lng form, then the
 * @lat,lng viewport; if the link hides its coordinates (e.g. maps.app.goo.gl
 * short links), falls back to a Waze search for the place name or address.
 *
 * Returns '' when no map link was saved — guessing from the written address
 * sent drivers to the wrong place, so the button stays hidden until someone
 * actually pastes a link.
 */
export function wazeFromGoogleMaps(mapUrl: string, addressFallback = ''): string {
  const url = mapUrl.trim();
  if (!url) return '';
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
  /** Installers may only read their own jobs, so the filter has to be part
   *  of the query — the security rules reject an unfiltered read. */
  onlyForInstaller?: string,
): () => void {
  const database = db;
  if (database) {
    const base = collection(database, COLLECTION);
    return onSnapshot(
      onlyForInstaller
        ? query(base, where('installerEmails', 'array-contains', onlyForInstaller.toLowerCase()))
        : query(base, orderBy('order', 'asc')),
      (snap) =>
        cb(
          snap.docs
            .map((d) => {
              const data = d.data() as Record<string, unknown>;
              if (!onlyForInstaller) backfillInstallers(database, d.id, data);
              return normalize(data, d.id);
            })
            // Deleted jobs live on in the Trash, not on the board.
            .filter((j) => !j.deletedAtMs),
        ),
      (err) => {
        cb([]);
        onError?.(err.message);
      },
    );
  }
  const live = () => readLocal().filter((j) => !j.deletedAtMs);
  cb(live());
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) cb(live());
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** The Trash: jobs someone deleted, newest first. */
export function subscribeDeletedJobs(cb: (list: Job[]) => void): () => void {
  const database = db;
  if (database) {
    return onSnapshot(
      collection(database, COLLECTION),
      (snap) =>
        cb(
          snap.docs
            .map((d) => normalize(d.data() as Record<string, unknown>, d.id))
            .filter((j) => Boolean(j.deletedAtMs))
            .sort((a, b) => (b.deletedAtMs ?? 0) - (a.deletedAtMs ?? 0)),
        ),
      () => cb([]),
    );
  }
  const emit = () => cb(readLocal().filter((j) => Boolean(j.deletedAtMs)));
  emit();
  const handler = (e: StorageEvent) => {
    if (e.key === LS_KEY) emit();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** Fields the store stamps itself — callers never provide them. */
type JobInput = Omit<
  Job,
  'id' | 'createdBy' | 'createdAtMs' | 'updatedBy' | 'updatedAtMs' | 'deletedAtMs' | 'deletedBy'
>;

export async function createJob(input: JobInput): Promise<void> {
  const database = db;
  if (database) {
    const ref = await addDoc(collection(database, COLLECTION), {
      ...input,
      createdAt: serverTimestamp(),
      createdBy: currentEmail(),
    });
    await logJobEvent(ref.id, 'created', 'Job created');
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
    deletedAtMs: null,
    deletedBy: '',
  });
  writeLocal(list);
}

export async function upsertJob(job: Job): Promise<void> {
  const database = db;
  if (database) {
    // Never write the audit fields from the client copy: merge keeps the
    // original createdAt/createdBy intact and we re-stamp the "updated" pair.
    const { id, createdBy, createdAtMs, updatedBy, updatedAtMs, deletedAtMs, deletedBy, ...rest } =
      job;
    await setDoc(
      doc(database, COLLECTION, id),
      { ...rest, updatedAt: serverTimestamp(), updatedBy: currentEmail() },
      { merge: true },
    );
    await logJobEvent(id, 'edited', 'Job details updated');
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
    const label = JOB_STATUSES.find((s) => s.key === status)?.label ?? status;
    await logJobEvent(id, 'status', `Moved to ${label}`);
    return;
  }
  const list = readLocal();
  const idx = list.findIndex((j) => j.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], status, order };
    writeLocal(list);
  }
}

/** Move a job to the Trash — recoverable, see restoreJob. */
export async function deleteJob(id: string): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(
      doc(database, COLLECTION, id),
      { deletedAt: serverTimestamp(), deletedBy: currentEmail() },
      { merge: true },
    );
    return;
  }
  writeLocal(
    readLocal().map((j) =>
      j.id === id ? { ...j, deletedAtMs: Date.now(), deletedBy: currentEmail() } : j,
    ),
  );
}

/** Put a job back on the board. */
export async function restoreJob(id: string): Promise<void> {
  const database = db;
  if (database) {
    await setDoc(
      doc(database, COLLECTION, id),
      { deletedAt: deleteField(), deletedBy: deleteField() },
      { merge: true },
    );
    return;
  }
  writeLocal(
    readLocal().map((j) => (j.id === id ? { ...j, deletedAtMs: null, deletedBy: '' } : j)),
  );
}

/** Delete a job for good. Cannot be undone. */
export async function destroyJob(id: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((j) => j.id !== id));
}


// ---------------------------------------------------------------------------
// Job activity: creation, edits, status moves and comments.
// ---------------------------------------------------------------------------

function activityRef(database: Firestore, jobId: string) {
  return collection(database, COLLECTION, jobId, 'activity');
}

/** Record something that happened to a job. Never throws — a job save must
 *  not fail just because its history line couldn't be written. */
export async function logJobEvent(
  jobId: string,
  kind: JobEventKind,
  text: string,
  mentions: string[] = [],
): Promise<void> {
  const database = db;
  if (!database || !jobId) return;
  try {
    await addDoc(activityRef(database, jobId), {
      kind,
      text,
      mentions,
      by: currentEmail(),
      at: serverTimestamp(),
    });
    // Touch the job itself as well. A comment is a change to the job as far
    // as anyone reading the board is concerned, but it is written to a
    // sub-collection — so without this the card would never show that
    // something had happened on it.
    await setDoc(
      doc(database, COLLECTION, jobId),
      { updatedAt: serverTimestamp(), updatedBy: currentEmail() },
      { merge: true },
    ).catch(() => undefined);
  } catch (e) {
    console.warn('Could not record job activity:', e instanceof Error ? e.message : e);
  }
}


/** email → emoji, tolerant of anything odd that got written. */
function readReactions(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string' && val) out[k.toLowerCase()] = val;
    }
  }
  return out;
}

/** Post a comment, optionally tagging colleagues and attaching photos/PDFs. */
export async function addJobComment(
  jobId: string,
  text: string,
  mentions: string[] = [],
  attachments: JobAttachment[] = [],
): Promise<void> {
  const database = db;
  if (!database) throw new Error('Comments need a database connection.');
  const body = text.trim();
  // A photo on its own is a perfectly good comment.
  if (!body && !attachments.length) return;
  await addDoc(activityRef(database, jobId), {
    kind: 'comment',
    text: body,
    mentions,
    attachments,
    by: currentEmail(),
    at: serverTimestamp(),
  });
}

/** Put, swap or take back this account's reaction on one history entry.
 *  The rules allow exactly this: only the caller's own slot in the
 *  reactions map may change, and nothing else on the entry. */
export async function setJobReaction(
  jobId: string,
  entryId: string,
  emoji: string | null,
): Promise<void> {
  const database = db;
  if (!database) throw new Error('Reactions need a database connection.');
  await updateDoc(
    doc(database, COLLECTION, jobId, 'activity', entryId),
    new FieldPath('reactions', currentEmail()),
    emoji ?? deleteField(),
  );
}

/** Live history for one job, oldest first. */
/** Newest last, with anything still on its way to the server at the very
 *  end: those carry no timestamp yet, and Firestore would otherwise sort
 *  them before every real message. */
function sendingLast<T extends { atMs: number | null }>(list: T[]): T[] {
  return [...list].sort((x, y) => (x.atMs ?? Infinity) - (y.atMs ?? Infinity));
}

export function subscribeJobActivity(
  jobId: string,
  cb: (events: JobEvent[]) => void,
): () => void {
  const database = db;
  if (!database || !jobId) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(activityRef(database, jobId), orderBy('at', 'asc')),
    (snap) =>
      cb(
        sendingLast(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            kind: (['created', 'edited', 'status', 'comment'].includes(String(data.kind))
              ? data.kind
              : 'comment') as JobEventKind,
            by: String(data.by ?? ''),
            atMs: toMillis(data.at),
            text: String(data.text ?? ''),
            mentions: Array.isArray(data.mentions) ? data.mentions.map(String) : [],
            reactions: readReactions(data.reactions),
            attachments: Array.isArray(data.attachments)
              ? (data.attachments as Record<string, unknown>[]).map((a) => ({
                  url: String(a.url ?? ''),
                  name: String(a.name ?? 'file'),
                  kind: a.kind === 'pdf' ? ('pdf' as const) : ('image' as const),
                }))
              : [],
          };
        }),
        ),
      ),
    () => cb([]),
  );
}
