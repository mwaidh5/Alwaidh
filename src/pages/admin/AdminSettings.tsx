import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type SiteSettings,
} from '../../lib/settingsStore';
import { uploadImage } from '../../lib/imageUpload';

export default function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError('');
    setSaved(false);
    setBusy(true);
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  function update<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  function resetDefaults() {
    if (!confirm('Reset all settings to defaults?')) return;
    setSettings({ ...DEFAULT_SETTINGS });
  }

  if (!settings) {
    return <p className="text-center text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Site-wide configuration. Some settings affect the public site immediately.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {saved && (
        <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Settings saved.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Storefront">
          <Grid>
            <Field label="Store name">
              <input
                className="input"
                value={settings.storeName}
                onChange={(e) => update('storeName', e.target.value)}
              />
            </Field>
            <Field label="Contact email">
              <input
                type="email"
                className="input"
                value={settings.contactEmail}
                onChange={(e) => update('contactEmail', e.target.value)}
              />
            </Field>
            <Field label="Support phone">
              <input
                type="tel"
                className="input"
                value={settings.supportPhone}
                onChange={(e) => update('supportPhone', e.target.value)}
              />
            </Field>
            <Field label="Default currency (ISO)">
              <input
                className="input"
                value={settings.defaultCurrency}
                onChange={(e) => update('defaultCurrency', e.target.value.toUpperCase())}
              />
            </Field>
          </Grid>
        </Section>

        <Section title="Checkout">
          <Grid>
            <Field label="Tax rate (%)">
              <input
                type="number"
                step="0.01"
                min={0}
                className="input"
                value={settings.taxRatePercent}
                onChange={(e) => update('taxRatePercent', Number(e.target.value))}
              />
            </Field>
            <Field label="Flat shipping cost">
              <input
                type="number"
                step="0.01"
                min={0}
                className="input"
                value={settings.shippingFlat}
                onChange={(e) => update('shippingFlat', Number(e.target.value))}
              />
            </Field>
          </Grid>
          <Toggle
            label="Enable checkout"
            description="When off, customers can still browse but not complete an order."
            checked={settings.enableCheckout}
            onChange={(v) => update('enableCheckout', v)}
          />
        </Section>

        <Section title="Site behaviour">
          <Toggle
            label="Show solar calculator"
            description="Toggle the public /solar-calculator route visibility in navigation."
            checked={settings.showSolarCalculator}
            onChange={(v) => update('showSolarCalculator', v)}
          />
          <Toggle
            label="Maintenance mode"
            description="Show a maintenance banner; checkout will be disabled."
            checked={settings.maintenanceMode}
            onChange={(v) => update('maintenanceMode', v)}
          />
          <Field label="Top-of-page banner message">
            <input
              className="input"
              placeholder="e.g. Free shipping on orders over $500"
              value={settings.bannerMessage}
              onChange={(e) => update('bannerMessage', e.target.value)}
            />
          </Field>
        </Section>

        <Section title="Site images">
          <p className="text-sm text-slate-600">
            Replace the main images used across the website. Changes go live as soon as you save.
          </p>
          <ImageField
            label="Homepage hero image"
            value={settings.heroImage}
            folder="site"
            onChange={(url) => update('heroImage', url)}
          />
          <ImageField
            label="Homepage solar banner image"
            value={settings.solarBannerImage}
            folder="site"
            onChange={(url) => update('solarBannerImage', url)}
          />
          <ImageField
            label="Logo (navbar)"
            value={settings.logoImage}
            folder="site"
            onChange={(url) => update('logoImage', url)}
          />
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button type="button" onClick={resetDefaults} className="text-sm text-slate-500 hover:underline">
            Reset to defaults
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function ImageField({
  label,
  value,
  folder,
  onChange,
}: {
  label: string;
  value: string;
  folder: string;
  onChange: (url: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  async function handle(file: File) {
    setErr('');
    setUploading(true);
    try {
      const { url } = await uploadImage(file, folder);
      onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="flex flex-wrap items-start gap-3">
        <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-slate-400">
              Default
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="btn-secondary"
            >
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-sm font-semibold text-red-700 hover:underline"
              >
                Use default
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handle(f);
            }}
          />
          <input
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste an image URL"
          />
          {err && <p className="text-xs text-red-700">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="text-sm font-semibold text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </label>
  );
}
