import { useEffect, useSyncExternalStore } from 'react';

/**
 * How many pop-ups are open. Only the outermost one touches the page, so a
 * dialog opened from inside another dialog can't restore the scroll
 * position while its parent is still up.
 */
let depth = 0;
let savedY = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

/**
 * Freeze the page while a pop-up is open, so only the pop-up scrolls.
 *
 * `overflow: hidden` alone isn't enough: iOS scrolls the page anyway once
 * a drag starts on the backdrop, or when the panel's own scroll reaches
 * its end and chains outward — which is what made a job's details slide
 * about while you read them. Pinning the body and offsetting it by the
 * current scroll holds it still on every browser; the offset is what stops
 * the page jumping to the top, and it is put back on close.
 *
 * Every pop-up calls this, which also makes it the one place that knows
 * whether anything is open — see `useAnyModalOpen`.
 */
export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    if (depth === 0) {
      savedY = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${savedY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.overflow = 'hidden';
    }
    depth += 1;
    emit();
    return () => {
      depth -= 1;
      emit();
      if (depth > 0) return;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.overflow = '';
      // Instant, not smooth: the page has scroll-behavior: smooth, and
      // animating back to where you already were reads as the page moving
      // on its own after the pop-up closes.
      window.scrollTo({ top: savedY, left: 0, behavior: 'instant' as ScrollBehavior });
    };
  }, [active]);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * True while any pop-up is open. The phone's chrome — the header and the
 * tab bar — gets out of the way when one is, so a pop-up reads as a screen
 * of its own rather than a card floating between two bars.
 */
export function useAnyModalOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => depth > 0,
    () => false,
  );
}
