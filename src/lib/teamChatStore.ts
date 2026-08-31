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
  where,
  type Firestore,
  deleteField,
  FieldPath,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { ChatProductCard } from './chatStore';

/**
 * Internal messaging between staff: one-to-one chats and named groups.
 *
 * Membership is the whole access model — you can only see a conversation
 * whose members list holds your email, enforced in the security rules, so
 * the query always filters on it.
 */

/** A solar job pointed at from a message. Details are copied in so an old
 *  message still reads correctly after the job changes. */
export interface TeamJobCard {
  id: string;
  customer: string;
  system: string;
  status: string;
}

export interface TeamChat {
  id: string;
  name: string; // group name; '' for a one-to-one chat
  isGroup: boolean;
  members: string[]; // lowercase emails
  lastText: string;
  lastBy: string;
  lastAtMs: number | null;
  reads: Record<string, number>; // email → when they last opened it (ms)
  createdBy: string;
}

export interface TeamMessage {
  id: string;
  text: string;
  by: string;
  atMs: number | null;
  mentions: string[];
  product: ChatProductCard | null;
  job: TeamJobCard | null;
  reactions: Record<string, string>; // email → emoji, one per person
  editedMs: number | null; // when the sender last fixed the wording
}

const COLLECTION = 'teamChats';

function myEmail(): string {
  return auth?.currentUser?.email?.toLowerCase() ?? '';
}

function toMillis(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const ts = v as { toMillis?: () => number } | null;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : null;
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

function normalizeChat(data: Record<string, unknown>, id: string): TeamChat {
  const reads = (data.reads ?? {}) as Record<string, unknown>;
  return {
    id,
    name: String(data.name ?? ''),
    isGroup: Boolean(data.isGroup),
    members: Array.isArray(data.members)
      ? data.members.map((m) => String(m).toLowerCase())
      : [],
    lastText: String(data.lastText ?? ''),
    lastBy: String(data.lastBy ?? ''),
    lastAtMs: toMillis(data.lastAt),
    reads: Object.fromEntries(Object.entries(reads).map(([k, v]) => [k, Number(v) || 0])),
    createdBy: String(data.createdBy ?? ''),
  };
}

function messagesRef(database: Firestore, chatId: string) {
  return collection(database, COLLECTION, chatId, 'messages');
}

/** True when this conversation holds something the signed-in user hasn't read. */
export function hasUnread(chat: TeamChat, email = myEmail()): boolean {
  if (!chat.lastAtMs || chat.lastBy === email) return false;
  return chat.lastAtMs > (chat.reads[email] ?? 0);
}

/** Every conversation the signed-in user belongs to, newest activity first. */
export function subscribeTeamChats(
  cb: (list: TeamChat[]) => void,
  onError?: (message: string) => void,
): () => void {
  const database = db;
  const email = myEmail();
  if (!database || !email) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(database, COLLECTION), where('members', 'array-contains', email)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => normalizeChat(d.data() as Record<string, unknown>, d.id))
          // Sorted here rather than in the query: pairing array-contains with
          // an orderBy would need a composite index.
          .sort((a, b) => (b.lastAtMs ?? 0) - (a.lastAtMs ?? 0)),
      ),
    (err) => {
      cb([]);
      onError?.(err.message);
    },
  );
}

/** Live messages in one conversation, oldest first. */
export function subscribeTeamMessages(
  chatId: string,
  cb: (list: TeamMessage[]) => void,
): () => void {
  const database = db;
  if (!database || !chatId) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(messagesRef(database, chatId), orderBy('at', 'asc')),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const p = data.product as Record<string, unknown> | undefined;
          const j = data.job as Record<string, unknown> | undefined;
          return {
            id: d.id,
            text: String(data.text ?? ''),
            by: String(data.by ?? ''),
            atMs: toMillis(data.at),
            mentions: Array.isArray(data.mentions) ? data.mentions.map(String) : [],
            reactions: readReactions(data.reactions),
            editedMs: toMillis(data.editedAt),
            product: p?.id
              ? {
                  id: String(p.id),
                  name: String(p.name ?? ''),
                  price: Number(p.price ?? 0),
                  currency: String(p.currency ?? 'IQD'),
                  image: String(p.image ?? ''),
                }
              : null,
            job: j?.id
              ? {
                  id: String(j.id),
                  customer: String(j.customer ?? ''),
                  system: String(j.system ?? ''),
                  status: String(j.status ?? ''),
                }
              : null,
          };
        }),
      ),
    () => cb([]),
  );
}

/** The five-minute grace: the author fixing their own message. */
export async function editTeamMessage(chatId: string, messageId: string, text: string): Promise<void> {
  const database = db;
  if (!database) throw new Error('Messaging needs a database connection.');
  await updateDoc(doc(database, COLLECTION, chatId, 'messages', messageId), {
    text: text.trim(),
    editedAt: serverTimestamp(),
  });
}

export async function deleteTeamMessage(chatId: string, messageId: string): Promise<void> {
  const database = db;
  if (!database) throw new Error('Messaging needs a database connection.');
  await deleteDoc(doc(database, COLLECTION, chatId, 'messages', messageId));
}

/** Put, swap or take back this account's reaction on one message. The
 *  rules allow only the caller's own slot in the reactions map to move. */
export async function setTeamReaction(
  chatId: string,
  messageId: string,
  emoji: string | null,
): Promise<void> {
  const database = db;
  if (!database) throw new Error('Messaging needs a database connection.');
  await updateDoc(
    doc(database, COLLECTION, chatId, 'messages', messageId),
    new FieldPath('reactions', myEmail()),
    emoji ?? deleteField(),
  );
}

/**
 * Start a conversation. A one-to-one chat is reused if it already exists,
 * so two people never end up with parallel threads.
 */
export async function createTeamChat(
  members: string[],
  name = '',
  existing: TeamChat[] = [],
): Promise<string> {
  const database = db;
  if (!database) throw new Error('Messaging needs a database connection.');
  const me = myEmail();
  const list = [...new Set([me, ...members.map((m) => m.trim().toLowerCase())])].filter(Boolean);
  if (list.length < 2) throw new Error('Pick at least one person.');
  const isGroup = list.length > 2 || Boolean(name.trim());

  if (!isGroup) {
    const other = list.find((m) => m !== me);
    const already = existing.find(
      (c) => !c.isGroup && c.members.length === 2 && other && c.members.includes(other),
    );
    if (already) return already.id;
  }

  const ref = await addDoc(collection(database, COLLECTION), {
    name: name.trim(),
    isGroup,
    members: list,
    createdBy: me,
    createdAt: serverTimestamp(),
    lastText: '',
    lastBy: '',
    lastAt: serverTimestamp(),
    reads: { [me]: Date.now() },
  });
  return ref.id;
}

/** Post a message, optionally tagging people and pointing at a product or job. */
export async function sendTeamMessage(
  chatId: string,
  text: string,
  opts: {
    mentions?: string[];
    product?: ChatProductCard | null;
    job?: TeamJobCard | null;
  } = {},
): Promise<void> {
  const database = db;
  if (!database) throw new Error('Messaging needs a database connection.');
  const body = text.trim();
  const { mentions = [], product = null, job = null } = opts;
  if (!body && !product && !job) return;
  const me = myEmail();
  await addDoc(messagesRef(database, chatId), {
    text: body,
    by: me,
    at: serverTimestamp(),
    mentions,
    ...(product ? { product } : {}),
    ...(job ? { job } : {}),
  });
  await setDoc(
    doc(database, COLLECTION, chatId),
    {
      lastText: body || (product ? `📦 ${product.name}` : `🛠️ ${job?.customer ?? ''}`),
      lastBy: me,
      lastAt: serverTimestamp(),
      reads: { [me]: Date.now() },
    },
    { merge: true },
  );
}

/** Mark a conversation read for the signed-in user. */
export async function markTeamRead(chatId: string): Promise<void> {
  const database = db;
  const me = myEmail();
  if (!database || !chatId || !me) return;
  await setDoc(
    doc(database, COLLECTION, chatId),
    { reads: { [me]: Date.now() } },
    { merge: true },
  ).catch(() => undefined);
}

/** Add people to a group. */
export async function addTeamMembers(chatId: string, emails: string[]): Promise<void> {
  const database = db;
  if (!database) return;
  const chat = await new Promise<TeamChat | null>((resolve) => {
    const stop = onSnapshot(doc(database, COLLECTION, chatId), (snap) => {
      stop();
      resolve(snap.exists() ? normalizeChat(snap.data() as Record<string, unknown>, snap.id) : null);
    });
  });
  if (!chat) return;
  const next = [...new Set([...chat.members, ...emails.map((e) => e.toLowerCase())])];
  await setDoc(doc(database, COLLECTION, chatId), { members: next, isGroup: true }, { merge: true });
}

/** Rename a group. */
export async function renameTeamChat(chatId: string, name: string): Promise<void> {
  const database = db;
  if (!database) return;
  await setDoc(doc(database, COLLECTION, chatId), { name: name.trim(), isGroup: true }, { merge: true });
}

/** Delete a conversation (its creator, or an admin). */
export async function deleteTeamChat(chatId: string): Promise<void> {
  const database = db;
  if (!database) return;
  await deleteDoc(doc(database, COLLECTION, chatId));
}
