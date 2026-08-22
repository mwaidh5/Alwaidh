import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from './ChatWidget';
import BottomNav from './BottomNav';
import PullToRefresh from './PullToRefresh';

export default function Layout() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <PullToRefresh />
      <Navbar />
      {/* Keyed on the path so every page arrives with the same short slide,
          including one product to the next — where React would otherwise
          reuse the component and the change would just blink. */}
      <main key={location.pathname} className="page-enter flex-1">
        <Outlet />
      </main>
      {/* Phones have the tab bar; a wall of links under it is what a website
          does, not an app. Everything here is still reachable — Shop, Solar
          and Cart from the bar, About and Privacy from the menu. */}
      <div className="hidden md:block">
        <Footer />
      </div>
      <ChatWidget />
      <BottomNav />
      {/* The bar floats over the page, so the end of it needs room to be
          scrolled clear of. */}
      <div aria-hidden className="h-24 md:hidden" />
    </div>
  );
}
