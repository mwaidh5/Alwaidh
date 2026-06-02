import { Link } from 'react-router-dom';
import type { CategorySlug } from '../types/product';
import { categories } from '../data/categories';
import { useProducts } from '../lib/useProducts';
import { formatPrice } from '../lib/format';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1100&q=80';
const SOLAR_IMAGE =
  'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80';

export default function Home() {
  const { products } = useProducts();
  const collection = products.slice(0, 8);

  const imageFor = (slug: CategorySlug) =>
    products.find((p) => p.category === slug)?.image ?? HERO_IMAGE;

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-white">
        <div className="container-page grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Your Tech Destination
            </p>
            <h1 className="mt-4 text-5xl font-extrabold leading-none tracking-tight text-slate-900 sm:text-6xl">
              New Season
              <br />
              Collection
            </h1>
            <p className="mt-6 max-w-md text-slate-600">
              Quality computers, solar energy systems, and Tiandy security cameras — chosen for
              performance and built to last.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700"
              >
                Shop Now
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:bg-slate-50"
              >
                Read More
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src={HERO_IMAGE}
              alt="Featured products"
              className="aspect-[5/4] w-full rounded-3xl object-cover shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* Category promo tiles */}
      <section className="container-page grid gap-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <Link
            key={c.slug}
            to="/shop"
            className="group flex items-center gap-5 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition hover:shadow-md"
          >
            <img
              src={imageFor(c.slug)}
              alt={c.name}
              className="h-28 w-28 flex-none rounded-2xl object-contain"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {c.name}
              </p>
              <span className="mt-1 inline-block text-base font-semibold text-slate-900 underline-offset-4 group-hover:underline">
                Shop Now
              </span>
            </div>
          </Link>
        ))}
        <Link
          to="/shop"
          className="group flex items-center gap-5 rounded-3xl bg-slate-900 p-8 text-white shadow-sm transition hover:bg-slate-800"
        >
          <span className="text-6xl">🛍️</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              All Products
            </p>
            <span className="mt-1 inline-block text-base font-semibold underline-offset-4 group-hover:underline">
              Shop Now
            </span>
          </div>
        </Link>
      </section>

      {/* Latest collection grid */}
      <section className="container-page py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Latest Collection
        </h2>
        <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {collection.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="group">
              <div className="aspect-square overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition group-hover:shadow-md">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full rounded-2xl object-contain transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="line-clamp-1 text-sm text-slate-700 group-hover:text-slate-900">
                  {p.name}
                </span>
                <span className="flex-none text-sm font-bold text-orange-500">
                  {formatPrice(p.price, p.currency)}
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link
            to="/shop"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:bg-slate-50"
          >
            View All Products
          </Link>
        </div>
      </section>

      {/* Solar energy banner */}
      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white">
          <img
            src={SOLAR_IMAGE}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div className="relative px-8 py-28 text-center md:max-w-2xl md:px-16 md:py-36 md:text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
              Clean Energy
            </p>
            <h2 className="mt-4 text-4xl font-extrabold uppercase tracking-[0.12em] sm:text-6xl">
              Go Solar
            </h2>
            <p className="mt-5 max-w-xl text-lg text-white/85">
              Cut your power bills and run on clean, reliable energy. We supply panels, inverters,
              and batteries — and help you size the right system for your home or business.
            </p>
            <Link
              to="/solar-calculator"
              className="mt-8 inline-flex items-center justify-center rounded-full border border-white/70 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-slate-900"
            >
              Build a Solar System
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
