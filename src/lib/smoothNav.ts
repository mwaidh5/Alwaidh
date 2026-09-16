import { flushSync } from 'react-dom';
import type { NavigateFunction } from 'react-router-dom';

/**
 * Change page without the blink.
 *
 * A route change used to be: old page gone, new page mounted at zero
 * opacity, faded in — a flash of white between every two screens. Where
 * the browser can (Chrome, Android's WebView, Safari from iOS 18), the
 * old and new screens are cross-faded by the browser itself, pixels to
 * pixels, so nothing is ever blank. Elsewhere the change is instant,
 * which is still better than a fade from nothing.
 */
export function smoothNavigate(navigate: NavigateFunction, to: string): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof doc.startViewTransition === 'function' && !reduce) {
    // flushSync: the new page has to be in the DOM before the browser
    // takes its "after" picture, or it cross-fades to an empty frame.
    doc.startViewTransition(() => {
      flushSync(() => navigate(to));
    });
    return;
  }
  navigate(to);
}
