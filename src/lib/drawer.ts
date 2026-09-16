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

export function useDrawerOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
