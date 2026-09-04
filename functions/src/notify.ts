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

/** How long an undelivered ping may wait for a device before it is
 *  dropped. A laptop that was asleep should not wake to an hour of chat
 *  pings its owner already handled on the phone. */
const WEB_TTL_S = 5 * 60;
const PHONE_TTL_S = 15 * 60;

export async function push(topic: string, title: string, body: string, link: string): Promise<void> {
  try {
    const now = Date.now();
    await getMessaging().send({
      topic,
      notification: { title, body },
      // The app reads `link` to open the right screen when tapped, and
      // `sentAt` to ignore a ping that reaches it long after the fact.
      data: { link, sentAt: String(now) },
      webpush: {
        headers: { TTL: String(WEB_TTL_S) },
        // The same tag the service worker uses, so the SDK's own copy of
        // the alert and ours collapse into one.
        notification: { tag: link, icon: '/pwa-192.png', badge: '/pwa-192.png' },
        fcmOptions: { link: `https://alwaidh.com${link}` },
      },
      apns: {
        // iOS: a sound also makes the phone buzz when it's on silent.
        payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } },
        headers: { 'apns-priority': '10', 'apns-expiration': String(Math.floor(now / 1000) + PHONE_TTL_S) },
      },
      android: {
        priority: 'high',
        ttl: PHONE_TTL_S * 1000,
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

/**
 * One person, several sign-ins. The owner's laptop uses one address and
 * his phone another; to the topics they are two people, and one of them
 * kept buzzing while the other was reading. Groups listed in
 * settings/site.staffAliases are treated as a single person: viewing on
 * any of them silences all of them, and a reply from any of them counts
 * as the author's own.
 */
export async function aliasGroups(): Promise<string[][]> {
  // One group per entry, written "a@x.com = b@y.com" (Firestore cannot
  // hold a list inside a list). Commas, semicolons and spaces also split.
  const site = (await getFirestore().doc('settings/site').get()).data() ?? {};
  const raw = Array.isArray(site.staffAliases) ? site.staffAliases : [];
  return raw
    .map((g: unknown) =>
      String(g ?? '')
        .split(/[=,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes('@')),
    )
    .filter((g: string[]) => g.length > 1);
}

/** Every address that is the same person as any address in `emails`. */
export async function sameAs(emails: Iterable<string>): Promise<Set<string>> {
  const out = new Set<string>([...emails].map((e) => e.toLowerCase()).filter(Boolean));
  for (const group of await aliasGroups()) {
    if (group.some((e) => out.has(e))) group.forEach((e) => out.add(e));
  }
  return out;
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
  const authorSelves = await sameAs([String(author ?? '')]);
  const viewing = await sameAs(await viewersOf(focus));
  const targets = [...new Set(emails)].filter((e) => e && !authorSelves.has(e) && !viewing.has(e));
  if (viewing.size) logger.info(`${channel}: already viewing, skipped: ${[...viewing].join(', ')}`);
  await Promise.all(targets.map((e) => push(`${userTopic(e)}__${channel}`, title, body, link)));
}
