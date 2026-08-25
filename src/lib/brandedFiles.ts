/**
 * The address a file is shared under: alwaidh.com/f/<path> instead of the
 * firebasestorage URL with its token. A hosting rewrite hands /f/** to the
 * serveFile function, which streams the object with its real content type
 * — so the link ends in .pdf and previews like a document in messaging
 * apps. URLs that aren't Firebase Storage pass through unchanged.
 */
const SITE = 'https://alwaidh.com';

export function brandedFileUrl(url: string): string {
  const m = /firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/.exec(url);
  if (!m) return url;
  try {
    const path = decodeURIComponent(m[1]);
    return `${SITE}/f/${path.split('/').map(encodeURIComponent).join('/')}`;
  } catch {
    return url;
  }
}
