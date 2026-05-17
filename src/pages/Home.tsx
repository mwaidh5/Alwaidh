import { Link } from 'react-router-dom';
import CategoryTile from '../components/CategoryTile';
import ProductCard from '../components/ProductCard';
import { categories } from '../data/categories';
import { useProducts } from '../lib/useProducts';

export default function Home() {
  const { products } = useProducts();
  const featured = products.filter((p) => p.inStock).slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
              Welcome to Alwaidh
            </p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              Power your work, your home, and your security — all in one shop.
            </h1>
            <p className="mt-5 max-w-prose text-lg text-slate-600">
              Quality computers, solar energy systems, and Tiandy security cameras with fast
              shipping and expert support.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-primary">Shop all products</Link>
              <Link to="/solar-calculator" className="btn-secondary">Build a solar system</Link>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
              <img
                src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=900&q=80"
                alt="Featured"
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Shop by category</h2>
            <p className="mt-1 text-slate-600">Three product lines, one trusted store.</p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {categories.map((c) => (
            <CategoryTile key={c.slug} category={c} />
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="container-page py-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold text-slate-900">Featured products</h2>
          <Link to="/shop" className="text-sm font-semibold text-brand-700 hover:underline">
            See all →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="bg-slate-50">
        <div className="container-page grid gap-6 py-12 sm:grid-cols-3">
          {[
            { title: 'Fast shipping', body: 'Same-day dispatch on in-stock items.' },
            { title: 'Genuine products', body: 'Authorised reseller for Tiandy and partner brands.' },
            { title: 'Expert support', body: 'Help selecting solar, IT, and CCTV systems.' },
          ].map((v) => (
            <div key={v.title} className="card p-6">
              <h3 className="font-semibold text-slate-900">{v.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{v.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
