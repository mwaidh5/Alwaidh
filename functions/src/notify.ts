import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

/** The built-in owner; extra admins are read from settings at send time. */
export const OWNER_EMAILS = ['mwaidh5@gmail.com'];

/**
 * A person's own topic, one per channel — a broadcast cannot leave out
 * the person who caused the notification, so every channel became
 * your-own-topic-per-channel. Must fold emails the same way the web app
 * does (src/lib/push.ts).
 */
export function userTopic(email: string): string {
  return `user_${String(email).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

export async function push(topic: string, title: string, body: string, link: string): Promise<void> {
  try {
    await getMessaging().send({
      topic,
      notification: { title, body },
      // The app reads this to open the right screen when tapped.
      data: { link },
      apns: {
        // iOS: a sound also makes the phone buzz when it's on silent.
        payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } },
        headers: { 'apns-priority': '10' },
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'alwaidh-staff',
          sound: 'default',
          // Ask for the phone's usual notification sound and buzz. The
          // channel governs this from Android 8 on, but these matter on
          // older phones and when the channel was created elsewhere.
          defaultSound: true,
          defaultVibrateTimings: true,
          priority: 'max',
        },
      },
    });
    logger.info(`sent to ${topic}: ${title}`);
  } catch (err) {
    // Never let a notification failure roll back or retry the write itself.
    logger.error(`push to ${topic} failed`, err);
  }
}

/** The role lists, read fresh so newly added staff get pings immediately. */
export async function staffLists(): Promise<{ admins: string[]; jobs: string[]; messages: string[] }> {
  const site = (await getFirestore().doc('settings/site').get()).data() ?? {};
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : []);
  const admins = [...new Set([...OWNER_EMAILS, ...list(site.extraAdminEmails)])];
  return {
    admins,
    jobs: [...new Set([...admins, ...list(site.solarStaffEmails)])],
    messages: [
      ...new Set([
        ...admins,
        ...list(site.computerStaffEmails),
        ...list(site.solarStaffEmails),
        ...list(site.shopManagerEmails),
      ]),
    ],
  };
}

/** A presence record older than this is a device that has gone quiet. */
const FRESH_MS = 75_000;

/**
 * Who is already looking at the thing about to be announced.
 *
 * Every signed-in device writes what it is viewing (src/lib/presence.ts):
 * `messages`, `chat:<id>`, `jobs`, `job:<id>`, `team`, `team:<id>`. A
 * person with a fresh record matching any of `keys` has the news on a
 * screen in front of them — their other devices need not buzz.
 */
export async function viewersOf(keys: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!keys.length) return out;
  try {
    const since = Date.now() - FRESH_MS;
    const snap = await getFirestore()
      .collection('presence')
      .where('key', 'in', keys.slice(0, 30))
      .get();
    snap.forEach((d) => {
      const x = d.data();
      const at = x.at && typeof x.at.toMillis === 'function' ? x.at.toMillis() : 0;
      if (at >= since && x.email) out.add(String(x.email).toLowerCase());
    });
  } catch (err) {
    logger.warn('presence lookup failed; notifying everyone', err);
  }
  return out;
}

/**
 * One channel's note to each person's own topic — never the author's
 * (nobody needs their phone to announce the comment they just typed),
 * and never to someone already looking at it on another screen.
 *
 * The old shared-topic broadcast is gone: it could exclude nobody, which
 * is how the owner kept hearing his own job updates on his phone.
 */
export async function pushUsers(
  emails: string[],
  author: unknown,
  channel: string,
  title: string,
  body: string,
  link: string,
  focus: string[] = [],
): Promise<void> {
  const skip = String(author ?? '').trim().toLowerCase();
  const viewing = await viewersOf(focus);
  const targets = [...new Set(emails)].filter((e) => e && e !== skip && !viewing.has(e));
  if (viewing.size) logger.info(`${channel}: ${viewing.size} already viewing, skipped`);
  await Promise.all(targets.map((e) => push(`${userTopic(e)}__${channel}`, title, body, link)));
}
