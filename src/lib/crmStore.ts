import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  deleteField,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

/**
 * The CRM: people who might buy, before they are orders or jobs. Two
 * separate books — solar leads and computer leads — because different
 * staff work them; who may open which book is assigned per person from
 * the Users page. Each lead is a card that moves through a pipeline,
 * carries a source tag (where the lead came from — Facebook now means a
 * manual entry, later the integration will write here itself), and keeps
 * a running list of notes.
 */

export type CrmSection = 'solar' | 'computers';
export type CrmStatus = 'new' | 'contacted' | 'interested' | 'quoted' | 'won' | 'lost';

export const CRM_STATUSES: { key: CrmStatus; label: string }[] = [
  { key: 'new', label: 'New Leads' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'interested', label: 'Interested' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

/** Where a lead came from. 'Facebook' is what the future integration will
 *  stamp, so manual entries already speak the same language. */
export const CRM_TAGS = [
  'Facebook',
  'Instagram',
  'WhatsApp',
  'Phone call',
  'Walk-in',
  'Referral',
  'Website',
  'Other',
] as const;

export interface CrmNote {
  id: string;
  text: string;
  by: string; // staff email
  atMs: number;
}

export interface CrmContact {
  id: string;
  section: CrmSection;
  name: string;
  phone: string;
  city: string; // area / address, free text
  tag: string; // source, one of CRM_TAGS
  interest: string; // what they asked about — "8kW system", "gaming laptop"
  status: CrmStatus;
  notes: CrmNote[];
  order: number; // position weight within its column (newest first)
  /** When to nudge the team to recontact them; null = no reminder. */
  remindAtMs: number | null;
  createdBy: string;
  createdAtMs: number | null;
  updatedBy: string;
  updatedAtMs: number | null;
}

const COLLECTION = 'crmContacts';

function currentEmail(): string {
  return auth?.currentUser?.email?.toLowerCase() ?? '';
}

function toMillis(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const ts = v as { toMillis?: () => number } | null;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : null;
}

function normalize(data: Record<string, unknown>, id: string): CrmContact {
  return {
    id,
    section: data.section === 'computers' ? 'computers' : 'solar',
    name: String(data.name ?? ''),
    phone: String(data.phone ?? ''),
    city: String(data.city ?? ''),
    tag: String(data.tag ?? 'Other'),
    interest: String(data.interest ?? ''),
    status: (CRM_STATUSES.some((s) => s.key === data.status) ? data.status : 'new') as CrmStatus,
    notes: Array.isArray(data.notes)
      ? (data.notes as Record<string, unknown>[]).map((n) => ({
          id: String(n.id ?? ''),
          text: String(n.text ?? ''),
          by: String(n.by ?? ''),
          atMs: Number(n.atMs ?? 0),
        }))
      : [],
    order: Number(data.order ?? 0),
    remindAtMs: typeof data.remindAtMs === 'number' ? data.remindAtMs : null,
    createdBy: String(data.createdBy ?? ''),
    createdAtMs: toMillis(data.createdAt),
    updatedBy: String(data.updatedBy ?? ''),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

/**
 * Live list of one book's leads. The section filter is part of the query
 * because the security rules only grant reads the query can prove are
 * inside a book this person was given.
 */
export function subscribeContacts(
  section: CrmSection,
  cb: (list: CrmContact[]) => void,
  onError?: (message: string) => void,
): () => void {
  const database = db;
  if (!database) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(database, COLLECTION), where('section', '==', section)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => normalize(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => b.order - a.order || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)),
      ),
    (err) => {
      cb([]);
      onError?.(err.message);
    },
  );
}

type ContactInput = Omit<
  CrmContact,
  'id' | 'notes' | 'remindAtMs' | 'createdBy' | 'createdAtMs' | 'updatedBy' | 'updatedAtMs'
>;

export async function createContact(input: ContactInput): Promise<void> {
  const database = db;
  if (!database) throw new Error('The CRM needs a database connection.');
  await addDoc(collection(database, COLLECTION), {
    ...input,
    notes: [],
    createdAt: serverTimestamp(),
    createdBy: currentEmail(),
    updatedAt: serverTimestamp(),
    updatedBy: currentEmail(),
  });
}

export async function upsertContact(contact: CrmContact): Promise<void> {
  const database = db;
  if (!database) throw new Error('The CRM needs a database connection.');
  const { id, createdBy, createdAtMs, updatedBy, updatedAtMs, notes, ...rest } = contact;
  await setDoc(
    doc(database, COLLECTION, id),
    { ...rest, updatedAt: serverTimestamp(), updatedBy: currentEmail() },
    { merge: true },
  );
}

/** Drag a card to another column. */
export async function setContactStatus(
  id: string,
  status: CrmStatus,
  order: number,
): Promise<void> {
  const database = db;
  if (!database) throw new Error('The CRM needs a database connection.');
  await updateDoc(doc(database, COLLECTION, id), {
    status,
    order,
    updatedAt: serverTimestamp(),
    updatedBy: currentEmail(),
  });
}

/** Append a note to the lead's running list. */
/** Set, move or clear the follow-up reminder. Clearing the "already
 *  reminded" mark alongside means a re-set date will fire again. */
export async function setContactReminder(id: string, remindAtMs: number | null): Promise<void> {
  const database = db;
  if (!database) throw new Error('Reminders need a database connection.');
  await updateDoc(doc(database, COLLECTION, id), {
    remindAtMs: remindAtMs ?? deleteField(),
    remindedAtMs: deleteField(),
    updatedAt: serverTimestamp(),
    updatedBy: currentEmail(),
  });
}

export async function addContactNote(id: string, text: string): Promise<void> {
  const database = db;
  if (!database) throw new Error('The CRM needs a database connection.');
  const body = text.trim();
  if (!body) return;
  await updateDoc(doc(database, COLLECTION, id), {
    notes: arrayUnion({
      id: Math.random().toString(36).slice(2, 10),
      text: body,
      by: currentEmail(),
      atMs: Date.now(),
    }),
    updatedAt: serverTimestamp(),
    updatedBy: currentEmail(),
  });
}

export async function deleteContact(id: string): Promise<void> {
  const database = db;
  if (!database) throw new Error('The CRM needs a database connection.');
  await deleteDoc(doc(database, COLLECTION, id));
}

/** "0770 123 4567" → tel:+9647701234567-style link, or '' if no number. */
export function telLink(phone: string): string {
  const digits = phone.replace(/[^+\d]/g, '');
  return digits ? `tel:${digits}` : '';
}

/** WhatsApp chat link. Iraqi numbers written locally (07xx…) get the
 *  country code; anything already international is left alone. */
export function waLink(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = `964${d.slice(1)}`;
  else if (d.length === 10 && d.startsWith('7')) d = `964${d}`;
  return `https://wa.me/${d}`;
}
