import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Keep the live data live.
 *
 * On a phone the app is put to sleep the moment it leaves the screen, and
 * the socket that carries new messages dies with it. When the person comes
 * back — usually because a notification just told them something is
 * waiting — the database client may take a minute or more to notice and
 * dial again, so the screen shows yesterday's list until someone reloads.
 *
 * Rather than wait for it to notice, we hang up and redial ourselves the
 * moment the app is back in front after any real absence, when the network
 * comes back, and when a notification arrives. Every open listener is
 * re-subscribed by the client on reconnect, so the new message lands
 * within a second or two.
 */

let busy = false;
let lastNudge = 0;

/** Drop and re-open the connection. Cheap, and throttled to once in 5 s. */
export async function nudgeConnection(): Promise<void> {
  if (!db || busy || Date.now() - lastNudge < 5_000) return;
  busy = true;
  lastNudge = Date.now();
  try {
    await disableNetwork(db);
    await enableNetwork(db);
  } catch {
    /* already closing down, or no network at all — the client will retry */
  } finally {
    busy = false;
  }
}

/** Call once at start-up. */
export function keepLive(): void {
  if (typeof document === 'undefined' || !db) return;
  let hiddenAt = 0;
  // A quick switch to another app and back leaves the socket intact; only
  // a real absence (the phone locked, another app for a while) is worth a
  // reconnect.
  const AWAY = 15_000;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    if (away >= AWAY) void nudgeConnection();
  });
  window.addEventListener('online', () => void nudgeConnection());
  // Restored from the back-forward cache: the page is exactly as it was,
  // socket included — which is to say, dead.
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) void nudgeConnection();
  });
}
