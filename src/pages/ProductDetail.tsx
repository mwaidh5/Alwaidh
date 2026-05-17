import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProducts } from '../lib/useProducts';
import { getCategory } from '../data/categories';
import { formatPrice } from '../lib/format';
import { useCart } from '../context/CartContext';

export default function ProductDetail() {
  const { id = '' } = useParams();
  const { products, loading } = useProducts();
  const product = products.find((p) => p.id === id);
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (loading) {
    return <p className="container-page py-20 text-center text-slate-500">Loading product…</p>;
  }

  if (!product) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link to="/" className="mt-4 inline-block text-brand-700 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const category = getCategory(product.category);

  function handleAdd() {
    if (!product) return;
    add(product.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="container-page py-10">
      <nav className="mb-6 text-sm text-slate-500">
        <Link to="/" className="hover:text-brand-700">Home</Link>
        <span className="mx-2">/</span>
        {category && (
          <>
            <Link to={`/category/${category.slug}`} className="hover:text-brand-700">
              {category.name}
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-slate-700">{product.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl bg-slate-100">
          <img src={product.image} alt={product.name} className="aspect-square w-full object-cover" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{product.brand}</div>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{product.name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="text-2xl font-bold text-brand-700">
              {formatPrice(product.price, product.currency)}
            </div>
            <div className="text-sm text-slate-500">★ {product.rating.toFixed(1)}</div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {product.inStock ? 'In stock' : 'Out of stock'}
            </span>
          </div>

          <p className="mt-5 text-slate-700">{product.description}</p>

          <div className="mt-6 flex items-center gap-3">
            <div className="inline-flex items-center rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-lg"
                aria-label="Decrease"
              >
                −
              </button>
              <span className="w-10 text-center font-semibold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="px-3 py-2 text-lg"
                aria-label="Increase"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!product.inStock}
              className="btn-primary disabled:bg-slate-300"
            >
              {added ? 'Added ✓' : 'Add to cart'}
            </button>
          </div>

          <div className="mt-8">
            <h2 className="font-semibold text-slate-900">Specifications</h2>
            <dl className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {Object.entries(product.specs).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="col-span-2 text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
