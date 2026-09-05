import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * The chat assistant's little brain-pan: whether it speaks, and the
 * owner's notes it answers from. Lives in the settings collection so the
 * existing rules apply — anyone may read, only admins write. The Cloud
 * Function reads the same document before every reply.
 */
export interface AssistantConfig {
  enabled: boolean;
  knowledge: string;
  /** What it says when it hands a customer to the team (Arabic chats). */
  handoffLine: string;
}

const REF = ['settings', 'assistant'] as const;

export async function loadAssistantConfig(): Promise<AssistantConfig> {
  if (!db) return { enabled: false, knowledge: '', handoffLine: '' };
  const snap = await getDoc(doc(db, ...REF));
  const data = snap.data() ?? {};
  return {
    enabled: Boolean(data.enabled ?? false),
    knowledge: String(data.knowledge ?? ''),
    handoffLine: String(data.handoffLine ?? ''),
  };
}

/** The switch alone. It never touches the notes, so flipping it before
 *  they have loaded cannot wipe them - which is exactly how twenty lines
 *  of notes vanished once. */
export async function saveAssistantEnabled(enabled: boolean): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await setDoc(doc(db, ...REF), { enabled }, { merge: true });
}

/**
 * The notes. The text they replace is kept alongside as a backup, so one
 * bad save is never the end of it - and an empty box never overwrites
 * notes that exist: clearing them has to be deliberate.
 */
export async function saveAssistantKnowledge(knowledge: string, { allowEmpty = false } = {}): Promise<void> {
  if (!db) throw new Error('Not connected.');
  const ref = doc(db, ...REF);
  const current = String((await getDoc(ref)).data()?.knowledge ?? '');
  if (!knowledge.trim() && current.trim() && !allowEmpty) {
    throw new Error('The notes box is empty. Reload the page to see the saved notes; to erase them on purpose, delete them line by line.');
  }
  await setDoc(ref, { knowledge, knowledgeBackup: current }, { merge: true });
}

/** The hand-off sentence alone. Empty means the built-in one. */
export async function saveAssistantHandoff(handoffLine: string): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await setDoc(doc(db, ...REF), { handoffLine: handoffLine.trim() }, { merge: true });
}

/** @deprecated kept for older call sites; prefer the two above. */
export async function saveAssistantConfig(cfg: AssistantConfig): Promise<void> {
  await saveAssistantEnabled(cfg.enabled);
  await saveAssistantKnowledge(cfg.knowledge);
}
