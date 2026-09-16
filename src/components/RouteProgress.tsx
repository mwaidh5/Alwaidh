import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The thin line at the top that runs across on every page change — the
 * app's way of saying "on it" while the new screen fills in. It races to
 * most of the way, finishes once the new page has had a beat to draw its
 * first frame, and fades.
 */
export default function RouteProgress() {
  const { pathname } = useLocation();
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');

  useEffect(() => {
    setPhase('run');
    const finish = window.setTimeout(() => setPhase('done'), 350);
    const hide = window.setTimeout(() => setPhase('idle'), 750);
    return () => {
      window.clearTimeout(finish);
      window.clearTimeout(hide);
    };
  }, [pathname]);

  if (phase === 'idle') return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div
        className="h-[3px] rounded-e-full bg-brand-600 shadow-[0_0_8px_rgba(37,99,235,.6)]"
        style={{
          width: phase === 'run' ? '82%' : '100%',
          opacity: phase === 'done' ? 0 : 1,
          transition: phase === 'run' ? 'width 380ms cubic-bezier(.2,.7,.3,1)' : 'width 160ms ease-out, opacity 320ms ease-out 120ms',
        }}
      />
    </div>
  );
}
