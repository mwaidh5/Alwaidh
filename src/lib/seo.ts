import { useEffect } from 'react';

/**
 * Head management for a client-rendered site: every page declares its
 * title, description, canonical address and structured data, and this
 * hook writes them into <head>. Googlebot renders JavaScript, so these
 * tags are what it indexes — the closest a SPA gets to server rendering
 * without becoming one.
 */

const SITE = 'https://alwaidh.com';
const DEFAULT_IMAGE = `${SITE}/pwa-512.png`;

export interface SeoOptions {
  /** Full document title — write it out, no template magic. */
  title: string;
  description?: string;
  /** Path beginning with '/', used for the canonical and og:url. */
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  /** JSON-LD structured data — an object or several. */
  jsonLd?: object | object[];
  /** Pages that must stay out of the index (tracking links etc). */
  noindex?: boolean;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | null): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string | null): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-seo]`);
  if (href === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    el.setAttribute('data-seo', '');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useSeo(opts: SeoOptions): void {
  const {
    title,
    description,
    path,
    image = DEFAULT_IMAGE,
    type = 'website',
    jsonLd,
    noindex = false,
  } = opts;

  useEffect(() => {
    document.title = title;
    const url = path ? `${SITE}${path}` : undefined;

    if (description) upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : null);
    upsertLink('canonical', url ?? null);

    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description ?? '');
    upsertMeta('property', 'og:type', type === 'product' ? 'website' : type);
    upsertMeta('property', 'og:url', url ?? SITE);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:site_name', 'Alwaidh — الواعظ');
    upsertMeta('name', 'twitter:card', 'summary_large_image');

    let script = document.getElementById('seo-jsonld');
    if (jsonLd) {
      if (!script) {
        script = document.createElement('script');
        script.id = 'seo-jsonld';
        (script as HTMLScriptElement).type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd]);
    } else {
      script?.remove();
    }
  }, [title, description, path, image, type, noindex, JSON.stringify(jsonLd ?? null)]);
}

/** The company card search engines show beside the brand name. */
export function organizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Al-Waidh Technology Trading Co. — شركة الواعظ',
    alternateName: 'Alwaidh — الواعظ للقدرة',
    url: SITE,
    logo: DEFAULT_IMAGE,
    image: DEFAULT_IMAGE,
    telephone: '+964 774 420 5582',
    email: 'support@alwaidh.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Sinaa Street — شارع الصناعة',
      addressLocality: 'Baghdad',
      addressCountry: 'IQ',
    },
    openingHours: 'Sa-Th 08:30-15:30',
    description:
      'منظومات الطاقة الشمسية والحاسبات وكاميرات المراقبة في العراق — تجهيز وتركيب وصيانة منذ 1992. Solar energy systems, computers and Tiandy security cameras in Iraq.',
  };
}
