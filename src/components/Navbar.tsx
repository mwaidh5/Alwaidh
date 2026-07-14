import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../lib/useProducts';
import { useSettings } from '../lib/useSettings';
import { formatPrice } from '../lib/format';

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop' },
  { to: '/solar-prices', label: 'Solar Prices' },
  { to: '/about', label: 'About' },
];

export default function Navbar() {
  const { itemCount } = useCart();
  const { user, isAdmin, signOut } = useAuth();
  const { products } = useProducts();
  const settings = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Close the mobile menu whenever the route changes.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  // Close the Projects/Search popovers when clicking outside them.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(t)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Focus the search field when the popover opens.
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  const results = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [searchQuery, products]);

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (results[0]) {
      navigate(`/product/${results[0].id}`);
      closeSearch();
    } else {
      navigate('/shop');
      closeSearch();
    }
  }

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
          <Link to="/" className="flex min-w-0 items-center gap-2 font-extrabold text-brand-700">
            {settings.logoImage ? (
              <img src={settings.logoImage} alt={settings.storeName || 'Alwaidh'} className="h-9 w-auto" />
            ) : (
              <>
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-brand-600 text-white">A</span>
                <span className="truncate text-lg tracking-tight">{settings.storeName || 'Alwaidh'}</span>
              </>
            )}
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {/* Search (icon only) */}
          <div className="relative" ref={searchRef}>
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
              aria-label="Search products"
              aria-expanded={searchOpen}
            >
              <SearchIcon />
            </button>
            {searchOpen && (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <form onSubmit={handleSearchSubmit}>
                  <input
                    ref={searchInput}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products…"
                    className="input"
                  />
                </form>
                <div className="mt-2 max-h-80 overflow-y-auto">
                  {searchQuery.trim() === '' ? (
                    <p className="px-1 py-3 text-sm text-slate-500">Type to search products.</p>
                  ) : results.length === 0 ? (
                    <p className="px-1 py-3 text-sm text-slate-500">No products found.</p>
                  ) : (
                    <ul className="space-y-1">
                      {results.map((p) => (
                        <li key={p.id}>
                          <Link
                            to={`/product/${p.id}`}
                            onClick={closeSearch}
                            className="flex items-center gap-3 rounded-md p-2 hover:bg-slate-50"
                          >
                            <img
                              src={p.image}
                              alt=""
                              className="h-10 w-10 flex-none rounded object-cover"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">
                                {p.name}
                              </span>
                              <span className="text-xs text-slate-500">{p.brand}</span>
                            </span>
                            <span className="flex-none text-sm font-semibold text-brand-700">
                              {formatPrice(p.price, p.currency)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Link
                  to="/shop"
                  onClick={closeSearch}
                  className="mt-2 block rounded-md border-t border-slate-100 px-1 pt-3 text-center text-sm font-semibold text-brand-700 hover:underline"
                >
                  Browse all products →
                </Link>
              </div>
            )}
          </div>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-slate-300 bg-white py-1 pl-1 pr-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-7 w-7 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="hidden sm:inline">
                  {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                  role="menu"
                >
                  <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                    Signed in as
                    <div className="truncate font-semibold text-slate-800">{user.email}</div>
                  </div>
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    role="menuitem"
                  >
                    My account & orders
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      role="menuitem"
                    >
                      Admin dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              aria-label="Sign in"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:px-3"
            >
              <UserIcon />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}

          <Link
            to="/cart"
            className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:px-3"
            aria-label="Cart"
          >
            <span className="hidden sm:inline">Cart</span>
            <CartIcon className="sm:hidden" />
            <span className="grid min-w-[1.5rem] place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
              {itemCount}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-slate-200 bg-white md:hidden">
          <div className="container-page space-y-1 py-3">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                Admin
              </NavLink>
            )}
            {user ? (
              <Link
                to="/account"
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                My account &amp; orders
              </Link>
            ) : (
              <Link
                to="/login"
                className="block rounded-md bg-brand-600 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}

function CartIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21.5 7H6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
