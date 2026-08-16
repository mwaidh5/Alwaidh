import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  HERO_DEFAULT_COLORS,
  loadSettings,
  saveSettings,
  type BrandLogo,
  type HeroSlide,
  type PromoTile,
  type SiteSettings,
} from '../../lib/settingsStore';
import { uploadImage } from '../../lib/imageUpload';
import { categories } from '../../data/categories';
import { allBrands } from '../../data/brands';
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

  // Start from the built-in brands the first time, so the list opens with
  // what the site already shows rather than empty.
  const brandRows: BrandLogo[] = settings.brands?.length
    ? settings.brands
    : allBrands.map((b) => ({ name: b.name, image: settings.brandLogos?.[b.slug] ?? '' }));

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
        <Section title="Storefront" hint="Shop name, contact details and currency." defaultOpen>
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

        <Section title="Checkout" hint="Tax, delivery fee and whether customers can order.">
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

        <Section title="Site behaviour" hint="Maintenance mode and the announcement bar.">
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

        <Section title="Product sub-categories" hint="The groups staff can file products under.">
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

        <Section title="Homepage banners" hint="The big banners at the top of the homepage.">
          <p className="text-sm text-slate-600">
            {t(
              'Each banner is a photo with wording and a button over it. Tap one to change its words, colours and where the button goes.',
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
                  mobileImage: '',
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

        <Section
          title="Homepage tiles"
          hint="The three smaller cards under the main banner."
        >
          <p className="text-sm text-slate-600">
            {t('Tap a tile to change its photo, its wording, its colours and where it leads.')}
          </p>
          {(settings.promoTiles ?? []).map((tile, i) => (
            <PromoTileEditor
              key={i}
              index={i}
              tile={tile}
              total={(settings.promoTiles ?? []).length}
              onChange={(next) =>
                update(
                  'promoTiles',
                  (settings.promoTiles ?? []).map((x, n) => (n === i ? next : x)),
                )
              }
              onRemove={() =>
                update(
                  'promoTiles',
                  (settings.promoTiles ?? []).filter((_, n) => n !== i),
                )
              }
              onMove={(dir) => {
                const list = [...(settings.promoTiles ?? [])];
                const to = i + dir;
                if (to < 0 || to >= list.length) return;
                [list[i], list[to]] = [list[to], list[i]];
                update('promoTiles', list);
              }}
            />
          ))}
          <button
            type="button"
            onClick={() =>
              update('promoTiles', [
                ...(settings.promoTiles ?? []),
                {
                  image: '',
                  title: 'New tile',
                  buttonLabel: 'Explore now',
                  buttonLink: '/shop',
                  ...HERO_DEFAULT_COLORS,
                  overlay: 25,
                },
              ])
            }
            className="btn-secondary"
          >
            {t('+ Add a tile')}
          </button>
        </Section>

        <Section title="Brand logos" hint="The brands strip on the homepage.">
          <p className="text-sm text-slate-600">
            {t('Add the brands you carry, upload each logo, and reorder or remove them.')}
          </p>
          {brandRows.map((b, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-3">
                <span className="grid h-12 w-20 flex-none place-items-center overflow-hidden rounded-md border border-slate-200 bg-white">
                  {b.image ? (
                    <img src={b.image} alt="" className="max-h-10 w-auto object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400">{t('No logo')}</span>
                  )}
                </span>
                <input
                  className="input"
                  value={b.name}
                  placeholder={t('Brand name')}
                  onChange={(e) =>
                    update(
                      'brands',
                      brandRows.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                />
                <div className="flex flex-none items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...brandRows];
                      if (i === 0) return;
                      [list[i - 1], list[i]] = [list[i], list[i - 1]];
                      update('brands', list);
                    }}
                    disabled={i === 0}
                    title={t('Move up')}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...brandRows];
                      if (i === list.length - 1) return;
                      [list[i], list[i + 1]] = [list[i + 1], list[i]];
                      update('brands', list);
                    }}
                    disabled={i === brandRows.length - 1}
                    title={t('Move down')}
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        'brands',
                        brandRows.filter((_, n) => n !== i),
                      )
                    }
                    title={t('Remove this brand')}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <ImageField
                label="Logo"
                value={b.image}
                folder="site"
                onChange={(url) =>
                  update(
                    'brands',
                    brandRows.map((x, n) => (n === i ? { ...x, image: url } : x)),
                  )
                }
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => update('brands', [...brandRows, { name: '', image: '' }])}
            className="btn-secondary"
          >
            {t('+ Add a brand')}
          </button>
        </Section>

        <Section title="Site images" hint="Logo, category tiles and brand logos.">
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

/**
 * The banner as visitors will see it, at the real proportions of each
 * screen — 2.375:1 on a computer, taller than it is wide on a phone — so
 * it's obvious how the photo will be cropped before anything is saved.
 */
function HeroPreview({ slide }: { slide: HeroSlide }) {
  const { t } = useLang();
  const [device, setDevice] = useState<'pc' | 'phone'>('pc');
  const phone = device === 'phone';
  const photo = (phone && slide.mobileImage) || slide.image;

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('Preview')}
        </p>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
          {(
            [
              { key: 'pc', label: '🖥️ Computer' },
              { key: 'phone', label: '📱 Phone' },
            ] as const
          ).map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDevice(d.key)}
              className={`rounded-md px-2.5 py-1 transition ${
                device === d.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t(d.label)}
            </button>
          ))}
        </div>
      </div>

      <div className={`mx-auto ${phone ? 'w-[320px] max-w-full' : 'w-full'}`}>
        <div
          className="relative overflow-hidden rounded-xl bg-slate-800"
          // Same shapes the homepage uses: 1216×512 and 343×416.
          style={{ aspectRatio: phone ? '343 / 416' : '1216 / 512' }}
        >
          {photo && (
            <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: `rgba(2, 6, 23, ${Math.min(90, Math.max(0, slide.overlay)) / 100})`,
            }}
          />
          <div
            className={`relative flex h-full flex-col justify-center ${
              phone ? 'gap-2 px-6' : 'gap-2.5 px-8'
            }`}
          >
            {slide.eyebrow && (
              <span
                className={`w-fit rounded-full border px-2 py-0.5 font-bold uppercase tracking-[0.15em] ${
                  phone ? 'text-[8px]' : 'text-[9px]'
                }`}
                style={{ color: slide.textColor, borderColor: slide.textColor }}
              >
                {slide.eyebrow}
              </span>
            )}
            <p
              className={`font-extrabold leading-tight ${phone ? 'text-2xl' : 'text-2xl'}`}
              style={{ color: slide.textColor }}
            >
              {slide.title || t('Your headline here')}
            </p>
            {slide.subtitle && (
              <p
                className={`${phone ? 'line-clamp-3 text-[11px]' : 'max-w-md text-xs'} leading-snug`}
                style={{ color: slide.textColor, opacity: 0.85 }}
              >
                {slide.subtitle}
              </p>
            )}
            {slide.buttonLabel && (
              <span
                className={`w-fit rounded-full font-bold uppercase ${
                  phone ? 'px-3.5 py-1.5 text-[9px]' : 'px-4 py-2 text-[10px]'
                }`}
                style={{ background: slide.buttonBg, color: slide.buttonText }}
              >
                {slide.buttonLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {phone && !slide.mobileImage && slide.image && (
        <p className="mt-2 text-center text-xs text-amber-700">
          {t('No phone photo yet — the wide one is being cropped to fit.')}
        </p>
      )}
    </div>
  );
}

/** One of the smaller cards under the banner. */
function PromoTileEditor({
  index,
  tile,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  tile: PromoTile;
  total: number;
  onChange: (t: PromoTile) => void;
  onRemove: () => void;
  onMove: (dir: 1 | -1) => void;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const set = <K extends keyof PromoTile>(key: K, value: PromoTile[K]) =>
    onChange({ ...tile, [key]: value });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="relative h-12 w-20 flex-none overflow-hidden rounded-md bg-slate-800">
            {tile.image && <img src={tile.image} alt="" className="h-full w-full object-cover" />}
            <span
              className="absolute inset-0"
              style={{
                background: `rgba(2, 6, 23, ${Math.min(90, Math.max(0, tile.overlay)) / 100})`,
              }}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t('Tile')} {index + 1}
            </span>
            <span className="block truncate text-sm font-bold text-slate-900">
              {tile.title || t('Untitled')}
            </span>
          </span>
          <span className={`ms-auto flex-none text-slate-400 transition ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        <div className="flex flex-none items-center gap-1">
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
            title={t('Remove this tile')}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            🗑️
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4">
          {/* Preview at the tile's real shape — 395 × 240 on a computer. */}
          <div
            className="relative mb-4 overflow-hidden rounded-lg bg-slate-800"
            style={{ aspectRatio: '395 / 240', maxWidth: '395px' }}
          >
            {tile.image && (
              <img src={tile.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div
              className="absolute inset-0"
              style={{
                background: `rgba(2, 6, 23, ${Math.min(90, Math.max(0, tile.overlay)) / 100})`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end gap-2 p-5">
              <p className="text-lg font-extrabold" style={{ color: tile.textColor }}>
                {tile.title || t('Untitled')}
              </p>
              {tile.buttonLabel && (
                <span
                  className="w-fit rounded-full px-4 py-1.5 text-xs font-bold"
                  style={{ background: tile.buttonBg, color: tile.buttonText }}
                >
                  {tile.buttonLabel} →
                </span>
              )}
            </div>
          </div>

          <ImageField
            label="Tile photo"
            value={tile.image}
            folder="site"
            onChange={(url) => set('image', url)}
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <input
                className="input"
                value={tile.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>
            <Field label="Button text">
              <input
                className="input"
                value={tile.buttonLabel}
                onChange={(e) => set('buttonLabel', e.target.value)}
                placeholder={t('Leave empty to hide the button')}
              />
            </Field>
          </div>
          <Field label="Tile goes to">
            <input
              className="input"
              dir="ltr"
              value={tile.buttonLink}
              onChange={(e) => set('buttonLink', e.target.value)}
              placeholder="/shop?category=solar"
            />
          </Field>

          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <ColorField
              label="Text colour"
              value={tile.textColor}
              onChange={(v) => set('textColor', v)}
            />
            <ColorField
              label="Button colour"
              value={tile.buttonBg}
              onChange={(v) => set('buttonBg', v)}
            />
            <ColorField
              label="Button text colour"
              value={tile.buttonText}
              onChange={(v) => set('buttonText', v)}
            />
            <Field label="Darken photo">
              <input
                type="range"
                min={0}
                max={90}
                value={tile.overlay}
                onChange={(e) => set('overlay', Number(e.target.value))}
                className="mt-2 w-full"
              />
              <p className="text-xs text-slate-500">{tile.overlay}%</p>
            </Field>
          </div>
        </div>
      )}
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
  const [open, setOpen] = useState(false);
  const set = <K extends keyof HeroSlide>(key: K, value: HeroSlide[K]) =>
    onChange({ ...slide, [key]: value });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {/* Collapsed row: a thumbnail and the headline, enough to tell the
          banners apart without opening any of them. */}
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="relative h-12 w-20 flex-none overflow-hidden rounded-md bg-slate-800">
            {slide.image && (
              <img src={slide.image} alt="" className="h-full w-full object-cover" />
            )}
            <span
              className="absolute inset-0"
              style={{
                background: `rgba(2, 6, 23, ${Math.min(90, Math.max(0, slide.overlay)) / 100})`,
              }}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t('Banner')} {index + 1}
            </span>
            <span className="block truncate text-sm font-bold text-slate-900">
              {slide.title || t('Your headline here')}
            </span>
          </span>
          <span className={`ms-auto flex-none text-slate-400 transition ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        <div className="flex flex-none items-center gap-1">
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

      {!open ? null : (
        <div className="border-t border-slate-100 p-4">
      <HeroPreview slide={slide} />

      <ImageField
        label="Banner photo (computer — wide)"
        value={slide.image}
        folder="site"
        onChange={(url) => set('image', url)}
      />
      <div className="mt-3">
        <ImageField
          label="Banner photo for phones (tall — optional)"
          value={slide.mobileImage}
          folder="site"
          onChange={(url) => set('mobileImage', url)}
        />
        <p className="mt-1 text-xs text-slate-500">
          {t(
            'On a phone the banner is taller than it is wide, so a wide photo loses its sides. Upload a tall version here — about 720 × 880 — or leave it empty to crop the wide one.',
          )}
        </p>
      </div>

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
      )}
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

/**
 * A settings group that stays folded away until it's needed, so the page
 * is a short list of headings rather than one long scroll. The first one
 * opens by default so the page doesn't look empty.
 */
function Section({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <span>
          <span className="block text-base font-bold text-slate-900">{t(title)}</span>
          {hint && <span className="mt-0.5 block text-xs text-slate-500">{t(hint)}</span>}
        </span>
        <span className={`flex-none text-slate-400 transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="space-y-4 border-t border-slate-100 p-5">{children}</div>}
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
