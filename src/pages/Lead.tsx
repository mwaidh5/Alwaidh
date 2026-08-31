import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useLang } from '../lib/i18n';
import { useSeo } from '../lib/seo';

/**
 * Where a Facebook ad lands: alwaidh.com/lead/<campaign-name>. One short
 * form — name and phone — written to the public `leads` inbox, which a
 * Cloud Function copies into the CRM tagged Facebook with the campaign
 * name, so every ad's people arrive in the book already labelled.
 *
 * A campaign slug starting with "comp" files into the computers book;
 * everything else is solar.
 */
export default function Lead() {
  const { campaign = 'facebook' } = useParams();
  const { t, lang, setLang } = useLang();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [trap, setTrap] = useState(''); // honeypot: humans never see it
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useSeo({ title: 'الواعظ للقدرة — سجل اهتمامك', noindex: true });

  // Ad visitors are Arabic-speaking; a first-timer starts in Arabic
  // without being quizzed by the language pop-up.
  useEffect(() => {
    try {
      if (localStorage.getItem('alwaidh.lang.v1') === null) setLang('ar');
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (trap.trim()) {
      // A bot filled the invisible field — pretend everything worked.
      setDone(true);
      return;
    }
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    if (cleanPhone.length < 10) {
      setError(t('That phone number looks too short.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!db) throw new Error('offline');
      await addDoc(collection(db, 'leads'), {
        name: name.trim().slice(0, 80),
        phone: cleanPhone.slice(0, 24),
        city: city.trim().slice(0, 80),
        campaign: campaign.slice(0, 60),
        section: campaign.toLowerCase().startsWith('comp') ? 'computers' : 'solar',
        at: serverTimestamp(),
      });
      setDone(true);
    } catch {
      setError(t('Could not send — check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="container-page flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        {done ? (
          <div className="card p-8 text-center">
            <p className="text-5xl">✅</p>
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
              {t('Got it — we will call you today!')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {t('Our team will call you with a free quote. In a hurry? Talk to us on WhatsApp now.')}
            </p>
            <a
              href="https://wa.me/9647744205582"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700"
            >
              💬 WhatsApp
            </a>
            <a href="/solar-prices" className="mt-3 block text-sm font-semibold text-brand-700 hover:underline">
              {t('See the systems and prices')} {lang === 'ar' ? '←' : '→'}
            </a>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white">
              <img src="/pwa-192.png" alt="" className="h-12 w-12 rounded-xl" />
              <h1 className="mt-3 text-2xl font-extrabold leading-tight">
                {t('Let the sun power your home')}
              </h1>
              <p className="mt-1.5 text-sm text-brand-100">
                {t('Leave your number and our team calls you with a free quote — cash or bank installments up to 7 years.')}
              </p>
            </div>
            <form onSubmit={submit} className="space-y-3 p-6">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Your name')}
                required
                className="input"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('Phone number (07xx xxx xxxx)')}
                type="tel"
                dir="ltr"
                required
                className="input"
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('Your area (optional)')}
                className="input"
              />
              {/* honeypot — invisible to people, irresistible to bots */}
              <input
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">
                {busy ? '…' : `📞 ${t('Call me back')}`}
              </button>
              <p className="text-center text-[11px] text-slate-400">
                {t('Free consultation · 2-year installation warranty · Baghdad and all provinces')}
              </p>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
