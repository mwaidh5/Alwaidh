import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../lib/format';
import { createOrder } from '../lib/orderStore';
import { loadSettings, type SiteSettings } from '../lib/settingsStore';

export default function Cart() {
  const { items, productLookup, subtotal, currency, setQuantity, remove, clear, buildOrderLines } =
    useCart();
  const { user } = useAuth();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({
    name: user?.displayName ?? '',
    email: user?.email ?? '',
    phone: '',
    address: '',
    notes: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: f.name || user.displayName || '',
        email: f.email || user.email || '',
      }));
    }
  }, [user]);

  if (confirmation) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">Order placed ✓</h1>
        <p className="mt-2 text-slate-600">
          Order reference: <span className="font-mono">{confirmation.id.slice(0, 8)}</span>
        </p>
        <p className="mt-1 text-slate-600">We'll be in touch shortly to confirm payment & shipping.</p>
        <Link to="/shop" className="btn-primary mt-6 inline-flex">
          Continue shopping
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Your cart is empty</h1>
        <p className="mt-2 text-slate-600">Add a few items to get started.</p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          Continue shopping
        </Link>
      </div>
    );
  }

  const taxRate = (settings?.taxRatePercent ?? 0) / 100;
  const shipping = settings?.shippingFlat ?? 0;
  const tax = subtotal * taxRate;
  const total = subtotal + tax + shipping;

  const checkoutEnabled =
    (settings?.enableCheckout ?? true) && !(settings?.maintenanceMode ?? false);

  async function handlePlaceOrder() {
    setError('');
    if (!form.name.trim() || !form.email.trim()) {
      setError('Please enter your name and email.');
      return;
    }
    setBusy(true);
    try {
      const { lines, subtotal: sub, currency: cur } = buildOrderLines();
      const id = await createOrder({
        customerName: form.name.trim(),
        customerEmail: form.email.trim(),
        customerPhone: form.phone.trim() || undefined,
        shippingAddress: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        lines,
        subtotal: sub,
        currency: cur,
        userUid: user?.uid,
      });
      clear();
      setConfirmation({ id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place order.');
    } finally {
      setBusy(false);
    }
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
                  <Link
                    to={`/product/${product.id}`}
                    className="font-semibold text-slate-900 hover:text-brand-700"
                  >
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
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        className="px-2 py-1"
                        aria-label="Increase"
                      >
                        +
                      </button>
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
          {tax > 0 && (
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-600">Tax ({settings?.taxRatePercent}%)</span>
              <span className="font-semibold">{formatPrice(tax, currency)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-slate-600">Shipping</span>
            <span className="font-semibold">
              {shipping > 0 ? formatPrice(shipping, currency) : 'Free'}
            </span>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4 flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-extrabold text-brand-700">
              {formatPrice(total, currency)}
            </span>
          </div>

          {!checkout ? (
            <>
              <button
                type="button"
                onClick={() => setCheckout(true)}
                disabled={!checkoutEnabled}
                className="btn-primary mt-6 w-full disabled:bg-slate-300"
              >
                {checkoutEnabled ? 'Checkout' : 'Checkout unavailable'}
              </button>
              {!checkoutEnabled && (
                <p className="mt-2 text-xs text-slate-500">
                  Online checkout is currently disabled. Please contact us to place an order.
                </p>
              )}
            </>
          ) : (
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handlePlaceOrder();
              }}
            >
              <input
                className="input"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                type="email"
                className="input"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <textarea
                className="input min-h-[60px]"
                placeholder="Shipping address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <textarea
                className="input min-h-[60px]"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? 'Placing order…' : `Place order · ${formatPrice(total, currency)}`}
              </button>
              <button
                type="button"
                onClick={() => setCheckout(false)}
                className="w-full text-sm text-slate-500 hover:underline"
              >
                Back to cart
              </button>
            </form>
          )}

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
