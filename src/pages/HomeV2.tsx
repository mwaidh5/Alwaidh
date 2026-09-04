import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../lib/useProducts';
import { useSettingsStatus } from '../lib/useSettings';
import { useLang } from '../lib/i18n';
import { openChat } from '../lib/chatPanel';
import { pName } from '../lib/localizeProduct';
import { formatPrice } from '../lib/format';
import { allBrands } from '../data/brands';
import { SHOP_LOCATION } from '../lib/shopLocation';
import {
  subscribeInstallmentRows,
  SEED_INSTALLMENT_ROWS,
  planMonthly,
  type InstallmentRow,
} from '../lib/solarInstallmentsStore';
import { useSeo, organizationJsonLd } from '../lib/seo';

/**
 * The homepage as three doors.
 *
 * A first-time visitor knows which of the three they came for, so the
 * page opens on exactly that choice — three tall panels, each one a
 * world of its own — and only then tells the rest: the numbers behind
 * the shop, a solar system you size with your thumb, what is new on the
 * shelf, the camera pitch, and the way to reach a person.
 */

const PHONE = '0774 420 5582';
const PHONE_TEL = '+9647744205582';

const STOCK = {
  computers: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1400&q=80',
  solar: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1400&q=80',
  cameras: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=1400&q=80',
};

/* Arabic for this page only, so the preview stays self-contained. */
const AR: Record<string, string> = {
  'Computers': 'حاسبات',
  'Solar energy': 'طاقة شمسية',
  'Security cameras': 'كاميرات مراقبة',
  'Machines that hold up at work': 'أجهزة تتحمل الشغل',
  'Power that stays on': 'كهرباء ما تنقطع',
  'Eyes on the whole site': 'عيون على المكان كله',
  'Laptops, desktops and POS — Lenovo distributor since 2010, repaired in our own lab.': 'لابتوبات وحاسبات وأنظمة نقاط بيع — وكيل Lenovo منذ 2010، وصيانة بمختبرنا.',
  'Complete systems with published prices, cash or bank installments up to 7 years.': 'منظومات كاملة بأسعار معلنة، نقداً أو بأقساط المصرف حتى 7 سنوات.',
  'Tiandy IP cameras and recorders, planned from your floor plan and fitted by our crew.': 'كاميرات Tiandy ومسجلات، نخطط من مخطط محلك ويركبها فريقنا.',
  'Shop computers': 'تصفح الحاسبات',
  'See solar prices': 'أسعار الطاقة الشمسية',
  'Shop cameras': 'تصفح الكاميرات',
  'Everything for power, computers and cameras — from one place in Baghdad.': 'كل شي يخص الكهرباء والحاسبات والكاميرات — من مكان واحد ببغداد.',
  'Three things, done properly, since 1992.': 'ثلاث اختصاصات، نشتغلها صح، منذ 1992.',
  'Since': 'منذ',
  'showrooms in Baghdad': 'معارض في بغداد',
  'warehouse': 'مخزن',
  'year warranty on solar': 'سنوات ضمان على الطاقة الشمسية',
  'provinces delivered': 'محافظة نوصل لها',
  'on Google': 'على Google',
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
  'New on the shelf': 'جديد على الرف',
  'Straight from the warehouse in Sufaraniya.': 'مباشرة من مخزننا في الصفرانية.',
  'Browse the shop': 'تصفح المتجر',
  'Watch your shop from your phone': 'راقب محلك من موبايلك',
  'Cameras that see colour at night, a recorder that keeps two weeks, and a setup that only you can open.': 'كاميرات تشوف بالألوان بالليل، مسجل يحفظ أسبوعين، وإعداد ما يفتحه غيرك.',
  'Authorised Tiandy reseller': 'وكيل معتمد لـ Tiandy',
  'Planned from your floor plan, cabled and fitted by our crew': 'نخطط من مخطط المكان، ونمد الكيبلات ونركب بفريقنا',
  'Remote setup and callouts after the installation': 'إعداد عن بعد وزيارات بعد التركيب',
  'Read the camera guides': 'اقرأ أدلة الكاميرات',
  'Brands we carry': 'العلامات اللي نبيعها',
  'Talk to a person': 'احچي مع شخص',
  'A real colleague answers on the chat, or call the shop.': 'زميل حقيقي يرد على الدردشة، أو اتصل بالمعرض.',
  'Open the chat': 'افتح الدردشة',
  'Call': 'اتصل',
  'Directions': 'الموقع',
  'Baghdad, Sinaa Street — opposite the University of Technology': 'بغداد، شارع الصناعة — مقابل الجامعة التكنولوجية',
  'Hi! I am interested in the {amps} A installment system — could you give me the details?': 'مرحباً! مهتم بمنظومة {amps} أمبير بالتقسيط — ممكن التفاصيل؟',
  'Free site survey': 'كشف مجاني',
  'Nothing upfront on bank plans': 'بدون دفعة أولى بخطط المصرف',
  'Delivery across Iraq': 'توصيل لكل العراق',
};

export default function HomeV2() {
  const { t: tt, lang } = useLang();
  const t = (s: string) => (lang === 'ar' ? (AR[s] ?? tt(s)) : s);
  const { products } = useProducts();
  const { settings } = useSettingsStatus();

  useSeo({
    title:
      lang === 'ar'
        ? 'الواعظ للقدرة — منظومات الطاقة الشمسية والحاسبات في العراق | Alwaidh'
        : 'Alwaidh — Solar Energy Systems, Computers & Tiandy Cameras in Iraq',
    description:
      lang === 'ar'
        ? 'شركة الواعظ في بغداد: منظومات طاقة شمسية كاملة بأسعار معلنة، حاسبات ولابتوبات، وكاميرات مراقبة Tiandy — تجهيز وتركيب وصيانة في عموم العراق منذ 1992.'
        : 'Alwaidh, Baghdad: complete solar energy systems with published prices, computers and laptops, and Tiandy security cameras — supplied, installed and serviced across Iraq since 1992.',
    path: '/',
    jsonLd: organizationJsonLd(),
  });

  const photo = {
    computers: settings.aboutImages?.computers || settings.heroSlides?.[0]?.image || settings.heroImage || STOCK.computers,
    solar: settings.aboutImages?.solar || settings.solarBannerImage || settings.heroSlides?.[1]?.image || STOCK.solar,
    cameras: settings.aboutImages?.cameras || STOCK.cameras,
  };

  const DOORS = [
    {
      key: 'computers',
      accent: '#3b82f6',
      eyebrow: 'Computers',
      title: 'Machines that hold up at work',
      blurb: 'Laptops, desktops and POS — Lenovo distributor since 2010, repaired in our own lab.',
      cta: 'Shop computers',
      to: '/shop?category=computers',
      image: photo.computers,
    },
    {
      key: 'solar',
      accent: '#f59e0b',
      eyebrow: 'Solar energy',
      title: 'Power that stays on',
      blurb: 'Complete systems with published prices, cash or bank installments up to 7 years.',
      cta: 'See solar prices',
      to: '/solar-prices',
      image: photo.solar,
    },
    {
      key: 'cameras',
      accent: '#3cc63c',
      eyebrow: 'Security cameras',
      title: 'Eyes on the whole site',
      blurb: 'Tiandy IP cameras and recorders, planned from your floor plan and fitted by our crew.',
      cta: 'Shop cameras',
      to: '/shop?category=tiandy-cameras',
      image: photo.cameras,
    },
  ];
  const [hot, setHot] = useState<number | null>(null);

  // ---- the solar sizer ----
  const [rows, setRows] = useState<InstallmentRow[]>(SEED_INSTALLMENT_ROWS);
  useEffect(() => subscribeInstallmentRows((list) => list.length && setRows(list)), []);
  const sized = useMemo(
    () => rows.filter((r) => Number(r.sizeAmp) > 0 && r.cash > 0).sort((a, b) => Number(a.sizeAmp) - Number(b.sizeAmp)),
    [rows],
  );
  const [pick, setPick] = useState(1);
  const sys = sized[Math.min(pick, Math.max(0, sized.length - 1))];
  const money = (n: number) => n.toLocaleString('en-US');

  const newest = useMemo(
    () =>
      products
        .filter((p) => p.inStock && p.image)
        .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
        .slice(0, 8),
    [products],
  );

  const brandList = (settings.brands ?? []).length
    ? settings.brands
    : allBrands.map((b) => ({ name: b.name, image: settings.brandLogos?.[b.slug] ?? '' }));

  return (
    <div className="bg-slate-950 text-white">
      {/* ---- the statement ---- */}
      <section className="container-page pb-6 pt-10 sm:pt-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
          شركة تقنية الواعظ · Alwaidh · Baghdad
        </p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          {t('Everything for power, computers and cameras — from one place in Baghdad.')}
        </h1>
        <p className="mt-4 text-lg text-slate-300">{t('Three things, done properly, since 1992.')}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ['⭐', `5.0 ${t('on Google')}`],
            ['🛡️', `5 ${t('year warranty on solar')}`],
            ['🚚', t('Delivery across Iraq')],
            ['📋', t('Free site survey')],
          ].map(([icon, label]) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[13px] font-semibold text-slate-200"
            >
              <span aria-hidden>{icon}</span>
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ---- three doors ---- */}
      <section className="px-3 sm:px-6" onMouseLeave={() => setHot(null)}>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 lg:h-[72vh] lg:min-h-[520px] lg:flex-row">
          {DOORS.map((d, i) => {
            const open = hot === i;
            const dim = hot !== null && !open;
            return (
              <Link
                key={d.key}
                to={d.to}
                onMouseEnter={() => setHot(i)}
                onFocus={() => setHot(i)}
                className="group relative block h-[46vw] min-h-[230px] overflow-hidden rounded-3xl bg-slate-900 lg:h-auto"
                style={{
                  flex: open ? '2.1 1 0%' : '1 1 0%',
                  transition: 'flex 600ms cubic-bezier(.32,.72,0,1)',
                }}
              >
                <img
                  src={d.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-700"
                  style={{
                    transform: open ? 'scale(1.06)' : 'scale(1)',
                    filter: dim ? 'saturate(.4) brightness(.55)' : 'none',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(180deg, rgba(2,6,23,.15) 0%, rgba(2,6,23,.25) 45%, rgba(2,6,23,.92) 100%)' }}
                />
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: d.accent }} />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: d.accent }}>
                    {`0${i + 1}`} — {t(d.eyebrow)}
                  </div>
                  <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl lg:text-[2rem]">{t(d.title)}</h2>
                  <p
                    className="mt-2 max-w-md text-sm leading-relaxed text-slate-200 lg:max-h-0 lg:overflow-hidden lg:opacity-0 lg:transition-all lg:duration-500 lg:group-hover:max-h-24 lg:group-hover:opacity-100"
                  >
                    {t(d.blurb)}
                  </p>
                  <span
                    className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-slate-950"
                    style={{ background: d.accent }}
                  >
                    {t(d.cta)} <span aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- the numbers ---- */}
      <section className="container-page mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-y border-white/10 py-10 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ['1992', t('Since')],
          ['3', t('showrooms in Baghdad')],
          ['600 m²', t('warehouse')],
          ['5', t('year warranty on solar')],
          ['18', t('provinces delivered')],
        ].map(([n, label]) => (
          <div key={label}>
            <div dir="ltr" className="text-4xl font-black tracking-tight sm:text-5xl">
              {n}
            </div>
            <div className="mt-1 text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </section>

      {/* ---- size your solar ---- */}
      {sys && (
        <section className="container-page py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400">{t('Solar energy')}</p>
              <h2 className="mt-2 text-3xl font-black leading-tight sm:text-5xl">{t('Size your solar system')}</h2>
              <p className="mt-3 text-slate-300">{t('Slide to the amps your house runs on. The price is the real one.')}</p>
              <div className="mt-8">
                <div dir="ltr" className="flex items-end justify-between">
                  {sized.map((r, i) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setPick(i)}
                      className="flex flex-col items-center gap-2 text-xs font-bold text-slate-500 transition"
                      style={{ color: i === pick ? '#fbbf24' : undefined }}
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
                  className="mt-2 w-full accent-amber-400"
                  aria-label={t('Amp')}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-transparent p-6 sm:p-8">
              <div className="flex items-baseline gap-2">
                <span dir="ltr" className="text-6xl font-black tracking-tight text-amber-300 sm:text-7xl">
                  {sys.sizeAmp}
                </span>
                <span className="text-xl font-bold text-amber-200/80">{t('Amp')}</span>
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-white/10 pt-5 text-sm">
                <div>
                  <dt className="text-slate-400">{t('Panels')}</dt>
                  <dd dir="ltr" className="mt-1 text-lg font-extrabold">
                    {sys.panelsCount} × 650W
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t('Battery')}</dt>
                  <dd dir="ltr" className="mt-1 text-lg font-extrabold">
                    {sys.batteryKwh} KWh
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t('Backup')}</dt>
                  <dd dir="ltr" className="mt-1 text-lg font-extrabold">
                    {sys.backupHours} {t('hours')}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-5">
                <div>
                  <div className="text-xs text-slate-400">{t('Cash')}</div>
                  <div dir="ltr" className="text-3xl font-black tracking-tight">
                    {money(sys.cash)} <span className="text-sm font-semibold text-slate-400">{t('IQD')}</span>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-xs text-slate-400">{t('or monthly over 7 years')}</div>
                  <div dir="ltr" className="text-3xl font-black tracking-tight text-amber-300">
                    {money(planMonthly(sys.cash, 7))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to="/solar-prices" className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300">
                  {t('All systems and plans')}
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    openChat(
                      t('Hi! I am interested in the {amps} A installment system — could you give me the details?').replace(
                        '{amps}',
                        sys.sizeAmp,
                      ),
                    )
                  }
                  className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10"
                >
                  {t('Ask about this one')}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---- new on the shelf ---- */}
      {newest.length > 0 && (
        <section className="bg-white py-14 text-slate-900">
          <div className="container-page mb-6 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-600">{t('Computers')}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{t('New on the shelf')}</h2>
              <p className="mt-2 text-slate-500">{t('Straight from the warehouse in Sufaraniya.')}</p>
            </div>
            <Link to="/shop" className="hidden shrink-0 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold hover:bg-slate-50 sm:inline-flex">
              {t('Browse the shop')} →
            </Link>
          </div>
          <div className="scrollbar-none flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:px-6 xl:container-page">
            {newest.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="group w-64 flex-none snap-start overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10"
              >
                <div className="aspect-square overflow-hidden bg-slate-50">
                  <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <div className="p-4">
                  <div className="line-clamp-2 min-h-[2.6rem] text-sm font-semibold leading-snug">{pName(p, lang)}</div>
                  <div className="mt-2 text-lg font-black">{formatPrice(p.price, p.currency)}</div>
                </div>
              </Link>
            ))}
          </div>
          <div className="container-page mt-4 sm:hidden">
            <Link to="/shop" className="inline-flex rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold">
              {t('Browse the shop')} →
            </Link>
          </div>
        </section>
      )}

      {/* ---- cameras ---- */}
      <section className="container-page grid gap-8 py-16 lg:grid-cols-2 lg:items-center">
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <img src={photo.cameras} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#3cc63c]">{t('Security cameras')}</p>
          <h2 className="mt-2 text-3xl font-black leading-tight sm:text-5xl">{t('Watch your shop from your phone')}</h2>
          <p className="mt-3 text-slate-300">
            {t('Cameras that see colour at night, a recorder that keeps two weeks, and a setup that only you can open.')}
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-200">
            {[
              t('Authorised Tiandy reseller'),
              t('Planned from your floor plan, cabled and fitted by our crew'),
              t('Remote setup and callouts after the installation'),
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-[#2ea830] text-[11px] font-black text-white">✓</span>
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link to="/shop?category=tiandy-cameras" className="rounded-full bg-[#2ea830] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#248527]">
              {t('Shop cameras')}
            </Link>
            <Link to="/blog" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold hover:bg-white/10">
              {t('Read the camera guides')}
            </Link>
          </div>
        </div>
      </section>

      {/* ---- brands ---- */}
      {brandList.some((b) => b.image) && (
        <section className="border-y border-white/10 py-8">
          <div className="container-page">
            <p className="mb-5 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('Brands we carry')}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
              {brandList
                .filter((b) => b.image)
                .map((b) => (
                  <img
                    key={b.name}
                    src={b.image}
                    alt={b.name}
                    loading="lazy"
                    className="h-8 w-auto object-contain opacity-70 brightness-0 invert transition hover:opacity-100"
                  />
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- a person ---- */}
      <section className="container-page py-16">
        <div className="grid gap-8 rounded-3xl bg-white p-7 text-slate-900 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{t('Talk to a person')}</h2>
            <p className="mt-2 text-slate-600">{t('A real colleague answers on the chat, or call the shop.')}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openChat()}
                className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                💬 {t('Open the chat')}
              </button>
              <a href={`tel:${PHONE_TEL}`} dir="ltr" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold hover:bg-slate-50">
                📞 {PHONE}
              </a>
              <a
                href={SHOP_LOCATION.maps}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold hover:bg-slate-50"
              >
                📍 {t('Directions')}
              </a>
            </div>
          </div>
          <div className="text-sm leading-relaxed text-slate-600">
            <p className="font-bold text-slate-900">{t('Baghdad, Sinaa Street — opposite the University of Technology')}</p>
            <p className="mt-1">
              {t('Nothing upfront on bank plans')} · {t('Free site survey')} · {t('Delivery across Iraq')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
