import { useEffect, useState, type ReactNode } from 'react';
import {
  createSolarPrice,
  deleteSolarPrice,
  subscribeSolarPrices,
  upsertSolarPrice,
  type SolarPrice,
} from '../../lib/solarPricesStore';

type FormState = SolarPrice;

const EMPTY: FormState = {
  id: '',
  capacity: '',
  inverter: '',
  panels: '',
  batteries: '',
  backup: '',
  price: '',
  priceWithInverter: '',
  order: 0,
};

export default function AdminSolarPrices() {
  const [prices, setPrices] = useState<SolarPrice[] | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeSolarPrices(setPrices), []);

  async function handleSave() {
    if (!editing) return;
    setError('');
    setBusy(true);
    try {
      const payload = {
        capacity: editing.capacity.trim(),
        inverter: editing.inverter.trim(),
        panels: editing.panels.trim(),
        batteries: editing.batteries.trim(),
        backup: editing.backup.trim(),
        price: editing.price.trim(),
        priceWithInverter: editing.priceWithInverter.trim(),
        order: Number(editing.order) || 0,
      };
      if (!payload.capacity) throw new Error('Capacity is required.');
      if (editing.id) await upsertSolarPrice({ id: editing.id, ...payload });
      else await createSolarPrice(payload);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this row?')) return;
    try {
      await deleteSolarPrice(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Solar Prices</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage the rows shown on the public Solar Prices sheet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setEditing({ ...EMPTY, order: prices?.length ?? 0 });
          }}
          className="btn-primary"
        >
          + Add row
        </button>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      {prices === null ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : prices.length === 0 ? (
        <p className="card p-10 text-center text-sm text-slate-500">No rows yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Capacity</th>
                <th className="px-3 py-3">Inverter</th>
                <th className="px-3 py-3">Panels</th>
                <th className="px-3 py-3">Batteries</th>
                <th className="px-3 py-3">Backup</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">+ Inverter</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {prices.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-3 font-semibold text-slate-900">{p.capacity}</td>
                  <td className="px-3 py-3 text-slate-700">{p.inverter}</td>
                  <td className="px-3 py-3 text-slate-700">{p.panels}</td>
                  <td className="px-3 py-3 text-slate-700">{p.batteries}</td>
                  <td className="px-3 py-3 text-slate-700">{p.backup}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{p.price || '-'}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{p.priceWithInverter || '-'}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setEditing({ ...p });
                      }}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="ml-3 text-sm font-semibold text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PriceDialog
          state={editing}
          setState={setEditing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function PriceDialog({
  state,
  setState,
  busy,
  onCancel,
  onSave,
}: {
  state: FormState;
  setState: (s: FormState) => void;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const set = (k: keyof FormState, v: string) => setState({ ...state, [k]: v });
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="font-bold text-slate-900">{state.id ? 'Edit row' : 'New row'}</h2>
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Capacity (السعة)">
            <input className="input" value={state.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="4 أمبير" />
          </Field>
          <Field label="Inverter (العاكسة)">
            <input className="input" value={state.inverter} onChange={(e) => set('inverter', e.target.value)} placeholder="2 كيلو واط" />
          </Field>
          <Field label="Panels (عدد الألواح)">
            <input className="input" value={state.panels} onChange={(e) => set('panels', e.target.value)} placeholder="2" />
          </Field>
          <Field label="Batteries (البطاريات)">
            <input className="input" value={state.batteries} onChange={(e) => set('batteries', e.target.value)} placeholder="ليثيوم 5 كيلو واط" />
          </Field>
          <Field label="Backup (ساعات التغذية)">
            <input className="input" value={state.backup} onChange={(e) => set('backup', e.target.value)} placeholder="4 ساعة" />
          </Field>
          <Field label="Display order">
            <input type="number" className="input" value={state.order} onChange={(e) => setState({ ...state, order: Number(e.target.value) })} />
          </Field>
          <Field label="Price (السعر)">
            <input className="input" value={state.price} onChange={(e) => set('price', e.target.value)} placeholder="2,150,000" />
          </Field>
          <Field label="Price + IP65 inverter">
            <input className="input" value={state.priceWithInverter} onChange={(e) => set('priceWithInverter', e.target.value)} placeholder="6,000,000 or -" />
          </Field>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={onSave} className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
