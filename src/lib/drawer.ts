import { useSyncExternalStore } from 'react';

/**
 * The phone menu drawer's one bit of state, shared between the button in
 * the header that opens it, the layer that draws it, and the page wrapper
 * that slides aside to reveal it.
 */
let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function openDrawer(): void {
  if (open) return;
  open = true;
  emit();
}

export function closeDrawer(): void {
  if (!open) return;
  open = false;
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * "Open the notification settings" — asked from the drawer, answered by
 * the dashboard layout, which owns that dialog. A counter, so asking
 * twice in a row still opens it twice.
 */
let notifAsk = 0;
const notifListeners = new Set<() => void>();

export function askNotificationSettings(): void {
  notifAsk += 1;
  for (const fn of notifListeners) fn();
}

export function useNotificationAsk(): number {
  return useSyncExternalStore(
    (fn) => {
      notifListeners.add(fn);
      return () => {
        notifListeners.delete(fn);
      };
    },
    () => notifAsk,
    () => 0,
  );
}

export function useDrawerOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
