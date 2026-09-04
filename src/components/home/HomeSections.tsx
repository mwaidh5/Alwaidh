import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../../lib/i18n';
import { openChat } from '../../lib/chatPanel';
import { SHOP_LOCATION } from '../../lib/shopLocation';
import {
  subscribeInstallmentRows,
  SEED_INSTALLMENT_ROWS,
  planMonthly,
  type InstallmentRow,
} from '../../lib/solarInstallmentsStore';

/**
 * Three homepage sections lifted from the "three doors" draft and set in
 * the site's own light colours: a solar system sized with a slider, the
 * camera pitch, and a plain way to reach a person.
 */

const PHONE = '0774 420 5582';
const PHONE_TEL = '+9647744205582';

const AR: Record<string, string> = {
  'Solar energy': 'طاقة شمسية',
  'Security cameras': 'كاميرات مراقبة',
  'Size your solar system': 'اختر حجم منظومتك',
  'Slide to the amps your house runs on. The price is the real one.': 'اسحب على الأمبير اللي يشتغل بيه بيتك. السعر هو السعر الحقيقي.',
  'Amp': 'أمبير',
  'Panels': 'الألواح',
  'Battery': 'البطارية',
  'Backup': 'التغذية',
  'hours': 'ساعة',
  'h': 'س',
  'Cash': 'نقداً',
  'or monthly over 7 years': 'أو شهرياً على 7 سنوات',
  'IQD': 'دينار',
  'All systems and plans': 'كل المنظومات والخطط',
  'Ask about this one': 'اسأل عن هذي',
  'Hi! I am interested in the {amps} A installment system — could you give me the details?': 'مرحباً! مهتم بمنظومة {amps} أمبير بالتقسيط — ممكن التفاصيل؟',
  'Watch your shop from your phone': 'راقب محلك من موبايلك',
  'Cameras that see colour at night, a recorder that keeps two weeks, and a setup that only you can open.': 'كاميرات تشوف بالألوان بالليل، مسجل يحفظ أسبوعين، وإعداد ما يفتحه غيرك.',
  'Authorised Tiandy reseller': 'وكيل معتمد لـ Tiandy',
  'Planned from your floor plan, cabled and fitted by our crew': 'نخطط من مخطط المكان، ونمد الكيبلات ونركب بفريقنا',
  'Remote setup and callouts after the installation': 'إعداد عن بعد وزيارات بعد التركيب',
  'Shop cameras': 'تصفح الكاميرات',
  'Read the camera guides': 'اقرأ أدلة الكاميرات',
  'Talk to a person': 'احچي مع شخص',
  'A real colleague answers on the chat, or call the shop.': 'زميل حقيقي يرد على الدردشة، أو اتصل بالمعرض.',
  'Open the chat': 'افتح الدردشة',
  'Directions': 'الموقع',
  'Baghdad, Sinaa Street — opposite the University of Technology': 'بغداد، شارع الصناعة — مقابل الجامعة التكنولوجية',
  'Free site survey': 'كشف مجاني',
  'Nothing upfront on bank plans': 'بدون دفعة أولى بخطط المصرف',
  'Delivery across Iraq': 'توصيل لكل العراق',
};

function useT() {
  const { t: tt, lang } = useLang();
  return (s: string) => (lang === 'ar' ? (AR[s] ?? tt(s)) : s);
}

const money = (n: number) => n.toLocaleString('en-US');

/**
 * The solar dial: a vertical slider, lit in blue from the bottom up to
 * the chosen system, with the amps down one side and the backup hours
 * down the other. The readout beside it is the same live installment
 * table the prices page uses.
 */
export function SolarDial() {
  const t = useT();
  const [rows, setRows] = useState<InstallmentRow[]>(SEED_INSTALLMENT_ROWS);
  useEffect(() => subscribeInstallmentRows((list) => list.length && setRows(list)), []);
  const sized = useMemo(
    () =>
      rows
        .filter((r) => Number(r.sizeAmp) > 0 && r.cash > 0)
        .sort((a, b) => Number(a.sizeAmp) - Number(b.sizeAmp)),
    [rows],
  );
  const [pick, setPick] = useState(1);
  const trackRef = useRef<HTMLDivElement>(null);
  const n = sized.length;
  const idx = Math.min(pick, Math.max(0, n - 1));
  const sys = sized[idx];
  if (!sys) return null;

  // Where along the track (0 = bottom, 1 = top) each system sits.
  const at = (i: number) => (n > 1 ? i / (n - 1) : 0);
  const fromPointer = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    setPick(Math.round(frac * (n - 1)));
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-6">
      <div className="grid grid-cols-[auto_1fr] gap-6 sm:gap-8">
        {/* the dial */}
        <div dir="ltr" className="flex select-none items-stretch gap-3 pt-6">
          <div className="relative w-8 text-end text-[13px] font-bold text-slate-400">
            <div className="absolute inset-x-0 -top-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {t('Amp')}
            </div>
            {sized.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setPick(i)}
                className="absolute inset-x-0 -translate-y-1/2 text-end transition"
                style={{ top: `${(1 - at(i)) * 100}%`, color: i === idx ? '#1d4ed8' : undefined }}
              >
                {r.sizeAmp}
              </button>
            ))}
          </div>
          <div
            ref={trackRef}
            role="presentation"
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              fromPointer(e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons) fromPointer(e.clientY);
            }}
            className="relative h-64 w-4 cursor-pointer touch-none rounded-full bg-slate-900 sm:h-72"
          >
            {/* lit from the bottom up to the thumb */}
            <div
              className="absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-300 ease-out"
              style={{
                height: `${at(idx) * 100}%`,
                background: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 55%, #93c5fd 100%)',
                boxShadow: '0 0 22px 4px rgba(59,130,246,.55)',
              }}
            />
            {sized.map((r, i) => (
              <span
                key={r.id}
                className="absolute left-1/2 h-0.5 w-1.5 -translate-x-1/2 rounded-full bg-white/40"
                style={{ top: `${(1 - at(i)) * 100}%` }}
              />
            ))}
            {/* the thumb */}
            <div
              className="pointer-events-none absolute left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow-lg shadow-slate-900/25 ring-1 ring-slate-200 transition-[top] duration-300 ease-out"
              style={{ top: `${(1 - at(idx)) * 100}%` }}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10.5l4 4 8-9" />
              </svg>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, n - 1)}
              step={1}
              value={idx}
              onChange={(e) => setPick(Number(e.target.value))}
              aria-label={t('Amp')}
              className="sr-only"
            />
          </div>
          <div className="relative w-10 text-[12px] font-semibold text-slate-400">
            <div className="absolute inset-x-0 -top-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {t('Backup')}
            </div>
            {sized.map((r, i) => (
              <span
                key={r.id}
                className="absolute inset-x-0 -translate-y-1/2"
                style={{ top: `${(1 - at(i)) * 100}%`, color: i === idx ? '#0f172a' : undefined }}
              >
                {r.backupHours} {t('h')}
              </span>
            ))}
          </div>
        </div>

        {/* the readout */}
        <div className="flex min-w-0 flex-col">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">{t('Size your solar system')}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span dir="ltr" className="text-5xl font-black leading-none tracking-tight text-slate-900 sm:text-6xl">
              {sys.sizeAmp}
            </span>
            <span className="text-lg font-bold text-slate-500">{t('Amp')}</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[
              [t('Panels'), `${sys.panelsCount} × 650W`],
              [t('Battery'), `${sys.batteryKwh} KWh`],
              [t('Backup'), `${sys.backupHours} ${t('hours')}`],
              [t('Cash'), `${money(sys.cash)} ${t('IQD')}`],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11px] text-slate-400">{k}</dt>
                <dd dir="ltr" className="truncate text-base font-extrabold text-slate-900">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-auto border-t border-slate-100 pt-4">
            <div className="text-[11px] text-slate-400">{t('or monthly over 7 years')}</div>
            <div dir="ltr" className="text-3xl font-black leading-none tracking-tight text-brand-600 sm:text-4xl">
              {money(planMonthly(sys.cash, 7))}
              <span className="ms-1.5 text-sm font-semibold text-slate-400">{t('IQD')}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                openChat(
                  t('Hi! I am interested in the {amps} A installment system — could you give me the details?').replace('{amps}', sys.sizeAmp),
                )
              }
              className="mt-3 text-sm font-bold text-brand-700 hover:underline"
            >
              {t('Ask about this one')} →
            </button>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">{t('Slide to the amps your house runs on. The price is the real one.')}</p>
    </div>
  );
}

/** The camera pitch beside the Tiandy picture. */
export function CamerasPitch({ image }: { image: string }) {
  const t = useT();
  return (
    <section className="mt-14 border-y border-slate-200 bg-slate-50">
      <div className="container-page grid gap-8 py-14 lg:grid-cols-2 lg:items-center">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <img src={image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-tiandy-700">{t('Security cameras')}</p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            {t('Watch your shop from your phone')}
          </h2>
          <p className="mt-3 text-slate-600">
            {t('Cameras that see colour at night, a recorder that keeps two weeks, and a setup that only you can open.')}
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            {[
              t('Authorised Tiandy reseller'),
              t('Planned from your floor plan, cabled and fitted by our crew'),
              t('Remote setup and callouts after the installation'),
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-tiandy-600 text-[11px] font-black text-white">✓</span>
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link to="/shop?category=tiandy-cameras" className="rounded-full bg-tiandy-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-tiandy-700">
              {t('Shop cameras')}
            </Link>
            <Link to="/blog" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-100">
              {t('Read the camera guides')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Chat, phone, directions: the way to a person. */
export function TalkToUs() {
  const t = useT();
  return (
    <section className="container-page pb-14">
      <div className="grid gap-8 rounded-3xl bg-brand-600 p-7 text-white sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{t('Talk to a person')}</h2>
          <p className="mt-2 text-brand-100">{t('A real colleague answers on the chat, or call the shop.')}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openChat()}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50"
            >
              💬 {t('Open the chat')}
            </button>
            <a href={`tel:${PHONE_TEL}`} dir="ltr" className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">
              📞 {PHONE}
            </a>
            <a
              href={SHOP_LOCATION.maps}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10"
            >
              📍 {t('Directions')}
            </a>
          </div>
        </div>
        <div className="text-sm leading-relaxed text-brand-100">
          <p className="font-bold text-white">{t('Baghdad, Sinaa Street — opposite the University of Technology')}</p>
          <p className="mt-1">
            {t('Nothing upfront on bank plans')} · {t('Free site survey')} · {t('Delivery across Iraq')}
          </p>
        </div>
      </div>
    </section>
  );
}
