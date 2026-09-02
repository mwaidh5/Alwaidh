import { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from './ChatWidget';
import BottomNav from './BottomNav';
import PullToRefresh from './PullToRefresh';
import MobileDrawer from './MobileDrawer';
import LanguageGate from './LanguageGate';
import { trackPageView } from '../lib/ga';
import { closeDrawer, useDrawerOpen } from '../lib/drawer';
import { enablePush, handlePushTaps, isNativeApp, pushState, syncSubscriptions } from '../lib/push';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../lib/i18n';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, realIsAdmin, isComputerStaff, isSolarStaff, isShopManager, isInstaller } = useAuth();

  // A tapped browser notification: the service worker asks the running
  // app to route, which keeps the session and lands on the right screen
  // even when the tab was showing something else.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const link = (e.data as { type?: string; link?: string } | null)?.type === 'alwaidh:navigate'
        ? (e.data as { link?: string }).link
        : null;
      if (link && link.startsWith('/')) navigate(link);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A tapped notification opens its page — armed here, in the shell that
  // exists from the first frame, so even a tap that cold-starts the app
  // finds someone listening.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    handlePushTaps((path) => navigate(path)).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const navType = useNavigationType();
  const drawerOpen = useDrawerOpen();
  const { dir } = useLang();
  // The card look has to OUTLIVE the open state: dropping the shadow,
  // radius and stacking order the instant the drawer closes hides the
  // page behind the menu for the whole return journey — which reads as a
  // teleport. So the decoration stays until the slide back has finished.
  const [settling, setSettling] = useState(false);
  // The wrapper is the whole document tall, so scaling it about its own
  // middle throws the card far from what the visitor was looking at. The
  // correction is baked into the transform itself, as a translateY that
  // re-centres the visible slice: Safari keeps compositing with the old
  // origin when only transform-origin changes and the transform string
  // stays the same, which left iPhones showing the bug the origin fix
  // was meant to cure. Computed in a layout effect so the very first
  // painted frame of the slide is already aimed true.
  // top/bottom describe the viewport slice of the document, so the card
  // can be clipped to a real, bounded, rounded rectangle — without the
  // clip it ran off the bottom of the screen as an endless slab. With
  // the lift, the slice lands with identical margins above and below:
  // lift - 0.14·scrollY = 0.07·viewport, whatever the scroll.
  const [cardBox, setCardBox] = useState({ lift: 0, top: 0, bottom: 0, frameM: 0, vw: 0, vh: 0 });
  useLayoutEffect(() => {
    if (drawerOpen) {
      const y = Math.max(0, window.scrollY);
      const vh = window.innerHeight;
      const docH = document.documentElement.scrollHeight;
      // At the top of the page the slice would open on the blank strip
      // above the site header (the phone's status-bar padding) — start
      // the frame at the header instead, and re-centre the shorter card.
      const header = document.querySelector('header');
      const headerTop = header ? Math.max(0, header.getBoundingClientRect().top + y) : 0;
      const sliceTop = Math.min(Math.max(y, headerTop), y + Math.round(vh * 0.25));
      const sliceH = y + vh - sliceTop;
      const marginTop = (vh - sliceH * 0.86) / 2;
      setCardBox({
        lift: Math.round(marginTop + y - sliceTop * 0.86),
        top: Math.round(y),
        bottom: Math.max(0, Math.round(docH - y - vh)),
        frameM: Math.round(marginTop),
        vw: window.innerWidth,
        vh,
      });
    }
  }, [drawerOpen]);

  // The card's picture frame, cut in the UNTRANSFORMED wrapper: iOS
  // Safari quietly drops a clip-path that sits on the same element as an
  // animated transform, which is why phones kept seeing an endless slab
  // where emulation showed a card. The frame hugs the card's on-screen
  // rect — top/bottom at 7% of the viewport, the open side at the card's
  // visible edge (37% across) — and both the clip and the transform
  // animate with the same curve, so the frame tracks the card exactly
  // on the way home.
  const frame = (() => {
    if (!drawerOpen && !settling) return undefined;
    const { top, bottom, frameM, vw } = cardBox;
    if (!vw) return undefined;
    const side = Math.round(vw * 0.63);
    const open = drawerOpen;
    const t = open ? top + frameM : top;
    const b = open ? bottom + frameM : bottom;
    const inner = open ? side : 0;
    const [right, left] = dir === 'rtl' ? [inner, 0] : [0, inner];
    return {
      clipPath: `inset(${t}px ${right}px ${b}px ${left}px round ${open ? 24 : 0}px)`,
      transition: 'clip-path 500ms cubic-bezier(.32,.72,0,1)',
      // The clip makes this wrapper its own stacking layer, which would
      // fall behind the fixed drawer — lift the whole framed card above.
      position: 'relative' as const,
      zIndex: 40,
    } as const;
  })();
  useEffect(() => {
    if (drawerOpen) {
      setSettling(false);
      return;
    }
    setSettling(true);
    const id = window.setTimeout(() => setSettling(false), 560);
    return () => window.clearTimeout(id);
  }, [drawerOpen]);

  // iPhone, Arabic: the slid-out card adds scrollable space on the left,
  // and in RTL that side is reachable — Safari drifted the page into it,
  // parking the card back over the menu. The clip wrapper below removes
  // the overflow at the source; this pins the root scroller too, for
  // Safari versions that ignore the clip.
  useEffect(() => {
    if (!drawerOpen && !settling) return;
    const html = document.documentElement;
    const prev = html.style.overflowX;
    html.style.overflowX = 'hidden';
    window.scrollTo({ left: 0 });
    return () => {
      html.style.overflowX = prev;
    };
  }, [drawerOpen, settling]);

  // Open a new page and start at the top of it — otherwise tapping Shop
  // halfway down the homepage drops you halfway down the shop. Going back
  // is left alone: that is where a page restores the place you left, and
  // the shop does exactly that.
  useEffect(() => {
    if (navType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, navType]);

  // Every new install of the app asks once for notification permission,
  // a moment after the first screen settles — before any sign-in, so the
  // device is ready the day its owner becomes staff (or we have news).
  useEffect(() => {
    try {
      if (!isNativeApp() || localStorage.getItem('alwaidh.pushAsked.v1')) return;
      localStorage.setItem('alwaidh.pushAsked.v1', '1');
    } catch {
      return;
    }
    const id = window.setTimeout(() => {
      enablePush({ isAdmin: false, isComputerStaff: false, isSolarStaff: false }, null).catch(
        () => undefined,
      );
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);

  // The boot screen from index.html has done its job the moment this
  // layout is on screen — fade it and take it out of the tree.
  useEffect(() => {
    const el = document.getElementById('boot');
    if (!el) return;
    el.classList.add('done');
    const id = window.setTimeout(() => el.remove(), 450);
    return () => window.clearTimeout(id);
  }, []);

  // Staff phones keep their notification topics in step from ANY page —
  // waiting for a dashboard visit left phones deaf to the new per-person
  // topics for days after the notification rework.
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    (async () => {
      if ((await pushState()) !== 'granted' || cancelled) return;
      syncSubscriptions(
        {
          isAdmin: realIsAdmin,
          isComputerStaff,
          isSolarStaff,
          isShopManager,
          isInstaller,
        },
        user.email ?? null,
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, realIsAdmin, isComputerStaff, isSolarStaff, isShopManager, isInstaller]);

  // Every screen the visitor lands on reaches Google Analytics.
  useEffect(() => {
    trackPageView(location.pathname, document.title);
  }, [location.pathname]);

  // The menu reveal: the whole page slides aside and shrinks into a card,
  // and the drawer is simply what was underneath. The transform makes this
  // wrapper the anchor for every fixed child — tab bar, chat bubble — so
  // they shrink with the page, which is exactly the effect.
  //
  // 56%, not more: the point is a CARD beside the menu, a third of the
  // screen of it still showing — slide further and all that's left is a
  // sliver, which reads as a plain side drawer. The menu labels sit in
  // the far 58% of the panel, so this much card never covers a word.
  const slide = dir === 'rtl' ? '-56%' : '56%';
  return (
    <>
      <LanguageGate />
      <MobileDrawer />
      {/* overflow-x: clip (not hidden — hidden would make this a scroll
          container and kill the sticky header) keeps the slid-out card
          from widening the page: without it, RTL iOS can scroll into the
          card's off-screen side. */}
      <div className="drawer-frame" style={{ overflowX: 'clip', ...frame }}>
      <div
        className="drawer-card flex min-h-screen flex-col bg-white transition-transform duration-500 [transition-timing-function:cubic-bezier(.32,.72,0,1)]"
        style={
          drawerOpen || settling
            ? {
                transform: drawerOpen
                  ? `translateX(${slide}) translateY(${cardBox.lift}px) scale(.86)`
                  : 'translateX(0) translateY(0) scale(1)',
                // Scale hangs from the top edge; the lift above brings the
                // on-screen part of the page back into view.
                transformOrigin: '50% 0',
                overflow: 'hidden',
                boxShadow: drawerOpen ? '0 24px 70px rgba(2,6,23,.5)' : '0 0 0 rgba(2,6,23,0)',
                // Above the drawer layer, or the menu's full-screen
                // background paints over the card and the page vanishes
                // entirely — the whole point is the glimpse of it.
                position: 'relative',
                zIndex: 40,
                // Keep Safari holding the page on one compositor layer for
                // the whole ride — re-rasterizing mid-slide is the white
                // flicker iPhones sometimes show, worst with Arabic fonts.
                willChange: 'transform',
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
      </div>
    </>
  );
}
