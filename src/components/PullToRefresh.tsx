import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';
import { useAnyModalOpen } from '../lib/useScrollLock';
import { useDrawerOpen } from '../lib/drawer';

/** How far to pull before letting go does anything. Deliberately steep:
    with the damping below it takes roughly a two-thirds-of-the-screen
    drag, because an accidental refresh costs far more than a second
    tug ever will. */
const THRESHOLD = 110;
/** Past this the rubber band stops giving, so it never feels broken. */
const MAX = 150;

/** True when the touch began inside something that scrolls on its own —
    a pop-up, a picker, a sideways strip. Dragging those must never read
    as pulling the page. */
function insideScrollable(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    if (
      (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) ||
      (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth)
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Pull down at the top of a page to reload it — the gesture people already
 * expect from an app.
 *
 * It reloads outright rather than re-reading the data. Products, prices and
 * jobs are already live, so a data refresh would do nothing visible; what
 * people actually reach for this gesture for is "I think I'm looking at
 * something stale", and a reload is what fixes that — it also picks up a
 * new version of the site if one has shipped.
 */
export default function PullToRefresh() {
  const { t } = useLang();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  // While a pop-up is open (adding a job, editing a product), its inner
  // scrolling was being read as a pull — the gesture is simply off then.
  // Same for the phone menu: a downward swipe on it was dragging the
  // refresh pill over the drawer and could reload the app mid-menu.
  const modalOpen = useAnyModalOpen();
  const drawerOpen = useDrawerOpen();

  useEffect(() => {
    if (modalOpen || drawerOpen) {
      start.current = null;
      setPull(0);
      return;
    }
    // Only where the gesture belongs: a mouse has a scrollbar and a
    // keyboard, and desktop browsers don't do this.
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    function onStart(e: TouchEvent) {
      // Only from a standing start at the very top, one finger, and not
      // inside anything that scrolls by itself.
      start.current =
        window.scrollY <= 0 && e.touches.length === 1 && !insideScrollable(e.target)
          ? e.touches[0].clientY
          : null;
    }

    function onMove(e: TouchEvent) {
      if (start.current === null || refreshing) return;
      const delta = e.touches[0].clientY - start.current;
      if (delta <= 0 || window.scrollY > 0) {
        // Scrolling up, or the page has moved — this isn't a pull.
        setPull(0);
        start.current = null;
        return;
      }
      // Resistance: the further it goes the less it gives.
      setPull(Math.min(MAX, delta * 0.4));
    }

    function onEnd() {
      if (start.current === null) return;
      start.current = null;
      setPull((current) => {
        if (current >= THRESHOLD) {
          setRefreshing(true);
          // Let the spinner paint before the page freezes to reload.
          setTimeout(() => window.location.reload(), 150);
          return THRESHOLD;
        }
        return 0;
      });
    }

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [refreshing, modalOpen, drawerOpen]);

  if (pull <= 0 && !refreshing) return null;

  const ready = pull >= THRESHOLD;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center md:hidden"
      style={{ transform: `translateY(${Math.max(pull, refreshing ? THRESHOLD : 0) - 20}px)` }}
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-lg backdrop-blur">
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-brand-600 ${
            refreshing ? 'animate-spin' : ''
          }`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
        {refreshing ? t('Refreshing…') : ready ? t('Let go to refresh') : t('Pull to refresh')}
      </div>
    </div>
  );
}
