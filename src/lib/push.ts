/**
 * Push notifications for staff.
 *
 * Devices subscribe to FCM topics matching the person's role; the Cloud
 * Functions in /functions publish to those topics when a job, order or
 * message is created. Topics mean no device tokens to store or expire.
 *
 * Only runs inside the native app — browsers would need a service worker
 * and a VAPID key, which isn't set up.
 */
export const PUSH_TOPICS = {
  jobs: 'staff-jobs',
  orders: 'staff-orders',
  messages: 'staff-messages',
} as const;

export type PushTopic = (typeof PUSH_TOPICS)[keyof typeof PUSH_TOPICS];

export type PushState = 'unsupported' | 'granted' | 'denied' | 'prompt';

function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** Which topics a staff member should hear about, given their access. */
export function topicsFor(opts: {
  isAdmin: boolean;
  isSolarStaff: boolean;
  isComputerStaff: boolean;
}): PushTopic[] {
  const topics: PushTopic[] = [];
  if (opts.isAdmin || opts.isSolarStaff) topics.push(PUSH_TOPICS.jobs);
  if (opts.isAdmin) topics.push(PUSH_TOPICS.orders, PUSH_TOPICS.messages);
  return topics;
}

/** Current permission, without prompting. */
export async function pushState(): Promise<PushState> {
  if (!isNativeApp()) return 'unsupported';
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const { receive } = await FirebaseMessaging.checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unsupported';
  }
}

/**
 * Ask for permission (must be triggered by a tap on iOS) and subscribe to
 * the given topics. Returns the resulting state so the UI can explain it.
 */
export async function enablePush(topics: PushTopic[]): Promise<PushState> {
  if (!isNativeApp()) return 'unsupported';
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const { receive } = await FirebaseMessaging.requestPermissions();
    if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'prompt';
    // Registers with APNs/FCM; without this the topic subscription has no
    // device to attach to.
    await FirebaseMessaging.getToken();
    for (const topic of topics) {
      await FirebaseMessaging.subscribeToTopic({ topic });
    }
    return 'granted';
  } catch {
    return 'unsupported';
  }
}

/** Stop notifications on this device (e.g. when signing out). */
export async function disablePush(topics: PushTopic[]): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    for (const topic of topics) {
      await FirebaseMessaging.unsubscribeFromTopic({ topic });
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
