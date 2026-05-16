import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { getCategory } from '../data/categories';
import { getProductsByCategory } from '../data/products';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating';

export default function Category() {
  const { slug = '' } = useParams();
  const category = getCategory(slug);
  const [sort, setSort] = useState<SortKey>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);

  const products = useMemo(() => {
    let list = getProductsByCategory(slug);
    if (inStockOnly) list = list.filter((p) => p.inStock);
    switch (sort) {
      case 'price-asc':
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list = [...list].sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }
    return list;
  }, [slug, sort, inStockOnly]);

  if (!category) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold">Category not found</h1>
        <Link to="/" className="mt-4 inline-block text-brand-700 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div>
      <section className={`bg-gradient-to-br ${category.accent} text-white`}>
        <div className="container-page py-12">
          <div className="text-5xl">{category.icon}</div>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{category.name}</h1>
          <p className="mt-2 max-w-2xl text-white/90">{category.tagline}</p>
        </div>
      </section>

      <section className="container-page py-10">
        <div className="mb-6 flex flex-wrap items-center gap-4">
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
            <label htmlFor="sort" className="text-slate-600">Sort by</label>
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

        {products.length === 0 ? (
          <p className="py-12 text-center text-slate-600">No products match your filters.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
