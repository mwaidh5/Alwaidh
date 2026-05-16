import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/format';

export default function Cart() {
  const { items, productLookup, subtotal, currency, setQuantity, remove, clear } = useCart();

  if (items.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Your cart is empty</h1>
        <p className="mt-2 text-slate-600">Add a few items to get started.</p>
        <Link to="/" className="btn-primary mt-6 inline-flex">Continue shopping</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-extrabold text-slate-900">Your cart</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr,360px]">
        <div className="card divide-y divide-slate-200">
          {items.map((item) => {
            const product = productLookup[item.productId];
            if (!product) return null;
            return (
              <div key={item.productId} className="flex gap-4 p-4">
                <Link
                  to={`/product/${product.id}`}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100"
                >
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                </Link>
                <div className="flex-1">
                  <Link to={`/product/${product.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                    {product.name}
                  </Link>
                  <div className="text-xs text-slate-500">{product.brand}</div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="inline-flex items-center rounded-md border border-slate-300">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                        className="px-2 py-1"
                        aria-label="Decrease"
                      >−</button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        className="px-2 py-1"
                        aria-label="Increase"
                      >+</button>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(item.productId)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-700">
                    {formatPrice(product.price * item.quantity, product.currency)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatPrice(product.price, product.currency)} each
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="card h-fit p-6">
          <h2 className="font-semibold text-slate-900">Order summary</h2>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-semibold">{formatPrice(subtotal, currency)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-slate-600">Shipping</span>
            <span className="text-slate-500">Calculated at checkout</span>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4 flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-extrabold text-brand-700">
              {formatPrice(subtotal, currency)}
            </span>
          </div>
          <button type="button" className="btn-primary mt-6 w-full">
            Checkout
          </button>
          <button
            type="button"
            onClick={clear}
            className="mt-3 w-full text-sm text-slate-500 hover:text-red-600"
          >
            Clear cart
          </button>
        </aside>
      </div>
    </div>
  );
}
