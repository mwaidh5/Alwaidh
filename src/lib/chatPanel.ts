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

let pendingDraft = '';

/** Ask the chat panel to open, optionally with words already typed in —
 *  "I'm interested in the 20 Amp system" — so the visitor only has to
 *  press send. The draft is consumed once. */
export function openChat(draft = ''): void {
  // Passed straight to onClick, React hands over the click event instead
  // of words — anything that isn't a string is "no draft", not a crash.
  pendingDraft = typeof draft === 'string' ? draft : '';
  openTicks += 1;
  emit();
}

/** The panel collects the prefilled words, at most once per open. */
export function consumeChatDraft(): string {
  const d = pendingDraft;
  pendingDraft = '';
  return d;
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
