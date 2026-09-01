import { useEffect, useState } from 'react';
import { subscribePriceRows, SEED_PRICE_ROWS, type PriceRow } from '../lib/solarPricesStore';
import {
  subscribeInstallmentRows,
  SEED_INSTALLMENT_ROWS,
  planTotal,
  planMonthly,
  FULL_YEARS,
  type InstallmentRow,
} from '../lib/solarInstallmentsStore';
import { useSettings } from '../lib/useSettings';
import { saveFile } from '../lib/savePdf';
import { openChat } from '../lib/chatPanel';
import { useSeo, organizationJsonLd } from '../lib/seo';
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
  [/بطارية واحدة/g, 'one battery'],
  [/ثلاث بطاريات/g, '3 batteries'],
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
const PHONE = '0774 420 5582';
const WEBSITE = 'alwaidh.com';
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
  const [instLive, setInstLive] = useState<InstallmentRow[]>([]);
  // Which price list is showing, and how long the payment plan runs.
  const [mode, setMode] = useState<'cash' | 'plan'>('cash');
  // A one-time coach mark pointing at the cash/installments switch —
  // gone forever once dismissed, or the moment the switch is used.
  const HINT_KEY = 'alwaidh.instHint.v1';
  const [showHint, setShowHint] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === null;
    } catch {
      return false;
    }
  });
  function dismissHint() {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* private mode — it just shows again next visit */
    }
  }
  const [years, setYears] = useState(FULL_YEARS);
  const [downloading, setDownloading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const settings = useSettings();
  const columns = settings.solarPriceColumns;

  useSeo({
    title:
      lang === 'ar'
        ? 'أسعار منظومات الطاقة الشمسية في العراق — نقداً وبالتقسيط | الواعظ للقدرة'
        : 'Solar Energy System Prices in Iraq — Cash & Installments | Alwaidh',
    description:
      lang === 'ar'
        ? 'أسعار منظومات الطاقة الشمسية الكاملة في العراق: ألواح Jinko، انفيرترات IP65، بطاريات ليثيوم — تشمل التركيب. نقداً أو بالتقسيط ضمن مبادرة البنك المركزي حتى 7 سنوات.'
        : 'Complete solar system prices for Iraq: Jinko panels, IP65 inverters, lithium batteries — installation included. Cash or Central Bank initiative installments up to 7 years.',
    path: '/solar-prices',
    jsonLd: organizationJsonLd(),
  });

  useEffect(() => subscribePriceRows(setLive), []);
  useEffect(() => subscribeInstallmentRows(setInstLive), []);
  const rows = live.length ? live : SEED_PRICE_ROWS;
  const instRows = instLive.length ? instLive : SEED_INSTALLMENT_ROWS;
  const money = (n: number) => n.toLocaleString('en-GB');

  async function downloadPdf() {
    const el = document.getElementById(mode === 'plan' ? 'installments-sheet' : 'price-sheet');
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
      // A real A4 page, filled edge to edge: the sheets are drawn at the
      // A4 aspect (1:1.414), so the photograph maps onto the full paper
      // and printing leaves no margins to shrink into.
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
      // Not pdf.save(): that is an <a download> click, which a web view
      // has nothing to catch — in the app the button did nothing at all.
      const result = await saveFile(
        pdf.output('blob'),
        mode === 'plan' ? 'alwaidh-solar-installments.pdf' : 'alwaidh-solar-prices.pdf',
      );
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
            <div className="relative">
            {showHint && (
              <div className="absolute bottom-full right-0 z-10 mb-3 w-60 animate-bounce">
                <div className="relative rounded-xl bg-brand-600 px-3.5 py-2.5 pe-8 text-[13px] font-semibold leading-snug text-white shadow-lg">
                  {t('From here you can switch between cash prices and installment plans 👇')}
                  <button
                    type="button"
                    onClick={dismissHint}
                    aria-label={t('Close')}
                    className="absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[11px] leading-none hover:bg-white/35"
                  >
                    ✕
                  </button>
                  {/* the arrow tip, pointing at the switch */}
                  <span
                    aria-hidden
                    className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 bg-brand-600"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
              {(
                [
                  { key: 'cash', label: 'Cash prices' },
                  { key: 'plan', label: 'Installments' },
                ] as const
              ).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => {
                    setMode(o.key);
                    if (showHint) dismissHint();
                  }}
                  className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${
                    mode === o.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {t(o.label)}
                </button>
              ))}
            </div>
            </div>
          </div>
        </div>

        {/* ---- installments: the Central Bank initiative systems ---- */}
        {mode === 'plan' && (
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-700">{t('Central Bank initiative — pay monthly')}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="me-1 text-xs font-semibold text-slate-500">{t('Plan length')}</span>
                {Array.from({ length: FULL_YEARS }, (_, i) => i + 1).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYears(y)}
                    className={`h-8 w-8 rounded-full text-[13px] font-bold transition sm:h-9 sm:w-9 sm:text-sm ${
                      years === y
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:ring-brand-300'
                    }`}
                  >
                    {y}
                  </button>
                ))}
                <span className="ms-1 text-xs font-semibold text-slate-500">
                  {t(years === 1 ? 'year' : 'years')}
                </span>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {instRows.map((row) => (
                <article
                  key={row.id}
                  className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10"
                >
                  <div className="flex items-baseline gap-1.5">
                    <span dir="ltr" className="text-4xl font-extrabold leading-none tracking-tight text-slate-900">
                      {row.sizeAmp}
                    </span>
                    <span className="text-lg font-bold text-slate-700">{t('Amp')}</span>
                  </div>
                  <dl>
                    {(
                      [
                        [t('Inverter'), `${row.inverterKw} KW IP65`, ''],
                        [t('Panels'), `${row.panelsCount} × Jinko 650W`, ''],
                        // The size leads; how many batteries make it up is
                        // the small print underneath.
                        [t('Batteries'), `${row.batteryKwh} KWh`, localize(row.batteryLabel)],
                        [t('Backup hours'), `${row.backupHours} ${t('hours')}`, ''],
                      ] as [string, string, string][]
                    ).map(([k, v, sub]) => (
                      <div
                        key={k}
                        className="flex items-start justify-between gap-3 border-b border-dashed border-slate-200 py-2.5 last:border-b-0"
                      >
                        <dt className="text-[13px] text-slate-400">{k}</dt>
                        <dd
                          dir="ltr"
                          style={{ unicodeBidi: 'isolate' }}
                          className="max-w-[12rem] text-end text-[13px] font-bold leading-relaxed text-slate-800"
                        >
                          {v}
                          {sub && (
                            <span dir="auto" className="block text-[11px] font-semibold text-slate-400">
                              {sub}
                            </span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-auto flex flex-col gap-1.5 border-t border-slate-100 pt-4">
                    <div className="flex items-baseline gap-1.5">
                      <span dir="ltr" className="text-[26px] font-extrabold tracking-tight text-brand-600">
                        {money(planMonthly(row.price7, years))}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {t('IQD')} / {t('monthly')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {t('Total price')}:{' '}
                      <span dir="ltr" className="font-extrabold text-slate-800">
                        {money(planTotal(row.price7, years))}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openChat(
                          t('Hi! I am interested in the {system} installment system on a {years}-year plan — could you give me the details?')
                            .replace('{system}', `${row.sizeKw} KW / ${row.sizeAmp} A`)
                            .replace('{years}', String(years)),
                        )
                      }
                      className="mt-2 w-full rounded-full border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-900 transition hover:border-brand-600 hover:bg-brand-600 hover:text-white"
                    >
                      {t('Ask about this system')}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
              {t(
                'Prices include installation and commissioning. IP65 inverter with internet monitoring and a 5-year warranty; 16 KWh IP20 lithium batteries, 8000 cycles, 5-year warranty; Jinko 650W panels with a 15-year warranty.',
              )}
            </p>
          </div>
        )}

        {/* ---- the system cards, every screen size ---- */}
        {mode === 'cash' && (
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
                    onClick={() =>
                      openChat(
                        t('Hi! I am interested in the {system} system — could you give me the details?').replace(
                          '{system}',
                          `${cap.n} ${cap.unit || t('Amp')}`,
                        ),
                      )
                    }
                    className="mt-1.5 w-full rounded-full border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-900 transition hover:border-brand-600 hover:bg-brand-600 hover:text-white"
                  >
                    {t('Ask about this system')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        )}

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
            className="mx-auto flex min-h-[778px] w-[1100px] max-w-none flex-col bg-white p-8 text-slate-900"
          >
            {/* Header: chip + title on one side, the logos on the other */}
            <div className="flex items-start justify-between gap-6">
              <div>
                <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700">
                  ⚡ {t('System prices')}
                </span>
                <h2 className="mb-1 mt-2.5 text-3xl font-black text-slate-900">
                  {t('Solar power systems')}
                </h2>
                <p className="text-sm leading-relaxed text-slate-500">
                  {t(
                    'Complete prices including panels, inverter, batteries and installation. Prices are in Iraqi dinar and can change with stock.',
                  )}
                </p>
              </div>
              <div className="flex flex-none items-center gap-4 pt-1">
                {settings.solarLogo ? (
                  <img src={settings.solarLogo} alt="SolarMax" className="h-10 w-auto" />
                ) : (
                  <div dir="ltr" className="text-start leading-tight">
                    <p className="text-xl font-black text-slate-900">SolarMax®</p>
                    <p className="text-sm font-bold text-slate-500">الواعظ للقدرة</p>
                  </div>
                )}
                {settings.logoImage && <img src={settings.logoImage} alt="" className="h-10 w-auto" />}
              </div>
            </div>

            {/* The table */}
            <div className="mt-5 flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200">
              <div className="grid items-center gap-3 bg-brand-600 px-6 py-2.5" style={gridStyle}>
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
                  className="grid flex-1 items-center gap-3 border-b border-slate-200 bg-white px-6 py-2.5 last:border-b-0"
                  style={gridStyle}
                >
                  {columns.map((c) =>
                    c.key === 'capacity' ? (
                      <div key={c.key} className="flex items-center gap-2.5">
                        <span className="h-6 w-1 flex-none rounded-full bg-brand-600" />
                        <span className="text-xl font-black text-slate-900">
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
                            : 'text-[15px] leading-relaxed text-slate-600'
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
            <div className="mt-auto flex items-center justify-between gap-6 border-t border-slate-200 pt-3">
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
              {settings.solarLogo && <img src={settings.solarLogo} alt="" className="h-10 w-auto opacity-90" />}
            </div>
          </div>
        </div>

        {/* The installments sheet, photographed when the installments
            view is open. Same rules as its sibling: parked off-screen,
            no letter-spacing, digits pinned LTR. */}
        <div aria-hidden className="fixed -left-[9999px] top-0">
          <div
            id="installments-sheet"
            dir={en ? 'ltr' : 'rtl'}
            style={{
              fontFamily: en ? "'Inter', system-ui, sans-serif" : "'Janna LT', 'Tajawal', sans-serif",
              letterSpacing: 0,
            }}
            className="mx-auto flex min-h-[877px] w-[1240px] max-w-none flex-col bg-white p-8 text-slate-900"
          >
            <div className="flex items-center justify-between gap-6">
              <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700">
                ⚡ {t('Installments')}
              </span>
              <div className="flex flex-none items-center gap-4">
                {settings.solarLogo ? (
                  <img src={settings.solarLogo} alt="SolarMax" className="h-10 w-auto" />
                ) : (
                  <div dir="ltr" className="text-start leading-tight">
                    <p className="text-xl font-black text-slate-900">SolarMax®</p>
                    <p className="text-sm font-bold text-slate-500">الواعظ للقدرة</p>
                  </div>
                )}
                {settings.logoImage && <img src={settings.logoImage} alt="" className="h-14 w-auto" />}
              </div>
            </div>
            <p className="mt-2 text-center text-lg font-black text-slate-800">شركة تقنية الواعظ</p>
            <h2 className="mb-1 mt-1 text-2xl font-black leading-snug text-slate-900">
              {t('Installment systems — Central Bank initiative')}
            </h2>
            <p className="text-sm leading-relaxed text-slate-500">
              {t('The total and the monthly payment for each plan length — 3, 5 and 7 years.')}
            </p>

            <div className="mt-5 flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200">
              <div
                className="grid items-center gap-3 bg-brand-600 px-6 py-2.5"
                style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}
              >
                {[
                  t('System'),
                  t('Inverter'),
                  t('Panels'),
                  t('Batteries'),
                  t('Backup hours'),
                  `3 ${t('years')}`,
                  `5 ${t('years')}`,
                  `7 ${t('years')}`,
                ].map((h) => (
                  <div key={h} className="text-center text-sm font-extrabold text-white">
                    {h}
                  </div>
                ))}
              </div>
              {instRows.map((row) => (
                <div
                  key={row.id}
                  className="grid flex-1 items-center gap-3 border-b border-slate-200 bg-white px-6 py-1.5 last:border-b-0"
                  style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}
                >
                  <div className="flex items-center justify-center gap-2.5">
                    <span className="h-6 w-1 flex-none rounded-full bg-brand-600" />
                    <span dir="ltr" className="text-xl font-black text-slate-900">
                      {row.sizeAmp} A
                    </span>
                  </div>
                  <div dir="ltr" className="text-center text-[15px] text-slate-600">{row.inverterKw} KW IP65</div>
                  <div dir="ltr" className="text-center text-[15px] text-slate-600">
                    {row.panelsCount}
                  </div>
                  <div className="text-center text-[15px] leading-tight text-slate-600">
                    <span dir="ltr" className="block">{row.batteryKwh} KWh</span>
                    <span className="block text-[12px] text-slate-400">{localize(row.batteryLabel)}</span>
                  </div>
                  <div dir="ltr" className="text-center text-[15px] text-slate-600">
                    {row.backupHours} {t('hours')}
                  </div>
                  {[3, 5, 7].map((y) => (
                    <div key={y} dir="ltr" className="text-center leading-tight">
                      <div
                        className={`text-[17px] font-extrabold tracking-tight ${
                          y === 7 ? 'text-brand-700' : 'text-slate-900'
                        }`}
                      >
                        {money(planTotal(row.price7, y))}
                      </div>
                      <div className="text-[13px] font-bold text-brand-600">
                        {money(planMonthly(row.price7, y))} / {t('month')}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl bg-slate-50 p-3">
              <p className="mb-1 text-sm font-extrabold text-slate-900">{t('Notes')}</p>
              {/* Hand-drawn bullets: html2canvas puts list markers on the
                  wrong side in RTL. */}
              <div className="space-y-0 text-[11px] leading-snug text-slate-600">
                {[
                  t('These prices include installation and commissioning; installation costs can vary by 10% depending on the site.'),
                  t('The inverter is IP65-rated with internet monitoring and a 5-year warranty.'),
                  t('The batteries are IP20-rated, 16 KWh, 8000 charge cycles at 90% depth of discharge, with a 5-year warranty.'),
                  t('The panels are Jinko — the world’s number one panel — rated 650W with a 15-year warranty.'),
                  t('The price includes the AC cable between the inverter and the national board up to 15 metres; any extra length is charged.'),
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-brand-600" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-8 border-t border-slate-200 pt-3">
              {(settings.brands ?? [])
                .filter((b) => /jinko|saj|hailei/i.test(b.name) && b.image)
                .map((b) => (
                  <img key={b.name} src={b.image} alt={b.name} className="h-7 w-auto object-contain" />
                ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-6 border-t border-slate-200 pt-3">
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
              {settings.solarLogo && <img src={settings.solarLogo} alt="" className="h-10 w-auto opacity-90" />}
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
