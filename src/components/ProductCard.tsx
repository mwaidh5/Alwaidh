import { Link } from 'react-router-dom';
import type { Product } from '../types/product';
import { formatPrice } from '../lib/format';
import { useCart } from '../context/CartContext';

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();

  return (
    <div className="card group flex flex-col overflow-hidden">
      <Link to={`/product/${product.id}`} className="block aspect-square overflow-hidden bg-slate-100">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">{product.brand}</div>
        <Link
          to={`/product/${product.id}`}
          className="line-clamp-2 font-semibold text-slate-900 hover:text-brand-700"
        >
          {product.name}
        </Link>
        <p className="line-clamp-2 text-sm text-slate-600">{product.shortDescription}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="text-lg font-bold text-brand-700">
            {formatPrice(product.price, product.currency)}
          </div>
          <button
            type="button"
            onClick={() => add(product.id, 1)}
            disabled={!product.inStock}
            className="btn-primary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {product.inStock ? 'Add to cart' : 'Out of stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
