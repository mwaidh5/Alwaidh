import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { products } from '../data/products';
import { formatPrice } from '../lib/format';

const solarProducts = products.filter((p) => p.category === 'solar');
const panels = solarProducts.filter((p) => /panel/i.test(p.name));
const inverters = solarProducts.filter((p) => /inverter/i.test(p.name));
const batteries = solarProducts.filter((p) => /battery/i.test(p.name));

const currency = solarProducts[0]?.currency ?? 'IQD';

export default function SolarCalculator() {
  const [panelId, setPanelId] = useState<string>(panels[0]?.id ?? '');
  const [panelQty, setPanelQty] = useState<number>(8);
  const [inverterId, setInverterId] = useState<string>(inverters[0]?.id ?? '');
  const [batteryId, setBatteryId] = useState<string>(batteries[0]?.id ?? '');
  const [batteryQty, setBatteryQty] = useState<number>(1);
  const [installation, setInstallation] = useState<boolean>(true);

  const selectedPanel = panels.find((p) => p.id === panelId);
  const selectedInverter = inverters.find((p) => p.id === inverterId);
  const selectedBattery = batteries.find((p) => p.id === batteryId);

  const breakdown = useMemo(() => {
    const lines: { label: string; qty: number; unit: number; total: number }[] = [];
    if (selectedPanel && panelQty > 0) {
      lines.push({
        label: selectedPanel.name,
        qty: panelQty,
        unit: selectedPanel.price,
        total: selectedPanel.price * panelQty,
      });
    }
    if (selectedInverter) {
      lines.push({
        label: selectedInverter.name,
        qty: 1,
        unit: selectedInverter.price,
        total: selectedInverter.price,
      });
    }
    if (selectedBattery && batteryQty > 0) {
      lines.push({
        label: selectedBattery.name,
        qty: batteryQty,
        unit: selectedBattery.price,
        total: selectedBattery.price * batteryQty,
      });
    }
    const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
    const installFee = installation ? Math.round(subtotal * 0.1) : 0;
    return { lines, subtotal, installFee, grandTotal: subtotal + installFee };
  }, [selectedPanel, selectedInverter, selectedBattery, panelQty, batteryQty, installation]);

  const totalPanelWatts = useMemo(() => {
    if (!selectedPanel) return 0;
    const match = /(\d+)\s*W/i.exec(selectedPanel.name);
    const watts = match ? Number(match[1]) : 0;
    return watts * panelQty;
  }, [selectedPanel, panelQty]);

  const totalBatteryKwh = useMemo(() => {
    if (!selectedBattery) return 0;
    const match = /([\d.]+)\s*kWh/i.exec(selectedBattery.name);
    const kwh = match ? Number(match[1]) : 0;
    return Math.round(kwh * batteryQty * 100) / 100;
  }, [selectedBattery, batteryQty]);

  return (
    <div>
      <section className="bg-gradient-to-br from-sun-600 to-sun-400 text-white">
        <div className="container-page py-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-white/90">Tools</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Solar System Price Calculator</h1>
          <p className="mt-2 max-w-2xl text-white/90">
            Build your own solar system: pick the panels, inverter, and batteries you want — we'll
            tally the price live.
          </p>
        </div>
      </section>

      <section className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <ComponentCard title="Solar panels" icon="☀️">
            <Selector
              label="Panel model"
              value={panelId}
              onChange={setPanelId}
              options={panels.map((p) => ({ value: p.id, label: `${p.name} — ${formatPrice(p.price, p.currency)}` }))}
            />
            <NumberField
              label="Quantity"
              value={panelQty}
              min={0}
              max={60}
              onChange={setPanelQty}
              hint={totalPanelWatts > 0 ? `≈ ${totalPanelWatts.toLocaleString()} W total` : undefined}
            />
          </ComponentCard>

          <ComponentCard title="Inverter" icon="⚡">
            <Selector
              label="Inverter model"
              value={inverterId}
              onChange={setInverterId}
              options={inverters.map((p) => ({ value: p.id, label: `${p.name} — ${formatPrice(p.price, p.currency)}` }))}
            />
            {selectedInverter && (
              <p className="text-sm text-slate-600">{selectedInverter.shortDescription}</p>
            )}
          </ComponentCard>

          <ComponentCard title="Batteries" icon="🔋">
            <Selector
              label="Battery model"
              value={batteryId}
              onChange={setBatteryId}
              options={batteries.map((p) => ({ value: p.id, label: `${p.name} — ${formatPrice(p.price, p.currency)}` }))}
            />
            <NumberField
              label="Quantity"
              value={batteryQty}
              min={0}
              max={16}
              onChange={setBatteryQty}
              hint={totalBatteryKwh > 0 ? `≈ ${totalBatteryKwh} kWh storage` : undefined}
            />
          </ComponentCard>

          <ComponentCard title="Installation" icon="🛠️">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={installation}
                onChange={(e) => setInstallation(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Add professional installation (≈ 10% of components)
            </label>
          </ComponentCard>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card p-6">
            <h2 className="text-lg font-extrabold text-slate-900">Your estimate</h2>
            <p className="mt-1 text-xs text-slate-500">Live total — adjust components on the left.</p>

            <ul className="mt-5 space-y-3 text-sm">
              {breakdown.lines.length === 0 && (
                <li className="text-slate-500">No components selected yet.</li>
              )}
              {breakdown.lines.map((line) => (
                <li key={line.label} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{line.label}</p>
                    <p className="text-xs text-slate-500">
                      {line.qty} × {formatPrice(line.unit, currency)}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900">
                    {formatPrice(line.total, currency)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
              <Row label="Components" value={formatPrice(breakdown.subtotal, currency)} />
              {installation && (
                <Row label="Installation" value={formatPrice(breakdown.installFee, currency)} />
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-extrabold text-slate-900">
                <span>Total</span>
                <span>{formatPrice(breakdown.grandTotal, currency)}</span>
              </div>
            </div>

            <Link
              to="/about"
              className="btn-primary mt-6 w-full justify-center text-center"
            >
              Request a quote
            </Link>
            <p className="mt-3 text-xs text-slate-500">
              Estimate only. Final pricing depends on site survey, mounting hardware, and cabling.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ComponentCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.max(min, Math.min(max, n)));
        }}
        className="mt-1 block w-32 rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-slate-700">
      <span>{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
