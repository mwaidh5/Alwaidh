/**
 * Getting a device back onto the newest version of the site.
 *
 * The app installs a service worker that keeps a copy of itself for offline
 * use. That copy is what a phone shows, so a device can keep running an old
 * version after a deploy. Clearing it and reloading forces a fresh download.
 */

/** Version currently running, so people can say what they're on. */
export const APP_BUILD = __APP_BUILD__;

export interface FlushResult {
  serviceWorkers: number;
  caches: number;
}

/**
 * Throw away the stored copy of the app on this device. Sign-in and the
 * cart are left alone — they live in different storage, and losing them
 * would be a surprising cost for "check for updates".
 */
export async function flushAppCache(): Promise<FlushResult> {
  let serviceWorkers = 0;
  let cacheCount = 0;

  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (await reg.unregister()) serviceWorkers++;
      }
    } catch {
      /* not supported, or blocked — the cache clear below still helps */
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        if (await caches.delete(key)) cacheCount++;
      }
    } catch {
      /* nothing to clear */
    }
  }

  // The settings snapshot kept for a fast first paint can also be stale.
  try {
    localStorage.removeItem('alwaidh.settings.cache.v1');
  } catch {
    /* private mode */
  }

  return { serviceWorkers, caches: cacheCount };
}

/** Reload from the network rather than from whatever the browser kept. */
export function hardReload(): void {
  const url = new URL(window.location.href);
  url.searchParams.set('fresh', String(Date.now()));
  window.location.replace(url.toString());
}
