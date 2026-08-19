/**
 * The shop's own address. Links are always built on this, because the app
 * and the older hosting address both serve the same site — a customer
 * shouldn't be sent a link that reads "alwaidh-baeb5.web.app".
 */
export const SITE_ORIGIN = 'https://alwaidh.com';

/** The public link for a page. Local development keeps its own address so
 *  links can still be opened while testing. */
export function publicUrl(path: string): string {
  const { hostname, origin } = window.location;
  const local = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(hostname);
  return `${local ? origin : SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/**
 * Hand a link to the phone's share sheet (WhatsApp, Messages, …). Where
 * that isn't available — desktop browsers, and the Android webview — the
 * link is copied instead, which is the same job in two taps.
 *
 * Must be called straight from a tap: browsers only allow sharing, and
 * some only allow copying, while a user gesture is still in effect.
 */
export async function shareLink(input: {
  title: string;
  text?: string;
  url: string;
}): Promise<ShareOutcome> {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  const data = { title: input.title, text: input.text, url: input.url };
  if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (e) {
      // Closing the share sheet isn't a failure — don't then copy behind
      // the person's back, or tell them something went wrong.
      if ((e as { name?: string })?.name === 'AbortError') return 'shared';
      /* anything else: fall through to copying */
    }
  }
  return (await copyText(input.url)) ? 'copied' : 'failed';
}

/** Copy text, falling back to the old selection trick where the clipboard
 *  API is unavailable (older webviews, and any page not served over https). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* not permitted here — try the fallback below */
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}
