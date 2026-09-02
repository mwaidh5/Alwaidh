import { Link } from 'react-router-dom';
import type { ChatSystemCard as SystemCard } from '../lib/chatStore';

const money = (n: number) => n.toLocaleString('en-US');

/**
 * A solar system inside a chat bubble: what is in it, what it costs, and —
 * for the bank's installments — the monthly figure for each plan length.
 * Arabic throughout, whatever the site language: this is the sheet the
 * shop quotes from, and it is read by the person being quoted.
 */
export default function ChatSystemCard({
  system,
  onOpen,
  newTab,
}: {
  system: SystemCard;
  onOpen?: () => void;
  newTab?: boolean;
}) {
  const link = newTab ? (
    <a href="/solar-prices" target="_blank" rel="noreferrer" className={LINK}>
      كل المنظومات والأسعار ↗
    </a>
  ) : (
    <Link to="/solar-prices" onClick={onOpen} className={LINK}>
      كل المنظومات والأسعار ←
    </Link>
  );

  return (
    <div
      dir="rtl"
      className="mt-1.5 w-64 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-start text-slate-800"
    >
      <div className="flex items-center gap-2 bg-gradient-to-l from-amber-400 to-amber-500 px-3 py-2 text-slate-900">
        <span className="text-lg">☀️</span>
        <p className="text-[13px] font-extrabold leading-tight">{system.title}</p>
      </div>
      <dl className="px-3 py-2">
        {system.rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between gap-3 border-b border-dashed border-slate-100 py-1 last:border-b-0"
          >
            <dt className="text-[11px] text-slate-500">{r.label}</dt>
            <dd className="text-[12px] font-bold text-slate-800">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-slate-100 px-3 py-2">
        <p className="text-[14px] font-extrabold text-brand-700">{system.price}</p>
        {system.extra && <p className="mt-0.5 text-[11px] text-slate-500">{system.extra}</p>}
        {system.plans.length > 0 && (
          <table className="mt-2 w-full text-[11px]">
            <thead>
              <tr className="text-slate-500">
                <th className="py-0.5 text-start font-semibold">المدة</th>
                <th className="py-0.5 text-start font-semibold">السعر الكلي</th>
                <th className="py-0.5 text-start font-semibold">شهرياً</th>
              </tr>
            </thead>
            <tbody>
              {system.plans.map((p) => (
                <tr key={p.years} className="border-t border-slate-100">
                  <td className="py-1 font-bold">{p.years} سنوات</td>
                  <td className="py-1">{money(p.total)}</td>
                  <td className="py-1 font-extrabold text-brand-700">{money(p.monthly)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-slate-100 px-3 py-1.5">{link}</div>
    </div>
  );
}

const LINK = 'text-[11px] font-bold text-brand-700 hover:underline';
