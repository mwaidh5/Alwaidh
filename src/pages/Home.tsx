import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { categories } from '../data/categories';
import { allBrands } from '../data/brands';
import { useProducts } from '../lib/useProducts';
import { useSettingsStatus } from '../lib/useSettings';
import { hasSettingsCache } from '../lib/settingsStore';
import { useLang } from '../lib/i18n';
import { openChat } from '../lib/chatPanel';
import { pName } from '../lib/localizeProduct';
import { formatPrice } from '../lib/format';
import type { CategorySlug, Product } from '../types/product';
import type { PromoTile } from '../lib/settingsStore';
import { useSeo, organizationJsonLd } from '../lib/seo';

const FALLBACK = {
  computers:
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1100&q=80',
  solar:
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1400&q=80',
  cameras:
    'https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?auto=format&fit=crop&w=1200&q=80',
};

/** A chosen accent, tinted the way the built-in ones are. */
function customTheme(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // The chip is the same colour at low opacity; the text a lighter cast
  // of it, so it stays readable on the photo's dark side.
  const lift = (v: number) => Math.round(v + (255 - v) * 0.45);
  return {
    accent: hex,
    chipBg: `rgba(${r},${g},${b},.2)`,
    chipText: `rgb(${lift(r)},${lift(g)},${lift(b)})`,
    chipRing: `rgba(${lift(r)},${lift(g)},${lift(b)},.45)`,
  };
}

/** The hero's per-slide accent tints, matched to where the slide links. */
function slideTheme(link: string) {
  if (/solar/.test(link))
    return { accent: '#fbbf24', chipBg: 'rgba(251,191,36,.18)', chipText: '#fcd34d', chipRing: 'rgba(252,211,77,.45)' };
  if (/tiandy|camera/.test(link))
    return { accent: '#4fd852', chipBg: 'rgba(46,168,48,.2)', chipText: '#7ee87e', chipRing: 'rgba(126,232,126,.45)' };
  return { accent: '#60a5fa', chipBg: 'rgba(59,130,246,.2)', chipText: '#93c5fd', chipRing: 'rgba(147,197,253,.45)' };
}

/** The small print and accent on each promo card, matched to where it links. */
interface TileFlavour {
  eyebrow: string;
  blurb: string;
  color: string; // eyebrow text
  chipBg: string; // the little arrow circle
  chipText: string;
}
function tileFlavour(link: string): TileFlavour {
  if (/solar/.test(link))
    return { eyebrow: 'Free site survey', blurb: 'Panels, inverters and batteries for clean, reliable power — sized, installed and serviced by us.', color: '#b45309', chipBg: '#fbbf24', chipText: '#0f172a' };
  if (/tiandy|camera/.test(link))
    return { eyebrow: 'Authorised reseller', blurb: 'Professional IP and analog cameras and NVRs.', color: '#248527', chipBg: '#2ea830', chipText: '#ffffff' };
  if (/computer/.test(link))
    return { eyebrow: 'Since 1992', blurb: 'Laptops, desktops and workstations for work and play.', color: '#1d4ed8', chipBg: '#2563eb', chipText: '#ffffff' };
  return { eyebrow: 'Alwaidh', blurb: '', color: '#334155', chipBg: '#0f172a', chipText: '#ffffff' };
}

/** The canvas design's use cases: a situation each, not a category. */
const USE_CASES = [
  { eyebrow: 'Home office', title: 'Setting up to work', blurb: 'A laptop, monitor and the cables that fit it.', cta: 'See bundles', to: '/shop?category=computers' },
  { eyebrow: 'Power cuts', title: 'Keeping the lights on', blurb: 'Tell us what must stay running and we size it.', cta: 'Size my system', to: '/solar-prices' },
  { eyebrow: 'Security', title: 'Watching the shop', blurb: 'Cameras, recorder and cabling from your plan.', cta: 'Plan a system', to: '/shop?category=tiandy-cameras' },
  { eyebrow: 'Business', title: 'Buying wholesale', blurb: 'Quantity pricing to every Iraqi province.', cta: 'Request pricing', to: '/about' },
];

/** The shop on Google Maps — where the 5.0 comes from. */
const GOOGLE_REVIEWS =
  'https://www.google.com/maps/search/?api=1&query=33.3114556%2C44.443511&query_place_id=ChIJS-oOsqeBVxURnLpKX56_pCU';

export default function Home() {
  const { t, lang } = useLang();
  const { products, loading: productsLoading } = useProducts();
  const { settings, loaded: settingsLoaded } = useSettingsStatus();
  // Real content is ready when the server answered — or when this device
  // has a cached copy of it, which is what cachedSettings() painted.
  const settingsReady = settingsLoaded || hasSettingsCache();

  const imageFor = (slug: CategorySlug) =>
    products.find((p) => p.category === slug && p.image)?.image ?? '';

  // Banners are written in Settings → Homepage banners. Where no picture
  // has been uploaded yet, fall back to something sensible so the page is
  // never blank.
  const stockImage = [FALLBACK.computers, FALLBACK.solar, FALLBACK.cameras];
  const slides = (settingsReady ? (settings.heroSlides ?? []) : []).map((s, i) => ({
    ...s,
    image:
      s.image ||
      (i === 0 ? settings.heroImage : i === 1 ? settings.solarBannerImage : '') ||
      stockImage[i % stockImage.length],
  }));

  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance, unless someone is hovering or has just used the arrows.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  // A finger-swipe across the banner turns the page on phones. Only a
  // clearly horizontal drag counts, so vertical scrolling stays smooth.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t0 = touchStart.current;
    touchStart.current = null;
    if (!t0) return;
    const dx = e.changedTouches[0].clientX - t0.x;
    const dy = e.changedTouches[0].clientY - t0.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    // "Next" follows the reading direction: drag against it in Arabic.
    step(((lang === 'ar' ? dx > 0 : dx < 0) ? 1 : -1) as 1 | -1);
  };

  const step = (dir: 1 | -1) => {
    setPaused(true);
    setSlide((s) => (s + dir + slides.length) % slides.length);
  };

  const tiles = settingsReady ? (settings.promoTiles ?? []) : [];
  // The list staff manage in Settings; until they add one, the built-in
  // brands with whatever logos were uploaded against them.
  const brandList = (settings.brands ?? []).length
    ? settings.brands
    : allBrands.map((b) => ({ name: b.name, image: settings.brandLogos?.[b.slug] ?? '' }));

  // Newest first. The shop hands products over in alphabetical order, which
  // is why "New arrivals" used to open with whatever began with a digit.
  // Products added before the date was recorded fall to the back.
  const inStock = useMemo(
    () =>
      products
        .filter((p) => p.inStock)
        .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)),
    [products],
  );
  // One row. The rest is what the shop is for — a homepage that keeps
  // going with product grids stops being a homepage.
  const newest = inStock.slice(0, 4);

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

  // The big card is whichever tile Settings crowned; failing that, the
  // canvas's default — the solar tile — and failing that, the first.
  const crownedIdx = tiles.findIndex((tl) => tl.big);
  const solarIdx = tiles.findIndex((tl) => /solar/.test(tl.buttonLink));
  const bigIdx = crownedIdx >= 0 ? crownedIdx : solarIdx >= 0 ? solarIdx : 0;
  const bigTile = tiles[bigIdx];
  const sideTiles = tiles.map((tl, i) => ({ tile: tl, i })).filter(({ i }) => i !== bigIdx);
  const tileImg = (i: number) =>
    tiles[i].image || imageFor(categories[i]?.slug) || stockImage[i % stockImage.length];

  return (
    <div className="bg-white">
      {/* ---------------- Hero banner ---------------- */}
      {/* Sits in the page's usual centred column; inside it the photo fills
          the whole banner, with the wording laid over the top. */}
      <section className="container-page pt-6">
        <div
          className="relative h-[26rem] overflow-hidden rounded-3xl bg-slate-900 sm:h-[32rem]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
        {!settingsReady && <div aria-hidden className="skeleton absolute inset-0" />}
        {slides.map((s, i) => (
          <div
            key={i}
            aria-hidden={i !== slide}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === slide ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {/* The photo fills the whole banner. Phones get the taller crop
                when one has been uploaded — the banner is portrait there, so
                a wide photo would lose its left and right edges. */}
            <picture>
              {s.mobileImage && <source media="(max-width: 639px)" srcSet={s.mobileImage} />}
              <img
                src={s.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </picture>
            {/* Darkened just enough that the words stay readable. */}
            <div
              className="absolute inset-0"
              style={{ background: `rgba(2, 6, 23, ${Math.min(90, Math.max(0, s.overlay)) / 100})` }}
            />
            {/* Phones: the wording sits at the bottom of the banner, so the
                photo gets a floor of shade under it whatever the overlay
                setting says. */}
            <div
              className="absolute inset-0 sm:hidden"
              style={{
                background:
                  'linear-gradient(to top, rgba(2,6,23,.9) 0%, rgba(2,6,23,.62) 34%, rgba(2,6,23,.14) 66%, rgba(2,6,23,0) 100%)',
              }}
            />
            {/* Desktop: the design's shade comes in from the wording side,
                leaving the photo clear on the other. */}
            <div className="hero-shade absolute inset-0 hidden sm:block" />
            <div className="relative flex h-full flex-col justify-end gap-3 p-6 pb-16 sm:justify-center sm:gap-4 sm:px-14 sm:pb-0">
              {(() => {
                const theme = s.accent ? customTheme(s.accent) : slideTheme(s.buttonLink);
                // Arabic banners come from the slide's own Arabic fields
                // when the admin filled them; otherwise the English text
                // runs through the dictionary like everything else.
                const wd = (en: string, ar: string) => (lang === 'ar' && ar ? ar : t(en));
                const words = wd(s.title, s.titleAr).split(' ');
                const cut = Math.max(1, words.length - 2);
                const head = words.slice(0, cut).join(' ');
                const tail = words.slice(cut).join(' ');
                return (
                  <>
                    {s.eyebrow && (
                      <span
                        className="self-start rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em]"
                        style={{
                          background: theme.chipBg,
                          color: theme.chipText,
                          boxShadow: `inset 0 0 0 1px ${theme.chipRing}`,
                        }}
                      >
                        {wd(s.eyebrow, s.eyebrowAr)}
                      </span>
                    )}
                    <h1
                      className="max-w-2xl text-[28px] font-extrabold leading-[1.12] tracking-tight sm:text-5xl sm:leading-[1.08]"
                      style={{ color: s.textColor }}
                    >
                      {head}{' '}
                      <span className="sm:block" style={{ color: theme.accent }}>
                        {tail}
                      </span>
                    </h1>
                    {s.subtitle && (
                      <p
                        className="max-w-xl text-[13px] leading-relaxed sm:text-lg"
                        style={{ color: s.textColor, opacity: 0.85 }}
                      >
                        {wd(s.subtitle, s.subtitleAr)}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {s.buttonLabel && (
                        <HeroLink
                          to={s.buttonLink}
                          style={{ background: s.buttonBg, color: s.buttonText }}
                          className="shadow-lg"
                        >
                          {wd(s.buttonLabel, s.buttonLabelAr)}
                        </HeroLink>
                      )}
                      <button
                        type="button"
                        onClick={() => openChat()}
                        className="hidden rounded-full bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-900 transition hover:bg-slate-100 sm:inline-block"
                      >
                        {t('Talk to us')}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ))}

        {/* Slide controls — only worth showing with more than one banner. */}
        {slides.length > 1 && (
          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t('Previous')}
              className="hidden h-7 w-7 place-items-center rounded-full text-base font-bold text-slate-900 hover:bg-slate-100 sm:grid"
            >
              ‹
            </button>
            <div className="flex items-center gap-1.5 px-1">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPaused(true);
                    setSlide(i);
                  }}
                  aria-label={`${t('Slide')} ${i + 1}`}
                  className={`h-1.5 rounded-full transition-colors ${
                    i === slide ? 'w-6 bg-brand-600' : 'w-1.5 bg-slate-300'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={t('Next')}
              className="hidden h-7 w-7 place-items-center rounded-full text-base font-bold text-slate-900 hover:bg-slate-100 sm:grid"
            >
              ›
            </button>
          </div>
        )}
        </div>
      </section>

      {/* ---------------- Proof ---------------- */}
      {/* The reasons to trust the shop, where a first-time visitor actually
          looks: right under the banner, not at the foot of the page. The
          Google rating is a link — anyone can go and read the reviews. */}
      <section className="container-page pt-5">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 lg:grid-cols-4">
          {[
            { icon: '★', title: 'Rated 5.0 on Google', body: 'Read what customers say', to: GOOGLE_REVIEWS },
            { icon: '🛡', title: '5-year warranty', body: 'On the inverter and the batteries' },
            { icon: '🚚', title: 'Delivery across Iraq', body: 'Cash on delivery, nothing upfront' },
            { icon: '🏬', title: 'In Baghdad since 1992', body: 'A shop you can walk into' },
          ].map((v) => {
            const inner = (
              <>
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-50 text-base text-brand-700">
                  {v.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold text-slate-900">{t(v.title)}</span>
                  <span className="block truncate text-xs text-slate-500">{t(v.body)}</span>
                </span>
              </>
            );
            const cls = 'flex items-center gap-3 bg-white px-4 py-3.5';
            return v.to ? (
              <a key={v.title} href={v.to} target="_blank" rel="noreferrer" className={`${cls} hover:bg-brand-50/40`}>
                {inner}
              </a>
            ) : (
              <div key={v.title} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- Start here ---------------- */}
      {/* The canvas design's use-case cards: people don't shop for a
          category, they shop for a situation. Scrolls sideways on phones,
          a row of four on desktop. */}
      <section className="pt-16 lg:pt-20">
        <div className="container-page mb-6">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
            {t('Start here')}
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {t('What do you need it for?')}
          </h2>
        </div>
        <div className="scrollbar-none flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:px-6 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible xl:container-page">
          {USE_CASES.map((c) => (
            <Link
              key={c.title}
              to={c.to}
              className="flex w-60 flex-none snap-start flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-lg hover:shadow-slate-900/5 lg:w-auto"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">
                {t(c.eyebrow)}
              </div>
              <div className="text-lg font-extrabold leading-snug text-slate-900">{t(c.title)}</div>
              <div className="text-[13px] leading-relaxed text-slate-500">{t(c.blurb)}</div>
              <span className="mt-auto flex items-center gap-1.5 pt-2 text-[13px] font-bold text-brand-700">
                <span>{t(c.cta)}</span>
                <span className="rtl:hidden">→</span>
                <span className="hidden rtl:inline">←</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- Promo banners ---------------- */}
      {!settingsReady && (
        <section className="container-page pt-16 lg:pt-20" aria-hidden>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="skeleton h-72 rounded-3xl lg:col-span-2" />
            <div className="grid grid-rows-2 gap-4">
              <div className="skeleton rounded-3xl" />
              <div className="skeleton rounded-3xl" />
            </div>
          </div>
        </section>
      )}
      <section className="container-page pt-16 lg:pt-20">
        {/* Phones follow the canvas: the first tile is a tall card with
            its wording on white below the photo, the rest are split rows.
            The grid stays for larger screens. Photos and links come from
            Settings as before; the small eyebrow/description lines are
            matched to what each tile links to. */}
        <div className="flex flex-col gap-3 sm:hidden">
          {bigTile && <BigTileCard tile={bigTile} img={tileImg(bigIdx)} />}
          {sideTiles.map(({ tile, i }) => (
            <SplitTileCard key={i} tile={tile} img={tileImg(i)} />
          ))}
        </div>

        <div className="hidden gap-4 sm:grid lg:grid-cols-2">
          {/* Written in Settings → Homepage tiles. */}
          {bigTile && (
            <div className="lg:row-span-2">
              <BigTileCard tile={bigTile} img={tileImg(bigIdx)} tall />
            </div>
          )}
          {sideTiles.map(({ tile, i }) => (
            <SplitTileCard key={i} tile={tile} img={tileImg(i)} />
          ))}
        </div>
      </section>

      {/* ---------------- New arrivals ---------------- */}
      {productsLoading && (
        <section className="mt-16 border-y border-slate-200 bg-slate-50 lg:mt-20" aria-hidden>
          <div className="container-page py-16">
            <div className="skeleton mb-6 h-8 w-48 rounded-lg" />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <div className="skeleton h-64 rounded-2xl" />
              <div className="skeleton h-64 rounded-2xl" />
              <div className="skeleton hidden h-64 rounded-2xl lg:block" />
              <div className="skeleton hidden h-64 rounded-2xl lg:block" />
            </div>
          </div>
        </section>
      )}
      {newest.length > 0 && (
        <section className="mt-16 border-y border-slate-200 bg-slate-50 lg:mt-20">
          <div className="container-page py-16">
            <SectionHead eyebrow="In stock now" title="New arrivals" linkTo="/shop" linkLabel="Shop all" />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {newest.map((p) => (
                <ArrivalCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Solar ---------------- */}
      {/* A real rooftop, not a drawing: the solar tile's photo, or the
          solar banner, or the stock rooftop — whichever the shop has. */}
      <SolarQuote
        logo={settings.solarLogo}
        photo={
          (solarIdx >= 0 && tiles[solarIdx].image) ||
          settings.solarBannerImage ||
          imageFor('solar') ||
          FALLBACK.solar
        }
      />

      {/* ---------------- Brands ---------------- */}
      {/* Every logo in the same box at the same height, in grey until it is
          looked at — a row of partners, not a row of adverts. */}
      <section className="container-page pt-16 lg:pt-20">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
          {t('Partners')}
        </div>
        <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {t('Brands we carry')}
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {brandList.map((b, i) => {
            const logo = b.image;
            return (
              <div
                key={`${b.name}-${i}`}
                className="grid h-16 place-items-center rounded-xl border border-slate-200 bg-white px-4 grayscale transition hover:grayscale-0"
              >
                {logo ? (
                  <img src={logo} alt={b.name} loading="lazy" className="max-h-8 w-auto object-contain opacity-80" />
                ) : (
                  <span className="text-center text-xs font-bold text-slate-500">{b.name}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- Genuine ---------------- */}
      <section className="container-page py-16 lg:py-20">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-slate-200 pt-8 sm:grid-cols-3">
          {[
            { title: 'Genuine products', body: 'Everything we sell comes from the authorised source.' },
            { title: 'Easy replacement', body: 'Wrong item or changed your mind? Swap or return it.' },
            { title: 'Talk to a person', body: 'WhatsApp, phone, or the chat on this page — a human answers.' },
          ].map((v) => (
            <div key={v.title}>
              <div className="mb-1.5 font-bold text-slate-900">{t(v.title)}</div>
              <div className="text-sm leading-relaxed text-slate-500">{t(v.body)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** A tile's whole card is the link; it may point anywhere. */
/** The brand chip pinned to a tile photo's top corner — the logo lives
    on a white pad so it reads on any picture, and stays put whatever the
    photo's crop does. */
function TileLogo({ logo, small }: { logo: string; small?: boolean }) {
  if (!logo) return null;
  return (
    <span
      className={`absolute top-2.5 rounded-lg bg-white/95 shadow-sm ltr:left-2.5 rtl:right-2.5 ${
        small ? 'p-1' : 'p-1.5'
      }`}
    >
      <img
        src={logo}
        alt=""
        loading="lazy"
        className={`w-auto object-contain ${small ? 'h-6 max-w-[5.5rem]' : 'h-8 max-w-[8rem]'}`}
      />
    </span>
  );
}

/** The canvas's big promo card: photo on top, wording and the dark
    quote pill on white below. */
function BigTileCard({ tile, img, tall }: { tile: PromoTile; img: string; tall?: boolean }) {
  const { t } = useLang();
  const flavour = tileFlavour(tile.buttonLink);
  return (
    <TileLink
      to={tile.buttonLink}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10 ${tall ? 'h-full' : ''}`}
    >
      <div className={`relative overflow-hidden bg-slate-900 ${tall ? 'min-h-[16rem] flex-1' : 'h-44'}`}>
        <img
          src={img}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <TileLogo logo={tile.logo} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: flavour.color }}>
            {t(flavour.eyebrow)}
          </div>
          <div className="mb-1 text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">{t(tile.title)}</div>
          <div className="max-w-md text-[13px] leading-relaxed text-slate-500">{t(flavour.blurb)}</div>
        </div>
        <span className="inline-flex flex-none items-center gap-2 rounded-full bg-slate-900 py-2.5 pe-2.5 ps-5 text-xs font-bold text-white">
          <span>{t(tile.buttonLabel || 'Explore now')}</span>
          <span
            className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-extrabold"
            style={{ background: flavour.chipBg, color: flavour.chipText }}
          >
            →
          </span>
        </span>
      </div>
    </TileLink>
  );
}

/** The canvas's split promo row: photo on the start side, wording on white. */
function SplitTileCard({ tile, img }: { tile: PromoTile; img: string }) {
  const { t } = useLang();
  const flavour = tileFlavour(tile.buttonLink);
  return (
    <TileLink
      to={tile.buttonLink}
      className="group grid grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <div className="relative min-h-[7.5rem] overflow-hidden bg-slate-900 sm:min-h-[10rem]">
        <img
          src={img}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        <TileLogo logo={tile.logo} small />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-1 p-4 sm:gap-1.5 sm:p-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: flavour.color }}>
          {t(flavour.eyebrow)}
        </div>
        <div className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">{t(tile.title)}</div>
        <div className="text-xs leading-relaxed text-slate-500 sm:text-[13px]">{t(flavour.blurb)}</div>
        <span className="mt-1 flex items-center gap-1.5 text-xs font-bold sm:text-[13px]" style={{ color: flavour.color }}>
          <span>{t('Browse')}</span>
          <span className="rtl:hidden">→</span>
          <span className="hidden rtl:inline">←</span>
        </span>
      </div>
    </TileLink>
  );
}

function TileLink({
  to,
  className,
  children,
}: {
  to: string;
  className: string;
  children: React.ReactNode;
}) {
  if (to.startsWith('#') || /^https?:\/\//i.test(to)) {
    return (
      <a href={to} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to || '/shop'} className={className}>
      {children}
    </Link>
  );
}

function HeroLink({
  to,
  className,
  style,
  children,
}: {
  to: string;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const cls = `inline-block rounded-full px-7 py-3.5 text-xs font-bold uppercase tracking-wider transition hover:brightness-110 ${className}`;
  // In-page anchors (the quote form) aren't routes, and a link to another
  // website has to leave the app rather than go through the router.
  if (to.startsWith('#') || /^https?:\/\//i.test(to)) {
    return (
      <a href={to} className={cls} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to || '/shop'} className={cls} style={style}>
      {children}
    </Link>
  );
}

function SectionHead({
  eyebrow,
  title,
  linkTo,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  linkTo: string;
  linkLabel: string;
}) {
  const { t } = useLang();
  return (
    <div className="mb-5 flex items-end justify-between gap-6">
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
          {t(eyebrow)}
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t(title)}</h2>
      </div>
      <Link
        to={linkTo}
        className="flex flex-none items-center gap-2 text-sm font-bold text-brand-700 hover:underline"
      >
        <span>{t(linkLabel)}</span>
        <span className="rtl:hidden">→</span>
        <span className="hidden rtl:inline">←</span>
      </Link>
    </div>
  );
}

/** A product shown, not sold: the whole card opens it, the price sits
    with a quiet arrow, and the add-to-cart button waits in the shop. A
    homepage with a dozen identical blue buttons reads as a catalogue. */
function ArrivalCard({ product }: { product: Product }) {
  const { lang, t } = useLang();

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-brand-300 hover:shadow-lg hover:shadow-slate-900/5"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      {product.brand && (
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{product.brand}</div>
      )}
      <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-800 group-hover:text-brand-700">
        {pName(product, lang)}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-lg font-extrabold text-slate-900">
          {formatPrice(product.price, product.currency)}
        </span>
        <span className="text-xs font-bold text-brand-700">
          {t('View')} <span className="rtl:hidden">→</span>
          <span className="hidden rtl:inline">←</span>
        </span>
      </div>
    </Link>
  );
}

/** The solar pitch: a real roof, the promise, and one door to the prices. */
function SolarQuote({ logo, photo }: { logo?: string; photo: string }) {
  const { t } = useLang();

  return (
    <section id="quote" className="mt-16 border-y border-slate-200 bg-slate-50 lg:mt-20">
      <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-20">
        <div>
          {logo ? (
            <img
              src={logo}
              alt="SolarMax"
              className="mb-5 h-12 w-auto object-contain"
              loading="lazy"
            />
          ) : (
            <div className="mb-5 text-xl font-extrabold tracking-tight text-brand-700">SolarMax</div>
          )}
          <span className="inline-block rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-700 ring-1 ring-inset ring-brand-200">
            {t('Free site survey')}
          </span>
          <h2 className="mb-4 mt-4 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            <span className="block">{t('Forget your electricity problems —')}</span>
            <span className="block text-brand-600">{t('live without power cuts')}</span>
          </h2>
          <p className="mb-6 max-w-lg text-base leading-relaxed text-slate-600">
            {t(
              'Most homes we fit run their essentials through the night and pay back the system in under three years.',
            )}
          </p>
          <ul className="mb-8 flex flex-col gap-3">
            {[
              'Free survey and load assessment',
              'Panels, inverter, batteries and install in one quote',
              'Cash, or bank installments up to 7 years',
            ].map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">
                  ✓
                </span>
                <span>{t(line)}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/solar-prices"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
          >
            <span>{t('See solar prices')}</span>
            <span className="rtl:hidden">→</span>
            <span className="hidden rtl:inline">←</span>
          </Link>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-900 shadow-xl shadow-slate-900/10">
          <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/70 to-transparent p-5 text-white">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
              {t('Central Bank initiative')}
            </div>
            <div className="mt-1 text-lg font-extrabold">{t('Pay monthly, up to 7 years')}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

