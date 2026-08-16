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

/**
 * Web Push certificate from Firebase (Project settings → Cloud Messaging →
 * Web Push certificates). Without it a browser can only show notifications
 * a running page draws itself; with it, alerts arrive with the site closed.
 */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? '';

export function webPushConfigured(): boolean {
  return Boolean(VAPID_KEY);
}

/** Register the background handler and get this browser's push token. */
async function webPushToken(): Promise<string> {
  if (!VAPID_KEY || !('serviceWorker' in navigator)) return '';
  const { firebaseApp } = await import('../firebase');
  if (!firebaseApp) return '';
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return '';
  // Its own scope, so it sits alongside the app's offline worker.
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/firebase-cloud-messaging-push-scope',
  });
  return getToken(getMessaging(firebaseApp), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

/** Ask the server to point this browser's token at the given topics. */
async function setWebTopics(token: string, subscribe: string[], unsubscribe: string[]) {
  if (!token || (!subscribe.length && !unsubscribe.length)) return;
  const { firebaseApp } = await import('../firebase');
  if (!firebaseApp) return;
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const call = httpsCallable(getFunctions(firebaseApp, 'us-central1'), 'subscribeWebPush');
  await call({ token, subscribe, unsubscribe });
}

/** Must match the channelId the Cloud Functions send with. */
const ANDROID_CHANNEL = 'alwaidh-staff';

/**
 * Android decides sound and vibration from the notification *channel*, not
 * from the message, and a message naming a channel that doesn't exist can
 * arrive silently. Create ours up front, at the importance that gets a
 * heads-up banner with a sound and a buzz.
 *
 * A channel's settings are fixed once Android has seen it — the person owns
 * them from then on, in Settings → Notifications, which is as it should be.
 */
async function ensureAndroidChannel(): Promise<void> {
  const platform = capacitor()?.getPlatform?.();
  if (platform !== 'android') return;
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const { channels } = await FirebaseMessaging.listChannels();
    if (channels.some((c) => c.id === ANDROID_CHANNEL)) return;
    await FirebaseMessaging.createChannel({
      id: ANDROID_CHANNEL,
      name: 'Alwaidh staff',
      description: 'Jobs, orders, messages and team chat',
      importance: 5, // heads-up banner
      visibility: 1, // shown on the lock screen
      sound: 'default',
      vibration: true,
      lights: true,
    });
  } catch {
    /* older build without the plugin — nothing to set up */
  }
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | undefined {
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativeApp(): boolean {
  return Boolean(capacitor()?.isNativePlatform?.());
}

/**
 * Why notifications aren't available here — the difference between "this
 * app build is too old" and "this browser can't do it" matters, because
 * only one of them is fixable by the person reading the message.
 */
export type PushBlocker =
  | 'none'
  | 'old-app' // native app built before notifications shipped
  | 'ios-browser' // Safari on iPhone: only home-screen apps may notify
  | 'browser'; // some other browser without notification support

export function pushBlocker(): PushBlocker {
  if (isNativeApp()) {
    // The bridge knows exactly which plugins this binary was built with.
    const available = capacitor()?.isPluginAvailable?.('FirebaseMessaging');
    return available === false ? 'old-app' : 'none';
  }
  if (typeof Notification !== 'undefined') return 'none';
  const iOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS ? 'ios-browser' : 'browser';
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
      if (perm !== 'granted') return { state: perm === 'denied' ? 'denied' : 'prompt' };
      // Register for real push so alerts arrive with the site closed.
      await syncSubscriptions(roles, email);
      return { state: 'granted' };
    } catch (e) {
      return {
        state: 'granted',
        error: e instanceof Error ? e.message : 'Could not finish setting up notifications.',
      };
    }
  }
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const { receive } = await FirebaseMessaging.requestPermissions();
    if (receive !== 'granted') {
      return { state: receive === 'denied' ? 'denied' : 'prompt' };
    }
    await waitForToken(FirebaseMessaging);
    await ensureAndroidChannel();
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
  if (!isNativeApp()) {
    // Browser and home-screen app: the server does the subscribing, since
    // the web SDK can't join a topic by itself.
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const token = await webPushToken();
      if (!token) return;
      const prefs = notificationPrefs();
      const on: string[] = [];
      const off: string[] = [];
      for (const { key } of channelsFor(roles)) {
        if (key === 'team' && !email) continue;
        (prefs[key] === false ? off : on).push(topicFor(key, email ?? ''));
      }
      await setWebTopics(token, on, off);
    } catch {
      /* no certificate configured, or the browser refused — the dashboard
         still shows alerts while a tab is open */
    }
    return;
  }
  await ensureAndroidChannel();
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
  if (!isNativeApp()) {
    try {
      const token = await webPushToken();
      if (!token) return;
      if (key === 'team' && !email) return;
      const topic = topicFor(key, email ?? '');
      await setWebTopics(token, on ? [topic] : [], on ? [] : [topic]);
    } catch {
      /* stays saved; the next sync applies it */
    }
    return;
  }
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
