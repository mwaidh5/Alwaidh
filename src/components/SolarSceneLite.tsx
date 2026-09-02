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
      }, 5200);
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

  // Ground level is the roof plane dropped by the wall height; the wing's
  // roof sits between. Every polygon below is expressed in roof (u, v),
  // so the geometry stays consistent with the slots and the installer.
  const H = 44;
  const g = (u: number, v: number, lift = 0): [number, number] => {
    const p = pt(u, v);
    return [p[0], p[1] + H - lift];
  };
  const poly = (pts: [number, number][]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const r = (u: number, v: number, lift = 0): [number, number] => {
    const p = pt(u, v);
    return [p[0], p[1] - lift];
  };

  // The wing: a single storey in front of the shaded wall.
  const W = { u0: 0.42, u1: 1.0, v0: 1.0, v1: 1.3, h: 26 };
  // Pool, in front of the lit wall.
  const PL = { u0: -0.42, u1: -0.1, v0: 0.2, v1: 0.74 };

  return (
    <div className="select-none">
      {/* Coordinates assume left-to-right; the chip row below flips with
          the language, the drawing itself must not. */}
      <div dir="ltr" className="relative overflow-hidden rounded-2xl ring-1 ring-inset ring-slate-200">
        <svg
          ref={svgRef}
          viewBox="0 0 400 250"
          className="block h-auto w-full"
          role="img"
          aria-label={t('An installer mounting solar panels on a flat roof')}
        >
          <defs>
            <linearGradient id="vlSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#cfe3f7" />
              <stop offset="0.6" stopColor="#eef4fa" />
              <stop offset="1" stopColor="#f6f4ef" />
            </linearGradient>
            <radialGradient id="vlSun">
              <stop offset="0" stopColor="#fff8dc" />
              <stop offset="0.4" stopColor="#fde68a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="vlGround" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e6e2da" />
              <stop offset="1" stopColor="#d9d3c8" />
            </linearGradient>
            <linearGradient id="vlWallLit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fbfaf7" />
              <stop offset="1" stopColor="#e7e3dc" />
            </linearGradient>
            <linearGradient id="vlWallShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d3cfc7" />
              <stop offset="1" stopColor="#bab4aa" />
            </linearGradient>
            <linearGradient id="vlRoof" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f2f0eb" />
              <stop offset="1" stopColor="#dcd8d0" />
            </linearGradient>
            <linearGradient id="vlGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8fb8dc" />
              <stop offset="0.5" stopColor="#4f80ad" />
              <stop offset="1" stopColor="#2e5a85" />
            </linearGradient>
            <linearGradient id="vlPanel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1f2a44" />
              <stop offset="0.55" stopColor="#0b1220" />
              <stop offset="1" stopColor="#111827" />
            </linearGradient>
            <linearGradient id="vlWater" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="1" stopColor="#0ea5e9" />
            </linearGradient>
            <linearGradient id="vlWood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a5754a" />
              <stop offset="1" stopColor="#7c5433" />
            </linearGradient>
            <filter id="vlSoft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <filter id="vlSofter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
          </defs>

          <rect width="400" height="250" fill="url(#vlSky)" />
          <circle className="alw-sun" cx="350" cy="36" r="46" fill="url(#vlSun)" />
          <circle cx="350" cy="36" r="9" fill="#fef3c7" />

          {/* far away: a faint line of hills, nothing to compete with the house */}
          <path d="M0,124 C60,112 110,118 160,110 C210,102 250,116 300,108 C340,102 372,110 400,104 L400,140 L0,140 Z" fill="#c9d8e6" opacity="0.5" />

          {/* the same slow weather as before */}
          <g className="alw-cloud alw-cloud-a" fill="#ffffff" opacity="0.85">
            <ellipse cx="0" cy="34" rx="18" ry="6.5" />
            <ellipse cx="12" cy="30" rx="12" ry="6" />
            <ellipse cx="-11" cy="31.5" rx="9" ry="4.6" />
          </g>
          <g className="alw-cloud alw-cloud-b" fill="#ffffff" opacity="0.6">
            <ellipse cx="0" cy="62" rx="14" ry="5" />
            <ellipse cx="9" cy="59" rx="9" ry="4.4" />
          </g>
          <g className="alw-birds" stroke="#64748b" strokeWidth="1" fill="none" strokeLinecap="round">
            <path d="M0,46 q3,-3.4 6,0 q3,-3.4 6,0" />
            <path d="M14,52 q2.4,-2.8 4.8,0 q2.4,-2.8 4.8,0" />
          </g>

          {/* ground: a pale slab, with a lawn behind the house and a paved
              drive in front of the wing */}
          <polygon points="0,196 206,116 400,190 400,250 0,250" fill="url(#vlGround)" />
          <polygon points={poly([g(-0.7, -0.4), g(1.3, -0.4), g(1.3, -0.06), g(-0.7, -0.06)])} fill="#9fbf8a" opacity="0.9" />
          <polygon points={poly([g(-0.7, -0.06), g(1.3, -0.06), g(1.3, -0.02), g(-0.7, -0.02)])} fill="#c9c3b7" />
          {/* driveway */}
          <polygon points={poly([g(W.u0, W.v1), g(W.u1, W.v1), g(W.u1 + 0.3, W.v1 + 0.5), g(W.u0, W.v1 + 0.5)])} fill="#cfc9be" />
          <g stroke="#bfb8ab" strokeWidth="0.5">
            <line x1={g(W.u0 + 0.19, W.v1)[0]} y1={g(W.u0 + 0.19, W.v1)[1]} x2={g(W.u0 + 0.19, W.v1 + 0.5)[0]} y2={g(W.u0 + 0.19, W.v1 + 0.5)[1]} />
            <line x1={g(W.u0 + 0.38, W.v1)[0]} y1={g(W.u0 + 0.38, W.v1)[1]} x2={g(W.u0 + 0.38, W.v1 + 0.5)[0]} y2={g(W.u0 + 0.38, W.v1 + 0.5)[1]} />
          </g>

          {/* the house's shadow, thrown to the front-left, away from the sun */}
          <polygon
            points={poly([g(0, 0), g(0, 1), g(W.u0, W.v1), [g(W.u0, W.v1)[0] - 30, g(W.u0, W.v1)[1] + 12], [g(0, 1)[0] - 38, g(0, 1)[1] + 14], [g(0, 0)[0] - 38, g(0, 0)[1] + 14]])}
            fill="#3d3a33"
            opacity="0.22"
            filter="url(#vlSoft)"
          />

          {/* the pool: deck, water, a highlight where the sun strikes it */}
          <polygon points={poly([g(PL.u0 - 0.06, PL.v0 - 0.06), g(PL.u1 + 0.06, PL.v0 - 0.06), g(PL.u1 + 0.06, PL.v1 + 0.06), g(PL.u0 - 0.06, PL.v1 + 0.06)])} fill="#efece5" />
          <polygon points={poly([g(PL.u0, PL.v0), g(PL.u1, PL.v0), g(PL.u1, PL.v1), g(PL.u0, PL.v1)])} fill="url(#vlWater)" />
          <polygon points={poly([g(PL.u0, PL.v0), g(PL.u1, PL.v0), g(PL.u1, PL.v1), g(PL.u0, PL.v1)])} fill="none" stroke="#bae6fd" strokeWidth="0.8" />
          <path d={`M${g(PL.u0 + 0.06, PL.v0 + 0.12).join(',')} L${g(PL.u1 - 0.08, PL.v0 + 0.12).join(',')}`} stroke="#e0f2fe" strokeWidth="0.9" opacity="0.8" />
          <path d={`M${g(PL.u0 + 0.1, PL.v0 + 0.3).join(',')} L${g(PL.u1 - 0.12, PL.v0 + 0.3).join(',')}`} stroke="#e0f2fe" strokeWidth="0.6" opacity="0.6" />

          {/* olive trees: layered, grey-green, each on a soft shadow */}
          {[g(-0.62, 0.98), g(1.24, 1.12), g(-0.5, -0.32)].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <ellipse cx="0" cy="1" rx="10" ry="3" fill="rgba(15,23,42,.16)" filter="url(#vlSofter)" />
              <path d="M-1.2,0 L-0.6,-14 L0.8,-14 L1.4,0 Z" fill="#7c5c3f" />
              <circle cx="-5" cy="-17" r="6.5" fill="#7d9a76" />
              <circle cx="5" cy="-18" r="7" fill="#88a680" />
              <circle cx="0" cy="-24" r="7.5" fill="#94b08a" />
              <circle cx="1" cy="-21" r="5" fill="#a3bd98" opacity="0.9" />
            </g>
          ))}

          <g ref={houseRef}>
            {/* MAIN BLOCK — the lit wall faces the pool, the shaded wall faces the drive */}
            <polygon points={poly([r(0, 0), r(0, 1), g(0, 1), g(0, 0)])} fill="url(#vlWallLit)" />
            <polygon points={poly([r(0, 1), r(1, 1), g(1, 1), g(0, 1)])} fill="url(#vlWallShade)" />
            {/* the corner, and the dark line where wall meets ground */}
            <line x1={r(0, 1)[0]} y1={r(0, 1)[1]} x2={g(0, 1)[0]} y2={g(0, 1)[1]} stroke="#c2bbb0" strokeWidth="0.8" />
            <polygon points={poly([g(0, 0), g(0, 1), g(1, 1), [g(1, 1)[0], g(1, 1)[1] + 2], [g(0, 1)[0], g(0, 1)[1] + 2], [g(0, 0)[0], g(0, 0)[1] + 2]])} fill="#9c948a" opacity="0.5" />

            {/* GLASS on the lit wall: floor-to-ceiling, dark frame, sky in it */}
            <polygon points={poly([[r(0, 0.1)[0], r(0, 0.1)[1] + 9], [r(0, 0.62)[0], r(0, 0.62)[1] + 9], [g(0, 0.62)[0], g(0, 0.62)[1] - 2], [g(0, 0.1)[0], g(0, 0.1)[1] - 2]])} fill="#1f2937" />
            {/* THE LIVING ROOM, seen through the glass. Drawn flat in the
                wall's own frame (skewY matches the wall's slope), so a
                sofa is a sofa and a person stands upright. */}
            <g transform={`translate(${r(0, 0.115)[0]} ${r(0, 0.115)[1] + 10.5}) skewY(19.9)`}>
              <rect x="0" y="0" width="56.8" height="31" fill="#f4efe6" />
              <rect x="0" y="24" width="56.8" height="7" fill="#d8cdb8" />
              <rect x="6" y="22" width="30" height="7" rx="1" fill="#c7b9a0" opacity="0.6" />
              {/* the television on the far wall */}
              <rect x="38" y="5" width="15" height="9" rx="0.8" fill="#1f2937" />
              <rect className="alw-tv" x="38.8" y="5.8" width="13.4" height="7.4" rx="0.4" fill="#111827" />
              <rect x="42" y="14.2" width="7" height="1" fill="#374151" />
              {/* a floor lamp by the sofa */}
              <circle className="alw-lamp-glow" cx="4.5" cy="9" r="7" fill="#fde68a" opacity="0" />
              <line x1="4.5" y1="12" x2="4.5" y2="24" stroke="#64748b" strokeWidth="0.8" />
              <path d="M1.5,12 L7.5,12 L6.5,7.5 L2.5,7.5 Z" className="alw-shade" fill="#cbd5e1" />
              {/* a plant in the corner */}
              <rect x="50.5" y="19" width="4" height="5" rx="0.6" fill="#b45309" />
              <circle cx="52.5" cy="16.5" r="3.2" fill="#4d9b5b" />
              <circle cx="50.5" cy="18" r="2.2" fill="#3f8a4d" />
              <circle cx="54.6" cy="18" r="2.2" fill="#5aab68" />
              {/* the air-conditioner high on the wall, and its breath */}
              <rect x="20" y="2" width="12" height="3.6" rx="0.8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.4" />
              <g className="alw-ac-wind" stroke="#93c5fd" strokeWidth="0.6" fill="none" opacity="0">
                <path d="M22,7 q2,1.5 4,0 q2,-1.5 4,0" />
                <path d="M21,9.5 q2,1.5 4,0 q2,-1.5 4,0 q2,1.5 4,0" />
              </g>
              {/* the sofa */}
              <rect x="9" y="15" width="24" height="9" rx="2" fill="#5b7fa6" />
              <rect x="9" y="12.5" width="24" height="4" rx="1.5" fill="#6d91b8" />
              <rect x="8" y="16" width="3" height="8" rx="1" fill="#4f7196" />
              <rect x="31" y="16" width="3" height="8" rx="1" fill="#4f7196" />
              {/* the family: two grown-ups on the sofa, a child on the rug */}
              {[
                { x: 15, y: 16, skin: '#e8b48c', top: '#2563eb', hair: '#1f2937', h: 1 },
                { x: 26, y: 16, skin: '#e2a978', top: '#dc2626', hair: '#3f2a1d', h: 1 },
                { x: 41, y: 19, skin: '#eab88e', top: '#16a34a', hair: '#1f2937', h: 0.75 },
              ].map((p, i) => {
                // Position on the outer group's ATTRIBUTE, the cheer on the
                // inner group's CLASS — a CSS transform on one element
                // replaces the attribute wholesale and the family would
                // leap to the room's corner.
                return (
                <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.h})`}>
                  <g className="alw-person">
                    <rect x="-2.6" y="-6" width="5.2" height="7" rx="1.5" fill={p.top} />
                    <g className="alw-arms">
                      <rect x="-4.4" y="-5.5" width="1.8" height="4.5" rx="0.9" fill={p.skin} />
                      <rect x="2.6" y="-5.5" width="1.8" height="4.5" rx="0.9" fill={p.skin} />
                    </g>
                    <circle cx="0" cy="-8.6" r="2.6" fill={p.skin} />
                    <path d="M-2.6,-9.4 a2.6,2.2 0 0 1 5.2,0 Z" fill={p.hair} />
                  </g>
                </g>
                );
              })}
            </g>
            <polygon points={poly([[r(0, 0.115)[0], r(0, 0.115)[1] + 10.5], [r(0, 0.605)[0], r(0, 0.605)[1] + 10.5], [g(0, 0.605)[0], g(0, 0.605)[1] - 3.5], [g(0, 0.115)[0], g(0, 0.115)[1] - 3.5]])} fill="url(#vlGlass)" opacity="0.42" />
            {[0.235, 0.36, 0.485].map((v) => (
              <line key={v} x1={r(0, v)[0]} y1={r(0, v)[1] + 10.5} x2={g(0, v)[0]} y2={g(0, v)[1] - 3.5} stroke="#1f2937" strokeWidth="0.9" />
            ))}
            {/* the reflection: a lighter band across the glass */}
            <polygon points={poly([[r(0, 0.13)[0], r(0, 0.13)[1] + 12], [r(0, 0.6)[0], r(0, 0.6)[1] + 12], [r(0, 0.6)[0], r(0, 0.6)[1] + 20], [r(0, 0.13)[0], r(0, 0.13)[1] + 20]])} fill="#ffffff" opacity="0.18" />
            {/* the windows keep their class so the "roof done" glow still works */}
            <polygon className="alw-win" points={poly([[r(0, 0.115)[0], r(0, 0.115)[1] + 10.5], [r(0, 0.605)[0], r(0, 0.605)[1] + 10.5], [g(0, 0.605)[0], g(0, 0.605)[1] - 3.5], [g(0, 0.115)[0], g(0, 0.115)[1] - 3.5]])} fill="#fde68a" opacity="0" />

            {/* a timber slat panel on the shaded wall, the entrance beside it */}
            <polygon points={poly([[r(0.06, 1)[0], r(0.06, 1)[1] + 6], [r(0.3, 1)[0], r(0.3, 1)[1] + 6], [g(0.3, 1)[0], g(0.3, 1)[1] - 1], [g(0.06, 1)[0], g(0.06, 1)[1] - 1]])} fill="url(#vlWood)" />
            {[0.09, 0.12, 0.15, 0.18, 0.21, 0.24, 0.27].map((u) => (
              <line key={u} x1={r(u, 1)[0]} y1={r(u, 1)[1] + 6} x2={g(u, 1)[0]} y2={g(u, 1)[1] - 1} stroke="#5b3d24" strokeWidth="0.5" opacity="0.7" />
            ))}
            <polygon points={poly([[r(0.31, 1)[0], r(0.31, 1)[1] + 12], [r(0.4, 1)[0], r(0.4, 1)[1] + 12], [g(0.4, 1)[0], g(0.4, 1)[1] - 1], [g(0.31, 1)[0], g(0.31, 1)[1] - 1]])} fill="#111827" />
            <circle cx={r(0.385, 1)[0]} cy={r(0.385, 1)[1] + 28} r="0.7" fill="#e5e7eb" />

            {/* ROOF SLAB: a slab with thickness, cantilevered past the walls,
                its fascia catching the light along the top edge */}
            <polygon points={poly([r(-0.05, -0.05, 4), r(1.05, -0.05, 4), r(1.05, 1.05, 4), r(-0.05, 1.05, 4)])} fill="url(#vlRoof)" />
            <polygon points={poly([r(-0.05, -0.05, 4), r(-0.05, 1.05, 4), r(-0.05, 1.05, 0), r(-0.05, -0.05, 0)])} fill="#e9e5de" />
            <polygon points={poly([r(-0.05, 1.05, 4), r(1.05, 1.05, 4), r(1.05, 1.05, 0), r(-0.05, 1.05, 0)])} fill="#cdc7bc" />
            <polyline points={poly([r(-0.05, -0.05, 4), r(-0.05, 1.05, 4), r(1.05, 1.05, 4)])} fill="none" stroke="#ffffff" strokeWidth="0.9" opacity="0.8" />
            {/* the shadow the slab throws on the walls below it */}
            <polygon points={poly([r(0, 0), r(0, 1), [r(0, 1)[0], r(0, 1)[1] + 7], [r(0, 0)[0], r(0, 0)[1] + 7]])} fill="#6b6257" opacity="0.18" />
            <polygon points={poly([r(0, 1), r(1, 1), [r(1, 1)[0], r(1, 1)[1] + 7], [r(0, 1)[0], r(0, 1)[1] + 7]])} fill="#3f3a33" opacity="0.22" />
            {/* rooftop: a low plant room at the far corner, and the walkway */}
            <polygon points={poly([r(0.86, 0.02, 4), r(0.98, 0.02, 4), r(0.98, 0.14, 4), r(0.86, 0.14, 4)])} fill="#d6d1c7" />
            <polygon points={poly([r(0.86, 0.02, 10), r(0.98, 0.02, 10), r(0.98, 0.14, 10), r(0.86, 0.14, 10)])} fill="#ece8e1" />
            <polygon points={poly([r(0.86, 0.02, 10), r(0.86, 0.14, 10), r(0.86, 0.14, 4), r(0.86, 0.02, 4)])} fill="#e0dbd2" />
            <polygon points={poly([r(0.86, 0.14, 10), r(0.98, 0.14, 10), r(0.98, 0.14, 4), r(0.86, 0.14, 4)])} fill="#c4bdb2" />
          </g>

          {/* THE WING: one storey, in front of the shaded wall, with the garage */}
          <polygon points={poly([g(W.u0, W.v0, W.h), g(W.u0, W.v1, W.h), g(W.u0, W.v1), g(W.u0, W.v0)])} fill="url(#vlWallLit)" />
          <polygon points={poly([g(W.u0, W.v1, W.h), g(W.u1, W.v1, W.h), g(W.u1, W.v1), g(W.u0, W.v1)])} fill="url(#vlWallShade)" />
          {/* garage door */}
          <polygon points={poly([[g(W.u0 + 0.08, W.v1, W.h)[0], g(W.u0 + 0.08, W.v1, W.h)[1] + 5], [g(W.u1 - 0.08, W.v1, W.h)[0], g(W.u1 - 0.08, W.v1, W.h)[1] + 5], [g(W.u1 - 0.08, W.v1)[0], g(W.u1 - 0.08, W.v1)[1] - 1], [g(W.u0 + 0.08, W.v1)[0], g(W.u0 + 0.08, W.v1)[1] - 1]])} fill="#e5e1d9" />
          {[9, 13, 17, 21].map((d) => (
            <line key={d} x1={g(W.u0 + 0.08, W.v1, W.h)[0]} y1={g(W.u0 + 0.08, W.v1, W.h)[1] + d} x2={g(W.u1 - 0.08, W.v1, W.h)[0]} y2={g(W.u1 - 0.08, W.v1, W.h)[1] + d} stroke="#cfc9bf" strokeWidth="0.6" />
          ))}
          {/* wing roof slab */}
          <polygon points={poly([g(W.u0 - 0.04, W.v0, W.h + 3), g(W.u1 + 0.04, W.v0, W.h + 3), g(W.u1 + 0.04, W.v1 + 0.05, W.h + 3), g(W.u0 - 0.04, W.v1 + 0.05, W.h + 3)])} fill="url(#vlRoof)" />
          <polygon points={poly([g(W.u0 - 0.04, W.v0, W.h + 3), g(W.u0 - 0.04, W.v1 + 0.05, W.h + 3), g(W.u0 - 0.04, W.v1 + 0.05, W.h), g(W.u0 - 0.04, W.v0, W.h)])} fill="#e9e5de" />
          <polygon points={poly([g(W.u0 - 0.04, W.v1 + 0.05, W.h + 3), g(W.u1 + 0.04, W.v1 + 0.05, W.h + 3), g(W.u1 + 0.04, W.v1 + 0.05, W.h), g(W.u0 - 0.04, W.v1 + 0.05, W.h)])} fill="#cdc7bc" />
          <polyline points={poly([g(W.u0 - 0.04, W.v0, W.h + 3), g(W.u0 - 0.04, W.v1 + 0.05, W.h + 3), g(W.u1 + 0.04, W.v1 + 0.05, W.h + 3)])} fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.8" />
          {/* a hedge along the wing's foot */}
          {[0.1, 0.22, 0.34].map((d) => (
            <ellipse key={d} cx={g(W.u0 - 0.06, W.v0 + d)[0]} cy={g(W.u0 - 0.06, W.v0 + d)[1] - 2} rx="5" ry="3.2" fill="#8aa87e" />
          ))}

          {/* The wall kit: a Powerwall-style battery and its inverter on the
              lit wall, cabled to the roof. skewY(19.9) matches the wall's
              slope. It wakes the moment the first panel is in: LED green,
              screen lit, charge bars filling with the roof, and current
              flowing down the cables. */}
          <g className={count > 0 ? 'alw-gear alw-live' : 'alw-gear'}>
            <path d="M186,183 V196" fill="none" stroke="#475569" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M196,203 V208" fill="none" stroke="#475569" strokeWidth="1.4" strokeLinecap="round" />
            <path className="alw-cable-flow" d="M186,183 V196" fill="none" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" />
            <path className="alw-cable-flow" d="M196,203 V208" fill="none" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" />
            {/* the battery: a tall white slab, a dark band at its foot */}
            <g transform="translate(176 200) skewY(19.9)">
              <rect x="0.8" y="1" width="15" height="24" rx="2" fill="rgba(15,23,42,.18)" />
              <rect x="0" y="0" width="15" height="24" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.6" />
              <rect x="0" y="19.5" width="15" height="4.5" rx="1.2" fill="#0f172a" />
              <rect x="2" y="2.5" width="11" height="0.8" rx="0.4" fill="#e2e8f0" />
              {[0, 1, 2].map((i) => (
                <rect
                  key={i}
                  className={`alw-cell ${count > i * 2 ? 'alw-cell-on' : ''}`}
                  x={2.2 + i * 3.8}
                  y="21"
                  width="2.8"
                  height="1.6"
                  rx="0.5"
                  fill="#475569"
                />
              ))}
            </g>
            {/* the inverter beside it */}
            <g transform="translate(193 208) skewY(19.9)">
              <rect x="0.6" y="0.8" width="10" height="11" rx="1.4" fill="rgba(15,23,42,.18)" />
              <rect x="0" y="0" width="10" height="11" rx="1.4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.6" />
              <rect className="alw-inv-screen" x="1.8" y="2" width="6.4" height="3.4" rx="0.7" fill="#334155" />
              <circle className="alw-led" cx="2.6" cy="8.4" r="1" fill="#94a3b8" />
              <rect x="4.6" y="7.6" width="3.6" height="1.6" rx="0.8" fill="#cbd5e1" />
            </g>
          </g>

          {/* panels + their tap areas: black glass, flush to the slab */}
          {SLOTS.map((slot, k) => {
            const i = k % 3;
            const j = k < 3 ? 0 : 1;
            const q = [pt(i / 3, j / 2), pt((i + 1) / 3, j / 2), pt((i + 1) / 3, (j + 1) / 2), pt(i / 3, (j + 1) / 2)];
            return (
              <g key={k} transform={`translate(${slot.cx},${slot.cy - 4})`}>
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
                  <path d="M-17,-1.5 L-1,-12.5 L19,-4.5 L3,6.5 Z" fill="#3d3a33" opacity="0.25" filter="url(#vlSofter)" />
                  {/* a low rail, then the frame's thickness, then the glass */}
                  <path d="M-19,-4 L1,4 L17,-7 L17,-5.4 L1,5.6 L-19,-2.4 Z" fill="#334155" />
                  <path d="M-19,-4 L-3,-15 L17,-7 L1,4 Z" fill="#475569" />
                  <path d="M-18,-4.2 L-3.2,-14.2 L16,-7 L1.2,3 Z" fill="url(#vlPanel)" />
                  <g stroke="rgba(148,163,184,.25)" strokeWidth="0.5" fill="none">
                    <path d="M-10.6,-9.2 L8.6,-2 M-13.4,-7.4 L2.2,-0.5 M-8.4,-10.9 L7.2,-4 M-3.4,-14 L12,-7" />
                  </g>
                  <line className="alw-shine" x1="-11" y1="-9.5" x2="9" y2="-1.5" stroke="rgba(224,242,254,.65)" strokeWidth="1" strokeLinecap="round" />
                  <path d="M-18,-4.2 L-3.2,-14.2 L16,-7" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="0.7" />
                </g>
                <polygon data-alw-slot={k} points={q.map((p) => p.join(',')).join(' ')} fill="transparent" style={{ cursor: 'pointer' }} />
              </g>
            );
          })}

          {/* the installer */}
          <g ref={workerRef} data-alw-worker className="alw-worker" style={{ cursor: 'grab', touchAction: 'none' }}>
            <g ref={flipRef}>
              <g className="alw-inner">
                <ellipse cx="0" cy="1.5" rx="8" ry="2.6" fill="rgba(15,23,42,.3)" filter="url(#vlSofter)" />
                <rect x="-5" y="-10" width="4" height="10" rx="1.5" fill="#334155" />
                <rect x="1" y="-10" width="4" height="10" rx="1.5" fill="#334155" />
                <rect x="-5.4" y="-1.5" width="4.8" height="2.6" rx="1" fill="#1e293b" />
                <rect x="0.6" y="-1.5" width="4.8" height="2.6" rx="1" fill="#1e293b" />
                <g className="alw-torso">
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
                  <circle cx="0" cy="-27.5" r="4.6" fill="#eab88e" />
                  <path d="M-6,-29.5 a6,5 0 0 1 12,0 Z" fill="#facc15" />
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
