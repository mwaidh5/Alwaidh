import { Link } from 'react-router-dom';
import type { Product } from '../types/product';
import { discountPercent, formatPrice } from '../lib/format';
import { useCart } from '../context/CartContext';
import { useLang } from '../lib/i18n';

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { t } = useLang();
  const off = discountPercent(product.price, product.oldPrice);

  return (
    <div className="card group relative flex flex-col overflow-hidden">
      {off > 0 && (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
          −{off}%
        </span>
      )}
      <Link to={`/product/${product.id}`} className="block aspect-square overflow-hidden bg-slate-100">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">{product.brand}</div>
        <Link
          to={`/product/${product.id}`}
          className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 hover:text-brand-700 sm:text-base"
        >
          {product.name}
        </Link>
        <p className="line-clamp-2 hidden text-sm text-slate-600 sm:block">{product.shortDescription}</p>
        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between sm:pt-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-bold text-brand-700 sm:text-lg">
              {formatPrice(product.price, product.currency)}
            </span>
            {off > 0 && (
              <span className="text-xs text-slate-400 line-through">
                {formatPrice(product.oldPrice as number, product.currency)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => add(product.id, 1)}
            disabled={!product.inStock}
            className="btn-primary w-full px-3 py-2 text-xs disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto sm:text-sm"
          >
            {t(product.inStock ? 'Add to cart' : 'Out of stock')}
          </button>
        </div>
      </div>
    </div>
  );
}
