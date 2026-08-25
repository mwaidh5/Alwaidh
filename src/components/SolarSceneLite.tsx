import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n';

/**
 * The homepage's solar scene: a flat Iraqi roof, drawn in isometric SVG,
 * with a little installer who mounts panel frames on it.
 *
 * He works on his own — walks to an empty spot, bends over the rack and
 * fastens it, and the panel appears mid-work. Drag him, or tap a spot,
 * and he installs there instead. Two racks are done before anyone
 * touches anything, and stay done: the job is in progress, not a loop
 * from zero.
 *
 * Deliberately not a 3D engine. This is a few kilobytes of SVG and CSS,
 * so the homepage stays as fast as it is — that decision was taken after
 * trying the real-3D version and weighing what it cost.
 */

/** The roof's top face: origin corner plus two edge vectors. Every point
 *  on it is (u,v) in 0..1 along those edges. */
const O: [number, number] = [96, 150];
const U: [number, number] = [110, -42];
const V: [number, number] = [116, 42];
const pt = (u: number, v: number): [number, number] => [
  O[0] + u * U[0] + v * V[0],
  O[1] + u * U[1] + v * V[1],
];
/** Screen point → (u,v), by inverting the 2×2 basis. det = UxVy − VxUy. */
const DET = 9492;
const uvRaw = (x: number, y: number): [number, number] => {
  const dx = x - O[0];
  const dy = y - O[1];
  return [(42 * dx - 116 * dy) / DET, (42 * dx + 110 * dy) / DET];
};
const uv = (x: number, y: number): [number, number] => {
  const cl = (n: number) => Math.max(0.05, Math.min(0.95, n));
  const [ru, rv] = uvRaw(x, y);
  return [cl(ru), cl(rv)];
};

interface Slot {
  cx: number;
  cy: number;
  u: number;
  v: number;
  pre: boolean;
}

/** 2 rows × 3 columns; two are already done when the page loads. */
const SLOTS: Slot[] = [];
for (let j = 0; j < 2; j++)
  for (let i = 0; i < 3; i++) {
    const su = (i + 0.5) / 3;
    const sv = (j + 0.5) / 2;
    const c = pt(su, sv);
    SLOTS.push({ cx: c[0], cy: c[1], u: su, v: sv, pre: (j === 0 && i === 0) || (j === 1 && i === 1) });
  }
const WALK_MS = 850;
const WORK_MS = 1400;
const TICK_MS = 2600;

export default function SolarSceneLite() {
  const { t } = useLang();
  const svgRef = useRef<SVGSVGElement>(null);
  const workerRef = useRef<SVGGElement>(null);
  const flipRef = useRef<SVGGElement>(null);
  const houseRef = useRef<SVGGElement>(null);
  const panelRefs = useRef<(SVGGElement | null)[]>([]);
  const [filled, setFilled] = useState(() => SLOTS.map((s) => s.pre));
  const [done, setDone] = useState(false);
  const [hintGone, setHintGone] = useState(false);

  // Everything time-based lives in one mutable bag: the animation is a
  // little machine, and re-rendering React for each of its steps would
  // fight the CSS transitions doing the actual movement.
  const m = useRef({
    walking: false,
    working: false,
    dragging: false,
    busy: false,
    target: -1,
    filled: SLOTS.map((s) => s.pre),
    timers: [] as number[],
    pos: [0, 0] as [number, number],
    raf: 0,
    flight: 0,
  });

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    m.current.timers.push(id);
    return id;
  };

  useEffect(() => {
    const svg = svgRef.current;
    const worker = workerRef.current;
    if (!svg || !worker) return;
    const s = m.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Position goes through the SVG transform ATTRIBUTE, never through the
    // style attribute: React owns style and rewrites it on re-render, which
    // could silently wipe a transform set by hand and leave the worker at
    // the origin — outside the drawing, invisible. That happened.
    const place = (x: number, y: number) => {
      s.pos = [x, y];
      worker.setAttribute('transform', `translate(${x} ${y})`);
    };
    const start = pt(0.86, 0.2);
    place(start[0], start[1]);

    // Walks are a small tween: SVG attribute changes aren't CSS-transitioned
    // on iOS, so the easing is done by hand. If the tab stops rendering the
    // tween pauses, and the arrival timer snaps him to the end.
    function glide(to: [number, number], ms: number) {
      cancelAnimationFrame(s.raf);
      const from: [number, number] = [...s.pos];
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        place(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e);
        if (t < 1 && s.walking) s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    }

    function fly(to: [number, number], ms: number, arc: number, token: number) {
      cancelAnimationFrame(s.raf);
      const from: [number, number] = [...s.pos];
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        const y = from[1] + (to[1] - from[1]) * e - Math.sin(Math.PI * t) * arc;
        place(from[0] + (to[0] - from[0]) * e, y);
        if (t < 1 && s.flight === token) s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
    }

    // Dropped off the roof: he falls to the ground, has a moment, and
    // springs back up to his corner of the roof.
    function tumble(x: number) {
      s.busy = true;
      const gx = Math.max(30, Math.min(370, x));
      worker!.classList.add('alw-fall');
      fly([gx, 224], reduced ? 1 : 420, 0, ++s.flight);
      later(
        () => {
          cancelAnimationFrame(s.raf);
          place(gx, 224);
          worker!.classList.remove('alw-fall');
        },
        reduced ? 10 : 440,
      );
      later(
        () => {
          const home = pt(0.86, 0.2);
          face(home[0]);
          worker!.classList.add('alw-jump');
          fly(home, reduced ? 1 : 760, 62, ++s.flight);
          later(
            () => {
              cancelAnimationFrame(s.raf);
              worker!.classList.remove('alw-jump');
              const home2 = pt(0.86, 0.2);
              place(home2[0], home2[1]);
              s.busy = false;
            },
            reduced ? 20 : 790,
          );
        },
        reduced ? 20 : 900,
      );
    }

    function face(towardX: number) {
      flipRef.current?.setAttribute('transform', towardX < s.pos[0] ? 'scale(1,1)' : 'scale(-1,1)');
    }

    function install(k: number) {
      s.filled[k] = true;
      setFilled([...s.filled]);
    }

    function work(k: number) {
      s.working = true;
      const slot = SLOTS[k];
      face(slot.cx);
      worker!.classList.add('alw-working');
      // The rack appears while he's fastening it, not when he arrives.
      later(() => install(k), reduced ? 50 : WORK_MS * 0.55);
      later(
        () => {
          worker!.classList.remove('alw-working');
          s.working = false;
        },
        reduced ? 100 : WORK_MS,
      );
    }

    function walkTo(k: number) {
      const slot = SLOTS[k];
      if (!slot || s.filled[k] || s.walking || s.working || s.dragging || s.busy) return;
      s.walking = true;
      s.target = k;
      const side = slot.u > 0.66 ? -0.17 : 0.17;
      const stand = pt(slot.u + side, Math.min(0.9, slot.v + 0.05));
      face(slot.cx);
      worker!.classList.add('alw-walk');
      glide(stand, reduced ? 1 : WALK_MS);
      // A timeout is the arrival signal — transitions are only the visuals.
      // transitionend never fires in a tab that isn't rendering, and a
      // stuck flag would freeze the whole scene.
      later(
        () => {
          worker!.classList.remove('alw-walk');
          s.walking = false;
          cancelAnimationFrame(s.raf);
          const slot2 = SLOTS[k];
          const side2 = slot2.u > 0.66 ? -0.17 : 0.17;
          const stand2 = pt(slot2.u + side2, Math.min(0.9, slot2.v + 0.05));
          place(stand2[0], stand2[1]);
          if (!s.dragging) work(k);
        },
        reduced ? 60 : WALK_MS,
      );
    }

    function tick() {
      if (s.dragging || s.walking || s.working || s.busy) return;
      const next = s.filled.findIndex((f) => !f);
      if (next >= 0) {
        walkTo(next);
        return;
      }
      // Roof full: say so, then clear his racks — the pre-installed two
      // stay, the job was real — and start again.
      s.busy = true;
      setDone(true);
      houseRef.current?.classList.add('alw-powered');
      later(() => {
        SLOTS.forEach((slot, k) => {
          if (!slot.pre) s.filled[k] = false;
        });
        setFilled([...s.filled]);
        setDone(false);
        houseRef.current?.classList.remove('alw-powered');
        s.busy = false;
      }, 3400);
    }
    const interval = window.setInterval(tick, TICK_MS);

    const toSvg = (e: PointerEvent): [number, number] => {
      const r = svg!.getBoundingClientRect();
      const k = 400 / r.width;
      return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
    };

    function onDown(e: PointerEvent) {
      if (s.busy) return;
      const el = e.target as Element;
      if (el.closest('[data-alw-worker]')) {
        // Only the worker captures the pointer — a finger anywhere else
        // on the scene still scrolls the page.
        e.preventDefault();
        s.dragging = true;
        s.walking = false;
        s.working = false;
        worker!.classList.remove('alw-walk', 'alw-working');
        worker!.classList.add('alw-drag');
        setHintGone(true);
        try {
          svg!.setPointerCapture(e.pointerId);
        } catch {
          /* capture is a nicety */
        }
        return;
      }
      const hit = el.closest('[data-alw-slot]');
      if (hit) {
        const k = Number(hit.getAttribute('data-alw-slot'));
        if (s.filled[k]) return;
        setHintGone(true);
        // A tap redirects him even mid-walk — during autoplay he's walking
        // most of the time, and a tap that only works between walks feels
        // dead.
        if (s.walking) s.walking = false;
        if (!s.working) walkTo(k);
      }
    }
    function onMove(e: PointerEvent) {
      if (!s.dragging) return;
      const [x, y] = toSvg(e);
      place(Math.max(14, Math.min(386, x)), Math.max(34, Math.min(236, y)));
    }
    function onUp(e: PointerEvent) {
      if (!s.dragging) return;
      s.dragging = false;
      worker!.classList.remove('alw-drag');
      const [x, y] = toSvg(e);
      const [ru, rv] = uvRaw(x, y);
      if (ru < -0.08 || ru > 1.08 || rv < -0.08 || rv > 1.08) {
        tumble(x);
        return;
      }
      const [pu, pv] = uv(x, y);
      let best = -1;
      let bd = Infinity;
      SLOTS.forEach((slot, k) => {
        if (s.filled[k]) return;
        const d = (slot.u - pu) ** 2 + (slot.v - pv) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      });
      const foot = pt(pu, pv);
      place(foot[0], foot[1]);
      if (best >= 0) walkTo(best);
    }

    svg.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(m.current.raf);
      m.current.timers.forEach(clearTimeout);
      svg.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = filled.filter(Boolean).length;

  return (
    <div className="select-none">
      {/* Coordinates assume left-to-right; the chip row below flips with
          the language, the drawing itself must not. */}
      <div dir="ltr" className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-sky-200 via-sky-100 to-sky-50 ring-1 ring-inset ring-sky-200/60">
        <svg
          ref={svgRef}
          viewBox="0 0 400 250"
          className="block h-auto w-full"
          role="img"
          aria-label={t('An installer mounting solar panels on a flat roof')}
        >
          <defs>
            <linearGradient id="alwPanelG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3b76c0" />
              <stop offset="1" stopColor="#153360" />
            </linearGradient>
            <radialGradient id="alwSunG">
              <stop offset="0" stopColor="#fde68a" />
              <stop offset="0.55" stopColor="#fcd34d" stopOpacity="0.55" />
              <stop offset="1" stopColor="#fcd34d" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle className="alw-sun" cx="352" cy="38" r="34" fill="url(#alwSunG)" />
          <circle cx="352" cy="38" r="13" fill="#fcd34d" />

          {/* Two clouds on different winds, and a pair of birds. They all
              start left of the frame and drift across on CSS clocks. */}
          <g className="alw-cloud alw-cloud-a" fill="#ffffff" opacity="0.85">
            <ellipse cx="0" cy="34" rx="17" ry="6.5" />
            <ellipse cx="12" cy="31" rx="11" ry="5" />
            <ellipse cx="-11" cy="31.5" rx="9" ry="4.4" />
          </g>
          <g className="alw-cloud alw-cloud-b" fill="#ffffff" opacity="0.65">
            <ellipse cx="0" cy="62" rx="13" ry="5" />
            <ellipse cx="9" cy="59.5" rx="8" ry="3.8" />
          </g>
          <g className="alw-birds" stroke="#475569" strokeWidth="1.1" fill="none" strokeLinecap="round">
            <path d="M0,46 q3,-3.4 6,0 q3,-3.4 6,0" />
            <path d="M14,52 q2.4,-2.8 4.8,0 q2.4,-2.8 4.8,0" />
          </g>

          <ellipse cx="208" cy="230" rx="155" ry="14" fill="rgba(15,23,42,.14)" />

          {/* A palm on the empty side, and a bush by the far wall. */}
          <g transform="translate(44 216)">
            <path d="M-1.5,0 C-2.5,-10 -1,-20 1,-27 L3.5,-26.5 C1.8,-19 1.5,-9 2.5,0 Z" fill="#8a6a4b" />
            <g fill="#2e9e46">
              <path d="M2,-27 C7,-33 15,-34 21,-31 C14,-30 8,-27.5 3.5,-25 Z" />
              <path d="M2,-27 C-3,-33 -11,-34 -17,-31 C-10,-30 -4,-27.5 0.5,-25 Z" />
              <path d="M2,-27.5 C4,-34 9,-38 15,-38.5 C10,-35.5 6,-31 3.5,-26.5 Z" />
              <path d="M2,-27.5 C0,-34 -5,-38 -11,-38.5 C-6,-35.5 -2,-31 0.5,-26.5 Z" />
              <path d="M1.6,-28 C2,-33.5 2.4,-36.5 2,-39.5 C3.4,-36 4,-32 3.4,-27.8 Z" />
            </g>
            <ellipse cx="1" cy="1.5" rx="9" ry="2.4" fill="rgba(15,23,42,.18)" />
          </g>
          <g transform="translate(352 222)" fill="#3aa653">
            <ellipse cx="0" cy="-3" rx="9" ry="5.5" />
            <ellipse cx="-7" cy="-1" rx="6" ry="4" fill="#2e8f45" />
            <ellipse cx="7" cy="-1.5" rx="6.5" ry="4.2" fill="#35994c" />
          </g>

          <g ref={houseRef}>
            {/* lit wall, shaded wall, windows, door, parapet, roof */}
            <polygon points="96,150 212,192 212,236 96,194" fill="#e7e0d2" />
            <polygon points="212,192 322,150 322,194 212,236" fill="#c3b9a6" />
            <polygon className="alw-win" points="113.4,171.7 131.9,178.4 131.9,191.4 113.4,184.7" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
            <polygon className="alw-win" points="151.7,185.6 170.2,192.3 170.2,205.3 151.7,198.6" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
            <polygon points="272.5,179.9 287.9,174 287.9,207 272.5,212.9" fill="#57534e" stroke="#a8a29e" strokeWidth="1" />
            <polygon points="96,150 206,108 322,150 212,192" fill="#d9d2c2" stroke="#b6ad99" strokeWidth="2" strokeLinejoin="round" />
            <polygon points="107.3,150 206.3,112.2 310.7,150 211.7,187.8" fill="#ccc4b2" />
          </g>

          {/* panels + their tap areas */}
          {SLOTS.map((slot, k) => {
            const i = k % 3;
            const j = k < 3 ? 0 : 1;
            const q = [pt(i / 3, j / 2), pt((i + 1) / 3, j / 2), pt((i + 1) / 3, (j + 1) / 2), pt(i / 3, (j + 1) / 2)];
            return (
              <g key={k} transform={`translate(${slot.cx},${slot.cy})`}>
                {/* Position on the outer group's ATTRIBUTE, animation on the
                    inner group's CLASS. On one element the CSS transform
                    replaces the attribute wholesale, and every panel lost
                    its slot and rendered at the origin — off the drawing. */}
                <g
                  ref={(el) => {
                    panelRefs.current[k] = el;
                  }}
                  className={`alw-panel ${filled[k] ? 'alw-on' : ''}`}
                >
                  <line x1="-9" y1="1" x2="-6" y2="-6" stroke="#7a7264" strokeWidth="1.6" />
                  <line x1="8" y1="3" x2="6" y2="-4" stroke="#7a7264" strokeWidth="1.6" />
                  <path d="M-19,-5 L-3,-16 L17,-8 L1,3 Z" fill="url(#alwPanelG)" stroke="#122a4d" strokeWidth="1" />
                  <path d="M-19,-5 L-3,-16 L17,-8" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1" />
                  <line className="alw-shine" x1="-11" y1="-10.5" x2="9" y2="-2.5" stroke="rgba(191,219,254,.5)" strokeWidth=".8" />
                </g>
                <polygon data-alw-slot={k} points={q.map((p) => p.join(',')).join(' ')} fill="transparent" style={{ cursor: 'pointer' }} />
              </g>
            );
          })}

          {/* the installer */}
          <g ref={workerRef} data-alw-worker className="alw-worker" style={{ cursor: 'grab', touchAction: 'none' }}>
            <g ref={flipRef}>
              <g className="alw-inner">
                <ellipse cx="0" cy="1.5" rx="8" ry="2.6" fill="rgba(15,23,42,.3)" />
                <rect x="-5" y="-10" width="4" height="10" rx="1.5" fill="#334155" />
                <rect x="1" y="-10" width="4" height="10" rx="1.5" fill="#334155" />
                <g className="alw-torso">
                  <rect x="-6" y="-23" width="12" height="14" rx="3" fill="#2563eb" />
                  <rect x="-6" y="-23" width="12" height="5" rx="2.5" fill="#3b82f6" />
                  <g className="alw-arm alw-arm-l">
                    <rect x="-9.4" y="-22" width="3.2" height="5.5" rx="1.5" fill="#3b82f6" />
                    <rect x="-9" y="-17.5" width="2.6" height="6" rx="1.2" fill="#eab88e" />
                  </g>
                  <g className="alw-arm alw-arm-r">
                    <rect x="6.2" y="-22" width="3.2" height="5.5" rx="1.5" fill="#3b82f6" />
                    <rect x="6.4" y="-17.5" width="2.6" height="6" rx="1.2" fill="#eab88e" />
                  </g>
                  <circle cx="0" cy="-27.5" r="4.6" fill="#eab88e" />
                  <path d="M-6,-29.5 a6,5 0 0 1 12,0 Z" fill="#facc15" />
                  <rect x="-7" y="-30" width="14" height="2.2" rx="1.1" fill="#eab308" />
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200">
          {count} / {SLOTS.length} <span className="font-semibold text-slate-500">{t('panels')}</span>
        </span>
        {done ? (
          <span className="text-xs font-bold text-amber-600">{t('Roof done — your house next?')}</span>
        ) : (
          <span className={`text-xs text-slate-500 transition-opacity duration-500 ${hintGone ? 'opacity-0' : ''}`}>
            {t('Drag the worker, or tap the roof')}
          </span>
        )}
      </div>
    </div>
  );
}
