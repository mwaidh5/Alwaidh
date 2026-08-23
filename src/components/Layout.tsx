import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from './ChatWidget';
import BottomNav from './BottomNav';
import PullToRefresh from './PullToRefresh';
import MobileDrawer from './MobileDrawer';
import { closeDrawer, useDrawerOpen } from '../lib/drawer';
import { useLang } from '../lib/i18n';

export default function Layout() {
  const location = useLocation();
  const navType = useNavigationType();
  const drawerOpen = useDrawerOpen();
  const { dir } = useLang();
  // The card look has to OUTLIVE the open state: dropping the shadow,
  // radius and stacking order the instant the drawer closes hides the
  // page behind the menu for the whole return journey — which reads as a
  // teleport. So the decoration stays until the slide back has finished.
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    if (drawerOpen) {
      setSettling(false);
      return;
    }
    setSettling(true);
    const id = window.setTimeout(() => setSettling(false), 560);
    return () => window.clearTimeout(id);
  }, [drawerOpen]);

  // Open a new page and start at the top of it — otherwise tapping Shop
  // halfway down the homepage drops you halfway down the shop. Going back
  // is left alone: that is where a page restores the place you left, and
  // the shop does exactly that.
  useEffect(() => {
    if (navType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, navType]);

  // The menu reveal: the whole page slides aside and shrinks into a card,
  // and the drawer is simply what was underneath. The transform makes this
  // wrapper the anchor for every fixed child — tab bar, chat bubble — so
  // they shrink with the page, which is exactly the effect.
  const slide = dir === 'rtl' ? '-72%' : '72%';
  return (
    <>
      <MobileDrawer />
      <div
        className="flex min-h-screen flex-col bg-white transition-transform duration-500 [transition-timing-function:cubic-bezier(.32,.72,.28,1)]"
        style={
          drawerOpen || settling
            ? {
                transform: drawerOpen ? `translateX(${slide}) scale(.86)` : 'translateX(0) scale(1)',
                borderRadius: drawerOpen ? 24 : 0,
                overflow: 'hidden',
                boxShadow: drawerOpen ? '0 24px 70px rgba(2,6,23,.5)' : '0 0 0 rgba(2,6,23,0)',
                // Above the drawer layer, or the menu's full-screen
                // background paints over the card and the page vanishes
                // entirely — the whole point is the glimpse of it.
                position: 'relative',
                zIndex: 40,
              }
            : undefined
        }
      >
        {drawerOpen && (
          // While it's a card, the page is a picture of itself: one tap
          // anywhere on it closes the menu.
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeDrawer}
            className="absolute inset-0 z-50"
            style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
          />
        )}
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
    </>
  );
}
