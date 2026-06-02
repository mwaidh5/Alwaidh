import { Link } from 'react-router-dom';
import type { CategorySlug } from '../types/product';
import { categories } from '../data/categories';
import { useProducts } from '../lib/useProducts';
import { formatPrice } from '../lib/format';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=80';
const BANNER_IMAGE =
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80';

export default function Home() {
  const { products } = useProducts();
  const collection = products.slice(0, 8);

  const imageFor = (slug: CategorySlug) =>
    products.find((p) => p.category === slug)?.image ?? HERO_IMAGE;

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-slate-100">
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
                className="inline-flex items-center justify-center bg-slate-900 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700"
              >
                Shop Now
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center justify-center border border-slate-300 bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:bg-slate-50"
              >
                Read More
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              src={HERO_IMAGE}
              alt="Featured products"
              className="aspect-[4/3] w-full object-cover"
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
            className="group flex items-center gap-4 bg-slate-50 p-6 transition hover:bg-slate-100"
          >
            <img
              src={imageFor(c.slug)}
              alt={c.name}
              className="h-20 w-20 flex-none object-contain"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {c.name}
              </p>
              <span className="mt-1 inline-block text-sm font-semibold text-slate-900 underline-offset-4 group-hover:underline">
                Shop Now
              </span>
            </div>
          </Link>
        ))}
        <Link
          to="/shop"
          className="group flex items-center gap-4 bg-slate-900 p-6 text-white transition hover:bg-slate-800"
        >
          <span className="text-4xl">🛍️</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              All Products
            </p>
            <span className="mt-1 inline-block text-sm font-semibold underline-offset-4 group-hover:underline">
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
              <div className="aspect-square overflow-hidden bg-slate-100 p-6">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
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
            className="inline-flex items-center justify-center border border-slate-300 bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:bg-slate-50"
          >
            View All Products
          </Link>
        </div>
      </section>

      {/* Dark promo banner */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <img
          src={BANNER_IMAGE}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="container-page relative py-24 text-center md:max-w-xl md:text-left">
          <h2 className="text-4xl font-extrabold uppercase tracking-[0.15em] sm:text-5xl">
            Alwaidh
          </h2>
          <p className="mt-4 text-white/80">
            Improve your setup with technology chosen for reliability — and backed by expert support
            from a store that knows the gear.
          </p>
          <Link
            to="/about"
            className="mt-8 inline-flex items-center justify-center border border-white/70 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-slate-900"
          >
            View More
          </Link>
        </div>
      </section>
    </div>
  );
}
