import { useLang } from '../lib/i18n';

/**
 * The EN | عربي capsule from the design: a dark pill with a white thumb
 * that glides to the chosen language. Pinned LTR so the thumb's geometry
 * is identical in both reading directions — only the highlight moves,
 * the options never swap sides.
 */
export default function LangSwitch({ frosted = false }: { frosted?: boolean }) {
  const { lang, setLang } = useLang();
  const idx = lang === 'ar' ? 1 : 0;
  return (
    <div
      dir="ltr"
      role="group"
      aria-label="Language"
      className={`relative flex rounded-full p-1 ${
        frosted ? 'bg-white/10 ring-1 ring-inset ring-white/20' : 'bg-brand-600'
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform duration-200 [transition-timing-function:cubic-bezier(.23,1,.32,1)]"
        style={{ transform: `translateX(${idx * 100}%)` }}
      />
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        className={`relative z-10 w-11 rounded-full py-1.5 text-[11px] font-bold transition-colors duration-200 ${
          lang === 'en' ? 'text-slate-900' : 'text-white/80'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang('ar')}
        aria-pressed={lang === 'ar'}
        className={`relative z-10 w-11 rounded-full py-1.5 text-[11px] font-bold transition-colors duration-200 ${
          lang === 'ar' ? 'text-slate-900' : 'text-white/80'
        }`}
      >
        عربي
      </button>
    </div>
  );
}
