import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

/**
 * What each of a person's devices is looking at, so the others can hold
 * their tongue.
 *
 * A laptop with the customer chat open has no need of the phone buzzing
 * about that chat; a phone with a job's details open has no need of the
 * laptop's alert about that job. Each signed-in device writes one small
 * record — "this email, on this device, is viewing <key>" — refreshed every
 * 25 seconds while the tab is visible and blanked the moment it is not.
 * The functions that send notifications read these before they push, and
 * skip anyone whose fresh record covers the thing being announced.
 *
 * Keys are simple strings: `messages` (the inbox is open), `chat:<id>`
 * (that conversation), `jobs` (the board), `job:<id>` (that job's details),
 * `team`, `team:<id>`. A record older than 75 seconds counts as gone.
 */
const DEVICE_KEY = 'alwaidh.device.v1';
export const FRESH_MS = 75_000;
const BEAT_MS = 25_000;

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'nostorage';
  }
}

const fold = (email: string) => email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

/** Announce what this screen is showing; `null` when it shows nothing worth
 *  silencing others for. */
export function usePresence(key: string | null): void {
  const { user } = useAuth();
  const email = user?.email ?? '';

  useEffect(() => {
    const database = db;
    if (!database || !email || !key) return;
    const ref = doc(database, 'presence', `${fold(email)}__${deviceId()}`);
    const write = (k: string) =>
      setDoc(ref, { email: email.toLowerCase(), key: k, at: serverTimestamp() }).catch(() => undefined);
    const beat = () => write(document.visibilityState === 'visible' ? key : '');
    beat();
    const timer = window.setInterval(beat, BEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', beat);
      // Leaving the screen: say so, rather than let the record age out
      // while the phone stays silent about something nobody is reading.
      write('');
    };
  }, [email, key]);
}

/**
 * The keys this person's OTHER devices are viewing right now — for the
 * dashboard's own in-page alerts, which never pass through the server.
 */
export function useOthersViewing(): Set<string> {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() ?? '';
  const [keys, setKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const database = db;
    if (!database || !email) return;
    const mine = `${fold(email)}__${deviceId()}`;
    return onSnapshot(
      query(collection(database, 'presence'), where('email', '==', email)),
      (snap) => {
        const now = Date.now();
        const next = new Set<string>();
        snap.forEach((d) => {
          if (d.id === mine) return;
          const data = d.data() as { key?: string; at?: { toMillis(): number } };
          const at = data.at?.toMillis?.() ?? 0;
          if (data.key && now - at < FRESH_MS) next.add(data.key);
        });
        setKeys(next);
      },
      () => setKeys(new Set()),
    );
  }, [email]);

  return keys;
}

/** Tidy up on sign-out so a stale record cannot outlive the session. */
export async function clearPresence(email: string): Promise<void> {
  const database = db;
  if (!database || !email) return;
  await deleteDoc(doc(database, 'presence', `${fold(email)}__${deviceId()}`)).catch(() => undefined);
}
