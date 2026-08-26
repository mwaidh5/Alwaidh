import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics';
import { firebaseApp } from '../firebase';

/**
 * Google Analytics, finally switched on. The Firebase project has carried
 * a measurement id all along, but nothing ever initialised Analytics —
 * which is why GA sat reporting "no data received". Page views are logged
 * on every route change; events only leave production builds, so local
 * work never muddies the numbers.
 */
let analytics: Analytics | null = null;
let ready: Promise<void> | null = null;

function init(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    if (!import.meta.env.PROD || !firebaseApp) return;
    try {
      // Some webviews and private windows refuse analytics storage.
      if (await isSupported()) analytics = getAnalytics(firebaseApp);
    } catch {
      analytics = null;
    }
  })();
  return ready;
}

export async function trackPageView(path: string, title: string): Promise<void> {
  await init();
  if (!analytics) return;
  logEvent(analytics, 'page_view', {
    page_path: path,
    page_title: title,
    page_location: `https://alwaidh.com${path}`,
  });
}
