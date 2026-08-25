import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrder, ORDER_STATUSES, type Order, type OrderStatus } from '../lib/orderStore';
import { formatPrice } from '../lib/format';
import { useLang } from '../lib/i18n';
import { openChat } from '../lib/chatPanel';
import { useSeo } from '../lib/seo';

/**
 * Where an order stands, for the person who placed it. The link is a
 * capability: the order id is the unguessable Firestore id from the
 * confirmation email, the same model as a courier's tracking number.
 */

const STEPS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: 'pending', label: 'Order received', icon: '🧾' },
  { key: 'paid', label: 'Payment confirmed', icon: '💳' },
  { key: 'shipped', label: 'On its way', icon: '🚚' },
  { key: 'delivered', label: 'Delivered', icon: '📦' },
];

export default function Track() {
  const { id = '' } = useParams();
  const { t, lang } = useLang();
  const [order, setOrder] = useState<Order | null | 'missing'>(null);
  useSeo({ title: 'Order tracking — Alwaidh', noindex: true });

  useEffect(() => {
    let cancelled = false;
    getOrder(id)
      .then((o) => {
        if (!cancelled) setOrder(o ?? 'missing');
      })
      .catch(() => {
        if (!cancelled) setOrder('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (order === null) {
    return (
      <div className="container-page py-24 text-center text-slate-500">{t('Loading…')}</div>
    );
  }
  if (order === 'missing') {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('Order not found')}</h1>
        <p className="mt-2 text-slate-600">
          {t('Check the link from your confirmation email, or ask us in the chat.')}
        </p>
        <button type="button" onClick={() => openChat()} className="btn-primary mt-6">
          {t('Talk to us')}
        </button>
      </div>
    );
  }

  const cancelled = order.status === 'cancelled';
  const stepIndex = cancelled ? -1 : ORDER_STATUSES.indexOf(order.status);
  const placed = new Date(order.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page max-w-3xl">
        <div className="mb-6">
          <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-xs font-bold tracking-wide text-brand-700">
            {t('Order tracking')}
          </span>
          <h1 className="mb-1 mt-3 text-3xl font-black tracking-tight text-slate-900">
            {t('Hello')} {order.customerName.split(' ')[0] || ''} 👋
          </h1>
          <p className="text-sm text-slate-500">
            {t('Order reference')}: <span dir="ltr" className="font-mono font-bold text-slate-700">{order.id.slice(0, 8).toUpperCase()}</span> · {placed}
          </p>
        </div>

        {cancelled ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">
            {t('This order was cancelled. If that is a surprise, talk to us and we will sort it out.')}
          </div>
        ) : (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
            <ol className="grid gap-0 sm:grid-cols-4">
              {STEPS.map((s, i) => {
                const done = i <= stepIndex;
                const current = i === stepIndex;
                return (
                  <li key={s.key} className="relative flex items-start gap-3 pb-6 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center">
                    {i < STEPS.length - 1 && (
                      <span
                        className={`absolute start-[15px] top-9 h-[calc(100%-2rem)] w-0.5 sm:start-auto sm:end-auto sm:top-4 sm:h-0.5 sm:w-full ltr:sm:left-1/2 rtl:sm:right-1/2 ${
                          i < stepIndex ? 'bg-brand-600' : 'bg-slate-200'
                        }`}
                        aria-hidden
                      />
                    )}
                    <span
                      className={`relative z-10 grid h-8 w-8 flex-none place-items-center rounded-full text-sm ${
                        done ? 'bg-brand-600' : 'bg-slate-100'
                      } ${current ? 'ring-4 ring-brand-100' : ''}`}
                    >
                      {done ? <span className="text-white">✓</span> : s.icon}
                    </span>
                    <span className={`text-sm font-semibold ${done ? 'text-slate-900' : 'text-slate-400'}`}>
                      {t(s.label)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700">
            {t('Your items')}
          </div>
          {order.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-sm last:border-b-0">
              <span className="min-w-0 flex-1 font-semibold text-slate-800">{l.name}</span>
              <span className="flex-none text-slate-500" dir="ltr">× {l.quantity}</span>
              <span className="w-28 flex-none text-end font-bold text-slate-900" dir="ltr">
                {formatPrice(l.price * l.quantity, order.currency)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm font-bold text-slate-700">{t('Total')}</span>
            <span className="text-lg font-extrabold text-brand-700" dir="ltr">
              {formatPrice(order.subtotal, order.currency)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              openChat(
                t('Hi! I would like to ask about my order {ref}.').replace(
                  '{ref}',
                  order.id.slice(0, 8).toUpperCase(),
                ),
              )
            }
            className="btn-primary"
          >
            {t('Ask about this order')}
          </button>
          <Link to="/shop" className="text-sm font-semibold text-brand-700 hover:underline">
            {t('Continue shopping')} {lang === 'ar' ? '←' : '→'}
          </Link>
        </div>
      </div>
    </div>
  );
}
