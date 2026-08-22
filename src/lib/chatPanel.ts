import { useSyncExternalStore } from 'react';

/**
 * The one thing the chat panel and the tab bar both need to know about.
 *
 * The bubble that used to float over every page is gone from phones —
 * "Chat" is a tab now — so the bar has to be able to open the panel, and
 * to show what's waiting in it. Both live here rather than the two
 * components reaching into each other.
 */
let openTicks = 0;
let unread = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Ask the chat panel to open. */
export function openChat(): void {
  openTicks += 1;
  emit();
}

/** Counts up every time something asks the panel to open; the panel opens
 *  on a change rather than on a boolean, so asking twice still works after
 *  it has been closed in between. */
export function useChatOpenSignal(): number {
  return useSyncExternalStore(
    subscribe,
    () => openTicks,
    () => 0,
  );
}

export function setChatUnread(count: number): void {
  if (count === unread) return;
  unread = count;
  emit();
}

export function useChatUnread(): number {
  return useSyncExternalStore(
    subscribe,
    () => unread,
    () => 0,
  );
}
