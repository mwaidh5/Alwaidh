import { useEffect, useState } from 'react';
import { subscribePriceRows, SEED_PRICE_ROWS, type PriceRow } from '../lib/solarPricesStore';
import { useSettings } from '../lib/useSettings';

const COMPANY = 'شركة الواعظ للقدرة';
const SUBTITLE = 'المنظومات المخفضة';
const PHONE = '0781 0150 876';
const WEBSITE = 'www.alwaidhpower.com';
const ADDRESS = 'بغداد, شارع الصناعة — مقابل رئاسة الجامعة التكنلوجية';

export default function SolarPrices() {
  const [live, setLive] = useState<PriceRow[]>([]);
  const [downloading, setDownloading] = useState(false);
  const settings = useSettings();
  const columns = settings.solarPriceColumns;

  useEffect(() => subscribePriceRows(setLive), []);
  const rows = live.length ? live : SEED_PRICE_ROWS;

  async function downloadPdf() {
    const el = document.getElementById('price-sheet');
    if (!el) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('alwaidh-solar-prices.pdf');
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

        <div className="overflow-x-auto">
          <div
            id="price-sheet"
            dir="rtl"
            className="mx-auto w-[1100px] max-w-none bg-gradient-to-b from-sky-400 via-sky-300 to-sky-100 p-10 text-slate-900"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {settings.logoImage ? (
                  <img src={settings.logoImage} alt="" className="h-16 w-auto" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-xl bg-white/70 text-2xl font-black text-sky-700">
                    ☀
                  </div>
                )}
                <div className="text-right leading-tight">
                  <p className="text-xl font-black text-slate-800">SolarMax®</p>
                  <p className="text-sm font-bold text-slate-700">الواعظ للقدرة</p>
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-4xl font-black text-slate-900">{COMPANY}</h2>
                <p className="mt-1 text-lg font-extrabold text-red-600">{SUBTITLE}</p>
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
              <div className="space-y-1">
                <p>📞 {PHONE}</p>
                <p>🌐 {WEBSITE}</p>
              </div>
              <div className="text-left leading-snug">
                <p>العنوان : {ADDRESS}</p>
              </div>
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
