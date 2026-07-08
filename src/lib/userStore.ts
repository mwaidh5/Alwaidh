import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'computer-staff' | 'solar-staff' | 'customer';
  disabled?: boolean;
  createdAt: number;
  lastSeenAt: number;
}

const COLLECTION = 'users';
const LS_KEY = 'alwaidh.users.v1';

function readLocal(): AppUser[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: AppUser[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function normalize(data: Record<string, unknown>, uid: string): AppUser {
  const c = data.createdAt;
  const l = data.lastSeenAt;
  return {
    uid,
    email: String(data.email ?? ''),
    displayName: data.displayName ? String(data.displayName) : undefined,
    photoURL: data.photoURL ? String(data.photoURL) : undefined,
    role: (['admin', 'computer-staff', 'solar-staff', 'customer'].includes(String(data.role))
      ? data.role
      : 'customer') as AppUser['role'],
    disabled: Boolean(data.disabled ?? false),
    createdAt:
      c instanceof Timestamp ? c.toMillis() : typeof c === 'number' ? c : Date.now(),
    lastSeenAt:
      l instanceof Timestamp ? l.toMillis() : typeof l === 'number' ? l : Date.now(),
  };
}

export interface UpsertUserInput {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
}

export async function recordUserLogin(input: UpsertUserInput): Promise<void> {
  const database = db;
  const base = {
    email: input.email,
    displayName: input.displayName ?? '',
    photoURL: input.photoURL ?? '',
  };
  if (database) {
    await setDoc(
      doc(database, COLLECTION, input.uid),
      {
        ...base,
        lastSeenAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }
  const list = readLocal();
  const existing = list.find((u) => u.uid === input.uid);
  const now = Date.now();
  if (existing) {
    existing.email = base.email;
    existing.displayName = base.displayName || undefined;
    existing.photoURL = base.photoURL || undefined;
    existing.lastSeenAt = now;
  } else {
    list.push({
      uid: input.uid,
      email: base.email,
      displayName: base.displayName || undefined,
      photoURL: base.photoURL || undefined,
      role: 'customer',
      createdAt: now,
      lastSeenAt: now,
    });
  }
  writeLocal(list);
}

export async function listUsers(): Promise<AppUser[]> {
  const database = db;
  if (database) {
    const snap = await getDocs(query(collection(database, COLLECTION), orderBy('lastSeenAt', 'desc')));
    return snap.docs.map((d) => normalize(d.data() as Record<string, unknown>, d.id));
  }
  return readLocal()
    .slice()
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function setUserRole(uid: string, role: AppUser['role']): Promise<void> {
  const database = db;
  if (database) {
    await updateDoc(doc(database, COLLECTION, uid), { role });
    return;
  }
  writeLocal(readLocal().map((u) => (u.uid === uid ? { ...u, role } : u)));
}

export async function setUserDisabled(uid: string, disabled: boolean): Promise<void> {
  const database = db;
  if (database) {
    await updateDoc(doc(database, COLLECTION, uid), { disabled });
    return;
  }
  writeLocal(readLocal().map((u) => (u.uid === uid ? { ...u, disabled } : u)));
}

export async function createInvitedUser(input: {
  email: string;
  displayName?: string;
  role: AppUser['role'];
}): Promise<void> {
  const database = db;
  const uid = `invite-${crypto.randomUUID()}`;
  const payload = {
    email: input.email.toLowerCase(),
    displayName: input.displayName ?? '',
    role: input.role,
  };
  if (database) {
    await setDoc(doc(database, COLLECTION, uid), {
      ...payload,
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      invited: true,
    });
    return;
  }
  const now = Date.now();
  writeLocal([
    {
      uid,
      email: payload.email,
      displayName: payload.displayName || undefined,
      role: payload.role,
      createdAt: now,
      lastSeenAt: now,
    },
    ...readLocal(),
  ]);
}

export async function deleteUser(uid: string): Promise<void> {
  const database = db;
  if (database) {
    await deleteDoc(doc(database, COLLECTION, uid));
    return;
  }
  writeLocal(readLocal().filter((u) => u.uid !== uid));
}
