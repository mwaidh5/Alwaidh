import { useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { categories } from '../data/categories';
import { useProducts } from '../lib/useProducts';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating';
type CategoryFilter = 'all' | string;

export default function Shop() {
  const { products, loading } = useProducts();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortKey>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let list = products.slice();
    if (activeCategory !== 'all') {
      list = list.filter((p) => p.category === activeCategory);
    }
    if (inStockOnly) {
      list = list.filter((p) => p.inStock);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q),
      );
    }
    switch (sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }
    return list;
  }, [activeCategory, sort, inStockOnly, query, products]);

  const filterPills: { key: CategoryFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: products.length },
    ...categories.map((c) => ({
      key: c.slug,
      label: c.name,
      count: products.filter((p) => p.category === c.slug).length,
    })),
  ];

  return (
    <div>
      <section className="bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <div className="container-page py-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-100">Shop</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
            Every product, one place.
          </h1>
          <p className="mt-2 max-w-2xl text-white/90">
            Browse computers, solar energy gear, and Tiandy security cameras side by side.
          </p>
        </div>
      </section>

      <section className="container-page py-8">
        <div className="flex flex-wrap items-center gap-2">
          {filterPills.map((pill) => {
            const isActive = activeCategory === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setActiveCategory(pill.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pill.label}
                <span
                  className={`rounded-full px-2 text-xs ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            In stock only
          </label>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <label htmlFor="sort" className="text-slate-600">
              Sort by
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top rated</option>
            </select>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{filtered.length}</span> of{' '}
          {products.length} products
        </p>

        {loading ? (
          <p className="py-16 text-center text-slate-500">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-slate-600">No products match your filters.</p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
