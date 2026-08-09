import { Link } from 'react-router-dom';
import type { CategorySlug } from '../types/product';
import { categories } from '../data/categories';
import { solarBrands } from '../data/brands';
import { useProducts } from '../lib/useProducts';
import { useSettingsStatus } from '../lib/useSettings';
import { useLang } from '../lib/i18n';
import { formatPrice } from '../lib/format';
import StarRating from '../components/StarRating';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1100&q=80';
const SOLAR_IMAGE =
  'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80';

const VALUE_PROPS = [
  {
    icon: '🚚',
    title: 'Fast delivery',
    body: 'Same-day dispatch on in-stock items across Baghdad and beyond.',
  },
  {
    icon: '✅',
    title: 'Genuine products',
    body: 'Authorised reseller for Tiandy, SolarMax, and partner brands.',
  },
  {
    icon: '🛟',
    title: 'Expert support',
    body: 'Real help sizing solar systems, PCs, and CCTV — before and after you buy.',
  },
];

/**
 * The official Tiandy Iraq logo when one is uploaded in Settings, otherwise a
 * wordmark built from the brand green so the section never looks unbranded.
 */
function TiandyLogo({ src }: { src: string }) {
  if (src) {
    return <img src={src} alt="Tiandy Iraq" className="h-12 w-auto" />;
  }
  return (
    <span className="inline-flex items-end gap-2" aria-label="Tiandy Iraq">
      <span className="text-4xl font-extrabold leading-none tracking-tight text-tiandy-500">
        Tiandy
      </span>
      <span className="rounded bg-tiandy-500 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-white">
        IRAQ
      </span>
    </span>
  );
}

/**
 * The three things we sell, overlapping and lifted above the panel — real
 * product photos rather than a stock image, so it follows the catalogue.
 */
export default function Home() {
  const { products, loading: productsLoading } = useProducts();
  const { settings, loaded: settingsLoaded } = useSettingsStatus();
  const { t } = useLang();
  const collection = products.slice(0, 8);
  const tiandy = products.filter((p) => p.category === 'tiandy-cameras').slice(0, 4);
  // Until settings arrive we don't know if the shop uploaded its own images,
  // so show nothing rather than flashing a stock photo that then swaps out.
  const bannerImage = settings.solarBannerImage || (settingsLoaded ? SOLAR_IMAGE : '');

  // Same for category tiles: a real product photo once loaded, otherwise a
  // plain tint — never the stock image.
  const imageFor = (slug: CategorySlug) =>
    products.find((p) => p.category === slug)?.image ?? (productsLoading ? '' : HERO_IMAGE);

  return (
    <div className="bg-white">
      {/* Hero — split headline over a brand panel, with the product cluster
          breaking out above it. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/60 via-white to-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl"
        />
        <div className="container-page relative pt-10 sm:pt-14">
          {/* Split headline */}
          <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
            <h1 className="text-4xl font-extrabold leading-[0.95] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              {t('Power Your')}
              <br />
              <span className="text-brand-600">{t('WORK')}</span>
            </h1>
            <h2 className="text-4xl font-extrabold leading-[0.95] tracking-tight text-slate-900 sm:text-right sm:text-6xl lg:text-7xl">
              {t('Secure Your')}
              <br />
              <span className="text-brand-600">{t('WORLD')}</span>
              <span aria-hidden className="ml-2 text-sun-400">
                &#10022;
              </span>
            </h2>
          </div>

          {/* Brand panel */}
          <div className="relative mt-10 rounded-[2rem] bg-brand-600 px-6 pb-8 pt-10 sm:mt-16 sm:rounded-[2.5rem] sm:px-10 sm:pb-10 lg:pt-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem] sm:rounded-[2.5rem]"
            >
              <div className="absolute -left-10 top-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            </div>

            <div className={`relative grid items-center gap-8 ${settings.heroImage ? 'lg:grid-cols-2' : ''}`}>
              {/* Left: the pitch */}
              <div className="max-w-sm">
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/90">
                  <span aria-hidden>&#10022;</span> {t('Complete systems')}
                </p>
                <p className="mt-4 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                  {t('Where Power Meets Reliability')}
                </p>
                <p className="mt-3 text-white/85">
                  {t(
                    'Computers, solar energy, and security cameras — supplied, installed, and serviced by our own team.',
                  )}
                </p>
                <Link
                  to="/shop"
                  className="mt-7 inline-flex items-center gap-3 rounded-full bg-slate-900 py-2 pl-6 pr-2 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
                >
                  {t('Explore Now')}
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-900">
                    &rarr;
                  </span>
                </Link>

                <div className="mt-8 grid max-w-xs grid-cols-3 gap-3 text-center">
                  {[
                    { icon: '\ud83d\udcbb', label: t('Computers') },
                    { icon: '\u2600\ufe0f', label: t('Solar Energy') },
                    { icon: '\ud83d\udcf7', label: t('Cameras') },
                  ].map((f) => (
                    <div key={f.label} className="rounded-2xl bg-white/10 px-2 py-3">
                      <span className="text-2xl" aria-hidden>
                        {f.icon}
                      </span>
                      <p className="mt-1 text-xs font-semibold leading-tight text-white/90">
                        {f.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-2.5 backdrop-blur">
                  <span className="flex -space-x-2" aria-hidden>
                    {['\ud83d\udcbb', '\u2600\ufe0f', '\ud83d\udcf7'].map((icon) => (
                      <span
                        key={icon}
                        className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm ring-2 ring-brand-600"
                      >
                        {icon}
                      </span>
                    ))}
                  </span>
                  <p className="text-sm font-semibold leading-tight text-white">
                    {t('Trusted across Iraq')}
                    <br />
                    <span className="font-normal text-white/80">{t('since 1992')}</span>
                  </p>
                </div>
              </div>

              {/* Middle: real products, lifted above the panel */}
              {settings.heroImage && (
                <img
                  src={settings.heroImage}
                  alt={t('Our products')}
                  className="mx-auto w-full max-w-sm self-start object-contain drop-shadow-2xl sm:-mt-16 lg:-mt-32 lg:max-w-md"
                />
              )}

            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="container-page py-12">
        <div className="grid gap-5 sm:grid-cols-3">
          {VALUE_PROPS.map((v) => (
            <div
              key={t(v.title)}
              className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-5"
            >
              <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white text-xl shadow-sm">
                {v.icon}
              </span>
              <div>
                <p className="font-bold text-slate-900">{t(v.title)}</p>
                <p className="mt-0.5 text-sm text-slate-600">{t(v.body)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Category banners */}
      <section className="container-page py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">{t('Browse')}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              {t('Shop by Category')}
            </h2>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to="/shop"
              className="group relative h-44 overflow-hidden rounded-2xl shadow-sm"
            >
              {imageFor(c.slug) === '' && (
                <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden="true" />
              )}
              <img
                src={imageFor(c.slug)}
                alt={c.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/25 to-transparent" />
              {settings.categoryLogos?.[c.slug] ? (
                <span className="absolute left-4 top-4 grid h-14 w-14 place-items-center rounded-xl bg-white/95 p-1.5 shadow-md ring-1 ring-black/5">
                  <img
                    src={settings.categoryLogos[c.slug]}
                    alt={`${c.name} logo`}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                </span>
              ) : (
                <span className="absolute left-4 top-4 text-3xl drop-shadow">{c.icon}</span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-lg font-bold">{t(c.name)}</p>
                <span className="text-xs font-semibold uppercase tracking-wide text-white/80 underline-offset-4 group-hover:underline">
                  {t('Shop Now →')}
                </span>
              </div>
            </Link>
          ))}
          <Link
            to="/shop"
            className="group relative flex h-44 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800"
          >
            <span className="text-4xl transition group-hover:scale-110">🛍️</span>
            <p className="text-lg font-bold">{t('All Products')}</p>
            <span className="text-xs font-semibold uppercase tracking-wide text-white/70 underline-offset-4 group-hover:underline">
              {t('Shop Now →')}
            </span>
          </Link>
        </div>
      </section>

      {/* Latest collection — glass cards on a tinted wash */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl"
        />

        <div className="container-page relative">
          <div className="mb-6 flex items-end justify-between sm:mb-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-600 sm:text-xs">
                {t('Fresh in store')}
              </p>
              <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:mt-2 sm:text-3xl">
                {t('Latest Collection')}
              </h2>
            </div>
            <Link
              to="/shop"
              className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block"
            >
              {t('View all →')}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {collection.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="group rounded-2xl border border-white/70 bg-white/60 p-1.5 shadow-sm backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/85 hover:shadow-xl sm:p-2"
              >
                <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {/* Frosted price tag floating on the image */}
                  <span className="absolute bottom-1.5 right-1.5 whitespace-nowrap rounded-full border border-white/60 bg-white/70 px-2 py-0.5 text-[10px] font-extrabold text-slate-900 shadow-sm backdrop-blur-md sm:bottom-2 sm:right-2 sm:px-2.5 sm:py-1 sm:text-xs">
                    {formatPrice(p.price, p.currency)}
                  </span>
                </div>
                <div className="px-1 pb-1 pt-2 sm:px-1.5 sm:pt-2.5">
                  <p className="line-clamp-1 text-xs font-semibold text-slate-800 transition group-hover:text-brand-700 sm:text-sm">
                    {p.name}
                  </p>
                  <StarRating rating={p.rating} className="mt-1" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              to="/shop"
              className="inline-flex items-center justify-center rounded-full border border-white/70 bg-white/70 px-7 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow-sm backdrop-blur-md transition hover:bg-white"
            >
              {t('View All Products')}
            </Link>
          </div>
        </div>
      </section>

      {/* Tiandy cameras spotlight — always shown: it is a brand statement,
          not just a product list, so it stays even with no cameras loaded. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-tiandy-300/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-tiandy-100/60 blur-3xl"
          />
          <div className="container-page relative">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <TiandyLogo src={settings.tiandyLogo} />
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  {t('Security')} <span className="text-tiandy-600">{t('Cameras')}</span>
                </h2>
                <p className="mt-2 max-w-xl text-slate-600">
                  {t('Professional IP cameras and NVRs from an authorised Tiandy reseller — built for homes, shops, and business sites.')}
                </p>
              </div>
              <Link
                to="/shop"
                className="hidden text-sm font-semibold text-tiandy-600 hover:text-tiandy-700 hover:underline sm:block"
              >
                {t('View all →')}
              </Link>
            </div>

            {tiandy.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
                <p className="text-3xl">📷</p>
                <p className="mt-3 font-semibold text-slate-800">
                  {t('Camera range coming online soon')}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                  {t('We supply and install the full Tiandy line-up — IP cameras, NVRs, and complete CCTV systems. Ask us for a quote in the meantime.')}
                </p>
              </div>
            )}

            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {tiandy.map((p) => (
                <Link key={p.id} to={`/product/${p.id}`} className="group">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition group-hover:shadow-md group-hover:ring-tiandy-500/60">
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="line-clamp-1 text-sm font-semibold text-slate-800 group-hover:text-tiandy-600">
                        {p.name}
                      </span>
                      <span className="flex-none text-sm font-extrabold text-tiandy-600">
                        {formatPrice(p.price, p.currency)}
                      </span>
                    </div>
                    <StarRating rating={p.rating} />
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center rounded-full bg-tiandy-500 px-8 py-3.5 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-tiandy-500/30 transition hover:bg-tiandy-600"
              >
                {t('Shop Tiandy Cameras')}
              </Link>
            </div>
          </div>
      </section>

      {/* Solar energy — frosted glass over the SolarMax sky blue */}
      <section className="relative overflow-hidden">
        {bannerImage && (
          <img
            src={bannerImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Keep the installation photo readable: a light touch at the top,
            deepening into brand sky-blue behind the text below. */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/45 via-sky-700/75 to-sky-800/95" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-white/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-white/20 blur-3xl"
        />

        <div className="container-page relative py-10 sm:py-14">
          <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
            {settings.solarLogo ? (
              <span className="inline-flex items-center rounded-2xl bg-white/95 px-5 py-3 shadow-lg ring-1 ring-black/5">
                <img
                  src={settings.solarLogo}
                  alt="SolarMax — الواعظ للقدرة"
                  className="h-14 w-auto sm:h-16"
                />
              </span>
            ) : (
              <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white">
                ☀️ SolarMax · الواعظ للقدرة
              </span>
            )}
            <h2 className="mt-4 text-3xl font-extrabold uppercase tracking-tight text-white drop-shadow sm:text-4xl">
              {t('Power tomorrow today')}
              <br />
              {t('with solar')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/90">
              {t('Panels, inverters, and batteries sized for your home or business — supplied and installed by the team that knows the gear.')}
            </p>
            <Link
              to="/solar-prices"
              className="mt-6 inline-flex items-center gap-3 rounded-full bg-white py-2 pl-6 pr-2 text-sm font-bold uppercase tracking-wide text-sky-700 shadow-xl transition hover:bg-sky-50"
            >
              {t('View Solar Prices')}
              <span className="grid h-9 w-9 place-items-center rounded-full bg-sky-600 text-base text-white">
                →
              </span>
            </Link>
          </div>

          {/* Glass feature cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:mt-0">
            <div className="glass rounded-3xl p-4">
              <img
                src={imageFor('solar')}
                alt=""
                loading="lazy"
                className="h-20 w-full rounded-2xl object-cover"
              />
              <p className="mt-4 text-sm font-bold uppercase tracking-wide text-white">
                {t('Complete solar systems')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/85">
                {t('Panels, inverters, and batteries supplied as one working system — sized for your actual load.')}
              </p>
              <Link
                to="/solar-prices"
                className="mt-3 inline-block text-xs font-bold uppercase tracking-wide text-white underline-offset-4 hover:underline"
              >
                {t('Discover our systems →')}
              </Link>
            </div>

            <div className="glass rounded-3xl p-4">
              <span className="text-3xl">🔋</span>
              <p className="mt-3 text-sm font-bold uppercase tracking-wide text-white">
                {t('SolarMax batteries')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/85">
                {t('More power, more backup — tubular and lithium batteries built for long, hot days and nightly runtime.')}
              </p>
              <Link
                to="/shop"
                className="mt-3 inline-block text-xs font-bold uppercase tracking-wide text-white underline-offset-4 hover:underline"
              >
                {t('Shop batteries →')}
              </Link>
            </div>
          </div>

          </div>

          {/* Brands we supply */}
          <div className="mt-8">
            <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-white/80">
              {t('Brands we work with')}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {solarBrands.map((b) => {
                const logo = settings.brandLogos?.[b.slug];
                return (
                  <span
                    key={b.slug}
                    title={b.name}
                    className="flex h-16 min-w-[130px] items-center justify-center rounded-2xl bg-white/95 px-5 shadow-md ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt={b.name}
                        loading="lazy"
                        className="max-h-10 max-w-[140px] object-contain"
                      />
                    ) : (
                      <span className="text-lg font-extrabold tracking-tight text-slate-800">
                        {b.name}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
