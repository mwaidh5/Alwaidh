import { useEffect, useMemo, useState } from 'react';
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

/** Pick the amps; the panels, battery, hours and both prices follow. */
export function SolarSizer() {
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
  const sys = sized[Math.min(pick, Math.max(0, sized.length - 1))];
  if (!sys) return null;

  return (
    <section className="container-page pt-14">
      <div className="grid gap-8 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">{t('Solar energy')}</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t('Size your solar system')}</h2>
          <p className="mt-3 text-slate-600">{t('Slide to the amps your house runs on. The price is the real one.')}</p>
          <div className="mt-8">
            <div dir="ltr" className="flex items-end justify-between">
              {sized.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPick(i)}
                  className="flex flex-col items-center gap-2 text-xs font-bold transition"
                  style={{ color: i === pick ? '#d97706' : '#94a3b8' }}
                >
                  <span className="h-3 w-0.5 rounded-full bg-current" />
                  {r.sizeAmp}
                </button>
              ))}
            </div>
            <input
              dir="ltr"
              type="range"
              min={0}
              max={Math.max(0, sized.length - 1)}
              step={1}
              value={Math.min(pick, sized.length - 1)}
              onChange={(e) => setPick(Number(e.target.value))}
              className="mt-2 w-full accent-amber-500"
              aria-label={t('Amp')}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-amber-900/5 sm:p-8">
          <div className="flex items-baseline gap-2">
            <span dir="ltr" className="text-6xl font-black tracking-tight text-slate-900 sm:text-7xl">
              {sys.sizeAmp}
            </span>
            <span className="text-xl font-bold text-slate-500">{t('Amp')}</span>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-slate-100 pt-5 text-sm">
            {[
              [t('Panels'), `${sys.panelsCount} × 650W`],
              [t('Battery'), `${sys.batteryKwh} KWh`],
              [t('Backup'), `${sys.backupHours} ${t('hours')}`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-400">{k}</dt>
                <dd dir="ltr" className="mt-1 text-lg font-extrabold text-slate-900">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-5">
            <div>
              <div className="text-xs text-slate-400">{t('Cash')}</div>
              <div dir="ltr" className="text-3xl font-black tracking-tight text-slate-900">
                {money(sys.cash)} <span className="text-sm font-semibold text-slate-400">{t('IQD')}</span>
              </div>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-400">{t('or monthly over 7 years')}</div>
              <div dir="ltr" className="text-3xl font-black tracking-tight text-amber-600">
                {money(planMonthly(sys.cash, 7))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/solar-prices" className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-amber-950 hover:bg-amber-400">
              {t('All systems and plans')}
            </Link>
            <button
              type="button"
              onClick={() =>
                openChat(
                  t('Hi! I am interested in the {amps} A installment system — could you give me the details?').replace('{amps}', sys.sizeAmp),
                )
              }
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-50"
            >
              {t('Ask about this one')}
            </button>
          </div>
        </div>
      </div>
    </section>
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
