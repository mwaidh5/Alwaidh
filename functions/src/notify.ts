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

/**
 * One channel's note to each person's own topic — never the author's:
 * nobody needs their phone to announce the comment they just typed.
 *
 * `legacyTopic` also broadcasts to the channel's old shared topic, for
 * devices still running the app version that subscribed to those. They
 * drop it on their next sync; until then this keeps them hearing (with
 * no author exclusion — the price of the old scheme). Updated devices
 * left the legacy topic, so nobody is pinged twice.
 */
export async function pushUsers(
  emails: string[],
  author: unknown,
  channel: string,
  title: string,
  body: string,
  link: string,
  legacyTopic?: string,
): Promise<void> {
  const skip = String(author ?? '').trim().toLowerCase();
  await Promise.all([
    ...(legacyTopic ? [push(legacyTopic, title, body, link)] : []),
    ...[...new Set(emails)]
      .filter((e) => e && e !== skip)
      .map((e) => push(`${userTopic(e)}__${channel}`, title, body, link)),
  ]);
}
