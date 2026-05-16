import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { categories } from '../data/categories';

export default function Navbar() {
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-brand-700">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">A</span>
          <span className="text-lg tracking-tight">Alwaidh</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/shop"
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            Shop
          </NavLink>
          <span className="mx-2 h-5 w-px bg-slate-200" aria-hidden="true" />
          {categories.map((c) => (
            <NavLink
              key={c.slug}
              to={`/category/${c.slug}`}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {c.name}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/cart"
          className="relative inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          aria-label="Cart"
        >
          <span>Cart</span>
          <span className="grid min-w-[1.5rem] place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
            {itemCount}
          </span>
        </Link>
      </div>
    </header>
  );
}
