import { useEffect, useState } from 'react';
import { subscribePriceRows, SEED_PRICE_ROWS, type PriceRow } from '../lib/solarPricesStore';
import { useSettings } from '../lib/useSettings';
import { saveFile } from '../lib/savePdf';

const COMPANY = 'شركة الواعظ للقدرة';
const PHONE = '0781 0150 876';
const WEBSITE = 'www.alwaidhpower.com';
const ADDRESS = 'بغداد, شارع الصناعة — مقابل رئاسة الجامعة التكنلوجية';

export default function SolarPrices() {
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

  return (
    <div className="bg-slate-50 py-8">
      <div className="container-page">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-slate-900">Solar System Prices</h1>
          <button type="button" onClick={downloadPdf} disabled={downloading} className="btn-primary">
            {downloading ? 'Preparing…' : '⬇ Download PDF'}
          </button>
        </div>

        {/* One card per system, for a screen too narrow to take the sheet.
            The sheet below is 1100px wide because it is a poster — that is
            what the PDF is — so on a phone it became a strip you scrolled
            sideways through, three columns at a time. */}
        <div className="space-y-3 sm:hidden">
          {rows.map((row) => (
            <article key={row.id} dir="rtl" className="card overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 bg-sky-100 px-4 py-3">
                <h2 className="text-lg font-extrabold text-slate-900">
                  {row.values[columns[0]?.key ?? ''] || '—'}
                </h2>
                <span className="text-xs font-bold text-slate-600">{columns[0]?.label}</span>
              </div>
              <dl className="divide-y divide-slate-100">
                {columns.slice(1).map((c) => {
                  const value = row.values[c.key];
                  // A dash for every empty cell is noise on a phone; the
                  // sheet keeps them because a table needs its grid.
                  if (!value || value === '-') return null;
                  const money = c.key === 'price' || c.key === 'priceWithInverter';
                  return (
                    <div key={c.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <dt className="text-sm text-slate-500">
                        {c.label}
                        {c.sub && <span className="ms-1 text-[11px] text-slate-400">{c.sub}</span>}
                      </dt>
                      <dd
                        className={
                          money
                            ? 'text-base font-black text-slate-900'
                            : 'text-sm font-semibold text-slate-800'
                        }
                      >
                        {value}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>

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
