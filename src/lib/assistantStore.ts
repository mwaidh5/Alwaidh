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
}

const REF = ['settings', 'assistant'] as const;

export async function loadAssistantConfig(): Promise<AssistantConfig> {
  if (!db) return { enabled: false, knowledge: '' };
  const snap = await getDoc(doc(db, ...REF));
  const data = snap.data() ?? {};
  return {
    enabled: Boolean(data.enabled ?? false),
    knowledge: String(data.knowledge ?? ''),
  };
}

export async function saveAssistantConfig(cfg: AssistantConfig): Promise<void> {
  if (!db) throw new Error('Not connected.');
  await setDoc(doc(db, ...REF), cfg, { merge: true });
}
