import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitContact, storageMode } from '../lib/contactSubmissions';
import { allBrands } from '../data/brands';
import { useSettings } from '../lib/useSettings';
import { useLang } from '../lib/i18n';
import { useSeo, organizationJsonLd } from '../lib/seo';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const PHONE = '+964 774 420 5582';
const EMAIL = 'support@alwaidh.com';

/* The three identities, exactly as the canvas lays them out. Images come
   from the homepage banner settings, falling back to the same stock
   photos the homepage uses. */
const STOCK = [
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1100&q=80',
  'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?auto=format&fit=crop&w=1200&q=80',
];

interface Identity {
  id: string;
  accent: string;
  eyebrowColor: string;
  badge: string;
  eyebrow: string;
  title: string;
  body: string;
  rows: [string, string][];
  cta: string;
  ctaTo: string;
  ctaClasses: string;
}

const IDENTITIES: Identity[] = [
  {
    id: 'identity-computers',
    accent: '#2563eb',
    eyebrowColor: '#2563eb',
    badge: 'Since 1992',
    eyebrow: '01 — Computers',
    title: 'Machines that hold up at work',
    body: "Laptops, desktops and all-in-ones with the accessories that go with them — printers, scanners and POS systems. Iraq's first Lenovo distributor since 2010.",
    rows: [
      ['Supply', 'Business laptops, workstations, POS'],
      ['Install', 'Office roll-outs and networking'],
      ['Service', 'Repairs in our own Baghdad lab'],
    ],
    cta: 'Shop computers',
    ctaTo: '/shop?category=computers',
    ctaClasses: 'bg-brand-600 text-white hover:bg-brand-700',
  },
  {
    id: 'identity-solar',
    accent: '#f59e0b',
    eyebrowColor: '#b45309',
    badge: 'Since 2017',
    eyebrow: '02 — Solar energy',
    title: 'Power that stays on',
    body: 'Panels, hybrid inverters and batteries sized to your actual load — plus UPS from 1 kVA to 4 MVA and voltage stabilisers. We built the solar system at Al-Bilal station in Karbala.',
    rows: [
      ['Supply', 'Jinko panels, SolarMax & GE UPS'],
      ['Install', 'Free survey, sized and fitted by us'],
      ['Service', 'Inverter repair in-house'],
    ],
    cta: 'See solar prices',
    ctaTo: '/solar-prices',
    ctaClasses: 'bg-amber-500 text-amber-950 hover:bg-amber-400',
  },
  {
    id: 'identity-cameras',
    accent: '#2ea830',
    eyebrowColor: '#248527',
    badge: 'Authorised reseller',
    eyebrow: '03 — Security cameras',
    title: 'Eyes on the whole site',
    body: 'Tiandy IP and analog cameras, NVRs and full-site coverage — planned from your floor plan, cabled and commissioned by our own crew.',
    rows: [
      ['Supply', 'Tiandy cameras, NVRs, PoE switches'],
      ['Install', 'Camera plan, cabling, commissioning'],
      ['Service', 'Remote setup and callouts'],
    ],
    cta: 'Shop cameras',
    ctaTo: '/shop?category=tiandy-cameras',
    ctaClasses: 'bg-tiandy-600 text-white hover:bg-tiandy-700',
  },
];

const PILLS = [
  { to: '#identity-computers', label: 'Computers', dot: '#bfdbfe', bg: 'rgba(255,255,255,.12)', ring: 'rgba(255,255,255,.35)', color: '#eff6ff' },
  { to: '#identity-solar', label: 'Solar energy', dot: '#fbbf24', bg: 'rgba(245,158,11,.14)', ring: 'rgba(252,211,77,.45)', color: '#fde68a' },
  { to: '#identity-cameras', label: 'Security cameras', dot: '#3cc63c', bg: 'rgba(46,168,48,.16)', ring: 'rgba(126,232,126,.42)', color: '#a7f3a7' },
];

const FACTS: [string, string][] = [
  ['Three showrooms', 'Main one on Sinaa Street beside the University of Technology, plus two more in Baghdad.'],
  ["Our own service lab", "Computers and solar inverters repaired in-house — we don't hand your kit to anyone else."],
  ['600 m² warehouse', 'Stock held in Sufaraniya, so what you order is usually already in the country.'],
  ['Wholesale across Iraq', 'Every province, Kurdistan to Basrah — and retail online with delivery.'],
];

const TOPICS = ['Computers', 'Solar quote', 'Camera install', 'Repair', 'Wholesale'];

export default function About() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const { t, lang } = useLang();
  const [errorMsg, setErrorMsg] = useState('');
  const settings = useSettings();

  // Each card's own photo from Settings first; the homepage banners and
  // stock shots only fill in until those are uploaded.
  const ABOUT_KEYS = ['computers', 'solar', 'cameras'];
  const cardImage = (i: number) =>
    settings.aboutImages?.[ABOUT_KEYS[i]] ||
    settings.heroSlides?.[i]?.image ||
    (i === 0 ? settings.heroImage : i === 1 ? settings.solarBannerImage : '') ||
    STOCK[i];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMsg('Please fill in your name, email, and message.');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      await submitContact({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject: subject.trim() || undefined,
        message: message.trim(),
      });
      setStatus('success');
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send your message. Please try again.');
    }
  }

  useSeo({
    title:
      lang === 'ar'
        ? 'من نحن — شركة الواعظ للحاسبات والطاقة الشمسية، بغداد | Alwaidh'
        : 'About Alwaidh — Computers, Solar & Cameras in Baghdad since 1992',
    description:
      lang === 'ar'
        ? 'شركة الواعظ للتكنولوجيا في بغداد منذ 1992: حاسبات، منظومات طاقة شمسية وكاميرات مراقبة — ثلاث صالات عرض ومختبر صيانة خاص وتوصيل لكل المحافظات.'
        : 'Al-Waidh Technology, Baghdad, since 1992: computers, solar energy systems and security cameras — three showrooms, an in-house service lab, delivery to every province.',
    path: '/about',
    jsonLd: organizationJsonLd(),
  });

  const mode = storageMode();

  return (
    <div>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(760px 420px at 14% -10%, rgba(255,255,255,.16), transparent 62%), radial-gradient(620px 380px at 92% 118%, rgba(46,168,48,.22), transparent 60%), radial-gradient(520px 340px at 62% -30%, rgba(245,158,11,.2), transparent 60%)',
          }}
        />
        <div className="container-page relative py-14 sm:py-16">
          <span className="inline-block rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] shadow-[inset_0_0_0_1px_rgba(255,255,255,.16)]">
            {t('About us')}
          </span>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block">{t('One company,')}</span>
            <span className="block">{t('three trades we know cold.')}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
            {t(
              'Al-Waidh Technology Trading Co. LLC started as a computer bureau in Baghdad in 1992. Today we supply, install and service three things — and we do all three ourselves, from a single laptop to a complete solar plant.',
            )}
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {PILLS.map((p) => (
              <a
                key={p.to}
                href={p.to}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold"
                style={{ background: p.bg, boxShadow: `inset 0 0 0 1px ${p.ring}`, color: p.color }}
              >
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: p.dot }} />
                <span>{t(p.label)}</span>
              </a>
            ))}
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-4 border-t border-white/10 pt-7 sm:grid-cols-4">
            {[
              ['1992', 'In business since'],
              ['2017', 'Solar since'],
              ['3', 'Showrooms in Baghdad'],
              ['18', 'Provinces we deliver to'],
            ].map(([v, k]) => (
              <div key={k}>
                <dd className="text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
                  {v}
                </dd>
                <dt className="mt-1.5 text-xs font-semibold text-white/60">{t(k)}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------- Three identities ---------------- */}
      <section className="container-page pt-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
              {t('What we do')}
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              {t('Three identities, one team')}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-slate-500">
            {t(
              'Each line has its own stock, its own engineers and its own warranty — and they all come out of the same showroom on Sinaa Street.',
            )}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {IDENTITIES.map((c, i) => (
            <article
              key={c.id}
              id={c.id}
              className="flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10"
            >
              <div className="h-[5px]" style={{ background: c.accent }} />
              <div className="relative aspect-[4/3] bg-slate-100">
                <img src={cardImage(i)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute top-3.5 rounded-full bg-slate-950/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm ltr:left-3.5 rtl:right-3.5">
                  {t(c.badge)}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: c.eyebrowColor }}>
                    {t(c.eyebrow)}
                  </div>
                  <h3 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">{t(c.title)}</h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{t(c.body)}</p>
                <dl className="grid grid-cols-[64px_1fr] gap-x-3.5 gap-y-2 border-t border-slate-200 pt-4 text-[13px]">
                  {c.rows.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="pt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {t(k)}
                      </dt>
                      <dd className="leading-relaxed text-slate-700">{t(v)}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  to={c.ctaTo}
                  className={`mt-auto flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold uppercase tracking-wide transition ${c.ctaClasses}`}
                >
                  <span>{t(c.cta)}</span>
                  <span className="rtl:hidden">→</span>
                  <span className="hidden rtl:inline">←</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------- Behind all three ---------------- */}
      <section className="container-page pt-12">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-7 sm:p-9">
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">
                {t('Behind all three')}
              </div>
              <h2 className="mb-3 mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">
                {t('The same company does the selling, the fitting and the fixing')}
              </h2>
              <p className="text-sm leading-relaxed text-slate-500">
                {t('Al-Waidh Technology for Computers and Solar Systems Trading Co. LLC — Baghdad, licence no. 25460.')}
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 sm:gap-x-8">
              {FACTS.map(([title, body]) => (
                <div key={title}>
                  <div className="mb-1.5 text-[15px] font-bold text-slate-900">{t(title)}</div>
                  <div className="text-[13px] leading-relaxed text-slate-500">{t(body)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Brands ---------------- */}
      <section className="mt-14 border-y border-slate-200 bg-white py-10">
        <div className="container-page pb-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {t('Partners')}
          </div>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">
            {t('Brands we distribute and support')}
          </h2>
        </div>
        <BrandCarousel />
      </section>

      {/* ---------------- Contact ---------------- */}
      <section id="contact" className="container-page py-14">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.3fr)]">
          <div className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-600 p-7 text-brand-100 sm:p-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-100">
              {t('Contact')}
            </div>
            <h2 className="mb-2.5 mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-[27px]">
              {t('Come to the showroom, or tell us what you need')}
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-white/70">
              {t(
                "Quotes for solar systems and camera installs are free — send a rough idea of the site and we'll come back with a size and a price.",
              )}
            </p>
            <dl className="grid gap-4">
              {(
                [
                  ['Showroom', t('Sinaa Street, Baghdad, Iraq'), null],
                  ['Hours', t('Saturday – Thursday, 8:30 AM – 3:30 PM'), null],
                  ['Phone', PHONE, `tel:${PHONE.replace(/\s/g, '')}`],
                  ['Email', EMAIL, `mailto:${EMAIL}`],
                ] as [string, string, string | null][]
              ).map(([k, v, href], i, arr) => (
                <div key={k} className={`grid gap-1 ${i < arr.length - 1 ? 'border-b border-white/10 pb-4' : ''}`}>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-200">{t(k)}</dt>
                  <dd>
                    {href ? (
                      <a href={href} dir="ltr" className={k === 'Phone' ? 'text-lg font-bold text-white' : 'text-sm font-semibold text-white underline decoration-white/40'}>
                        {v}
                      </a>
                    ) : (
                      <span className="text-sm leading-relaxed text-white/90">{v}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{t('Send us a message')}</h2>
            <p className="mb-5 mt-1 text-[13px] text-slate-500">
              {t('We reply during showroom hours, usually the same day.')}
            </p>

            {status === 'success' ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <p className="font-semibold">{t('Thanks — we received your message.')}</p>
                <p className="mt-1">{t("We'll be in touch shortly.")}</p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="mt-3 text-sm font-semibold text-green-900 underline"
                >
                  {t('Send another message')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" required>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
                  </Field>
                  <Field label="Phone (optional)">
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" dir="ltr" />
                  </Field>
                </div>
                <Field label="Email" required>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
                </Field>
                <div className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">{t('What is it about?')}</span>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((topic) => {
                      const on = subject === topic;
                      return (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => setSubject(on ? '' : topic)}
                          className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition ${
                            on
                              ? 'border-brand-300 bg-brand-50 text-brand-700'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                          }`}
                        >
                          {t(topic)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field label="Message" required>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="input"
                    placeholder={t('Tell us about the site, the load, or the spec you need.')}
                    required
                  />
                </Field>

                {status === 'error' && errorMsg && (
                  <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{errorMsg}</p>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="rounded-xl bg-brand-600 px-7 py-3.5 text-[13px] font-bold uppercase tracking-wide text-white shadow-lg shadow-brand-600/40 transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    {status === 'submitting' ? t('Sending…') : t('Send message')}
                  </button>
                  <span className="text-xs text-slate-400">{t('Or call the showroom directly.')}</span>
                </div>

                {mode === 'local' && (
                  <p className="text-xs text-slate-500">
                    Note: Firebase isn't configured, so submissions are stored locally in this browser only.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Continuously scrolling brand strip. The track holds the list twice so the
 * CSS animation can loop seamlessly; hovering pauses it, and it stops
 * entirely for anyone who prefers reduced motion.
 */
function BrandCarousel() {
  const settings = useSettings();
  const loop = [...allBrands, ...allBrands];
  return (
    <div className="marquee-pause relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent sm:w-24" />
      <ul className="marquee-track flex w-max items-center gap-3.5">
        {loop.map((b, i) => {
          const logo = settings.brandLogos?.[b.slug];
          return (
            <li
              key={`${b.slug}-${i}`}
              aria-hidden={i >= allBrands.length}
              className="flex h-16 w-[150px] flex-none items-center justify-center rounded-xl border border-slate-200 bg-white px-5"
            >
              {logo ? (
                <img src={logo} alt={b.name} loading="lazy" className="max-h-11 max-w-full object-contain" />
              ) : (
                <span className="text-center text-[15px] font-extrabold tracking-tight text-slate-700">{b.name}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">
        {t(label)}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
