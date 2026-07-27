import { useState } from 'react';
import { submitContact, storageMode } from '../lib/contactSubmissions';
import { allBrands } from '../data/brands';
import { useSettings } from '../lib/useSettings';
import { useLang } from '../lib/i18n';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function About() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const { t } = useLang();
  const [errorMsg, setErrorMsg] = useState('');

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

  const mode = storageMode();

  return (
    <div>
      <section className="bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <div className="container-page py-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-100">
            {t('About us')}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
            {t('Computers since 1992. Powering homes since 2017.')}
          </h1>
          <p className="mt-3 max-w-2xl text-white/90">
            {t(
              'Al-Waidh Technology Trading Co. LLC — founded as Al-Waidh Computers Bureau in 1992 — is one of Iraq’s leading suppliers of computers, solar energy systems, and power protection. We supply, install, and service, from a single laptop to a complete solar plant.',
            )}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: t('In business since'), v: '1992' },
              { k: t('Solar since'), v: '2017' },
              { k: t('Showrooms in Baghdad'), v: '3' },
              { k: t('Coverage'), v: t('All Iraq') },
            ].map((s) => (
              <div key={s.k} className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                <dd className="text-2xl font-extrabold leading-none">{s.v}</dd>
                <dt className="mt-1 text-xs font-medium text-white/80">{s.k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container-page grid gap-10 py-12 lg:grid-cols-2">
        <div className="space-y-6">
          <Block
            icon="🏢"
            title="Who we are"
            body="Formerly Al-Waidh Computers, today Al-Waidh Technology for Computers and Solar Systems Trading Co. LLC (Baghdad, licence no. 25460). Our main showroom is on Sinaa Street beside the University of Technology, with two further showrooms, our own service lab for computers and solar inverters, and a 600 m² warehouse in Sufaraniya."
          />
          <Block
            icon="📦"
            title="What we supply"
            body="Laptops, desktops and all-in-ones with their accessories — printers, scanners and POS systems. Solar panels, inverters and batteries. UPS units from 1 kVA up to 4 MVA, voltage stabilisers, and Tiandy security cameras and NVRs."
          />
          <Block
            icon="🔧"
            title="We install and service"
            body="We don't just sell boxes. We size and install complete solar systems and power protection, and repair what we supply in our own lab — including work such as the solar energy system at Al-Bilal station in Karbala."
          />
          <Block
            icon="🚚"
            title="Where we reach"
            body="We wholesale computers and power equipment across every Iraqi province, from the Kurdistan Region in the north to Basrah in the south, and sell retail through our Baghdad showrooms and online with delivery."
          />
          <Block
            icon="🤝"
            title="Brands we represent"
            body="Iraq's first Lenovo distributor, since 2010. Distributor for Jinko Solar panels and SolarMax inverters, exclusive distributor for GE UPS (Switzerland) and for Indian low-frequency inverters, and an authorised Tiandy reseller for security cameras."
          />
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-slate-900">{t('Contact us')}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("Have a question or want a quote? Send us a message and we'll get back to you.")}
          </p>

          <dl className="mt-5 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 flex-none text-slate-500">{t('Showroom')}</dt>
              <dd className="text-slate-800">{t('Sinaa Street, Baghdad, Iraq')}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 flex-none text-slate-500">{t('Hours')}</dt>
              <dd className="text-slate-800">{t('Saturday – Thursday, 8:30 AM – 3:30 PM')}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 flex-none text-slate-500">{t('Phone')}</dt>
              <dd>
                <a href="tel:+9647705397778" className="font-semibold text-brand-700 hover:underline">
                  +964 770 539 7778
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 flex-none text-slate-500">{t('Email')}</dt>
              <dd>
                <a
                  href="mailto:info@alwaidhcomputers.com"
                  className="font-semibold text-brand-700 hover:underline"
                >
                  info@alwaidhcomputers.com
                </a>
              </dd>
            </div>
          </dl>

          {status === 'success' ? (
            <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <p className="font-semibold">Thanks — we received your message.</p>
              <p className="mt-1">We'll be in touch shortly.</p>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="mt-3 text-sm font-semibold text-green-900 underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <Field label="Name" required>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  required
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" required>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    required
                  />
                </Field>
                <Field label="Phone (optional)">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Subject (optional)">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input"
                  placeholder="e.g. Solar quote, camera install"
                />
              </Field>
              <Field label="Message" required>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input"
                  required
                />
              </Field>

              {status === 'error' && errorMsg && (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="btn-primary w-full justify-center sm:w-auto"
              >
                {status === 'submitting' ? 'Sending…' : 'Send message'}
              </button>

              {mode === 'local' && (
                <p className="text-xs text-slate-500">
                  Note: Firebase isn't configured, so submissions are stored locally in this browser
                  only. Add your Firebase config to <code>.env</code> to enable cross-device storage.
                </p>
              )}
            </form>
          )}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="py-12">
          <div className="container-page">
            <h2 className="text-2xl font-extrabold text-slate-900">{t('Brands we work with')}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('We supply and support these brands across Iraq.')}
            </p>
          </div>
          <BrandCarousel />
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
    <div className="marquee-pause relative mt-8 overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-slate-50 to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-slate-50 to-transparent sm:w-24" />
      <ul className="marquee-track flex w-max items-center gap-4">
        {loop.map((b, i) => {
          const logo = settings.brandLogos?.[b.slug];
          return (
            <li
              key={`${b.slug}-${i}`}
              aria-hidden={i >= allBrands.length}
              className="flex h-20 w-40 flex-none items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 shadow-sm"
            >
              {logo ? (
                <img
                  src={logo}
                  alt={b.name}
                  loading="lazy"
                  className="max-h-12 max-w-full object-contain"
                />
              ) : (
                <span className="text-center text-base font-extrabold tracking-tight text-slate-800">
                  {b.name}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Block({ icon, title, body }: { icon: string; title: string; body: string }) {
  const { t } = useLang();
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-lg font-extrabold text-slate-900">{t(title)}</h3>
      </div>
      <p className="mt-2 text-slate-600">{body}</p>
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
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
