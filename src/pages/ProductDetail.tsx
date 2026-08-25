import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProducts } from '../lib/useProducts';
import { getCategory } from '../data/categories';
import { discountPercent, formatPrice } from '../lib/format';
import { publicUrl, shareLink } from '../lib/share';
import { useCart } from '../context/CartContext';
import { useLang } from '../lib/i18n';
import { pName, pDesc, specLabel } from '../lib/localizeProduct';
import { brandedFileUrl } from '../lib/brandedFiles';
import { specRowsOf, StaffProductEdit } from '../components/ProductEditor';
import ProductCard from '../components/ProductCard';
import PdfView from '../components/PdfView';
import type { Product } from '../types/product';

export default function ProductDetail() {
  const { id = '' } = useParams();
  const { products, loading } = useProducts();
  const product = products.find((p) => p.id === id);
  const { add } = useCart();
  const { t, lang } = useLang();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  if (loading) {
    return <p className="container-page py-20 text-center text-slate-500">{t('Loading product…')}</p>;
  }

  if (!product) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-2xl font-bold">{t('Product not found')}</h1>
        <Link to="/" className="mt-4 inline-block text-brand-700 hover:underline">
          {t('Back to home')}
        </Link>
      </div>
    );
  }

  const category = getCategory(product.category);
  const gallery = product.images?.length ? product.images : product.image ? [product.image] : [];
  const related = relatedProducts(product, products);
  const off = discountPercent(product.price, product.oldPrice);
  // Product photos are rarely square, so showing the whole picture is the
  // sensible default; filling the frame crops it, which is what made some
  // look zoomed in.
  const fitClass = product.imageFit === 'cover' ? 'object-cover' : 'object-contain';

  function handleAdd() {
    if (!product) return;
    add(product.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="container-page py-10">
      <nav className="mb-6 text-sm text-slate-500">
        <Link to="/" className="hover:text-brand-700">{t('Home')}</Link>
        <span className="mx-2">/</span>
        {category && (
          <>
            <Link to={`/shop?category=${category.slug}`} className="hover:text-brand-700">
              {t(category.name)}
            </Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-slate-700">{pName(product, lang)}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl bg-slate-100">
            {off > 0 && (
              <span className="absolute left-3 top-3 z-10 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                −{off}%
              </span>
            )}
            <img
              src={gallery[activeImage] ?? product.image}
              alt={product.name}
              className={`aspect-square w-full ${fitClass} ${
                product.imageFit === 'cover' ? '' : 'p-4'
              }`}
            />
          </div>
          {gallery.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {gallery.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 transition ${
                    i === activeImage ? 'border-brand-600' : 'border-transparent hover:border-slate-300'
                  }`}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={img} alt="" className={`h-full w-full ${fitClass}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">{product.brand}</div>
            <StaffProductEdit product={product} />
          </div>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{pName(product, lang)}</h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold text-brand-700">
                {formatPrice(product.price, product.currency)}
              </span>
              {off > 0 && (
                <span className="text-base text-slate-400 line-through">
                  {formatPrice(product.oldPrice as number, product.currency)}
                </span>
              )}
            </div>
            {off > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {t('You save')} {off}%
              </span>
            )}
            {product.rating > 0 && (
              <div className="text-sm text-slate-500">★ {product.rating.toFixed(1)}</div>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                product.inStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {t(product.inStock ? 'In stock' : 'Out of stock')}
            </span>
          </div>

          <p className="mt-5 text-slate-700">{pDesc(product, lang)}</p>

          <div className="mt-6 flex items-center gap-3">
            <div className="inline-flex items-center rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-lg"
                aria-label="Decrease"
              >
                −
              </button>
              <span className="w-10 text-center font-semibold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="px-3 py-2 text-lg"
                aria-label="Increase"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!product.inStock}
              className="btn-primary disabled:bg-slate-300"
            >
              {added ? t('Added ✓') : t('Add to cart')}
            </button>
            <ShareButton product={product} />
          </div>

          <div className="mt-8">
            <h2 className="font-semibold text-slate-900">{t('Specifications')}</h2>
            <dl className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {/* In the order staff typed them — see specRowsOf. */}
              {specRowsOf(product).map((row, i) => (
                <div key={`${row.name}-${i}`} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
                  <dt className="text-slate-500">{specLabel(row.name, lang)}</dt>
                  <dd className="col-span-2 text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {product.manual && (
            <div className="mt-6">
              <a
                href={brandedFileUrl(product.manual)}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary inline-flex items-center gap-2"
              >
                📄 {t('Download manual (PDF)')}
              </a>
            </div>
          )}
        </div>
      </div>

      {product.datasheet && <DatasheetSection url={product.datasheet} />}

      {related.length > 0 && (
        <section className="mt-14 border-t border-slate-200 pt-10">
          <h2 className="text-xl font-bold text-slate-900">{t('You may also like')}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Up to four products worth suggesting, closest match first: same
 * sub-category beats same category, and the same brand breaks ties. A
 * product with nothing in common with anything is left alone rather than
 * padded out with unrelated stock.
 */
function relatedProducts(current: Product, all: Product[]): Product[] {
  const subs = new Set(current.subcategories ?? []);
  const score = (p: Product) =>
    (p.category === current.category ? 4 : 0) +
    ((p.subcategories ?? []).some((s) => subs.has(s)) ? 2 : 0) +
    (p.brand === current.brand ? 1 : 0);
  return all
    .filter((p) => p.id !== current.id)
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map((x) => x.p);
}

/**
 * Send this product to someone. On a phone that's the usual share sheet —
 * WhatsApp, Messages, anything installed; everywhere else the link is
 * copied, and the button says so.
 */
function ShareButton({ product }: { product: Product }) {
  const { t } = useLang();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleShare() {
    const url = publicUrl(`/product/${product.id}`);
    const outcome = await shareLink({
      title: product.name,
      text: `${product.name} — ${formatPrice(product.price, product.currency)}`,
      url,
    });
    setState(outcome === 'shared' ? 'idle' : outcome === 'copied' ? 'copied' : 'failed');
    if (outcome !== 'shared') setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="btn-secondary inline-flex items-center gap-1.5"
      title={t('Share this product')}
    >
      {state === 'copied' ? (
        t('Link copied ✓')
      ) : state === 'failed' ? (
        t('Could not copy')
      ) : (
        <>
          <span aria-hidden>🔗</span> {t('Share')}
        </>
      )}
    </button>
  );
}

function DatasheetSection({ url }: { url: string }) {
  const { t } = useLang();
  const isPdf = /\.pdf(\?|$)/i.test(safeDecode(url));
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">{t('Datasheet')}</h2>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          {t('Open in new tab ↗')}
        </a>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {isPdf ? (
          <PdfView url={url} />
        ) : (
          <img src={url} alt="Product datasheet" className="w-full" loading="lazy" />
        )}
      </div>
    </section>
  );
}

function safeDecode(u: string): string {
  try {
    return decodeURIComponent(u);
  } catch {
    return u;
  }
}
