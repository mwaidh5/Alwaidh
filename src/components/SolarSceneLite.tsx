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
      <div dir="ltr" className="relative overflow-hidden rounded-2xl ring-1 ring-inset ring-sky-200/60">
        <svg
          ref={svgRef}
          viewBox="0 0 400 250"
          className="block h-auto w-full"
          role="img"
          aria-label={t('An installer mounting solar panels on a flat roof')}
        >
          <defs>
            {/* Light comes from the upper right, where the sun is: the
                right-facing roof top is brightest, the left wall is lit,
                the wall facing us is in shade. */}
            <linearGradient id="alwSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7cc4f5" />
              <stop offset="0.55" stopColor="#c7e6fb" />
              <stop offset="1" stopColor="#fdf1d8" />
            </linearGradient>
            <radialGradient id="alwSunG">
              <stop offset="0" stopColor="#fff7c2" />
              <stop offset="0.35" stopColor="#fde68a" stopOpacity="0.8" />
              <stop offset="1" stopColor="#fcd34d" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="alwGround" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e9dcc3" />
              <stop offset="1" stopColor="#d6c4a3" />
            </linearGradient>
            <linearGradient id="alwRoofTop" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e3dccb" />
              <stop offset="1" stopColor="#cfc6b1" />
            </linearGradient>
            <linearGradient id="alwWallLit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#efe8d9" />
              <stop offset="1" stopColor="#dcd2bf" />
            </linearGradient>
            <linearGradient id="alwWallShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#bfb39d" />
              <stop offset="1" stopColor="#a89b85" />
            </linearGradient>
            <linearGradient id="alwGlass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2f5fb8" />
              <stop offset="0.5" stopColor="#1e3f86" />
              <stop offset="1" stopColor="#0f2352" />
            </linearGradient>
            <linearGradient id="alwWinGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7fb4e8" />
              <stop offset="1" stopColor="#3b6ea8" />
            </linearGradient>
            <filter id="alwSoft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <filter id="alwSofter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
          </defs>

          <rect width="400" height="250" fill="url(#alwSky)" />

          {/* the sun, with the long low rays of an afternoon */}
          <g opacity="0.35" stroke="#fde68a" strokeWidth="1.2" strokeLinecap="round">
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
              const r = (a * Math.PI) / 180;
              return (
                <line
                  key={a}
                  x1={352 + Math.cos(r) * 22}
                  y1={40 + Math.sin(r) * 22}
                  x2={352 + Math.cos(r) * 46}
                  y2={40 + Math.sin(r) * 46}
                />
              );
            })}
          </g>
          <circle className="alw-sun" cx="352" cy="40" r="40" fill="url(#alwSunG)" />
          <circle cx="352" cy="40" r="13" fill="#fde68a" />
          <circle cx="352" cy="40" r="10.5" fill="#fef3c7" />

          {/* Baghdad in the haze: a low skyline with a dome and a minaret */}
          <g fill="#9ec3e3" opacity="0.55">
            <rect x="0" y="126" width="400" height="30" />
            <rect x="18" y="112" width="22" height="16" />
            <rect x="52" y="118" width="14" height="10" />
            <rect x="74" y="106" width="9" height="22" />
            <rect x="118" y="116" width="26" height="12" />
            <path d="M226,128 a13,10 0 0 1 26,0 Z" />
            <rect x="256" y="98" width="4" height="30" />
            <path d="M254,98 h8 l-4,-8 Z" />
            <rect x="286" y="114" width="30" height="14" />
            <rect x="330" y="120" width="16" height="8" />
            <rect x="372" y="110" width="18" height="18" />
          </g>
          <rect x="0" y="126" width="400" height="30" fill="url(#alwSky)" opacity="0.35" />

          {/* Two clouds on different winds, and a pair of birds. They all
              start left of the frame and drift across on CSS clocks. */}
          <g className="alw-cloud alw-cloud-a" fill="#ffffff" opacity="0.92">
            <ellipse cx="0" cy="34" rx="18" ry="6.5" />
            <ellipse cx="12" cy="30" rx="12" ry="6" />
            <ellipse cx="-11" cy="31.5" rx="9" ry="4.6" />
            <ellipse cx="3" cy="28" rx="8" ry="5" />
          </g>
          <g className="alw-cloud alw-cloud-b" fill="#ffffff" opacity="0.7">
            <ellipse cx="0" cy="62" rx="14" ry="5" />
            <ellipse cx="9" cy="59" rx="9" ry="4.4" />
            <ellipse cx="-8" cy="60" rx="7" ry="3.6" />
          </g>
          <g className="alw-birds" stroke="#475569" strokeWidth="1.1" fill="none" strokeLinecap="round">
            <path d="M0,46 q3,-3.4 6,0 q3,-3.4 6,0" />
            <path d="M14,52 q2.4,-2.8 4.8,0 q2.4,-2.8 4.8,0" />
          </g>

          {/* The yard: a sand slab, its far wall, and a paved path to the door */}
          <polygon points="0,196 206,116 400,190 400,250 0,250" fill="url(#alwGround)" />
          <polygon points="0,196 206,116 400,190 400,196 206,122" fill="#b9a98c" opacity="0.45" />
          {/* far boundary wall, two faces */}
          <polygon points="26,190 206,122 206,130 26,198" fill="#d8ccb4" />
          <polygon points="206,122 386,188 386,196 206,130" fill="#bfb198" />
          <polygon points="26,184 206,116 386,182 386,188 206,122 26,190" fill="#e8e0cf" />
          {/* path */}
          <polygon points="300,196 330,184 400,212 400,232" fill="#cdbf9f" opacity="0.7" />
          {/* the house's shadow, thrown toward the front-left, away from the sun */}
          <polygon points="96,194 212,236 200,250 60,250 60,214" fill="#4a3f2f" opacity="0.22" filter="url(#alwSoft)" />

          {/* A palm on the empty side, and shrubs by the walls. */}
          <g transform="translate(44 216)">
            <ellipse cx="2" cy="1.5" rx="12" ry="3" fill="rgba(15,23,42,.18)" filter="url(#alwSofter)" />
            <path d="M-2,0 C-3.2,-12 -1.4,-24 1.2,-33 L4.2,-32.4 C2,-23 1.6,-11 3,0 Z" fill="#8a6a4b" />
            <path d="M-2,0 C-3.2,-12 -1.4,-24 1.2,-33 L2.6,-32.7 C0.8,-23 0.4,-11 1.2,0 Z" fill="#a7825d" opacity="0.6" />
            <g fill="#2e9e46">
              <path d="M2,-33 C8,-40 17,-41 24,-37 C16,-36 9,-33 4,-30 Z" />
              <path d="M2,-33 C-4,-40 -13,-41 -20,-37 C-12,-36 -5,-33 0,-30 Z" />
              <path d="M2,-33.5 C4,-41 10,-46 17,-46.5 C11,-43 6,-38 4,-32 Z" fill="#37b052" />
              <path d="M2,-33.5 C0,-41 -6,-46 -13,-46.5 C-7,-43 -2,-38 0,-32 Z" fill="#37b052" />
              <path d="M1.6,-34 C2,-40 2.6,-44 2,-48 C3.8,-44 4.6,-39 3.6,-33.6 Z" fill="#41bd5c" />
              <path d="M2,-32 C9,-31 15,-27 18,-21 C12,-24 7,-27 3.4,-29.5 Z" fill="#26893c" />
              <path d="M2,-32 C-5,-31 -11,-27 -14,-21 C-8,-24 -3,-27 0.6,-29.5 Z" fill="#26893c" />
            </g>
          </g>
          <g transform="translate(352 222)">
            <ellipse cx="0" cy="2" rx="12" ry="3" fill="rgba(15,23,42,.16)" filter="url(#alwSofter)" />
            <ellipse cx="0" cy="-3.5" rx="9.5" ry="6" fill="#3aa653" />
            <ellipse cx="-7.5" cy="-1" rx="6.5" ry="4.2" fill="#2e8f45" />
            <ellipse cx="7.5" cy="-1.5" rx="7" ry="4.4" fill="#45b25c" />
            <ellipse cx="1" cy="-6" rx="5" ry="3.4" fill="#5cc46f" opacity="0.8" />
          </g>
          <g transform="translate(70 232)">
            <ellipse cx="0" cy="-2.5" rx="7" ry="4.4" fill="#3aa653" />
            <ellipse cx="5" cy="-1" rx="5" ry="3.2" fill="#2e8f45" />
          </g>

          <g ref={houseRef}>
            {/* walls: the left one takes the light, the right one is in shade */}
            <polygon points="96,150 212,192 212,236 96,194" fill="url(#alwWallLit)" />
            <polygon points="212,192 322,150 322,194 212,236" fill="url(#alwWallShade)" />
            {/* the corner edge and the ground line */}
            <line x1="212" y1="192" x2="212" y2="236" stroke="#8f8470" strokeWidth="0.8" />
            <polygon points="96,194 212,236 322,194 322,197 212,239 96,197" fill="#8f8470" opacity="0.5" />

            {/* windows on the lit wall: frame, glass, sill, a curtain edge */}
            {[
              [113.4, 171.7, 131.9, 178.4, 131.9, 191.4, 113.4, 184.7],
              [151.7, 185.6, 170.2, 192.3, 170.2, 205.3, 151.7, 198.6],
            ].map((w, i) => (
              <g key={i}>
                <polygon
                  points={`${w[0] - 1.2},${w[1] - 1.2} ${w[2] + 1.2},${w[3] - 1.2} ${w[4] + 1.2},${w[5] + 1.2} ${w[6] - 1.2},${w[7] + 1.2}`}
                  fill="#f8fafc"
                />
                <polygon className="alw-win" points={w.join(',')} fill="url(#alwWinGlass)" />
                <line x1={(w[0] + w[2]) / 2} y1={(w[1] + w[3]) / 2} x2={(w[6] + w[4]) / 2} y2={(w[7] + w[5]) / 2} stroke="#f8fafc" strokeWidth="0.9" />
                <polygon
                  points={`${w[6] - 2},${w[7] + 1.2} ${w[4] + 2},${w[5] + 1.2} ${w[4] + 2},${w[5] + 3} ${w[6] - 2},${w[7] + 3}`}
                  fill="#e2e8f0"
                />
              </g>
            ))}

            {/* the door on the shaded wall: frame, wood, handle, a step */}
            <polygon points="271,180.4 289.4,173.4 289.4,208 271,215" fill="#e7e2d6" />
            <polygon points="272.5,179.9 287.9,174 287.9,207 272.5,212.9" fill="#7c4a2d" />
            <polygon points="274,181.2 286.4,176.5 286.4,190 274,194.7" fill="#8f583a" />
            <polygon points="274,196.5 286.4,191.8 286.4,205 274,209.7" fill="#8f583a" />
            <circle cx="284.5" cy="194.5" r="0.9" fill="#fcd34d" />
            <polygon points="268,215.8 292,206.6 292,210 268,219.2" fill="#c9bfa8" />

            {/* an air-conditioner on the shaded wall, as every house has */}
            <g transform="translate(300 176) skewY(-20.9)">
              <rect x="0" y="0" width="12" height="7" rx="1" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.6" />
              <line x1="1.5" y1="2.2" x2="10.5" y2="2.2" stroke="#94a3b8" strokeWidth="0.6" />
              <line x1="1.5" y1="4.2" x2="10.5" y2="4.2" stroke="#94a3b8" strokeWidth="0.6" />
            </g>

            {/* the roof: parapet outer face, top, and the inner well */}
            <polygon points="96,150 206,108 322,150 212,192" fill="#a89b85" />
            <polygon points="96,147 206,105 322,147 212,189" fill="url(#alwRoofTop)" stroke="#b6ad99" strokeWidth="1.2" strokeLinejoin="round" />
            <polygon points="107.3,150 206.3,112.2 310.7,150 211.7,187.8" fill="#c9c0ac" />
            <polygon points="107.3,150 206.3,112.2 310.7,150 211.7,187.8" fill="none" stroke="#b1a792" strokeWidth="0.8" />
            {/* a satellite dish on the far corner of the parapet */}
            <g transform="translate(300 146)">
              <line x1="0" y1="0" x2="0" y2="-6" stroke="#64748b" strokeWidth="1" />
              <ellipse cx="-2.5" cy="-8" rx="4.5" ry="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.6" />
            </g>
          </g>

          {/* The wall kit: inverter and battery on the lit wall, cabled
              to the roof. skewY(19.9) matches the wall's slope, so the
              boxes hang flat on it like the windows do. It wakes the
              moment the first panel is in: LED green, screen lit, charge
              bars filling with the roof, and current flowing down the
              cables. */}
          <g className={count > 0 ? 'alw-gear alw-live' : 'alw-gear'}>
            <path d="M186,183 V198" fill="none" stroke="#334155" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M186,212 V218" fill="none" stroke="#334155" strokeWidth="1.6" strokeLinecap="round" />
            <path className="alw-cable-flow" d="M186,183 V198" fill="none" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" />
            <path className="alw-cable-flow" d="M186,212 V218" fill="none" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" />

            <g transform="translate(179 198) skewY(19.9)">
              <rect x="0.6" y="0.8" width="14" height="14" rx="1.6" fill="rgba(15,23,42,.18)" />
              <rect x="0" y="0" width="14" height="14" rx="1.6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.7" />
              <rect x="0" y="0" width="14" height="2.2" rx="1" fill="#2563eb" />
              <rect className="alw-inv-screen" x="2.4" y="3.6" width="9.2" height="4.4" rx="0.8" fill="#334155" />
              <circle className="alw-led" cx="3.6" cy="11" r="1.2" fill="#94a3b8" />
              <rect x="6.4" y="10" width="5.2" height="2" rx="1" fill="#cbd5e1" />
            </g>

            <g transform="translate(177 218) skewY(19.9)">
              <rect x="0.6" y="0.8" width="18" height="9" rx="1.4" fill="rgba(15,23,42,.18)" />
              <rect x="0" y="0" width="18" height="9" rx="1.4" fill="#1e293b" stroke="#0f172a" strokeWidth="0.7" />
              <rect x="0" y="0" width="18" height="1.6" rx="0.8" fill="#334155" />
              {[0, 1, 2].map((i) => (
                <rect
                  key={i}
                  className={`alw-cell ${count > i * 2 ? 'alw-cell-on' : ''}`}
                  x={2.2 + i * 5}
                  y="2.6"
                  width="3.6"
                  height="4.4"
                  rx="0.7"
                  fill="#475569"
                />
              ))}
            </g>
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
                  {/* its shadow on the roof */}
                  <path d="M-17,-1 L-1,-12 L19,-4 L3,7 Z" fill="#3b3222" opacity="0.22" filter="url(#alwSofter)" />
                  {/* the stand: two legs and a rail */}
                  <line x1="-9" y1="1" x2="-6" y2="-6" stroke="#6b6357" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="8" y1="3" x2="6" y2="-4" stroke="#6b6357" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="-9" y1="1" x2="8" y2="3" stroke="#6b6357" strokeWidth="1.2" strokeLinecap="round" />
                  {/* the frame's thickness, then the glass */}
                  <path d="M-19,-5 L1,3 L17,-8 L17,-6.4 L1,4.6 L-19,-3.4 Z" fill="#94a3b8" />
                  <path d="M-19,-5 L-3,-16 L17,-8 L1,3 Z" fill="#cbd5e1" />
                  <path d="M-17.6,-5.2 L-3.2,-14.8 L15.6,-7.8 L1.2,1.6 Z" fill="url(#alwGlass)" />
                  {/* cell grid: two rows, three columns, in the panel's own perspective */}
                  <g stroke="rgba(191,219,254,.35)" strokeWidth="0.6">
                    <line x1="-10.4" y1="-10" x2="8.4" y2="-3.1" />
                    <line x1="-1.6" y1="-11.6" x2="-1.6" y2="-11.6" />
                    <path d="M-12.9,-8.4 L2.5,-1.4 M-8.2,-11.6 L7.2,-4.6 M-3.5,-14.7 L11.9,-7.8" fill="none" />
                  </g>
                  {/* the glass catching the sun */}
                  <line className="alw-shine" x1="-11" y1="-10.5" x2="9" y2="-2.5" stroke="rgba(219,234,254,.7)" strokeWidth="1" strokeLinecap="round" />
                  <path d="M-17.6,-5.2 L-3.2,-14.8 L15.6,-7.8" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="0.8" />
                </g>
                <polygon data-alw-slot={k} points={q.map((p) => p.join(',')).join(' ')} fill="transparent" style={{ cursor: 'pointer' }} />
              </g>
            );
          })}

          {/* the installer */}
          <g ref={workerRef} data-alw-worker className="alw-worker" style={{ cursor: 'grab', touchAction: 'none' }}>
            <g ref={flipRef}>
              <g className="alw-inner">
                <ellipse cx="0" cy="1.5" rx="8" ry="2.6" fill="rgba(15,23,42,.3)" filter="url(#alwSofter)" />
                {/* legs and boots */}
                <rect x="-5" y="-10" width="4" height="10" rx="1.5" fill="#334155" />
                <rect x="1" y="-10" width="4" height="10" rx="1.5" fill="#334155" />
                <rect x="-5.4" y="-1.5" width="4.8" height="2.6" rx="1" fill="#1e293b" />
                <rect x="0.6" y="-1.5" width="4.8" height="2.6" rx="1" fill="#1e293b" />
                <g className="alw-torso">
                  {/* hi-vis vest over a blue shirt */}
                  <rect x="-6" y="-23" width="12" height="14" rx="3" fill="#2563eb" />
                  <rect x="-6" y="-23" width="12" height="14" rx="3" fill="#f59e0b" opacity="0.9" />
                  <rect x="-6" y="-17.5" width="12" height="1.6" fill="#e2e8f0" opacity="0.9" />
                  <rect x="-6" y="-13.5" width="12" height="1.6" fill="#e2e8f0" opacity="0.9" />
                  <rect x="-1" y="-23" width="2" height="14" fill="#2563eb" opacity="0.9" />
                  <rect x="-6" y="-10.2" width="12" height="1.8" rx="0.9" fill="#1e293b" />
                  <g className="alw-arm alw-arm-l">
                    <rect x="-9.4" y="-22" width="3.2" height="5.5" rx="1.5" fill="#3b82f6" />
                    <rect x="-9" y="-17.5" width="2.6" height="6" rx="1.2" fill="#eab88e" />
                  </g>
                  <g className="alw-arm alw-arm-r">
                    <rect x="6.2" y="-22" width="3.2" height="5.5" rx="1.5" fill="#3b82f6" />
                    <rect x="6.4" y="-17.5" width="2.6" height="6" rx="1.2" fill="#eab88e" />
                  </g>
                  {/* head and helmet */}
                  <circle cx="0" cy="-27.5" r="4.6" fill="#eab88e" />
                  <path d="M-6,-29.5 a6,5 0 0 1 12,0 Z" fill="#facc15" />
                  <path d="M-6,-29.5 a6,5 0 0 1 12,0 Z" fill="#fde047" opacity="0.5" transform="translate(0 -0.6) scale(0.7 0.7)" />
                  <rect x="-7.4" y="-30" width="14.8" height="2.2" rx="1.1" fill="#eab308" />
                  <rect x="-2.5" y="-25.3" width="5" height="1" rx="0.5" fill="#c99a70" />
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
