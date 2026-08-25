// Builds public/sitemap.xml before every build: the fixed pages, every
// product, and every published article — fetched over Firestore's public
// REST endpoints, which the security rules already allow. Offline (or on
// any error) it still writes the fixed pages, so a build never fails for
// want of a sitemap.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITE = 'https://alwaidh.com';
const PROJECT = 'alwaidh-baeb5';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml');

const urls = [
  { loc: '/', priority: '1.0' },
  { loc: '/solar-prices', priority: '0.9' },
  { loc: '/shop', priority: '0.9' },
  { loc: '/blog', priority: '0.8' },
  { loc: '/about', priority: '0.6' },
];

async function fetchJson(url, body) {
  const res = await fetch(url, body ? { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : undefined);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

try {
  const data = await fetchJson(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/products?pageSize=300&mask.fieldPaths=draft`,
  );
  for (const d of data.documents ?? []) {
    if (d.fields?.draft?.booleanValue) continue;
    if (d.fields?.deletedAt) continue;
    urls.push({ loc: `/product/${d.name.split('/').pop()}`, priority: '0.7' });
  }
} catch (e) {
  console.warn('[sitemap] products skipped:', e.message);
}

try {
  const data = await fetchJson(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
    {
      structuredQuery: {
        from: [{ collectionId: 'blogPosts' }],
        where: {
          fieldFilter: { field: { fieldPath: 'published' }, op: 'EQUAL', value: { booleanValue: true } },
        },
      },
    },
  );
  for (const row of data ?? []) {
    const slug = row.document?.fields?.slug?.stringValue;
    if (slug) urls.push({ loc: `/blog/${slug}`, priority: '0.8' });
  }
} catch (e) {
  console.warn('[sitemap] blog skipped:', e.message);
}

const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${SITE}${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`;
writeFileSync(OUT, xml);
console.log(`[sitemap] ${urls.length} urls -> public/sitemap.xml`);
