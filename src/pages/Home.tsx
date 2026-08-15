import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categories } from '../data/categories';
import { allBrands } from '../data/brands';
import { useProducts } from '../lib/useProducts';
import { useSettings } from '../lib/useSettings';
import { useCart } from '../context/CartContext';
import { useLang } from '../lib/i18n';
import { formatPrice } from '../lib/format';
import { submitContact } from '../lib/contactSubmissions';
import type { CategorySlug, Product } from '../types/product';

const FALLBACK = {
  computers:
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1100&q=80',
  solar:
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1400&q=80',
  cameras:
    'https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?auto=format&fit=crop&w=1200&q=80',
};

interface Slide {
  key: CategorySlug;
  eyebrow: string;
  line1: string;
  line2: string;
  body: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
  image: string;
  /** Panel background and the colour of the second headline line. */
  panel: string;
  accent: string;
  dark: boolean;
}

export default function Home() {
  const { t } = useLang();
  const { products } = useProducts();
  const settings = useSettings();

  const imageFor = (slug: CategorySlug) =>
    products.find((p) => p.category === slug && p.image)?.image ?? '';

  const slides: Slide[] = [
    {
      key: 'computers',
      eyebrow: 'New arrivals',
      line1: 'Laptops built for',
      line2: 'real work',
      body: 'Business machines, workstations and accessories — spec’d properly, warrantied locally, and in stock today.',
      primary: { label: 'Shop computers', to: '/shop?category=computers' },
      secondary: { label: 'Talk to us', to: '/about' },
      image: settings.heroImage || imageFor('computers') || FALLBACK.computers,
      panel: 'bg-gradient-to-br from-slate-50 via-white to-slate-200',
      accent: 'text-brand-600',
      dark: false,
    },
    {
      key: 'solar',
      eyebrow: 'Clean energy',
      line1: 'Cut your power bill',
      line2: 'for good',
      body: 'Panels, inverters and batteries sized for your home or shop. Free site survey, installed by our own crew.',
      primary: { label: 'Get a free solar quote', to: '#quote' },
      secondary: { label: 'See the price sheet', to: '/solar-prices' },
      image: settings.solarBannerImage || imageFor('solar') || FALLBACK.solar,
      panel: 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-700',
      accent: 'text-sun-400',
      dark: true,
    },
    {
      key: 'tiandy-cameras',
      eyebrow: 'Surveillance',
      line1: 'Tiandy cameras,',
      line2: 'properly installed',
      body: 'IP cameras, NVRs and full-site coverage from an authorised Tiandy reseller.',
      primary: { label: 'Shop cameras', to: '/shop?category=tiandy-cameras' },
      secondary: { label: 'Book an install', to: '/about' },
      image: imageFor('tiandy-cameras') || FALLBACK.cameras,
      panel: 'bg-slate-950',
      accent: 'text-red-500',
      dark: true,
    },
  ];

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

  const inStock = useMemo(() => products.filter((p) => p.inStock), [products]);
  const newest = inStock.slice(0, 4);
  // A second strip further down, so the page shows more of the shop
  // without repeating what's already above it.
  const more = inStock.slice(4, 12);

  return (
    <div className="bg-white">
      {/* ---------------- Hero carousel ---------------- */}
      <section className="container-page pt-6">
        <div
          className="relative h-[30rem] overflow-hidden rounded-3xl bg-slate-100 sm:h-[32rem]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {slides.map((s, i) => (
            <div
              key={s.key}
              aria-hidden={i !== slide}
              className={`absolute inset-0 grid transition-opacity duration-700 md:grid-cols-[1.02fr_1fr] ${
                s.panel
              } ${i === slide ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            >
              <div className="z-[1] flex flex-col justify-center gap-4 p-8 sm:p-12">
                <span
                  className={`self-start rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] ${
                    s.dark
                      ? 'bg-white/10 text-white ring-1 ring-inset ring-white/30'
                      : 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
                  }`}
                >
                  {t(s.eyebrow)}
                </span>
                <h1
                  className={`text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl ${
                    s.dark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  <span className="block">{t(s.line1)}</span>
                  <span className={`block ${s.accent}`}>{t(s.line2)}</span>
                </h1>
                <p
                  className={`max-w-md text-base leading-relaxed ${
                    s.dark ? 'text-white/80' : 'text-slate-600'
                  }`}
                >
                  {t(s.body)}
                </p>
                <div className="mt-1 flex flex-wrap gap-3">
                  <HeroLink to={s.primary.to} className="bg-brand-600 text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700">
                    {t(s.primary.label)}
                  </HeroLink>
                  <HeroLink
                    to={s.secondary.to}
                    className={
                      s.dark
                        ? 'border border-white/30 text-white hover:bg-white/10'
                        : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                    }
                  >
                    {t(s.secondary.label)}
                  </HeroLink>
                </div>
              </div>
              <div className="relative hidden md:block">
                <img
                  src={s.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              </div>
            </div>
          ))}

          {/* Slide controls */}
          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t('Previous')}
              className="grid h-7 w-7 place-items-center rounded-full text-base font-bold text-slate-900 hover:bg-slate-100"
            >
              ‹
            </button>
            <div className="flex items-center gap-1.5 px-1">
              {slides.map((s, i) => (
                <button
                  key={s.key}
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
              className="grid h-7 w-7 place-items-center rounded-full text-base font-bold text-slate-900 hover:bg-slate-100"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- Promo banners ---------------- */}
      <section className="container-page pt-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map((s) => (
            <Link
              key={s.key}
              to={s.primary.to}
              className="group relative block h-60 overflow-hidden rounded-2xl bg-slate-900"
            >
              <img
                src={s.image}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end gap-2 p-6">
                <p className="text-lg font-extrabold text-white">
                  {t(categories.find((c) => c.slug === s.key)?.name ?? '')}
                </p>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-600 py-2 pe-2 ps-4 text-sm font-bold text-white shadow-lg">
                  {t('Explore now')}
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-extrabold text-brand-600">
                    →
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- New arrivals ---------------- */}
      {newest.length > 0 && (
        <section className="mt-14 border-y border-slate-200 bg-slate-50">
          <div className="container-page py-14">
            <SectionHead eyebrow="In stock now" title="New arrivals" linkTo="/shop" linkLabel="Shop all" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          {allBrands.map((b) => {
            const logo = settings.brandLogos?.[b.slug];
            return (
              <div
                key={b.slug}
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
        <div className="grid gap-6 border-t border-slate-200 pt-8 sm:grid-cols-2 lg:grid-cols-4">
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

function HeroLink({
  to,
  className,
  children,
}: {
  to: string;
  className: string;
  children: React.ReactNode;
}) {
  const cls = `rounded-full px-7 py-3.5 text-xs font-bold uppercase tracking-wider transition ${className}`;
  // In-page anchors (the quote form) aren't routes.
  if (to.startsWith('#')) {
    return (
      <a href={to} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [bill, setBill] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError(t('Please add your name and phone number.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await submitContact({
        name: name.trim(),
        email: '',
        phone: phone.trim(),
        subject: 'Solar quote request',
        message: [`City: ${city || '—'}`, `Monthly bill: ${bill || '—'}`].join('\n'),
      });
      setDone(true);
    } catch {
      setError(t('Could not send — check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  }

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
            <span className="block">{t('Tell us your bill —')}</span>
            <span className="block text-brand-600">{t('we’ll size the system')}</span>
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

        <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-xl shadow-sky-900/10">
          {done ? (
            <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-green-100 text-xl font-extrabold text-green-700">
                ✓
              </span>
              <p className="max-w-[15rem] font-bold text-slate-900">
                {t('Thanks — we’ll call you within 24 hours.')}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="text-lg font-extrabold tracking-tight text-slate-900">
                {t('Request a solar quote')}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Labelled label="Full name">
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('Your name')}
                  />
                </Labelled>
                <Labelled label="Phone number">
                  <input
                    type="tel"
                    dir="ltr"
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0770 000 0000"
                  />
                </Labelled>
              </div>
              <Labelled label="City">
                <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">{t('Select your city')}</option>
                  {['Baghdad', 'Basra', 'Erbil', 'Mosul', 'Najaf'].map((c) => (
                    <option key={c} value={c}>
                      {t(c)}
                    </option>
                  ))}
                </select>
              </Labelled>
              <Labelled label="Average monthly bill">
                <select className="input" value={bill} onChange={(e) => setBill(e.target.value)}>
                  <option value="">{t('Select a range')}</option>
                  {['Under 50,000 IQD', '50,000 – 150,000 IQD', 'Over 150,000 IQD'].map((b) => (
                    <option key={b} value={b}>
                      {t(b)}
                    </option>
                  ))}
                </select>
              </Labelled>
              {error && <p className="text-xs text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mt-1 w-full rounded-xl bg-brand-600 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-60"
              >
                {busy ? t('Sending…') : t('Request a free site visit')}
              </button>
              <p className="text-center text-[11px] text-slate-500">
                {t('We’ll call you within 24 hours. No obligation.')}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useLang();
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
      <span>{t(label)}</span>
      {children}
    </label>
  );
}
