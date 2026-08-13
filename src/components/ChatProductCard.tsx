import { Link } from 'react-router-dom';
import { formatPrice } from '../lib/format';
import { useLang } from '../lib/i18n';
import type { ChatProductCard as Card } from '../lib/chatStore';

/**
 * A product shared inside a chat message. In the visitor's panel it's a
 * link straight to the product page; for staff it opens in a new tab so
 * they don't lose the conversation.
 */
export default function ChatProductCard({
  product,
  newTab = false,
  onOpen,
}: {
  product: Card;
  newTab?: boolean;
  onOpen?: () => void;
}) {
  const { t } = useLang();
  const inner = (
    <>
      <span className="h-14 w-14 flex-none overflow-hidden rounded-lg bg-slate-100">
        {product.image && (
          <img src={product.image} alt="" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-xs font-bold text-slate-900">{product.name}</span>
        <span className="mt-0.5 block text-sm font-bold text-brand-700">
          {formatPrice(product.price, product.currency)}
        </span>
        <span className="mt-0.5 block text-[11px] font-semibold text-brand-700 underline">
          {t('View product')} →
        </span>
      </span>
    </>
  );

  const className =
    'mt-1.5 flex w-56 max-w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-brand-300 hover:shadow';

  if (newTab) {
    return (
      <a href={`/product/${product.id}`} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={`/product/${product.id}`} onClick={onOpen} className={className}>
      {inner}
    </Link>
  );
}
