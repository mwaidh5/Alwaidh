import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChatSystemCard } from '../lib/chatStore';
import { subscribePriceRows, type PriceRow } from '../lib/solarPricesStore';
import {
  cashPrice,
  planMonthly,
  planTotal,
  subscribeInstallmentRows,
  type InstallmentRow,
} from '../lib/solarInstallmentsStore';
import { useSettings } from '../lib/useSettings';
import { useLang } from '../lib/i18n';
import { useScrollLock } from '../lib/useScrollLock';

const money = (n: number) => n.toLocaleString('en-US');

/** A cash-sheet row as the card the customer will read. */
function cashCard(row: PriceRow, labels: Record<string, string>): ChatSystemCard {
  const v = row.values;
  const rows = ['inverter', 'panels', 'batteries', 'backup']
    .filter((k) => v[k] && v[k] !== '-')
    .map((k) => ({ label: labels[k] ?? k, value: v[k] }));
  const ip65 = v.priceWithInverter && v.priceWithInverter !== '-' ? v.priceWithInverter : '';
  return {
    kind: 'cash',
    title: `منظومة ${v.capacity ?? ''} — نقداً`,
    rows,
    price: `${v.price ?? ''} دينار`,
    extra: ip65 ? `مع انفيرتر IP65: ${ip65} دينار` : '',
    plans: [],
  };
}

/** An installment row as the card: cash price, then the 3/5/7-year plans. */
function planCard(row: InstallmentRow): ChatSystemCard {
  return {
    kind: 'plan',
    title: `منظومة ${row.sizeAmp} أمبير — تقسيط مبادرة البنك المركزي`,
    rows: [
      { label: 'العاكسة', value: `${row.inverterKw} كيلو واط IP65` },
      { label: 'الألواح', value: `${row.panelsCount} لوح Jinko 650W` },
      { label: 'البطاريات', value: `${row.batteryKwh} كيلو واط ساعة — ${row.batteryLabel}` },
      { label: 'ساعات التغذية', value: `${row.backupHours} ساعة` },
    ],
    price: `نقداً: ${money(cashPrice(row.price7))} دينار`,
    extra: 'السعر يشمل التنصيب والتشغيل',
    plans: [3, 5, 7].map((y) => ({
      years: y,
      total: planTotal(row.price7, y),
      monthly: planMonthly(row.price7, y),
    })),
  };
}

/**
 * Pick a system from either price sheet to send into a chat. Two tabs —
 * cash and installments — each a list of what the sheet holds right now.
 */
export default function SystemPicker({
  onPick,
  onClose,
}: {
  onPick: (card: ChatSystemCard) => void;
  onClose: () => void;
}) {
  useScrollLock();
  const { t } = useLang();
  const { solarPriceColumns } = useSettings();
  const [tab, setTab] = useState<'cash' | 'plan'>('cash');
  const [cash, setCash] = useState<PriceRow[]>([]);
  const [plans, setPlans] = useState<InstallmentRow[]>([]);
  useEffect(() => subscribePriceRows(setCash), []);
  useEffect(() => subscribeInstallmentRows(setPlans), []);
  const labels = useMemo(
    () => Object.fromEntries(solarPriceColumns.map((c) => [c.key, c.label])),
    [solarPriceColumns],
  );

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[80vh] sm:max-w-md sm:rounded-xl"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-lg font-bold text-slate-900">☀️ {t('Send a solar system')}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="grid h-10 w-10 place-items-center rounded-full text-xl text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="flex gap-1 border-b border-slate-200 p-2">
          {(
            [
              { key: 'cash', label: 'Cash prices' },
              { key: 'plan', label: 'Installments' },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setTab(o.key)}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                tab === o.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t(o.label)}
            </button>
          ))}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'cash'
            ? cash.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onPick(cashCard(row, labels))}
                    dir="rtl"
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-start hover:bg-slate-50"
                  >
                    <span>
                      <span className="block text-sm font-bold text-slate-900">{row.values.capacity}</span>
                      <span className="block text-xs text-slate-500">
                        {row.values.inverter} · {row.values.panels} لوح · {row.values.batteries}
                      </span>
                    </span>
                    <span className="flex-none text-sm font-extrabold text-brand-700">{row.values.price}</span>
                  </button>
                </li>
              ))
            : plans.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onPick(planCard(row))}
                    dir="rtl"
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-start hover:bg-slate-50"
                  >
                    <span>
                      <span className="block text-sm font-bold text-slate-900">{row.sizeAmp} أمبير</span>
                      <span className="block text-xs text-slate-500">
                        {row.inverterKw} كيلو واط · {row.panelsCount} لوح · {row.batteryKwh} كيلو واط ساعة
                      </span>
                    </span>
                    <span className="flex-none text-end text-xs font-bold text-slate-700">
                      <span className="block text-sm font-extrabold text-brand-700">
                        {money(planMonthly(row.price7, 7))} / شهر
                      </span>
                      نقداً {money(cashPrice(row.price7))}
                    </span>
                  </button>
                </li>
              ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
