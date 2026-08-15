import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  HERO_DEFAULT_COLORS,
  loadSettings,
  saveSettings,
  type HeroSlide,
  type SiteSettings,
} from '../../lib/settingsStore';
import { uploadImage } from '../../lib/imageUpload';
import { categories } from '../../data/categories';
import { solarBrands } from '../../data/brands';
import MediaPicker from '../../components/MediaPicker';
import { useLang } from '../../lib/i18n';

export default function AdminSettings() {
  const { t } = useLang();
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
      // Roles are managed in the Users tab. Re-read them at save time so an
      // older copy held by this page can't roll back a recent role change.
      const latest = await loadSettings();
      await saveSettings({
        ...settings,
        extraAdminEmails: latest.extraAdminEmails,
        computerStaffEmails: latest.computerStaffEmails,
        solarStaffEmails: latest.solarStaffEmails,
      });
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
    if (!confirm(t('Reset all settings to defaults?'))) return;
    setSettings({ ...DEFAULT_SETTINGS });
  }

  if (!settings) {
    return <p className="text-center text-sm text-slate-500">{t('Loading…')}</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('Settings')}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t('Site-wide configuration. Some settings affect the public site immediately.')}
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {saved && (
        <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {t('Settings saved.')}
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
            <Field label="Default delivery fee">
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
            label="Show solar prices link"
            description="Show the Solar Prices page link in the site navigation."
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

        <Section title="Product sub-categories">
          <p className="text-sm text-slate-600">
            {t(
              'Group products inside a category — for example Laptops, Desktops and Printers under Computers. One per line; staff pick from these when editing a product, and shoppers can filter by them.',
            )}
          </p>
          {categories.map((c) => (
            <ListField
              key={c.slug}
              label={`${t(c.name)} — ${t('sub-categories')}`}
              value={settings.subcategories?.[c.slug] ?? []}
              onChange={(v) =>
                update('subcategories', { ...(settings.subcategories ?? {}), [c.slug]: v })
              }
            />
          ))}
        </Section>

        <Section title="Homepage banners">
          <p className="text-sm text-slate-600">
            {t(
              'The big banners at the top of the homepage. Each one is a full-width photo with wording and a button over it — change the words, the colours and where the button goes.',
            )}
          </p>
          {(settings.heroSlides ?? []).map((slide, i) => (
            <HeroSlideEditor
              key={i}
              index={i}
              slide={slide}
              total={(settings.heroSlides ?? []).length}
              onChange={(next) =>
                update(
                  'heroSlides',
                  (settings.heroSlides ?? []).map((s, n) => (n === i ? next : s)),
                )
              }
              onRemove={() =>
                update(
                  'heroSlides',
                  (settings.heroSlides ?? []).filter((_, n) => n !== i),
                )
              }
              onMove={(dir) => {
                const list = [...(settings.heroSlides ?? [])];
                const to = i + dir;
                if (to < 0 || to >= list.length) return;
                [list[i], list[to]] = [list[to], list[i]];
                update('heroSlides', list);
              }}
            />
          ))}
          <button
            type="button"
            onClick={() =>
              update('heroSlides', [
                ...(settings.heroSlides ?? []),
                {
                  image: '',
                  eyebrow: '',
                  title: 'New banner',
                  subtitle: '',
                  buttonLabel: 'Shop now',
                  buttonLink: '/shop',
                  ...HERO_DEFAULT_COLORS,
                },
              ])
            }
            className="btn-secondary"
          >
            {t('+ Add a banner')}
          </button>
        </Section>

        <Section title="Site images">
          <p className="text-sm text-slate-600">
            {t('Replace the main images used across the website. Changes go live as soon as you save.')}
          </p>
          <ImageField
            label="Homepage hero image (shown large on the blue panel)"
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
          <ImageField
            label="Tiandy logo (homepage camera section)"
            value={settings.tiandyLogo}
            folder="site"
            onChange={(url) => update('tiandyLogo', url)}
          />
          <ImageField
            label="SolarMax logo (homepage solar section)"
            value={settings.solarLogo}
            folder="site"
            onChange={(url) => update('solarLogo', url)}
          />
          {categories.map((c) => (
            <ImageField
              key={c.slug}
              label={`${t(c.name)} — ${t('category tile logo')}`}
              value={settings.categoryLogos?.[c.slug] ?? ''}
              folder="site"
              onChange={(url) =>
                update('categoryLogos', { ...(settings.categoryLogos ?? {}), [c.slug]: url })
              }
            />
          ))}
          {solarBrands.map((b) => (
            <ImageField
              key={b.slug}
              label={`${b.name} — ${t('brand strip logo')}`}
              value={settings.brandLogos?.[b.slug] ?? ''}
              folder="site"
              onChange={(url) =>
                update('brandLogos', { ...(settings.brandLogos ?? {}), [b.slug]: url })
              }
            />
          ))}
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button type="button" onClick={resetDefaults} className="text-sm text-slate-500 hover:underline">
            {t('Reset to defaults')}
          </button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? t('Saving…') : t('Save settings')}
          </button>
        </div>
      </form>
    </div>
  );
}

/** One homepage banner: its photo, its wording, its button and its colours. */
function HeroSlideEditor({
  index,
  slide,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  slide: HeroSlide;
  total: number;
  onChange: (s: HeroSlide) => void;
  onRemove: () => void;
  onMove: (dir: 1 | -1) => void;
}) {
  const { t } = useLang();
  const set = <K extends keyof HeroSlide>(key: K, value: HeroSlide[K]) =>
    onChange({ ...slide, [key]: value });

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">
          {t('Banner')} {index + 1}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title={t('Move up')}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title={t('Move down')}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            title={t('Remove this banner')}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Live preview — what the banner will look like. */}
      <div className="relative mb-4 h-32 overflow-hidden rounded-lg bg-slate-800">
        {slide.image && (
          <img src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: `rgba(2, 6, 23, ${Math.min(90, Math.max(0, slide.overlay)) / 100})` }}
        />
        <div className="relative flex h-full flex-col justify-center gap-1.5 px-4">
          <p className="truncate text-sm font-extrabold" style={{ color: slide.textColor }}>
            {slide.title || t('Your headline here')}
          </p>
          {slide.buttonLabel && (
            <span
              className="w-fit rounded-full px-3 py-1 text-[10px] font-bold uppercase"
              style={{ background: slide.buttonBg, color: slide.buttonText }}
            >
              {slide.buttonLabel}
            </span>
          )}
        </div>
      </div>

      <ImageField
        label="Banner photo"
        value={slide.image}
        folder="site"
        onChange={(url) => set('image', url)}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Small label above the headline">
          <input
            className="input"
            value={slide.eyebrow}
            onChange={(e) => set('eyebrow', e.target.value)}
            placeholder={t('e.g. New arrivals')}
          />
        </Field>
        <Field label="Headline">
          <input
            className="input"
            value={slide.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
      </div>
      <Field label="Sentence under the headline">
        <input
          className="input"
          value={slide.subtitle}
          onChange={(e) => set('subtitle', e.target.value)}
        />
      </Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Button text">
          <input
            className="input"
            value={slide.buttonLabel}
            onChange={(e) => set('buttonLabel', e.target.value)}
            placeholder={t('Leave empty to hide the button')}
          />
        </Field>
        <Field label="Button goes to">
          <input
            className="input"
            dir="ltr"
            value={slide.buttonLink}
            onChange={(e) => set('buttonLink', e.target.value)}
            placeholder="/shop?category=solar"
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <ColorField label="Text colour" value={slide.textColor} onChange={(v) => set('textColor', v)} />
        <ColorField label="Button colour" value={slide.buttonBg} onChange={(v) => set('buttonBg', v)} />
        <ColorField
          label="Button text colour"
          value={slide.buttonText}
          onChange={(v) => set('buttonText', v)}
        />
        <Field label="Darken photo">
          <input
            type="range"
            min={0}
            max={90}
            value={slide.overlay}
            onChange={(e) => set('overlay', Number(e.target.value))}
            className="mt-2 w-full"
          />
          <p className="text-xs text-slate-500">{slide.overlay}%</p>
        </Field>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 flex-none cursor-pointer rounded border border-slate-300 bg-white p-0.5"
        />
        <input
          className="input"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </Field>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="text-base font-bold text-slate-900">{useLang().t(title)}</h2>
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
        {useLang().t(label)}
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const { t } = useLang();

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
        {useLang().t(label)}
      </label>
      <div className="flex flex-wrap items-start gap-3">
        <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-slate-400">
              {t('Default')}
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
              {uploading ? t('Uploading…') : t('Upload image')}
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={uploading}
              className="btn-secondary"
            >
              {t('🖼️ Choose from website')}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-sm font-semibold text-red-700 hover:underline"
              >
                {t('Use default')}
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
            placeholder={t('…or paste an image URL')}
          />
          {err && <p className="text-xs text-red-700">{err}</p>}
        </div>
      </div>
      <MediaPicker
        open={pickerOpen}
        title={`${t('Choose an image')} — ${label}`}
        onClose={() => setPickerOpen(false)}
        onSelect={(urls) => urls[0] && onChange(urls[0])}
      />
    </div>
  );
}

/**
 * One-per-line list editor. The typed text is held in local state: parsing on
 * every keystroke discarded the blank line Enter had just created, so the
 * caret snapped back and starting a new line was impossible.
 */
function ListField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { t } = useLang();
  const parse = (raw: string) =>
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  const [text, setText] = useState(value.join('\n'));

  // Adopt outside changes (settings finishing their load) without throwing
  // away what is being typed — only the parsed result has to match.
  useEffect(() => {
    const incoming = value.join('\n');
    setText((current) => (parse(current).join('\n') === incoming ? current : incoming));
  }, [value]);

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t(label)}
      </label>
      <textarea
        className="input min-h-[90px]"
        value={text}
        placeholder={t('One per line')}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parse(e.target.value));
        }}
      />
      <p className="mt-1 text-xs text-slate-500">
        {parse(text).length} {t('in this list')}
      </p>
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
  const { t } = useLang();
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="text-sm font-semibold text-slate-900">{t(label)}</span>
        <span className="block text-xs text-slate-500">{t(description)}</span>
      </span>
    </label>
  );
}
