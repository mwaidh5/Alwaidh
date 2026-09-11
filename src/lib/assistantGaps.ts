import {
  collection,
  deleteDoc,
  doc,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

/**
 * The questions that stopped the assistant.
 *
 * Whenever it tells a customer that a colleague will answer, the
 * question is written down here — together with what the colleague then
 * replied, if they did. The owner reads the two side by side and teaches
 * the answer in one tap; nothing is ever learned without them.
 */

const COLLECTION = 'assistantGaps';

export interface AssistantGap {
  id: string;
  chatId: string;
  question: string;
  /** What a colleague wrote in that chat afterwards, if anyone did. */
  staffAnswer: string;
  staffAnswerBy: string;
  taught: boolean;
  taughtBy: string;
  askedAtMs: number;
}

const ms = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | null;
  return typeof t?.toMillis === 'function' ? t.toMillis() : 0;
};

/** The newest questions first — answered ones included, so the owner can
 *  see what has already been taught. */
export function subscribeAssistantGaps(
  onChange: (gaps: AssistantGap[]) => void,
  onError?: (e: unknown) => void,
  max = 120,
): () => void {
  if (!db) return () => undefined;
  const q = query(collection(db, COLLECTION), orderBy('askedAt', 'desc'), fbLimit(max));
  return onSnapshot(
    q,
    (snap) =>
      onChange(
        snap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            chatId: String(v.chatId ?? ''),
            question: String(v.question ?? ''),
            staffAnswer: String(v.staffAnswer ?? ''),
            staffAnswerBy: String(v.staffAnswerBy ?? ''),
            taught: Boolean(v.taught),
            taughtBy: String(v.taughtBy ?? ''),
            askedAtMs: ms(v.askedAt),
          };
        }),
      ),
    (e) => onError?.(e),
  );
}

/** Ticked off: either taught, or set aside as nothing to learn. */
export async function markGapTaught(id: string, note = ''): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await setDoc(
    doc(db, COLLECTION, id),
    {
      taught: true,
      taughtNote: note.slice(0, 600),
      taughtBy: auth?.currentUser?.email ?? '',
      taughtAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Put it back on the pile. */
export async function markGapOpen(id: string): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await setDoc(doc(db, COLLECTION, id), { taught: false, taughtBy: '' }, { merge: true });
}

export async function removeGap(id: string): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await deleteDoc(doc(db, COLLECTION, id));
}
