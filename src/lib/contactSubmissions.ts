import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, firebaseReady } from '../firebase';

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  createdAt: number;
}

export interface NewContactSubmission {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

const COLLECTION = 'contactSubmissions';
const LS_KEY = 'alwaidh.contactSubmissions.v1';

export type StorageMode = 'firestore' | 'local';

export function storageMode(): StorageMode {
  return firebaseReady && db ? 'firestore' : 'local';
}

function readLocal(): ContactSubmission[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContactSubmission[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: ContactSubmission[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export async function submitContact(input: NewContactSubmission): Promise<void> {
  if (db) {
    await addDoc(collection(db, COLLECTION), {
      ...input,
      createdAt: serverTimestamp(),
    });
    return;
  }
  const list = readLocal();
  const entry: ContactSubmission = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: Date.now(),
  };
  writeLocal([entry, ...list]);
}

export async function listContactSubmissions(): Promise<ContactSubmission[]> {
  if (db) {
    const snap = await getDocs(query(collection(db, COLLECTION), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const ts = data.createdAt;
      const createdAt =
        ts instanceof Timestamp ? ts.toMillis() : typeof ts === 'number' ? ts : Date.now();
      return {
        id: d.id,
        name: String(data.name ?? ''),
        email: String(data.email ?? ''),
        phone: data.phone ? String(data.phone) : undefined,
        subject: data.subject ? String(data.subject) : undefined,
        message: String(data.message ?? ''),
        createdAt,
      };
    });
  }
  return readLocal();
}

export async function deleteContactSubmission(id: string): Promise<void> {
  if (db) {
    await deleteDoc(doc(db, COLLECTION, id));
    return;
  }
  writeLocal(readLocal().filter((s) => s.id !== id));
}
