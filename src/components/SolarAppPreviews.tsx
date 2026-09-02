import { useState } from 'react';
import { useLang } from '../lib/i18n';

/**
 * What the customer sees on their phone after the install: the two
 * monitoring apps, drawn as phone mock-ups in each app's own manner.
 * Sinexcel's is light — a house from the front, the flow marked in green;
 * SAJ's is dark — a house from above, a slower current. Both are drawn
 * here, not photographed: the point is the shape of the thing, and a
 * drawing stays crisp on any screen and never goes out of date with the
 * app's next update.
 *
 * The energy runs as a dashed line whose dashes travel: panel and
 * battery into the inverter, inverter into the house.
 */
export default function SolarAppPreviews({
  logos,
}: {
  logos: { sinexcel?: string; saj?: string };
}) {
  const { t } = useLang();
  const [which, setWhich] = useState<'sinexcel' | 'saj'>('sinexcel');

  const apps = [
    { key: 'sinexcel' as const, name: 'Sinexcel', logo: logos.sinexcel, node: <SinexcelPhone /> },
    { key: 'saj' as const, name: 'SAJ', logo: logos.saj, node: <SajPhone /> },
  ];

  return (
    <section className="mt-16 border-t border-slate-200 pt-12 lg:mt-20 lg:pt-16">
      <div className="mb-8 max-w-2xl">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
          {t('After the install')}
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {t('Watch your system from your phone')}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          {t(
            'Every system comes with its maker’s app: what the panels are producing, how full the battery is, and what the house is using — live, from anywhere.',
          )}
        </p>
      </div>

      {/* Phones: one at a time, with a switch. */}
      <div className="mb-5 flex items-center gap-1 rounded-full bg-slate-100 p-1 lg:hidden">
        {apps.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setWhich(a.key)}
            className={`flex-1 rounded-full py-2 text-[13px] font-bold transition ${
              which === a.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            {a.name}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {apps.map((a) => (
          <figure
            key={a.key}
            className={`${which === a.key ? '' : 'hidden'} flex flex-col items-center lg:flex`}
          >
            <div className="w-full max-w-[19rem]">{a.node}</div>
            <figcaption className="mt-5 flex items-center gap-3">
              {a.logo ? (
                <img src={a.logo} alt={a.name} className="h-7 w-auto object-contain" loading="lazy" />
              ) : (
                <span className="text-base font-extrabold text-slate-900">{a.name}</span>
              )}
              <span className="text-sm text-slate-500">{t('monitoring app')}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The phone itself: a dark bezel with a rounded screen and a notch.   */
function Phone({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative mx-auto rounded-[2.6rem] bg-slate-900 p-[7px] shadow-2xl shadow-slate-900/30 ring-1 ring-slate-700">
      <div
        className={`relative overflow-hidden rounded-[2.2rem] ${dark ? 'bg-[#0b1220] text-slate-100' : 'bg-[#f3f4f6] text-slate-900'}`}
        style={{ aspectRatio: '9 / 19' }}
      >
        <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sinexcel: light, a house from the front.                            */
function SinexcelPhone() {
  return (
    <Phone>
      <div dir="ltr" className="flex h-full flex-col px-3 pt-9 text-[9px]">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            أبو علي
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span>☾</span>
            <span>40°C</span>
            <span className="h-5 w-5 rounded-full bg-slate-300" />
          </div>
        </div>

        <svg viewBox="0 0 200 150" className="mt-2 w-full">
          <defs>
            <linearGradient id="sxRoof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a4353" />
              <stop offset="1" stopColor="#252c38" />
            </linearGradient>
            <linearGradient id="sxWall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8a929e" />
              <stop offset="1" stopColor="#6f7884" />
            </linearGradient>
            <linearGradient id="sxCell" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3b6fd6" />
              <stop offset="1" stopColor="#1d3f8f" />
            </linearGradient>
          </defs>
          {/* labels above */}
          <g fontSize="7" fill="#64748b">
            <text x="86" y="14" textAnchor="end" fontSize="9" fontWeight="700" fill="#0f172a">3.1 kW</text>
            <text x="86" y="23" textAnchor="end">PV</text>
            <line x1="90" y1="6" x2="90" y2="52" stroke="#cbd5e1" strokeWidth="0.8" />
            <text x="178" y="14" textAnchor="end" fontSize="9" fontWeight="700" fill="#0f172a">0 kW</text>
            <text x="178" y="23" textAnchor="end">Grid</text>
            <line x1="182" y1="6" x2="182" y2="60" stroke="#cbd5e1" strokeWidth="0.8" />
          </g>
          {/* ground */}
          <rect x="0" y="118" width="200" height="8" fill="#e5e7eb" />
          <rect x="0" y="126" width="200" height="4" fill="#d1d5db" />
          {/* tree */}
          <circle cx="112" cy="46" r="14" fill="#5faa5f" />
          <circle cx="122" cy="52" r="10" fill="#4f9b4f" />
          {/* pole + wire */}
          <line x1="184" y1="60" x2="184" y2="118" stroke="#334155" strokeWidth="2" />
          <line x1="178" y1="66" x2="190" y2="66" stroke="#334155" strokeWidth="1.5" />
          <line x1="184" y1="70" x2="150" y2="92" stroke="#94a3b8" strokeWidth="0.7" />
          {/* house body */}
          <rect x="30" y="72" width="130" height="46" fill="url(#sxWall)" />
          <polygon points="18,72 100,38 172,72" fill="url(#sxRoof)" />
          <rect x="18" y="70" width="154" height="3" fill="#f8fafc" />
          {/* dormer */}
          <rect x="54" y="52" width="34" height="20" fill="#7d8592" />
          <polygon points="50,52 71,42 92,52" fill="#2f3743" />
          <rect x="58" y="56" width="10" height="12" fill="#fde9b6" />
          <rect x="72" y="56" width="10" height="12" fill="#fde9b6" />
          {/* panels on the right roof slope */}
          <g transform="translate(104 48) skewX(-28)">
            {[0, 1, 2, 3, 4].map((c) =>
              [0, 1, 2].map((r) => (
                <rect key={`${c}-${r}`} x={c * 9} y={r * 6.5} width="8.2" height="5.8" fill="url(#sxCell)" stroke="#dbeafe" strokeWidth="0.5" />
              )),
            )}
          </g>
          {/* porch + car */}
          <rect x="30" y="72" width="34" height="46" fill="#6b7480" />
          <rect x="33" y="76" width="2" height="42" fill="#f1f5f9" />
          <rect x="60" y="76" width="2" height="42" fill="#f1f5f9" />
          <rect x="36" y="100" width="24" height="12" rx="5" fill="#f8fafc" />
          <circle cx="42" cy="114" r="3" fill="#1f2937" />
          <circle cx="54" cy="114" r="3" fill="#1f2937" />
          {/* window */}
          <rect x="72" y="84" width="26" height="18" fill="#f8fafc" />
          <rect x="74" y="86" width="22" height="14" fill="#fff3d6" />
          {/* inverter + battery on the wall */}
          <rect x="112" y="80" width="12" height="10" rx="1.2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.6" />
          <rect x="114" y="82" width="8" height="2.5" rx="0.6" fill="#cbd5e1" />
          <rect x="111" y="98" width="14" height="18" rx="1.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.6" />
          <rect x="113" y="100" width="10" height="2" rx="0.5" fill="#22c55e" />
          {/* door */}
          <rect x="136" y="84" width="18" height="34" fill="#4b5563" />
          <rect x="139" y="87" width="12" height="31" fill="#374151" />
          <circle cx="148.5" cy="103" r="0.9" fill="#e5e7eb" />
          {/* the flow: panels → inverter, battery → inverter, inverter → house */}
          <path d="M118,68 L118,80" fill="none" stroke="#bbf7d0" strokeWidth="2" />
          <path d="M118,90 L118,98" fill="none" stroke="#bbf7d0" strokeWidth="2" />
          <path d="M124,85 L136,85 L136,100" fill="none" stroke="#bbf7d0" strokeWidth="2" />
          <path className="sx-flow" d="M118,68 L118,80" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
          <path className="sx-flow" d="M118,98 L118,90" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
          <path className="sx-flow" d="M124,85 L136,85 L136,100" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
          {/* labels below */}
          <g fontSize="7" fill="#64748b">
            <line x1="118" y1="122" x2="118" y2="146" stroke="#cbd5e1" strokeWidth="0.8" />
            <text x="114" y="134" textAnchor="end" fontSize="9" fontWeight="700" fill="#0f172a">2.2 kW</text>
            <text x="114" y="143" textAnchor="end">Batt.</text>
            <line x1="152" y1="122" x2="152" y2="146" stroke="#cbd5e1" strokeWidth="0.8" />
            <text x="156" y="134" fontSize="9" fontWeight="700" fill="#0f172a">2.2 kW</text>
            <text x="156" y="143">Family</text>
          </g>
        </svg>

        {/* cards */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white p-2.5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-extrabold">0 <span className="text-[8px] font-bold">/kWh</span></span>
              <span className="text-emerald-500">↗</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-slate-500">Battery Level</span>
              <span className="text-[12px] font-extrabold text-emerald-500">80.9<span className="text-[8px]">%</span></span>
            </div>
            <div className="mt-1.5 flex gap-[3px]">
              {['#f87171', '#fb923c', '#fbbf24', '#fbbf24', '#38bdf8', '#38bdf8', '#38bdf8', '#4ade80', '#4ade80', '#e5e7eb'].map((c, i) => (
                <span key={i} className="h-3 flex-1 rounded-[3px]" style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col rounded-xl bg-white p-2.5 shadow-sm">
            <span className="self-end text-emerald-500">↗</span>
            <span className="my-auto text-center text-[12px] font-extrabold">Backup Power</span>
          </div>
        </div>
        <div className="mt-2 rounded-xl bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold">Electricity Analysis</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px]">◔ ▤</span>
          </div>
          <div className="mt-2 text-slate-500">PV</div>
          <div className="mt-1 h-2 w-full rounded-full bg-blue-400" />
          <div className="mt-1 flex justify-between text-[8px] font-bold text-slate-700">
            <span>100% 32kWh</span>
            <span>0% 0kWh</span>
          </div>
          <div className="mt-2 text-slate-500">Family</div>
          <div className="mt-1 flex h-2 w-full gap-0.5">
            <div className="w-1/4 rounded-full bg-blue-400" />
            <div className="flex-1 rounded-full bg-emerald-400" />
          </div>
        </div>
        {/* the app's tab bar */}
        <div className="mx-1 mb-3 mt-auto flex justify-around rounded-2xl bg-white px-2 py-2 shadow-sm">
          {[
            ['▦', 'Home', true],
            ['⚙', 'Admin.', false],
            ['📣', 'Message', false],
            ['👤', 'My', false],
          ].map(([icon, label, on]) => (
            <span key={String(label)} className={`flex flex-col items-center gap-0.5 ${on ? 'text-slate-900' : 'text-slate-400'}`}>
              <span className="text-[11px]">{icon}</span>
              <span className="text-[8px] font-semibold">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </Phone>
  );
}

/* ------------------------------------------------------------------ */
/* SAJ: dark, a house from above, a slower current.                    */
function SajPhone() {
  return (
    <Phone dark>
      <div
        dir="ltr"
        className="flex h-full flex-col px-3 pt-9 text-[9px]"
        style={{ background: 'linear-gradient(180deg, #2f7a8c 0%, #1b3b5a 22%, #0b1220 48%)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/10">‹</span>
          <span className="flex flex-1 rounded-lg bg-white/10 p-0.5">
            <span className="flex-1 rounded-md bg-slate-900 py-1 text-center font-bold">Plant</span>
            <span className="flex-1 py-1 text-center text-slate-300">Device</span>
          </span>
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/10">+</span>
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/10">⚙</span>
        </div>
        <div className="mt-3 px-1">
          <div className="text-[11px]">Today <span className="font-extrabold">19.24</span> kWh</div>
          <div className="text-slate-400">Updated 4 minutes ago</div>
        </div>

        <svg viewBox="0 0 200 160" className="mt-1 w-full">
          <defs>
            <linearGradient id="sjRoofL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3f4652" />
              <stop offset="1" stopColor="#262c36" />
            </linearGradient>
            <linearGradient id="sjRoofR" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2a3039" />
              <stop offset="1" stopColor="#1a1f27" />
            </linearGradient>
            <linearGradient id="sjCell" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2c4f9e" />
              <stop offset="1" stopColor="#152a5c" />
            </linearGradient>
          </defs>
          {/* labels */}
          <g fontSize="7" fill="#94a3b8">
            <line x1="16" y1="4" x2="16" y2="70" stroke="#475569" strokeWidth="0.7" />
            <text x="20" y="12" fontSize="9" fontWeight="700" fill="#f8fafc">5.99 kW</text>
            <text x="20" y="21">Grid</text>
            <rect x="20" y="25" width="26" height="9" rx="2" fill="#0ea5e9" opacity="0.2" />
            <text x="23" y="32" fill="#7dd3fc">Import</text>
            <line x1="106" y1="4" x2="106" y2="50" stroke="#475569" strokeWidth="0.7" />
            <text x="110" y="12" fontSize="9" fontWeight="700" fill="#f8fafc">3.1 kW</text>
            <text x="110" y="21">12 kWp · PV</text>
            <line x1="176" y1="4" x2="176" y2="60" stroke="#475569" strokeWidth="0.7" />
            <text x="180" y="12" fontSize="9" fontWeight="700" fill="#f8fafc">0 W</text>
            <text x="180" y="21">Load ›</text>
          </g>
          {/* ground disc */}
          <ellipse cx="104" cy="128" rx="96" ry="18" fill="#3b4250" />
          <ellipse cx="104" cy="126" rx="96" ry="18" fill="#525b6b" />
          {/* pole */}
          <line x1="20" y1="70" x2="20" y2="122" stroke="#9aa3b2" strokeWidth="2" />
          <line x1="13" y1="76" x2="27" y2="76" stroke="#9aa3b2" strokeWidth="1.4" />
          <line x1="20" y1="80" x2="52" y2="96" stroke="#9aa3b2" strokeWidth="0.6" />
          {/* house: two walls, two roof slopes */}
          <polygon points="52,78 104,100 104,128 52,108" fill="#8a929d" />
          <polygon points="104,100 160,80 160,110 104,128" fill="#6f7782" />
          <polygon points="44,80 76,50 112,66 104,100 52,78" fill="url(#sjRoofL)" />
          <polygon points="104,100 112,66 148,50 168,78 160,80" fill="url(#sjRoofR)" />
          <polygon points="76,50 112,66 148,50 112,40" fill="#1f242c" />
          {/* panels on the right slope */}
          <g transform="translate(116 60) skewY(-22)">
            {[0, 1, 2, 3].map((c) =>
              [0, 1].map((r) => (
                <rect key={`${c}-${r}`} x={c * 8.5} y={r * 7} width="7.8" height="6.2" fill="url(#sjCell)" stroke="#334155" strokeWidth="0.4" />
              )),
            )}
          </g>
          {/* windows */}
          <polygon points="60,88 68,91 68,101 60,98" fill="#f5c65a" />
          <polygon points="78,95 86,98 86,108 78,105" fill="#f5c65a" />
          <polygon points="128,96 136,93 136,103 128,106" fill="#f5c65a" />
          {/* inverter + battery on the lit wall */}
          <polygon points="90,98 100,102 100,112 90,108" fill="#e5e7eb" />
          <polygon points="91,100 99,103 99,105 91,102" fill="#94a3b8" />
          <polygon points="88,112 100,117 100,132 88,127" fill="#86efac" />
          <polygon points="88,112 100,117 100,119 88,114" fill="#4ade80" />
          <text x="89" y="125" fontSize="5" fontWeight="700" fill="#14532d">90%</text>
          {/* flow: pv → inverter, battery ↔ inverter, inverter → load */}
          <path d="M118,74 L106,74 L106,98" fill="none" stroke="#1e3a5f" strokeWidth="1.6" />
          <path d="M94,112 L94,108" fill="none" stroke="#1e3a5f" strokeWidth="1.6" />
          <path d="M100,106 L128,106" fill="none" stroke="#1e3a5f" strokeWidth="1.6" />
          <path className="sj-flow" d="M118,74 L106,74 L106,98" fill="none" stroke="#4ade80" strokeWidth="1.6" strokeLinecap="round" />
          <path className="sj-flow" d="M94,112 L94,108" fill="none" stroke="#4ade80" strokeWidth="1.6" strokeLinecap="round" />
          <path className="sj-flow" d="M100,106 L128,106" fill="none" stroke="#4ade80" strokeWidth="1.6" strokeLinecap="round" />
          {/* battery label */}
          <g fontSize="7" fill="#94a3b8">
            <line x1="94" y1="134" x2="94" y2="158" stroke="#475569" strokeWidth="0.7" />
            <rect x="97" y="136" width="28" height="9" rx="2" fill="#0ea5e9" opacity="0.2" />
            <text x="100" y="143" fill="#7dd3fc">Charge</text>
            <text x="97" y="154" fontSize="9" fontWeight="700" fill="#f8fafc">5.99 kW</text>
          </g>
        </svg>

        <div className="mt-1 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10">
          <div className="text-[10px] font-extrabold">Electricity Statistics</div>
          <div className="mt-1.5 flex rounded-full bg-white/5 p-0.5 text-[8px]">
            <span className="flex-1 rounded-full bg-white/10 py-0.5 text-center font-bold ring-1 ring-cyan-400/60">Day</span>
            {['Week', 'Month', 'Year', 'Total'].map((x) => (
              <span key={x} className="flex-1 py-0.5 text-center text-slate-400">{x}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {[
              ['PV Generation', '19.24'],
              ['Load', '7.99'],
              ['Import', '5.53'],
              ['Export', '0.0'],
              ['Charge Battery', '18.81'],
              ['Battery Discharge', '2.03'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/5 px-2 py-1.5">
                <div className="text-[8px] text-slate-300">{k}</div>
                <div className="text-[12px] font-extrabold">{v} <span className="text-[7px] font-bold text-slate-400">kWh</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
          <span className="text-[10px] font-extrabold">Revenue <span className="font-normal text-slate-400">ⓘ</span></span>
          <span className="rounded-full bg-white/10 px-2 py-1 text-[8px] text-slate-300">✎ Set Up Tariff</span>
        </div>
      </div>
    </Phone>
  );
}
