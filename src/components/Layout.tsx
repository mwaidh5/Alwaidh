import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from './ChatWidget';
import BottomNav from './BottomNav';

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
      <BottomNav />
      {/* The bar floats over the page, so the last thing on it needs room
          to be scrolled clear of. */}
      <div aria-hidden className="h-24 md:hidden" />
    </div>
  );
}
