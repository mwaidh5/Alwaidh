import { useState } from 'react';
import { useLang } from '../lib/i18n';
import { useScrollLock } from '../lib/useScrollLock';

/**
 * The first hello: a visitor who has never chosen a language gets asked
 * once, before anything else. Their answer is the same stored choice the
 * navbar capsule writes, so the site never asks again — and the capsule
 * still lets them change their mind any time.
 *
 * "First visit" is decided at module load, before the language provider's
 * effect persists its default and erases the evidence.
 */
const ASKED_KEY = 'alwaidh.langAsked.v1';

const firstVisit = (() => {
  try {
    // Ad landing pages pick Arabic themselves — a pop-up quiz before the
    // form is a conversion killer.
    if (window.location.pathname.startsWith('/lead')) return false;
    return localStorage.getItem('alwaidh.lang.v1') === null && localStorage.getItem(ASKED_KEY) === null;
  } catch {
    return false;
  }
})();

export default function LanguageGate() {
  const { setLang } = useLang();
  const [open, setOpen] = useState(firstVisit);
  useScrollLock(open);

  if (!open) return null;

  function choose(lang: 'en' | 'ar') {
    try {
      localStorage.setItem(ASKED_KEY, '1');
    } catch {
      /* private mode — the stored language itself still prevents re-asking */
    }
    setLang(lang);
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
        <img src="/pwa-192.png" alt="Alwaidh" className="mx-auto mb-4 h-14 w-14 rounded-2xl" />
        <h1 className="text-xl font-extrabold text-slate-900" dir="rtl" style={{ fontFamily: "'Janna LT', 'Tajawal', sans-serif" }}>
          اختر لغتك
        </h1>
        <p className="mb-6 mt-0.5 text-sm font-semibold text-slate-500">Choose your language</p>
        <div className="grid gap-2.5">
          <button
            type="button"
            onClick={() => choose('ar')}
            className="rounded-2xl bg-brand-600 py-3.5 text-lg font-extrabold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
            style={{ fontFamily: "'Janna LT', 'Tajawal', sans-serif" }}
          >
            العربية
          </button>
          <button
            type="button"
            onClick={() => choose('en')}
            className="rounded-2xl border border-slate-300 bg-white py-3.5 text-lg font-extrabold text-slate-800 transition hover:border-brand-600 hover:text-brand-700"
          >
            English
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-400" dir="rtl">
          يمكنك التبديل في أي وقت من أعلى الصفحة · You can switch any time from the top bar
        </p>
      </div>
    </div>
  );
}
