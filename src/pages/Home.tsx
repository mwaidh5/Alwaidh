import { Link } from 'react-router-dom';
import type { CategorySlug } from '../types/product';
import { categories } from '../data/categories';
import { useProducts } from '../lib/useProducts';
import { useSettings } from '../lib/useSettings';
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

export default function Home() {
  const { products } = useProducts();
  const settings = useSettings();
  const collection = products.slice(0, 8);
  const tiandy = products.filter((p) => p.category === 'tiandy-cameras').slice(0, 4);
  const heroImage = settings.heroImage || HERO_IMAGE;
  const bannerImage = settings.solarBannerImage || SOLAR_IMAGE;

  const imageFor = (slug: CategorySlug) =>
    products.find((p) => p.category === slug)?.image ?? HERO_IMAGE;

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 via-white to-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-amber-100/50 blur-3xl"
        />
        <div className="container-page relative grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
              ⚡ Your Tech Destination
            </p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl">
              New Season
              <br />
              <span className="text-brand-600">Collection</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-slate-600">
              Quality computers, solar energy systems, and Tiandy security cameras — chosen for
              performance and built to last.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center rounded-full bg-brand-600 px-8 py-3.5 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
              >
                Shop Now
              </Link>
              <Link
                to="/solar-prices"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Solar Prices
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src={heroImage}
              alt="Featured products"
              className="aspect-[5/4] w-full rounded-3xl object-cover shadow-xl ring-1 ring-slate-900/5"
            />
            <div className="absolute -bottom-4 left-6 flex items-center gap-2.5 rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
              <span className="text-2xl">📷</span>
              <div className="leading-tight">
                <p className="text-sm font-bold text-slate-900">Tiandy Authorised</p>
                <p className="text-xs text-slate-500">Security cameras &amp; NVRs</p>
              </div>
            </div>
            <div className="absolute -top-4 right-6 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
              <span>☀️</span>
              <p className="text-sm font-bold text-slate-900">Solar experts</p>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="container-page py-12">
        <div className="grid gap-5 sm:grid-cols-3">
          {VALUE_PROPS.map((v) => (
            <div
              key={v.title}
              className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-5"
            >
              <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white text-xl shadow-sm">
                {v.icon}
              </span>
              <div>
                <p className="font-bold text-slate-900">{v.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{v.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Category banners */}
      <section className="container-page py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">Browse</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Shop by Category
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
              <img
                src={imageFor(c.slug)}
                alt={c.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-lg font-bold">{c.name}</p>
                <span className="text-xs font-semibold uppercase tracking-wide text-white/80 underline-offset-4 group-hover:underline">
                  Shop Now →
                </span>
              </div>
            </Link>
          ))}
          <Link
            to="/shop"
            className="group relative flex h-44 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800"
          >
            <span className="text-4xl transition group-hover:scale-110">🛍️</span>
            <p className="text-lg font-bold">All Products</p>
            <span className="text-xs font-semibold uppercase tracking-wide text-white/70 underline-offset-4 group-hover:underline">
              Shop Now →
            </span>
          </Link>
        </div>
      </section>

      {/* Latest collection */}
      <section className="container-page py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">
              Fresh in store
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Latest Collection
            </h2>
          </div>
          <Link
            to="/shop"
            className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block"
          >
            View all →
          </Link>
        </div>
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {collection.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="group">
              <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100 shadow-sm transition group-hover:shadow-md">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <span className="line-clamp-1 text-sm font-semibold text-slate-800 group-hover:text-brand-700">
                    {p.name}
                  </span>
                  <span className="flex-none text-sm font-extrabold text-orange-500">
                    {formatPrice(p.price, p.currency)}
                  </span>
                </div>
                <StarRating rating={p.rating} />
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-12 text-center sm:hidden">
          <Link
            to="/shop"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:bg-slate-50"
          >
            View All Products
          </Link>
        </div>
      </section>

      {/* Tiandy cameras spotlight */}
      {tiandy.length > 0 && (
        <section className="relative overflow-hidden bg-slate-950 py-16 text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-red-600/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-red-500/10 blur-3xl"
          />
          <div className="container-page relative">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-red-400 ring-1 ring-red-500/40">
                  📷 Security
                </p>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Tiandy <span className="text-red-500">Cameras</span>
                </h2>
                <p className="mt-2 max-w-xl text-white/70">
                  Professional IP cameras and NVRs from an authorised Tiandy reseller — built for
                  homes, shops, and business sites.
                </p>
              </div>
              <Link
                to="/shop"
                className="hidden text-sm font-semibold text-red-400 hover:text-red-300 hover:underline sm:block"
              >
                View all →
              </Link>
            </div>

            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {tiandy.map((p) => (
                <Link key={p.id} to={`/product/${p.id}`} className="group">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10 transition group-hover:ring-red-500/60">
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                    />
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="line-clamp-1 text-sm font-semibold text-white group-hover:text-red-400">
                        {p.name}
                      </span>
                      <span className="flex-none text-sm font-extrabold text-red-500">
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
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-8 py-3.5 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700"
              >
                Shop Tiandy Cameras
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Solar energy banner */}
      <section className="container-page py-20">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white">
          <img
            src={bannerImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/40 to-transparent" />
          <div className="relative px-8 py-24 text-center md:max-w-2xl md:px-16 md:py-32 md:text-left">
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-amber-300 ring-1 ring-amber-300/40">
              ☀️ Clean Energy
            </p>
            <h2 className="mt-5 text-4xl font-extrabold uppercase tracking-[0.1em] sm:text-6xl">
              Go Solar
            </h2>
            <p className="mt-5 max-w-xl text-lg text-white/85">
              Cut your power bills and run on clean, reliable energy. We supply panels, inverters,
              and batteries — and help you size the right system for your home or business.
            </p>
            <Link
              to="/solar-prices"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold uppercase tracking-wide text-slate-900 shadow-lg transition hover:bg-amber-50"
            >
              View Solar Prices
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
