import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categories } from '../data/categories';
import { allBrands } from '../data/brands';
import { useProducts } from '../lib/useProducts';
import { useSettings } from '../lib/useSettings';
import { useCart } from '../context/CartContext';
import { useLang } from '../lib/i18n';
import { formatPrice } from '../lib/format';
import SolarSceneLite from '../components/SolarSceneLite';
import type { CategorySlug, Product } from '../types/product';

const FALLBACK = {
  computers:
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1100&q=80',
  solar:
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1400&q=80',
  cameras:
    'https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?auto=format&fit=crop&w=1200&q=80',
};

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
    return { eyebrow: 'Free site survey', blurb: 'Panels, inverters and batteries for clean, reliable power.', color: '#b45309', chipBg: '#fbbf24', chipText: '#0f172a' };
  if (/tiandy|camera/.test(link))
    return { eyebrow: 'Authorised reseller', blurb: 'IP and analog cameras and NVRs.', color: '#248527', chipBg: '#2ea830', chipText: '#ffffff' };
  if (/computer/.test(link))
    return { eyebrow: 'Since 1992', blurb: 'Laptops, desktops and workstations.', color: '#1d4ed8', chipBg: '#2563eb', chipText: '#ffffff' };
  return { eyebrow: 'Alwaidh', blurb: '', color: '#334155', chipBg: '#0f172a', chipText: '#ffffff' };
}

/** The canvas design's use cases: a situation each, not a category. */
const USE_CASES = [
  { eyebrow: 'Home office', title: 'Setting up to work', blurb: 'A laptop, monitor and the cables that fit it.', cta: 'See bundles', to: '/shop?category=computers', accent: '#2563eb' },
  { eyebrow: 'Power cuts', title: 'Keeping the lights on', blurb: 'Tell us what must stay running and we size it.', cta: 'Size my system', to: '/solar-prices', accent: '#f59e0b' },
  { eyebrow: 'Security', title: 'Watching the shop', blurb: 'Cameras, recorder and cabling from your plan.', cta: 'Plan a system', to: '/shop?category=tiandy-cameras', accent: '#2ea830' },
  { eyebrow: 'Business', title: 'Buying wholesale', blurb: 'Quantity pricing to every Iraqi province.', cta: 'Request pricing', to: '/about', accent: '#0f172a' },
];

export default function Home() {
  const { t } = useLang();
  const { products } = useProducts();
  const settings = useSettings();

  const imageFor = (slug: CategorySlug) =>
    products.find((p) => p.category === slug && p.image)?.image ?? '';

  // Banners are written in Settings → Homepage banners. Where no picture
  // has been uploaded yet, fall back to something sensible so the page is
  // never blank.
  const stockImage = [FALLBACK.computers, FALLBACK.solar, FALLBACK.cameras];
  const slides = (settings.heroSlides ?? []).map((s, i) => ({
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

  const step = (dir: 1 | -1) => {
    setPaused(true);
    setSlide((s) => (s + dir + slides.length) % slides.length);
  };

  const tiles = settings.promoTiles ?? [];
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
  const newest = inStock.slice(0, 4);
  // A second strip further down, so the page shows more of the shop
  // without repeating what's already above it.
  const more = inStock.slice(4, 12);

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
        >
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
            <div className="relative flex h-full flex-col justify-end gap-3 p-6 pb-16 sm:justify-center sm:gap-4 sm:px-14 sm:pb-0">
              {s.eyebrow && (
                <span
                  className="self-start rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] ring-1 ring-inset"
                  style={{ color: s.textColor, borderColor: s.textColor, opacity: 0.95 }}
                >
                  {t(s.eyebrow)}
                </span>
              )}
              <h1
                className="max-w-2xl text-[28px] font-extrabold leading-[1.12] tracking-tight sm:text-5xl sm:leading-[1.08]"
                style={{ color: s.textColor }}
              >
                {t(s.title)}
              </h1>
              {s.subtitle && (
                <p
                  className="max-w-xl text-[13px] leading-relaxed sm:text-lg"
                  style={{ color: s.textColor, opacity: 0.85 }}
                >
                  {t(s.subtitle)}
                </p>
              )}
              {s.buttonLabel && (
                <HeroLink
                  to={s.buttonLink}
                  style={{ background: s.buttonBg, color: s.buttonText }}
                  className="mt-2 self-start shadow-lg"
                >
                  {t(s.buttonLabel)}
                </HeroLink>
              )}
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
                  className={`h-1.5 rounded-full transition-all ${
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

      {/* ---------------- Start here ---------------- */}
      {/* The canvas design's use-case cards: people don't shop for a
          category, they shop for a situation. Scrolls sideways on phones,
          a row of four on desktop. */}
      <section className="pt-12">
        <div className="container-page mb-4">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">
            {t('Start here')}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {t('What do you need it for?')}
          </h2>
        </div>
        <div className="scrollbar-none flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:px-6 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible xl:container-page">
          {USE_CASES.map((c) => (
            <Link
              key={c.title}
              to={c.to}
              className="flex w-56 flex-none snap-start flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-lg lg:w-auto"
              style={{ borderTop: `3px solid ${c.accent}` }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: c.accent }}>
                {t(c.eyebrow)}
              </div>
              <div className="text-base font-extrabold leading-snug text-slate-900">{t(c.title)}</div>
              <div className="text-xs leading-relaxed text-slate-500">{t(c.blurb)}</div>
              <span className="mt-auto flex items-center gap-1.5 pt-1.5 text-xs font-bold" style={{ color: c.accent }}>
                <span>{t(c.cta)}</span>
                <span>→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- Promo banners ---------------- */}
      <section className="container-page pt-12">
        {/* Phones follow the canvas: the first tile is a tall card with
            its wording on white below the photo, the rest are split rows.
            The grid stays for larger screens. Photos and links come from
            Settings as before; the small eyebrow/description lines are
            matched to what each tile links to. */}
        <div className="flex flex-col gap-3 sm:hidden">
          {tiles.map((tile, i) => {
            const flavour = tileFlavour(tile.buttonLink);
            const img = tile.image || imageFor(categories[i]?.slug) || stockImage[i % stockImage.length];
            return i === 0 ? (
              <TileLink key={i} to={tile.buttonLink} className="block overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="relative h-44 bg-slate-900">
                  <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                </div>
                <div className="border-t border-slate-200 p-4">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: flavour.color }}>
                    {t(flavour.eyebrow)}
                  </div>
                  <div className="mb-1 text-lg font-extrabold tracking-tight text-slate-900">{t(tile.title)}</div>
                  <div className="mb-3.5 text-[13px] leading-relaxed text-slate-500">{t(flavour.blurb)}</div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 py-2.5 pe-2.5 ps-5 text-xs font-bold text-white">
                    <span>{t(tile.buttonLabel || 'Explore now')}</span>
                    <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-extrabold" style={{ background: flavour.chipBg, color: flavour.chipText }}>→</span>
                  </span>
                </div>
              </TileLink>
            ) : (
              <TileLink key={i} to={tile.buttonLink} className="grid grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="relative min-h-[7.5rem] bg-slate-900">
                  <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <div className="flex min-w-0 flex-col justify-center gap-1 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-700">
                    {t(flavour.eyebrow)}
                  </div>
                  <div className="text-base font-extrabold tracking-tight text-slate-900">{t(tile.title)}</div>
                  <div className="text-xs leading-relaxed text-slate-500">{t(flavour.blurb)}</div>
                </div>
              </TileLink>
            );
          })}
        </div>

        <div className="hidden grid-cols-2 gap-4 sm:grid lg:grid-cols-3">
          {/* Written in Settings → Homepage tiles. */}
          {tiles.map((tile, i) => {
            const flavour = tileFlavour(tile.buttonLink);
            const img = tile.image || imageFor(categories[i]?.slug) || stockImage[i % stockImage.length];
            return (
              <TileLink
                key={i}
                to={tile.buttonLink}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10"
              >
                <div className="relative h-44 overflow-hidden bg-slate-900 lg:h-48">
                  <img
                    src={img}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col border-t border-slate-200 p-5">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: flavour.color }}>
                    {t(flavour.eyebrow)}
                  </div>
                  <div className="mb-1 text-lg font-extrabold tracking-tight text-slate-900">{t(tile.title)}</div>
                  <div className="mb-4 text-[13px] leading-relaxed text-slate-500">{t(flavour.blurb)}</div>
                  <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-slate-900 py-2.5 pe-2.5 ps-5 text-xs font-bold text-white">
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
          })}
        </div>
      </section>

      {/* ---------------- New arrivals ---------------- */}
      {newest.length > 0 && (
        <section className="mt-14 border-y border-slate-200 bg-slate-50">
          <div className="container-page py-14">
            <SectionHead eyebrow="In stock now" title="New arrivals" linkTo="/shop" linkLabel="Shop all" />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {newest.map((p) => (
                <ArrivalCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Solar quote ---------------- */}
      <SolarQuote logo={settings.solarLogo} />

      {/* ---------------- More products ---------------- */}
      {more.length > 0 && (
        <section className="container-page pt-14">
          <SectionHead
            eyebrow="From the shop"
            title="More to explore"
            linkTo="/shop"
            linkLabel="Browse everything"
          />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {more.slice(0, 8).map((p) => (
              <ArrivalCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Brands ---------------- */}
      <section className="container-page pt-14">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
          {t('Partners')}
        </div>
        <h2 className="mb-5 text-3xl font-extrabold tracking-tight text-slate-900">
          {t('Brands we carry')}
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {brandList.map((b, i) => {
            const logo = b.image;
            return (
              <div
                key={`${b.name}-${i}`}
                className="grid h-20 place-items-center rounded-xl border border-slate-200 bg-white px-3"
              >
                {logo ? (
                  <img src={logo} alt={b.name} loading="lazy" className="max-h-12 w-auto object-contain" />
                ) : (
                  <span className="text-center text-sm font-bold text-slate-500">{b.name}</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- Why us ---------------- */}
      <section className="container-page py-14">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 border-t border-slate-200 pt-8 lg:grid-cols-4">
          {[
            {
              icon: '🚚',
              title: 'Fast delivery',
              body: 'Same-day dispatch in Baghdad, and across Iraq within days.',
            },
            {
              icon: '💵',
              title: 'Cash on delivery',
              body: 'Pay when the order reaches your door — nothing upfront.',
            },
            {
              icon: '🔄',
              title: 'Easy replacement',
              body: 'Wrong item or changed your mind? Swap or return it.',
            },
            {
              icon: '✅',
              title: 'Genuine products',
              body: 'Everything we sell comes from the authorised source.',
            },
          ].map((v) => (
            <div key={v.title}>
              <div className="mb-2 text-2xl" aria-hidden>
                {v.icon}
              </div>
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
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">{t(title)}</h2>
      </div>
      <Link
        to={linkTo}
        className="flex flex-none items-center gap-2 text-sm font-bold text-brand-700 hover:underline"
      >
        <span>{t(linkLabel)}</span>
        <span>→</span>
      </Link>
    </div>
  );
}

function ArrivalCard({ product }: { product: Product }) {
  const { t } = useLang();
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5">
      <Link
        to={`/product/${product.id}`}
        className="relative aspect-square overflow-hidden rounded-xl bg-slate-100"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </Link>
      <Link
        to={`/product/${product.id}`}
        className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-800 hover:text-brand-700"
      >
        {product.name}
      </Link>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-extrabold text-slate-900">
          {formatPrice(product.price, product.currency)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          add(product.id, 1);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
        className="mt-0.5 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
      >
        {added ? t('Added ✓') : t('Add to cart')}
      </button>
    </div>
  );
}

/** "Tell us your bill" — a real enquiry, landing in Admin → Submissions. */
function SolarQuote({ logo }: { logo?: string }) {
  const { t } = useLang();

  return (
    <section
      id="quote"
      className="mt-14 border-y border-sky-100 bg-gradient-to-br from-sky-50 via-white to-brand-50"
    >
      <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_.95fr]">
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
          <h2 className="mb-3 mt-4 text-4xl font-extrabold leading-tight tracking-tight text-slate-900">
            <span className="block">{t('Forget your electricity problems —')}</span>
            <span className="block text-brand-600">{t('live without power cuts')}</span>
          </h2>
          <p className="mb-6 max-w-lg text-base leading-relaxed text-slate-600">
            {t(
              'Most homes we fit run their essentials through the night and pay back the system in under three years.',
            )}
          </p>
          <ul className="flex flex-col gap-3">
            {[
              'Free survey and load assessment',
              'Panels, inverter, batteries and install in one quote',
              'Two-year workmanship warranty',
            ].map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">
                  ✓
                </span>
                <span>{t(line)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* The install in miniature, and one plain door to the prices —
            the quote form used to live here, and asked more questions than
            a price list answers. */}
        <div className="flex flex-col gap-5">
          <SolarSceneLite />
          <Link
            to="/solar-prices"
            className="block rounded-2xl bg-brand-600 py-4 text-center text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
          >
            {t('See solar prices')} →
          </Link>
        </div>
      </div>
    </section>
  );
}

