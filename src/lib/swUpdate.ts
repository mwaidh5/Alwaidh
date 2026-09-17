import { registerSW } from 'virtual:pwa-register';

/**
 * Keeping every device on the newest build without anyone thinking
 * about it.
 *
 * The app keeps a copy of itself for offline use, and that copy is what a
 * phone shows first. The plain registration only checked for a newer copy
 * when the app was launched, and even then left the screen on the old one
 * until the *next* launch — which is why a fix shipped at four in the
 * morning was still invisible at half past. Now:
 *
 *   - the check runs on launch, each time the app returns to the
 *     foreground, and every minute while it is open;
 *   - the moment a newer copy has taken over, the page reloads itself once
 *     (guarded, so a bad network can never loop it).
 *
 * The owner's "clear cache and reload" button in Settings stays as the
 * manual escape hatch.
 */
export function keepFresh(): void {
  if (!('serviceWorker' in navigator)) return;

  const update = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // A worker found waiting is told to go ahead — the belt to the
      // worker's own skipWaiting, for a copy built before it had one.
      const nudge = (w: ServiceWorker | null) => w?.postMessage({ type: 'SKIP_WAITING' });
      nudge(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const w = registration.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) nudge(w);
        });
      });
      const check = () => registration.update().catch(() => undefined);
      window.setInterval(check, 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  // autoUpdate already reloads when a new worker activates; this is the
  // belt to that brace, for browsers that swap the controller without the
  // activation event reaching a page that was loaded from the old cache.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const last = Number(sessionStorage.getItem('sw-reload-at') ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem('sw-reload-at', String(Date.now()));
    window.location.reload();
  });

  void update;
  watchVersion();
}

/**
 * The belt to the brace above: ask the server which build it is serving,
 * and if it is not the one running, throw away every stored copy and
 * start again. Checked on launch, whenever the app comes back to the
 * foreground, and every few minutes while it is open — so a phone that
 * has been sitting on last week's build is on this week's within a
 * minute of being picked up, service worker or no service worker.
 */
function watchVersion(): void {
  const RELOADED_FOR = 'alwaidh.reloadedFor.v1';
  let busy = false;
  const check = async () => {
    if (busy || document.visibilityState === 'hidden') return;
    busy = true;
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const { build } = (await res.json()) as { build?: string };
      if (!build || build === __APP_BUILD__) return;
      // Once per newer build: if a reload somehow still lands on the old
      // copy, do not spin — the next launch will try again.
      if (localStorage.getItem(RELOADED_FOR) === build) return;
      localStorage.setItem(RELOADED_FOR, build);
      const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      if ('caches' in window) {
        const keys = await caches.keys().catch(() => []);
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }
      window.location.reload();
    } catch {
      /* offline, or a proxy in the way — nothing to do until next time */
    } finally {
      busy = false;
    }
  };
  window.setTimeout(check, 3000);
  window.setInterval(check, 3 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
