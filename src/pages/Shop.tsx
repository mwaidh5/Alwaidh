import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types/product';
import { categories } from '../data/categories';
import { useProducts } from '../lib/useProducts';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/format';
import StarRating from '../components/StarRating';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating';
type ViewMode = 'grid' | 'list';

const PER_PAGE = 9;

export default function Shop() {
  const { products, loading } = useProducts();
  const { add } = useCart();

  const [activeCategory, setActiveCategory] = useState<'all' | string>('all');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [view, setView] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);

  // Price ceiling derived from the catalog.
  const maxCatalogPrice = useMemo(
    () => products.reduce((max, p) => Math.max(max, p.price), 0),
    [products],
  );
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const priceCeiling = maxPrice ?? maxCatalogPrice;

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [products]);

  const topRated = useMemo(
    () => products.slice().sort((a, b) => b.rating - a.rating).slice(0, 3),
    [products],
  );

  const filtered = useMemo(() => {
    let list = products.slice();
    if (activeCategory !== 'all') list = list.filter((p) => p.category === activeCategory);
    if (selectedBrands.length) list = list.filter((p) => selectedBrands.includes(p.brand));
    if (inStockOnly) list = list.filter((p) => p.inStock);
    if (maxPrice != null) list = list.filter((p) => p.price <= maxPrice);
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
  }, [products, activeCategory, selectedBrands, inStockOnly, maxPrice, query, sort]);

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [activeCategory, selectedBrands, inStockOnly, maxPrice, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PER_PAGE;
  const pageItems = filtered.slice(start, start + PER_PAGE);

  const toggleBrand = (name: string) =>
    setSelectedBrands((prev) =>
      prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name],
    );

  const clearFilters = () => {
    setActiveCategory('all');
    setSelectedBrands([]);
    setInStockOnly(false);
    setQuery('');
    setMaxPrice(null);
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="container-page flex items-center gap-2 py-4 text-sm text-slate-500">
          <Link to="/" className="hover:text-brand-700">
            Home
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-800">Products</span>
        </div>
      </div>

      <div className="container-page grid gap-8 py-8 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-8">
          <SidebarSection title="Search">
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search our store"
                className="input pr-9"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                🔍
              </span>
            </div>
          </SidebarSection>

          <SidebarSection title="Top Rated Products">
            <ul className="space-y-4">
              {topRated.map((p) => (
                <li key={p.id}>
                  <Link to={`/product/${p.id}`} className="group flex items-center gap-3">
                    <img
                      src={p.image}
                      alt={p.name}
                      loading="lazy"
                      className="h-14 w-14 flex-none rounded-md border border-slate-200 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-700">
                        {p.name}
                      </p>
                      <StarRating rating={p.rating} className="mt-0.5" />
                      <p className="mt-0.5 text-sm font-semibold text-brand-700">
                        {formatPrice(p.price, p.currency)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection title="Categories">
            <ul className="space-y-2 text-sm">
              <FilterRow
                label="All products"
                count={products.length}
                active={activeCategory === 'all'}
                onClick={() => setActiveCategory('all')}
              />
              {categories.map((c) => (
                <FilterRow
                  key={c.slug}
                  label={c.name}
                  count={products.filter((p) => p.category === c.slug).length}
                  active={activeCategory === c.slug}
                  onClick={() => setActiveCategory(c.slug)}
                />
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection title="Brands">
            <ul className="space-y-2 text-sm">
              {brands.map((b) => (
                <li key={b.name}>
                  <label className="flex cursor-pointer items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(b.name)}
                      onChange={() => toggleBrand(b.name)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="flex-1">{b.name}</span>
                    <span className="text-xs text-slate-400">({b.count})</span>
                  </label>
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection title="Price">
            {maxCatalogPrice > 0 && (
              <>
                <input
                  type="range"
                  min={0}
                  max={maxCatalogPrice}
                  step={10}
                  value={priceCeiling}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-brand-600"
                />
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>$0</span>
                  <span className="font-semibold text-slate-900">
                    Up to {formatPrice(priceCeiling)}
                  </span>
                </div>
              </>
            )}
          </SidebarSection>

          <SidebarSection title="Availability">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              In stock only
            </label>
          </SidebarSection>
        </aside>

        {/* Main */}
        <section>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-1">
              <ViewButton active={view === 'grid'} onClick={() => setView('grid')} label="Grid view">
                ▦
              </ViewButton>
              <ViewButton active={view === 'list'} onClick={() => setView('list')} label="List view">
                ☰
              </ViewButton>
            </div>

            <p className="text-sm text-slate-600">
              {filtered.length === 0
                ? 'No results'
                : `Showing ${start + 1}–${Math.min(start + PER_PAGE, filtered.length)} of ${
                    filtered.length
                  } result${filtered.length === 1 ? '' : 's'}`}
            </p>

            <div className="ml-auto flex items-center gap-2 text-sm">
              <label htmlFor="sort" className="text-slate-600">
                Sort By:
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="featured">Featured</option>
                <option value="rating">Alphabetically / Top rated</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <p className="py-16 text-center text-slate-500">Loading products…</p>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-slate-600">No products match your filters.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="btn-secondary mt-4 px-4 py-2 text-sm"
              >
                Clear filters
              </button>
            </div>
          ) : view === 'grid' ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((p) => (
                <GridCard key={p.id} product={p} onAdd={() => add(p.id, 1)} />
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {pageItems.map((p) => (
                <ListCard key={p.id} product={p} onAdd={() => add(p.id, 1)} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <PageButton
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
                label="Previous page"
              >
                «
              </PageButton>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`h-10 w-10 rounded-md border text-sm font-semibold transition ${
                    n === currentPage
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {n}
                </button>
              ))}
              <PageButton
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
                label="Next page"
              >
                »
              </PageButton>
            </div>
          )}
        </section>
      </div>

      {/* Solar calculator banner */}
      <section className="container-page pb-12">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 to-amber-400 px-8 py-12 text-center shadow-sm md:flex md:items-center md:justify-between md:gap-6 md:text-left">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
              Solar Energy
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
              Not sure which solar system you need?
            </h2>
            <p className="mt-2 max-w-xl text-white/90">
              Use our calculator to size the right panels, inverters, and batteries for your home or
              business in minutes.
            </p>
          </div>
          <Link
            to="/solar-calculator"
            className="mt-6 inline-flex flex-none items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-amber-700 transition hover:bg-amber-50 md:mt-0"
          >
            Open the Solar Calculator
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ---------- Small presentational helpers ---------- */

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 border-b border-slate-200 pb-2 text-base font-bold text-slate-900">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center justify-between rounded px-1 py-1 text-left transition ${
          active ? 'font-semibold text-brand-700' : 'text-slate-700 hover:text-brand-700'
        }`}
      >
        <span>{label}</span>
        <span className="text-xs text-slate-400">({count})</span>
      </button>
    </li>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-md text-lg transition ${
        active ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function PageButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function GridCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-center shadow-sm transition hover:shadow-md">
      <Link to={`/product/${product.id}`} className="block aspect-square overflow-hidden p-6">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col items-center gap-2 p-4">
        <StarRating rating={product.rating} />
        <Link
          to={`/product/${product.id}`}
          className="line-clamp-2 font-semibold text-slate-900 hover:text-brand-700"
        >
          {product.name}
        </Link>
        <div className="text-lg font-bold text-brand-700">
          {formatPrice(product.price, product.currency)}
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!product.inStock}
          className="btn-primary mt-2 px-4 py-2 text-sm opacity-0 transition group-hover:opacity-100 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-100"
        >
          {product.inStock ? 'Add to cart' : 'Out of stock'}
        </button>
      </div>
    </div>
  );
}

function ListCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <div className="card flex flex-col gap-4 overflow-hidden p-4 sm:flex-row">
      <Link
        to={`/product/${product.id}`}
        className="block aspect-square w-full flex-none overflow-hidden rounded-lg bg-slate-50 p-4 sm:w-40"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </Link>
      <div className="flex flex-1 flex-col">
        <div className="text-xs uppercase tracking-wide text-slate-500">{product.brand}</div>
        <Link
          to={`/product/${product.id}`}
          className="font-semibold text-slate-900 hover:text-brand-700"
        >
          {product.name}
        </Link>
        <StarRating rating={product.rating} showValue className="mt-1" />
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{product.shortDescription}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="text-lg font-bold text-brand-700">
            {formatPrice(product.price, product.currency)}
          </div>
          <button
            type="button"
            onClick={onAdd}
            disabled={!product.inStock}
            className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {product.inStock ? 'Add to cart' : 'Out of stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
