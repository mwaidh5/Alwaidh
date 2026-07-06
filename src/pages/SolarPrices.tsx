import { useEffect, useState } from 'react';
import { subscribeSolarPrices, SEED_PRICES, type SolarPrice } from '../lib/solarPricesStore';
import { useSettings } from '../lib/useSettings';

const COMPANY = 'شركة الواعظ للقدرة';
const SUBTITLE = 'المنظومات المخفضة';
const PHONE = '0781 0150 876';
const WEBSITE = 'www.alwaidhpower.com';
const ADDRESS = 'بغداد, شارع الصناعة — مقابل رئاسة الجامعة التكنلوجية';

export default function SolarPrices() {
  const [live, setLive] = useState<SolarPrice[]>([]);
  const [downloading, setDownloading] = useState(false);
  const settings = useSettings();

  useEffect(() => subscribeSolarPrices(setLive), []);
  const prices = live.length ? live : SEED_PRICES;

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

  return (
    <div className="bg-slate-50 py-8">
      <div className="container-page">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-slate-900">Solar System Prices</h1>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading}
            className="btn-primary"
          >
            {downloading ? 'Preparing…' : '⬇ Download PDF'}
          </button>
        </div>

        {/* The price sheet — this element is what gets captured into the PDF. */}
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
            <div className="mt-8 grid grid-cols-7 gap-2 px-3 pb-2 text-center text-sm font-extrabold text-slate-800">
              <div>السعة</div>
              <div>العاكسة</div>
              <div>عدد الألواح</div>
              <div>البطاريات</div>
              <div>
                ساعات التغذية
                <span className="block text-[10px] font-bold text-slate-600">Backup Time</span>
              </div>
              <div>السعر</div>
              <div>
                السعر مع انفيرتر
                <span className="block text-[10px] font-bold text-slate-600">IP65</span>
              </div>
            </div>

            {/* Rows */}
            <div className="space-y-3">
              {prices.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-7 items-center gap-2 rounded-full bg-white/75 px-3 py-4 text-center text-sm shadow-sm"
                >
                  <div className="text-base font-black text-slate-900">{p.capacity}</div>
                  <div className="font-semibold text-slate-800">{p.inverter}</div>
                  <div className="font-semibold text-slate-800">{p.panels}</div>
                  <div className="font-semibold text-slate-800">{p.batteries}</div>
                  <div className="font-semibold text-slate-800">{p.backup}</div>
                  <div className="text-base font-black text-slate-900">{p.price || '-'}</div>
                  <div className="text-base font-black text-slate-900">{p.priceWithInverter || '-'}</div>
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
