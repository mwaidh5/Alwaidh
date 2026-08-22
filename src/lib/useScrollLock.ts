import { useEffect } from 'react';

/**
 * How many modals are open. Only the outermost one touches the page, so a
 * dialog opened from inside another dialog can't restore the scroll
 * position while its parent is still up.
 */
let depth = 0;
let savedY = 0;

/**
 * Freeze the page while a pop-up is open, so only the pop-up scrolls.
 *
 * `overflow: hidden` alone isn't enough: iOS scrolls the page anyway once
 * a drag starts on the backdrop, or when the panel's own scroll reaches
 * its end and chains outward — which is what made a job's details slide
 * about while you read them. Pinning the body and offsetting it by the
 * current scroll holds it still on every browser; the offset is what stops
 * the page jumping to the top, and it is put back on close.
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
    return () => {
      depth -= 1;
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
