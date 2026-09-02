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
}
