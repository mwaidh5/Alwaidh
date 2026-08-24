import { useEffect, useState } from 'react';
import { subscribePriceRows, SEED_PRICE_ROWS, type PriceRow } from '../lib/solarPricesStore';
import { useSettings } from '../lib/useSettings';
import { saveFile } from '../lib/savePdf';
import { openChat } from '../lib/chatPanel';
import { useLang } from '../lib/i18n';

/* The sheet's data lives in the admin dashboard as Arabic text. For the
   English site we translate at display time: column names by key, and the
   handful of phrases the cells are built from. Anything unrecognised
   passes through unchanged, so custom admin edits still show up. */
const EN_COLUMN_LABELS: Record<string, string> = {
  capacity: 'Capacity',
  inverter: 'Inverter',
  panels: 'Panels',
  batteries: 'Batteries',
  backup: 'Backup hours',
  price: 'Price',
  priceWithInverter: 'Price with IP65 inverter',
};
const EN_PHRASES: Array<[RegExp, string]> = [
  [/ثلاث بطاريات ليثيوم/g, '3× lithium batteries'],
  [/بطاريتين ليثيوم/g, '2× lithium batteries'],
  [/بطاريتين حامضية/g, '2× acid batteries'],
  [/بطاريات ليثيوم/g, 'lithium batteries'],
  [/بطارية ليثيوم/g, 'lithium battery'],
  [/بطاريتين/g, '2 batteries'],
  [/بطاريات/g, 'batteries'],
  [/بطارية/g, 'battery'],
  [/ليثيوم/g, 'lithium'],
  [/حامضية/g, 'acid'],
  [/كيلو واط/g, 'kW'],
  [/واط/g, 'W'],
  [/[أا]مبير/g, 'Amp'],
  [/ساعات/g, 'hours'],
  [/ساعة/g, 'hours'],
];
const PHONE = '0781 0150 876';
const WEBSITE = 'www.alwaidhpower.com';
const ADDRESS = 'بغداد, شارع الصناعة — مقابل رئاسة الجامعة التكنلوجية';
const ADDRESS_EN = 'Baghdad, Sinaa Street — opposite the University of Technology';

export default function SolarPrices() {
  const { t, lang } = useLang();
  const en = lang === 'en';
  /** An Arabic sheet value, in the page's language. */
  function localize(v: string): string {
    if (!en || !v) return v;
    let out = v;
    for (const [re, to] of EN_PHRASES) out = out.replace(re, to);
    return out.replace(/\s+/g, ' ').trim();
  }
  const columnLabel = (c: { key: string; label: string }) =>
    en ? (EN_COLUMN_LABELS[c.key] ?? c.label) : c.label;
  const [live, setLive] = useState<PriceRow[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const settings = useSettings();
  const columns = settings.solarPriceColumns;

  useEffect(() => subscribePriceRows(setLive), []);
  const rows = live.length ? live : SEED_PRICE_ROWS;

  async function downloadPdf() {
    const el = document.getElementById('price-sheet');
    if (!el) return;
    setDownloading(true);
    setSaveError('');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      // JPEG, not PNG: the sheet is mostly a photographic gradient, which
      // PNG stores pixel by pixel — the file came out over 10 MB, too big
      // to send anyone. At this resolution the difference is invisible.
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      // Not pdf.save(): that is an <a download> click, which a web view
      // has nothing to catch — in the app the button did nothing at all.
      const result = await saveFile(pdf.output('blob'), 'alwaidh-solar-prices.pdf');
      if (result === 'failed') {
        setSaveError('Could not save the file on this device. Open alwaidh.com in a browser to download it.');
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not prepare the file.');
    } finally {
      setDownloading(false);
    }
  }

  const gridStyle = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };

  /** "4 امبير" → the big number and whatever follows it. */
  function splitCapacity(v: string): { n: string; unit: string } {
    const m = /([0-9]+)/.exec(v ?? '');
    if (!m) return { n: v ?? '—', unit: '' };
    return { n: m[1], unit: (v ?? '').replace(m[1], '').trim() };
  }
  const isPrice = (key: string) => key === 'price' || key === 'priceWithInverter';
  /** A price cell with its column label, or null when the row has none. */
  function pickPrice(row: PriceRow, key: string): { value: string; label: string } | null {
    const v = row.values[key];
    if (!v || v === '-') return null;
    const col = columns.find((c) => c.key === key);
    if (!col) return { value: v, label: '' };
    const label = columnLabel(col);
    return { value: v, label: col.sub && !label.includes(col.sub) ? `${label} ${col.sub}` : label };
  }
  const specCols = columns.filter((c) => c.key !== 'capacity');
  /** A cell for the photographed sheet, with each number pinned LTR so
      html2canvas can't scatter its digits when the line wraps. */
  function sheetCell(v: string) {
    return v.split(/(\d[\d,.]*)/g).map((part, i) =>
      /^\d/.test(part) ? (
        <span key={i} dir="ltr" style={{ unicodeBidi: 'isolate' }}>
          {part}
        </span>
      ) : (
        part
      ),
    );
  }

  return (
    <div className="bg-slate-50 py-8">
      <div className="container-page">
        {/* ---- header, from the design: chip, title, the IP switch ---- */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5 text-xs font-bold tracking-wide text-brand-700">
              ⚡ {t('System prices')}
            </span>
            <h1 className="mb-2 mt-3 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
              {t('Choose your system')}
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-slate-500">
              {t(
                'Ready systems by consumption size — the price includes panels, inverter, batteries and installation.',
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button type="button" onClick={downloadPdf} disabled={downloading} className="btn-secondary">
              {downloading ? t('Preparing…') : `⬇ ${t('Download PDF')}`}
            </button>
          </div>
        </div>

        {/* ---- the system cards, every screen size ---- */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const cap = splitCapacity(localize(row.values['capacity'] ?? ''));
            const main = pickPrice(row, 'price');
            const other = pickPrice(row, 'priceWithInverter');
            return (
              <article
                key={row.id}
                className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span dir="ltr" className="text-4xl font-extrabold leading-none tracking-tight text-slate-900">
                      {cap.n}
                    </span>
                    <span className="text-lg font-bold text-slate-700">{cap.unit || t('Amp')}</span>
                  </div>
                  {/* The shop's bread-and-butter size, badged like the
                      design. Move it by changing which capacity matches. */}
                  {cap.n === '20' && (
                    <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-extrabold text-amber-800">
                      {t('Most requested')}
                    </span>
                  )}
                </div>
                <dl>
                  {specCols
                    .filter((c) => !isPrice(c.key))
                    .map((c) => {
                      const v = row.values[c.key];
                      if (!v || v === '-') return null;
                      return (
                        <div
                          key={c.key}
                          className="flex items-start justify-between gap-3 border-b border-dashed border-slate-200 py-2.5 last:border-b-0"
                        >
                          <dt className="text-[13px] text-slate-400">{columnLabel(c)}</dt>
                          <dd className="max-w-[12rem] text-end text-[13px] font-bold leading-relaxed text-slate-800">
                            {localize(v)}
                          </dd>
                        </div>
                      );
                    })}
                </dl>
                <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-4">
                  {main && (
                    <div className="flex items-baseline gap-1.5">
                      <span dir="ltr" className="text-[26px] font-extrabold tracking-tight text-slate-900">
                        {main.value}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{t('IQD')}</span>
                    </div>
                  )}
                  {other && (
                    <div className="text-xs text-slate-500">
                      {other.label}:{' '}
                      <span dir="ltr" className="font-extrabold text-brand-600">
                        {other.value}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={openChat}
                    className="mt-1.5 w-full rounded-full border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-900 transition hover:border-brand-600 hover:bg-brand-600 hover:text-white"
                  >
                    {t('Ask about this system')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* ---- the design's slim footer line ---- */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-[13px] text-slate-500">
          <span>
            {ADDRESS} ·{' '}
            <span dir="ltr" className="font-bold text-slate-700">
              {PHONE}
            </span>
          </span>
          <span className="font-bold text-brand-700">{WEBSITE}</span>
        </div>

        {saveError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-800">
            {saveError}
          </p>
        )}

        {/* The poster itself. Kept in the page rather than hidden,
            because "Download PDF" photographs this element and
            display:none has nothing to photograph — so it is parked
            off-screen instead. It follows the page's language, and it
            never uses negative letter-spacing: html2canvas paints
            spaced text letter by letter, which severs Arabic ligatures. */}
        <div aria-hidden className="fixed -left-[9999px] top-0">
          <div
            id="price-sheet"
            dir={en ? 'ltr' : 'rtl'}
            style={{
              fontFamily: en ? "'Inter', system-ui, sans-serif" : "'Janna LT', 'Tajawal', sans-serif",
              letterSpacing: 0,
            }}
            className="mx-auto w-[1100px] max-w-none bg-white p-12 text-slate-900"
          >
            {/* Header: chip + title on one side, the logos on the other */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700">
                  ⚡ {t('System prices')}
                </span>
                <h2 className="mb-2 mt-3 text-5xl font-black text-slate-900">
                  {t('Solar power systems')}
                </h2>
                <p className="text-base leading-relaxed text-slate-500">
                  {t(
                    'Complete prices including panels, inverter, batteries and installation. Prices are in Iraqi dinar and can change with stock.',
                  )}
                </p>
              </div>
              <div className="flex flex-none items-center gap-4 pt-1">
                {settings.solarLogo ? (
                  <img src={settings.solarLogo} alt="SolarMax" className="h-20 w-auto" />
                ) : (
                  <div dir="ltr" className="text-start leading-tight">
                    <p className="text-xl font-black text-slate-900">SolarMax®</p>
                    <p className="text-sm font-bold text-slate-500">الواعظ للقدرة</p>
                  </div>
                )}
                {settings.logoImage && <img src={settings.logoImage} alt="" className="h-14 w-auto" />}
              </div>
            </div>

            {/* The table */}
            <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
              <div className="grid items-center gap-3 bg-brand-600 px-6 py-4" style={gridStyle}>
                {columns.map((c) => (
                  <div key={c.key} className="text-sm font-extrabold text-white">
                    {columnLabel(c)}
                    {!en && c.sub && !columnLabel(c).includes(c.sub) && (
                      <span className="block text-[10px] font-bold text-brand-100">{c.sub}</span>
                    )}
                  </div>
                ))}
              </div>
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid items-center gap-3 border-b border-slate-200 bg-white px-6 py-5 last:border-b-0"
                  style={gridStyle}
                >
                  {columns.map((c) =>
                    c.key === 'capacity' ? (
                      <div key={c.key} className="flex items-center gap-2.5">
                        <span className="h-6 w-1 flex-none rounded-full bg-brand-600" />
                        <span className="text-lg font-black text-slate-900">
                          {sheetCell(localize(row.values[c.key] ?? '') || '—')}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={c.key}
                        dir={isPrice(c.key) ? 'ltr' : undefined}
                        className={
                          isPrice(c.key)
                            ? `text-start text-lg font-extrabold ${
                                c.key === 'priceWithInverter' ? 'text-brand-600' : 'text-slate-900'
                              }`
                            : 'text-sm leading-relaxed text-slate-600'
                        }
                      >
                        {isPrice(c.key)
                          ? row.values[c.key] || '—'
                          : sheetCell(localize(row.values[c.key] ?? '') || '—')}
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>

            {/* Footer: where we are — the door stays on the website */}
            <div className="mt-8 flex items-center justify-between gap-6 border-t border-slate-200 pt-6">
              <div className="leading-relaxed">
                <p className="text-base font-bold text-slate-900">{en ? ADDRESS_EN : ADDRESS}</p>
                <p className="text-sm text-slate-500">
                  {t('For enquiries and installation:')}{' '}
                  <span dir="ltr" className="font-bold text-slate-700">
                    {PHONE}
                  </span>{' '}
                  · <span className="font-bold text-brand-700">{WEBSITE}</span>
                </p>
              </div>
              {settings.solarLogo && <img src={settings.solarLogo} alt="" className="h-12 w-auto opacity-90" />}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          Prices are managed from the admin dashboard. Tap “Download PDF” to save or share this sheet.
        </p>
      </div>
    </div>
  );
}
