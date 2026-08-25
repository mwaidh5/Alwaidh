import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

/**
 * Live chat between site visitors and staff.
 *
 * A visitor's conversation lives at chats/<random id>; the id is minted in
 * their browser and kept in localStorage, so it works with no sign-in. The
 * id being unguessable is what keeps other people out — the same model as
 * an order confirmation link.
 */

export interface ChatMeta {
  id: string;
  name: string; // what the visitor calls themselves ('' = guest)
  email: string; // filled in when they're signed in
  lastText: string;
  lastFrom: 'guest' | 'staff';
  lastAtMs: number | null;
  unreadForStaff: number;
  unreadForGuest: number;
}

/**
 * A product shared in the chat. The details are copied in rather than
 * looked up later, so an old conversation still reads correctly after the
 * product is renamed, repriced or removed.
 */
export interface ChatProductCard {
  id: string;
  name: string;
  price: number;
  currency: string;
  image: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  from: 'guest' | 'staff';
  by: string; // staff email; '' for the visitor
  byName: string; // staff display name, when the account has one
  atMs: number | null;
  product: ChatProductCard | null; // product card attached to the message
}

const COLLECTION = 'chats';
const ID_KEY = 'alwaidh.chat.id';

export function chatReady(): boolean {
  return Boolean(db);
}

/** The id of this browser's conversation, or '' if none was started yet. */
export function existingChatId(): string {
  try {
    return localStorage.getItem(ID_KEY) ?? '';
  } catch {
    return '';
  }
}

function ensureChatId(): string {
  let id = existingChatId();
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(ID_KEY, id);
    } catch {
      /* private mode: the chat lasts as long as the tab */
    }
  }
  return id;
}

function toMillis(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const ts = v as { toMillis?: () => number } | null;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : null;
}

function normalizeMeta(data: Record<string, unknown>, id: string): ChatMeta {
  return {
    id,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    lastText: String(data.lastText ?? ''),
    lastFrom: data.lastFrom === 'staff' ? 'staff' : 'guest',
    lastAtMs: toMillis(data.lastAt),
    unreadForStaff: Number(data.unreadForStaff ?? 0),
    unreadForGuest: Number(data.unreadForGuest ?? 0),
  };
}

function messagesRef(database: Firestore, chatId: string) {
  return collection(database, COLLECTION, chatId, 'messages');
}

/** Visitor sends a message; creates the conversation on first use. */
export async function sendGuestMessage(text: string, name = ''): Promise<string> {
  const database = db;
  if (!database) throw new Error('Chat needs a database connection.');
  const body = text.trim();
  if (!body) return existingChatId();
  const id = ensureChatId();
  const user = auth?.currentUser;
  await addDoc(messagesRef(database, id), {
    text: body,
    from: 'guest',
    by: '',
    at: serverTimestamp(),
  });
  await setDoc(
    doc(database, COLLECTION, id),
    {
      name: name.trim() || user?.displayName || '',
      email: user?.email ?? '',
      lastText: body,
      lastFrom: 'guest',
      lastAt: serverTimestamp(),
      unreadForStaff: increment(1),
      unreadForGuest: 0,
    },
    { merge: true },
  );
  return id;
}

/** Staff replies in a conversation, optionally sharing a product. */
export async function sendStaffReply(
  chatId: string,
  text: string,
  product: ChatProductCard | null = null,
): Promise<void> {
  const database = db;
  if (!database) throw new Error('Chat needs a database connection.');
  const body = text.trim();
  // A product card on its own is a complete reply.
  if (!body && !product) return;
  await addDoc(messagesRef(database, chatId), {
    text: body,
    from: 'staff',
    by: auth?.currentUser?.email ?? '',
    byName: auth?.currentUser?.displayName ?? '',
    at: serverTimestamp(),
    ...(product ? { product } : {}),
  });
  await setDoc(
    doc(database, COLLECTION, chatId),
    {
      lastText: body || `📦 ${product?.name ?? ''}`,
      lastFrom: 'staff',
      lastAt: serverTimestamp(),
      unreadForGuest: increment(1),
      unreadForStaff: 0,
    },
    { merge: true },
  );
}

/** Live messages of one conversation, oldest first. */
export function subscribeChatMessages(
  chatId: string,
  cb: (list: ChatMessage[]) => void,
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
          return {
            id: d.id,
            text: String(data.text ?? ''),
            from: data.from === 'staff' ? ('staff' as const) : ('guest' as const),
            by: String(data.by ?? ''),
            byName: String(data.byName ?? ''),
            atMs: toMillis(data.at),
            product: p?.id
              ? {
                  id: String(p.id),
                  name: String(p.name ?? ''),
                  price: Number(p.price ?? 0),
                  currency: String(p.currency ?? 'IQD'),
                  image: String(p.image ?? ''),
                }
              : null,
          };
        }),
      ),
    () => cb([]),
  );
}

/** Live metadata of one conversation (the visitor's unread badge). */
export function subscribeChatMeta(chatId: string, cb: (meta: ChatMeta | null) => void): () => void {
  const database = db;
  if (!database || !chatId) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(database, COLLECTION, chatId),
    (snap) => cb(snap.exists() ? normalizeMeta(snap.data() as Record<string, unknown>, snap.id) : null),
    () => cb(null),
  );
}

/** Every conversation, newest activity first — staff only. */
export function subscribeChats(
  cb: (list: ChatMeta[]) => void,
  onError?: (message: string) => void,
): () => void {
  const database = db;
  if (!database) {
    cb([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(database, COLLECTION), orderBy('lastAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => normalizeMeta(d.data() as Record<string, unknown>, d.id))),
    (err) => {
      cb([]);
      onError?.(err.message);
    },
  );
}

/** The visitor opened the panel — their unread count goes back to zero. */
export async function markGuestRead(chatId: string): Promise<void> {
  const database = db;
  if (!database || !chatId) return;
  await setDoc(doc(database, COLLECTION, chatId), { unreadForGuest: 0 }, { merge: true }).catch(
    () => undefined,
  );
}

/** Staff opened the conversation. */
export async function markStaffRead(chatId: string): Promise<void> {
  const database = db;
  if (!database || !chatId) return;
  await setDoc(doc(database, COLLECTION, chatId), { unreadForStaff: 0 }, { merge: true }).catch(
    () => undefined,
  );
}

/** Remove a conversation from the staff list (admin housekeeping). */
export async function deleteChat(chatId: string): Promise<void> {
  const database = db;
  if (!database) return;
  await deleteDoc(doc(database, COLLECTION, chatId));
}
