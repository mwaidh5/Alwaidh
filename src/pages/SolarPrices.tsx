import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribePriceRows, SEED_PRICE_ROWS, type PriceRow } from '../lib/solarPricesStore';
import { useSettings } from '../lib/useSettings';
import { saveFile } from '../lib/savePdf';
import { openChat } from '../lib/chatPanel';
import { useLang } from '../lib/i18n';

const COMPANY = 'شركة الواعظ للقدرة';
const PHONE = '0781 0150 876';
const WEBSITE = 'www.alwaidhpower.com';
const ADDRESS = 'بغداد, شارع الصناعة — مقابل رئاسة الجامعة التكنلوجية';

export default function SolarPrices() {
  const { t } = useLang();
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
  const specCols = columns.filter((c) => c.key !== 'capacity');

  return (
    <div className="bg-slate-50 py-8">
      <div className="container-page">
        {/* ---- header, from the design: chip, title, brand mark ---- */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold tracking-wide text-blue-700">
              ⚡ {t('System prices')}
            </span>
            <h1 className="mb-2 mt-3 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
              {t('Solar power systems')}
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-slate-500">
              {t(
                'Complete prices including panels, inverter, batteries and installation. Prices are in Iraqi dinar and can change with stock.',
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-end">
              <div className="text-sm font-extrabold tracking-tight text-slate-900">
                SolarMax<sup className="text-[8px]">®</sup>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">الواعظ للقدرة</div>
            </div>
            <button type="button" onClick={downloadPdf} disabled={downloading} className="btn-primary">
              {downloading ? t('Preparing…') : `⬇ ${t('Download PDF')}`}
            </button>
          </div>
        </div>

        {/* ---- phones: one card per system ---- */}
        <div className="grid gap-4 lg:hidden">
          {rows.map((row) => {
            const cap = splitCapacity(row.values['capacity'] ?? '');
            return (
              <article
                key={row.id}
                className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6"
              >
                <div className="flex items-baseline gap-1.5">
                  <span dir="ltr" className="text-4xl font-extrabold leading-none tracking-tight text-slate-900">
                    {cap.n}
                  </span>
                  <span className="text-lg font-bold text-slate-700">{cap.unit || t('ampere')}</span>
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
                          <dt className="text-[13px] text-slate-400">{c.label}</dt>
                          <dd className="max-w-[12rem] text-end text-[13px] font-bold leading-relaxed text-slate-800">
                            {v}
                          </dd>
                        </div>
                      );
                    })}
                </dl>
                <div className="mt-auto flex flex-col gap-2.5 border-t border-slate-100 pt-4">
                  {row.values['price'] && row.values['price'] !== '-' && (
                    <div className="flex items-baseline gap-1.5">
                      <span dir="ltr" className="text-2xl font-extrabold tracking-tight text-slate-900">
                        {row.values['price']}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">{t('IQD')}</span>
                    </div>
                  )}
                  {row.values['priceWithInverter'] && row.values['priceWithInverter'] !== '-' && (
                    <div className="text-xs text-slate-500">
                      {columns.find((c) => c.key === 'priceWithInverter')?.label}:{' '}
                      <span dir="ltr" className="font-extrabold text-orange-600">
                        {row.values['priceWithInverter']}
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

        {/* ---- desktop: the comparison table ---- */}
        <div className="hidden overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-xl shadow-slate-900/5 lg:block">
          <div
            className="grid items-center gap-3 rounded-t-2xl bg-slate-900 px-6 py-4"
            style={gridStyle}
          >
            {columns.map((c) => (
              <div
                key={c.key}
                className={`text-[13px] font-bold ${isPrice(c.key) || c.key === 'capacity' ? 'text-white' : 'text-slate-300'}`}
              >
                {c.label}
                {c.sub && <span className="ms-1.5 text-[11px] font-semibold text-slate-400">{c.sub}</span>}
              </div>
            ))}
          </div>
          {rows.map((row) => {
            const cap = splitCapacity(row.values['capacity'] ?? '');
            return (
              <div
                key={row.id}
                className="grid items-center gap-3 border-b border-slate-200 px-6 py-5 transition last:border-b-0 hover:bg-blue-50/50"
                style={gridStyle}
              >
                {columns.map((c) =>
                  c.key === 'capacity' ? (
                    <div key={c.key} className="flex items-center gap-2.5">
                      <span className="h-6 w-1 flex-none rounded-full bg-brand-600" />
                      <span className="text-lg font-black text-slate-900">
                        <span dir="ltr">{cap.n}</span> {cap.unit}
                      </span>
                    </div>
                  ) : (
                    <div
                      key={c.key}
                      dir={isPrice(c.key) ? 'ltr' : undefined}
                      className={
                        isPrice(c.key)
                          ? `text-lg font-extrabold tracking-tight ${c.key === 'priceWithInverter' ? 'text-orange-600' : 'text-slate-900'} text-start`
                          : 'text-sm leading-relaxed text-slate-600'
                      }
                    >
                      {row.values[c.key] || '—'}
                    </div>
                  ),
                )}
              </div>
            );
          })}
        </div>

        {/* ---- footer strip: where we are, and the door ---- */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-white p-6 ring-1 ring-inset ring-slate-200">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-slate-900">{ADDRESS}</span>
            <span className="text-[13px] text-slate-500">
              {t('For enquiries and installation:')}{' '}
              <span dir="ltr" className="font-bold text-slate-700">
                {PHONE}
              </span>{' '}
              · <span className="font-semibold text-brand-700">{WEBSITE}</span>
            </span>
          </div>
          <Link
            to="/about"
            className="rounded-full bg-brand-600 px-8 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
          >
            {t('Request a quote')}
          </Link>
        </div>

        {saveError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-800">
            {saveError}
          </p>
        )}

        {/* The poster itself. Kept in the page on phones rather than
            hidden, because "Download PDF" photographs this element and
            display:none has nothing to photograph — so it is parked
            off-screen instead. */}
        <div className="fixed -left-[9999px] top-0 sm:static sm:left-auto sm:overflow-x-auto">
          <div
            id="price-sheet"
            dir="rtl"
            style={{ fontFamily: "'Janna LT', 'Tajawal', sans-serif" }}
            className="mx-auto w-[1100px] max-w-none bg-gradient-to-b from-sky-400 via-sky-300 to-sky-100 p-10 text-slate-900"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {settings.logoImage && (
                  <img src={settings.logoImage} alt="" className="h-16 w-auto" />
                )}
                <div className="text-right leading-tight">
                  <p className="text-xl font-black text-slate-800">SolarMax®</p>
                  <p className="text-sm font-bold text-slate-700">الواعظ للقدرة</p>
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-4xl font-black text-slate-900">{COMPANY}</h2>
              </div>
              <div className="w-24" />
            </div>

            {/* Column headers */}
            <div className="mt-8 grid gap-2 px-3 pb-2 text-center text-sm font-extrabold text-slate-800" style={gridStyle}>
              {columns.map((c) => (
                <div key={c.key}>
                  {c.label}
                  {c.sub && <span className="block text-[10px] font-bold text-slate-600">{c.sub}</span>}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid items-center gap-2 rounded-full bg-white/75 px-3 py-4 text-center text-sm shadow-sm"
                  style={gridStyle}
                >
                  {columns.map((c, i) => (
                    <div
                      key={c.key}
                      className={
                        i === 0 || c.key === 'price' || c.key === 'priceWithInverter'
                          ? 'text-base font-black text-slate-900'
                          : 'font-semibold text-slate-800'
                      }
                    >
                      {row.values[c.key] || '-'}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-8 flex items-end justify-between text-sm font-bold text-slate-800">
              <div className="space-y-1 text-left">
                <p dir="ltr">📞 {PHONE}</p>
                <p dir="ltr">{WEBSITE}</p>
              </div>
              <div className="text-left leading-snug">
                <p>العنوان : {ADDRESS}</p>
              </div>
            </div>
          </div>
        </div>

        {saveError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-800">
            {saveError}
          </p>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          Prices are managed from the admin dashboard. Tap “Download PDF” to save or share this sheet.
        </p>
      </div>
    </div>
  );
}
