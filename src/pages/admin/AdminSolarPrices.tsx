import { useEffect, useState } from 'react';
import {
  subscribePriceRows,
  createPriceRow,
  upsertPriceRow,
  deletePriceRow,
  type PriceColumn,
  type PriceRow,
} from '../../lib/solarPricesStore';
import {
  subscribeInstallmentRows,
  createInstallmentRow,
  upsertInstallmentRow,
  deleteInstallmentRow,
  planMonthly,
  type InstallmentRow,
} from '../../lib/solarInstallmentsStore';
import { useSettings } from '../../lib/useSettings';
import { updateSettingsField } from '../../lib/settingsStore';

export default function AdminSolarPrices() {
  const settings = useSettings();
  const [columns, setColumns] = useState<PriceColumn[]>(settings.solarPriceColumns);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => setColumns(settings.solarPriceColumns), [settings.solarPriceColumns]);
  useEffect(() => subscribePriceRows(setRows), []);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong.');

  /* ---- column operations (persisted in site settings) ---- */
  function persistColumns(next: PriceColumn[]) {
    setColumns(next);
    updateSettingsField('solarPriceColumns', next).catch(fail);
  }
  function persistColumnLabels() {
    setColumns((prev) => {
      updateSettingsField('solarPriceColumns', prev).catch(fail);
      return prev;
    });
  }
  function setColumnLabel(idx: number, label: string) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, label } : c)));
  }
  function addColumn() {
    persistColumns([
      ...columns,
      { key: `col_${Date.now().toString(36)}`, label: 'عمود جديد' },
    ]);
  }
  function deleteColumn(idx: number) {
    if (!confirm('Delete this column from the price sheet?')) return;
    persistColumns(columns.filter((_, i) => i !== idx));
  }

  /* ---- row operations (persisted in the solarPrices collection) ---- */
  function setCell(rowId: string, key: string, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, values: { ...r.values, [key]: value } } : r)),
    );
  }
  function saveRow(rowId: string) {
    setRows((prev) => {
      const r = prev.find((x) => x.id === rowId);
      if (r) upsertPriceRow(r).catch(fail);
      return prev;
    });
  }
  function addRow() {
    createPriceRow(rows.length).catch(fail);
  }
  function deleteRow(id: string) {
    if (!confirm('Delete this row?')) return;
    deletePriceRow(id).catch(fail);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Solar Prices</h1>
          <p className="mt-1 text-sm text-slate-600">
            Click any cell to edit — changes save when you click away. Add or remove rows and columns
            freely.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={addColumn} className="btn-secondary">
            + Column
          </button>
          <button type="button" onClick={addRow} className="btn-primary">
            + Row
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="w-8 border-b border-slate-200 p-2 text-xs text-slate-400">#</th>
              {columns.map((c, idx) => (
                <th key={c.key} className="min-w-[130px] border-b border-slate-200 p-2 align-top">
                  <div className="flex items-center gap-1">
                    <input
                      value={c.label}
                      onChange={(e) => setColumnLabel(idx, e.target.value)}
                      onBlur={persistColumnLabels}
                      dir="auto"
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:border-brand-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => deleteColumn(idx)}
                      title="Delete column"
                      className="flex-none rounded px-1 text-red-500 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-10 border-b border-slate-200 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="p-8 text-center text-sm text-slate-400">
                  No rows yet — click “+ Row” to add one.
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <tr key={row.id} className="hover:bg-slate-50/50">
                  <td className="border-b border-slate-100 text-center text-xs text-slate-400">
                    {ri + 1}
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="border-b border-slate-100 p-1">
                      <input
                        value={row.values[c.key] ?? ''}
                        onChange={(e) => setCell(row.id, c.key, e.target.value)}
                        onBlur={() => saveRow(row.id)}
                        dir="auto"
                        className="w-full rounded border border-transparent px-2 py-1.5 hover:border-slate-200 focus:border-brand-500 focus:bg-white focus:outline-none"
                      />
                    </td>
                  ))}
                  <td className="border-b border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      title="Delete row"
                      className="rounded px-2 py-1 text-red-500 hover:bg-red-50"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={addRow} className="btn-secondary">
          + Add row
        </button>
        <button type="button" onClick={addColumn} className="btn-secondary">
          + Add column
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Tip: the columns and their order here are exactly what shows on the public price sheet.
      </p>

      <InstallmentsEditor />
    </div>
  );
}

/**
 * The Central Bank initiative systems, sold on installments. Staff edit
 * the specs and the published 7-year total; every other number on the
 * public page derives from that one price — cash is the total divided by
 * 1.21 (3% per year over 7 years), an N-year plan is cash times
 * (1 + 0.03 x N), and the monthly payment is the plan divided by its
 * months.
 */
function InstallmentsEditor() {
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, InstallmentRow>>({});
  const [error, setError] = useState('');
  useEffect(() => subscribeInstallmentRows(setRows), []);
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong.');

  const view = (r: InstallmentRow) => drafts[r.id] ?? r;
  const setField = (r: InstallmentRow, key: keyof InstallmentRow, value: string) =>
    setDrafts((d) => ({
      ...d,
      [r.id]: { ...view(r), [key]: key === 'price7' ? Number(value.replace(/[^0-9]/g, '')) * 1.225 : value },
    }));
  const save = (r: InstallmentRow) => {
    const draft = drafts[r.id];
    if (!draft) return;
    upsertInstallmentRow({ ...draft, price7: Math.round(draft.price7) }).catch(fail);
  };

  // No system-kW and no panel-kWp: amperes name the system and the panel
  // count is what customers ask about.
  const COLS: { key: keyof InstallmentRow; label: string; width?: string }[] = [
    { key: 'sizeAmp', label: 'Amp' },
    { key: 'inverterKw', label: 'العاكسة KW' },
    { key: 'panelsCount', label: 'عدد الألواح' },
    { key: 'batteryKwh', label: 'البطارية KWh' },
    { key: 'batteryLabel', label: 'وصف البطاريات', width: 'min-w-[130px]' },
    { key: 'backupHours', label: 'ساعات التغذية' },
    { key: 'price7', label: 'السعر النقدي', width: 'min-w-[110px]' },
  ];

  return (
    <div className="space-y-3 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Installments — مبادرة البنك المركزي</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter the CASH price only — the 7-year bank price (× 1.225), every shorter plan
            (3% a year plus a flat 1.5%) and the monthly amounts are all calculated automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => createInstallmentRow(rows.length).catch(fail)}
          className="btn-primary"
        >
          + Row
        </button>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              {COLS.map((c) => (
                <th key={c.key} className={`border-b border-slate-200 p-2 text-xs font-bold text-slate-600 ${c.width ?? 'min-w-[80px]'}`}>
                  {c.label}
                </th>
              ))}
              <th className="min-w-[110px] border-b border-slate-200 p-2 text-xs font-bold text-slate-400">
                سعر ٧ سنوات (محسوب)
              </th>
              <th className="min-w-[110px] border-b border-slate-200 p-2 text-xs font-bold text-slate-400">
                شهرياً / 7 سنوات
              </th>
              <th className="w-10 border-b border-slate-200 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length + 3} className="p-8 text-center text-sm text-slate-400">
                  No systems yet — click “+ Row” to add one.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const r = view(row);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    {COLS.map((c) => (
                      <td key={c.key} className="border-b border-slate-100 p-1">
                        <input
                          value={
                            c.key === 'price7'
                              ? r.price7
                                ? String(Math.round(r.price7 / 1.225))
                                : ''
                              : String(r[c.key] ?? '')
                          }
                          onChange={(e) => setField(row, c.key, e.target.value)}
                          onBlur={() => save(row)}
                          dir="auto"
                          className="w-full rounded border border-transparent px-2 py-1.5 hover:border-slate-200 focus:border-brand-500 focus:bg-white focus:outline-none"
                        />
                      </td>
                    ))}
                    <td dir="ltr" className="border-b border-slate-100 p-2 text-xs font-bold text-slate-500">
                      {r.price7 ? Math.round(r.price7).toLocaleString('en-GB') : '—'}
                    </td>
                    <td dir="ltr" className="border-b border-slate-100 p-2 text-xs font-bold text-slate-500">
                      {r.price7 ? planMonthly(r.price7, 7).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="border-b border-slate-100 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this system?')) deleteInstallmentRow(row.id).catch(fail);
                        }}
                        title="Delete row"
                        className="rounded px-2 py-1 text-red-500 hover:bg-red-50"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
