import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../lib/useProducts';
import { useSettings } from '../lib/useSettings';
import { formatPrice } from '../lib/format';

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop' },
  { to: '/solar-calculator', label: 'Solar Calculator' },
  { to: '/about', label: 'About' },
];

// Projects dropdown items — add more project types here later.
const projectLinks = [{ to: '/projects/solar', label: 'Solar Energy Projects' }];

export default function Navbar() {
  const { itemCount } = useCart();
  const { user, isAdmin, signOut } = useAuth();
  const { products } = useProducts();
  const settings = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const projectsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  // Close the Projects/Search popovers when clicking outside them.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (projectsRef.current && !projectsRef.current.contains(t)) setProjectsOpen(false);
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
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-extrabold text-brand-700">
          {settings.logoImage ? (
            <img src={settings.logoImage} alt={settings.storeName || 'Alwaidh'} className="h-9 w-auto" />
          ) : (
            <>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">A</span>
              <span className="text-lg tracking-tight">{settings.storeName || 'Alwaidh'}</span>
            </>
          )}
        </Link>

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

          {/* Projects dropdown */}
          <div className="relative" ref={projectsRef}>
            <button
              type="button"
              onClick={() => setProjectsOpen((o) => !o)}
              className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              aria-haspopup="menu"
              aria-expanded={projectsOpen}
            >
              Projects
              <ChevronDown className={`transition ${projectsOpen ? 'rotate-180' : ''}`} />
            </button>
            {projectsOpen && (
              <div
                className="absolute left-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
                role="menu"
              >
                {projectLinks.map((p) => (
                  <Link
                    key={p.to}
                    to={p.to}
                    onClick={() => setProjectsOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    role="menuitem"
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

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
              className="hidden sm:inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Sign in
            </Link>
          )}

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
      </div>
    </header>
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

function ChevronDown({ className = '' }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
