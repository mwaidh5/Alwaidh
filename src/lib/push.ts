/**
 * Notifications for staff.
 *
 * In the native app, each device subscribes to the FCM topics its owner
 * has switched on; the Cloud Functions in /functions publish to those
 * topics. Topics mean no device tokens to store or expire.
 *
 * In a browser there is no FCM setup, so the same switches drive plain
 * browser notifications, which the dashboard fires itself while a tab is
 * open (see AdminLayout).
 */

export type NotificationKey = 'jobs' | 'jobActivity' | 'orders' | 'messages' | 'team';

export interface NotificationChannel {
  key: NotificationKey;
  label: string;
  description: string;
}

/** Every switch, in the order they're shown. */
export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  { key: 'jobs', label: 'New solar jobs', description: 'When a job is added to the board.' },
  {
    key: 'jobActivity',
    label: 'Job comments & changes',
    description: 'Comments, edits, and moves between columns.',
  },
  { key: 'orders', label: 'Orders', description: 'New orders and status changes.' },
  {
    key: 'messages',
    label: 'Customer messages',
    description: 'Website chat and contact-form enquiries.',
  },
  { key: 'team', label: 'Team chat', description: 'Messages from colleagues, and @ tags.' },
];

/** The FCM topic behind each switch. Team chat is per person. */
function topicFor(key: NotificationKey, email: string): string {
  switch (key) {
    case 'jobs':
      return 'staff-jobs';
    case 'jobActivity':
      return 'staff-job-activity';
    case 'orders':
      return 'staff-orders';
    case 'messages':
      return 'staff-messages';
    case 'team':
      return userTopic(email);
  }
}

/**
 * A person's own topic, so team messages and @ tags reach exactly them.
 * FCM topic names allow only [a-zA-Z0-9-_.~%], so the email is folded into
 * that set — the same way here and in the functions.
 */
export function userTopic(email: string): string {
  return `user_${String(email).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

export interface Roles {
  isAdmin: boolean;
  isComputerStaff: boolean;
  isSolarStaff: boolean;
  isInstaller?: boolean;
}

/** Which switches are worth showing this person. */
export function channelsFor(roles: Roles): NotificationChannel[] {
  return NOTIFICATION_CHANNELS.filter(({ key }) => {
    if (key === 'team') return true; // everyone has colleagues
    if (key === 'jobs' || key === 'jobActivity') return roles.isAdmin || roles.isSolarStaff;
    if (key === 'orders') return roles.isAdmin;
    return roles.isAdmin || roles.isComputerStaff || roles.isSolarStaff; // messages
  });
}

export type PushState = 'unsupported' | 'granted' | 'denied' | 'prompt';

export function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

// ---------------------------------------------------------------------------
// Preferences — which switches are on, per device.
// ---------------------------------------------------------------------------

const PREFS_KEY = 'alwaidh.push.prefs.v1';

export type NotificationPrefs = Partial<Record<NotificationKey, boolean>>;

/** Saved switches; anything not chosen yet counts as on. */
export function notificationPrefs(): NotificationPrefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as NotificationPrefs;
  } catch {
    return {};
  }
}

export function isChannelOn(key: NotificationKey): boolean {
  return notificationPrefs()[key] !== false;
}

function savePrefs(prefs: NotificationPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode — the switches just won't be remembered */
  }
}

// ---------------------------------------------------------------------------
// Permission and subscriptions
// ---------------------------------------------------------------------------

/** Current permission, without prompting. */
export async function pushState(): Promise<PushState> {
  if (!isNativeApp()) {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission === 'granted'
      ? 'granted'
      : Notification.permission === 'denied'
        ? 'denied'
        : 'prompt';
  }
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const { receive } = await FirebaseMessaging.checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unsupported';
  }
}

/**
 * Wait for the push token.
 *
 * On iOS the token can't be minted until Apple has answered the device's
 * registration, which happens a moment after permission is granted. Asking
 * too early throws "APNS device token not set", which is what silently
 * stopped iPhone notifications — so retry for a few seconds before giving
 * up.
 */
async function waitForToken(
  messaging: { getToken: () => Promise<{ token: string }> },
  attempts = 10,
): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const { token } = await messaging.getToken();
      if (token) return token;
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 500 + i * 250));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('The device did not get a notification token.');
}

export interface EnableResult {
  state: PushState;
  /** Set when something went wrong, so the UI can say what. */
  error?: string;
}

/**
 * Ask for permission (must follow a tap on iOS) and subscribe to every
 * switched-on channel.
 */
export async function enablePush(roles: Roles, email: string | null): Promise<EnableResult> {
  if (!isNativeApp()) {
    if (typeof Notification === 'undefined') return { state: 'unsupported' };
    try {
      const perm = await Notification.requestPermission();
      return { state: perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'prompt' };
    } catch {
      return { state: 'unsupported' };
    }
  }
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const { receive } = await FirebaseMessaging.requestPermissions();
    if (receive !== 'granted') {
      return { state: receive === 'denied' ? 'denied' : 'prompt' };
    }
    await waitForToken(FirebaseMessaging);
    await syncSubscriptions(roles, email);
    return { state: 'granted' };
  } catch (e) {
    return {
      state: 'prompt',
      error: e instanceof Error ? e.message : 'Could not turn notifications on.',
    };
  }
}

/**
 * Bring this device's subscriptions in line with the switches. Safe to call
 * on every launch — subscriptions are lost when the app is reinstalled or
 * its token is refreshed, and re-subscribing costs nothing.
 */
export async function syncSubscriptions(roles: Roles, email: string | null): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const prefs = notificationPrefs();
    for (const { key } of channelsFor(roles)) {
      if (key === 'team' && !email) continue;
      const topic = topicFor(key, email ?? '');
      if (prefs[key] === false) {
        await FirebaseMessaging.unsubscribeFromTopic({ topic }).catch(() => undefined);
      } else {
        await FirebaseMessaging.subscribeToTopic({ topic }).catch(() => undefined);
      }
    }
  } catch {
    /* plugin missing (app built before notifications shipped) */
  }
}

/** Flip one switch and apply it to this device straight away. */
export async function setNotificationChannel(
  key: NotificationKey,
  on: boolean,
  email: string | null,
): Promise<void> {
  savePrefs({ ...notificationPrefs(), [key]: on });
  if (!isNativeApp()) return;
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    if (key === 'team' && !email) return;
    const topic = topicFor(key, email ?? '');
    if (on) await FirebaseMessaging.subscribeToTopic({ topic });
    else await FirebaseMessaging.unsubscribeFromTopic({ topic });
  } catch {
    /* stays saved; the next sync will apply it */
  }
}

/** Stop notifications on this device (e.g. when signing out). */
export async function disablePush(roles: Roles, email: string | null): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    for (const { key } of channelsFor(roles)) {
      await FirebaseMessaging.unsubscribeFromTopic({
        topic: topicFor(key, email ?? ''),
      }).catch(() => undefined);
    }
  } catch {
    /* nothing to clean up */
  }
}

/**
 * Open the right dashboard page when a notification is tapped. Call once
 * when the admin shell mounts.
 */
export async function handlePushTaps(navigate: (path: string) => void): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const handle = await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      const link = (event.notification?.data as Record<string, unknown> | undefined)?.link;
      if (typeof link === 'string' && link.startsWith('/')) navigate(link);
    });
    return () => {
      handle.remove().catch(() => {});
    };
  } catch {
    return () => {};
  }
}
