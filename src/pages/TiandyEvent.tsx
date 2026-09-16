import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '../lib/seo';
import {
  EVENT_ID,
  phoneLooksRight,
  registerForEvent,
  subscribeEventConfig,
  type EventConfig,
} from '../lib/eventStore';

/**
 * The event's sign-up page — the link that goes out on WhatsApp.
 *
 * Three fields and a button, in Tiandy's green, with nothing else on the
 * page to wander off to. Afterwards, the one place we do want them to
 * wander: the Tiandy cameras in the shop. Temporary: closed from the
 * dashboard after the event, and the route removed after that.
 */
const GREEN = '#3cc63c';
const DEEP = '#0f5a1f';
const DONE_KEY = `alwaidh.event.${EVENT_ID}`;

export default function TiandyEvent() {
  useSeo({ title: 'تسجيل الحضور — فعالية Tiandy | الواعظ', noindex: true });
  const [cfg, setCfg] = useState<EventConfig | null>(null);
  useEffect(() => subscribeEventConfig(setCfg), []);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [people, setPeople] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(DONE_KEY) === '1';
    } catch {
      return false;
    }
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('اكتب اسمك الكامل من فضلك.');
    if (!phoneLooksRight(phone)) return setError('رقم الهاتف لازم يكون 11 رقم ويبدأ بـ 07.');
    setBusy(true);
    try {
      await registerForEvent({ name, company, phone, people });
      try {
        localStorage.setItem(DONE_KEY, '1');
      } catch {
        /* private mode */
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('ما تم التسجيل. جرّب مرة ثانية أو اتصل بينا على 0774 420 5582.');
    } finally {
      setBusy(false);
    }
  }

  const title = cfg?.title || 'فعالية Tiandy';

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 pb-16">
      {/* The green band: the logo, the event, the date. */}
      <div className="px-4 pb-12 pt-10 text-white" style={{ background: `linear-gradient(160deg, ${DEEP} 0%, #157a2a 55%, ${GREEN} 100%)` }}>
        <div className="mx-auto max-w-lg">
          <div className="inline-flex items-center rounded-2xl bg-white px-4 py-2.5 shadow-md">
            <img src="/brands/tiandy-logo.png" alt="Tiandy" className="h-8 w-auto" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-white/70">تسجيل الحضور</p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight">{title}</h1>
          {(cfg?.date || cfg?.place) && (
            <div className="mt-3 space-y-1 text-sm font-semibold text-white/90">
              {cfg?.date && <p>🗓️ {cfg.date}</p>}
              {cfg?.place && <p>📍 {cfg.place}</p>}
            </div>
          )}
          {cfg?.note && <p className="mt-3 text-sm leading-relaxed text-white/85">{cfg.note}</p>}
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-lg px-4">
        {cfg && !cfg.open ? (
          <Closed />
        ) : done ? (
          <Thanks onAgain={() => {
            try {
              localStorage.removeItem(DONE_KEY);
            } catch {
              /* private mode */
            }
            setName('');
            setCompany('');
            setPhone('');
            setPeople(1);
            setDone(false);
          }} />
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <p className="text-sm text-slate-600">سجّل اسمك حتى نحجزلك مكان، والدعوة على حسابنا.</p>

            <label className="mt-5 block">
              <span className="mb-1 block text-sm font-bold text-slate-800">الاسم الكامل *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className="input w-full" placeholder="مثال: أحمد علي" />
            </label>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold text-slate-800">الشركة أو المحل <span className="font-normal text-slate-400">(اختياري)</span></span>
              <input value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" className="input w-full" placeholder="اسم الشركة أو المحل" />
            </label>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold text-slate-800">رقم الهاتف *</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" dir="ltr" className="input w-full text-left" placeholder="07xx xxx xxxx" />
            </label>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-bold text-slate-800">عدد الحضور</span>
              <select value={people} onChange={(e) => setPeople(Number(e.target.value))} className="input w-full">
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n === 1 ? 'شخص واحد' : n === 2 ? 'شخصين' : `${n} أشخاص`}</option>
                ))}
              </select>
            </label>

            {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-xl py-3.5 text-base font-extrabold text-white shadow-md transition active:scale-[.99] disabled:opacity-60"
              style={{ background: busy ? '#6fd96f' : GREEN }}
            >
              {busy ? 'جاري التسجيل…' : 'سجّل حضوري'}
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-400">رقمك يُستخدم فقط للتواصل بخصوص الفعالية.</p>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          شركة تقنية الواعظ — الوكيل المعتمد لـ Tiandy في بغداد
        </p>
      </div>
    </div>
  );
}

function Thanks({ onAgain }: { onAgain: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl text-white" style={{ background: GREEN }}>
        ✓
      </span>
      <h2 className="mt-4 text-xl font-extrabold text-slate-900">تم تسجيلك، نتشرف بحضورك</h2>
      <p className="mt-2 text-sm text-slate-600">رح نتواصل وياك قبل الموعد بالتفاصيل.</p>
      <p className="mt-6 text-sm font-semibold text-slate-700">ولحد الفعالية، شوف كاميرات Tiandy عندنا:</p>
      <Link
        to="/shop?category=tiandy-cameras"
        className="mt-3 inline-block w-full rounded-xl py-3.5 text-base font-extrabold text-white shadow-md"
        style={{ background: DEEP }}
      >
        تصفح منتجات Tiandy ←
      </Link>
      <button type="button" onClick={onAgain} className="mt-4 text-xs font-semibold text-slate-400 underline">
        تسجيل شخص ثاني
      </button>
    </div>
  );
}

function Closed() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
      <h2 className="text-xl font-extrabold text-slate-900">التسجيل مغلق</h2>
      <p className="mt-2 text-sm text-slate-600">شكراً لكل من حضر. تابعونا للفعاليات الجاية.</p>
      <Link to="/shop?category=tiandy-cameras" className="mt-5 inline-block w-full rounded-xl py-3 text-base font-extrabold text-white" style={{ background: DEEP }}>
        تصفح منتجات Tiandy ←
      </Link>
    </div>
  );
}
