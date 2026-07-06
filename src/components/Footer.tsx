import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-extrabold text-brand-700">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">A</span>
            <span>Alwaidh</span>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Computers, solar energy solutions, and Tiandy security cameras — all in one shop.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900">Browse</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-brand-700" to="/shop">Shop</Link></li>
            <li><Link className="hover:text-brand-700" to="/solar-prices">Solar Prices</Link></li>
            <li><Link className="hover:text-brand-700" to="/cart">Cart</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900">Support</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-brand-700" to="/about">Contact us</Link></li>
            <li>Shipping &amp; Returns</li>
            <li>Warranty</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-slate-900">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><Link className="hover:text-brand-700" to="/about">About</Link></li>
            <li>Privacy</li>
            <li>Terms</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Alwaidh. All rights reserved.
      </div>
    </footer>
  );
}
