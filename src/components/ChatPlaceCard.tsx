import { useLang } from '../lib/i18n';
import type { ChatPlaceCard as Place } from '../lib/chatStore';

/**
 * The shop's location inside a chat bubble: a little map plate with the
 * address and two ways to travel — the map for looking, Waze for driving.
 * A bare link would be a wall of characters nobody reads.
 */
/** True when the page is running inside the phone app's webview. */
function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export default function ChatPlaceCard({ place }: { place: Place }) {
  const { t } = useLang();
  // Inside the app a plain new-tab link goes nowhere; ask the phone to
  // open it instead, which is what puts it in Google Maps or Waze.
  const open = (url: string) => (e: React.MouseEvent) => {
    if (!isNativeApp()) return;
    e.preventDefault();
    window.open(url, '_system');
  };
  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800">
      <div className="relative h-20 bg-gradient-to-br from-brand-600 to-brand-800">
        {/* a suggestion of streets, drawn rather than fetched */}
        <svg viewBox="0 0 200 60" className="absolute inset-0 h-full w-full opacity-30" aria-hidden>
          <path d="M0 42 H200 M0 18 H200 M46 0 V60 M132 0 V60" stroke="white" strokeWidth="3" fill="none" />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-3xl drop-shadow">📍</span>
      </div>
      <div className="p-2.5">
        <p className="text-[13px] font-extrabold leading-tight">{place.label}</p>
        {place.address && (
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{place.address}</p>
        )}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <a
            href={place.maps}
            target="_blank"
            rel="noreferrer"
            onClick={open(place.maps)}
            className="flex items-center justify-center gap-1 rounded-lg bg-brand-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-brand-700"
          >
            🗺️ {t('Open the map')}
          </a>
          <a
            href={place.waze}
            target="_blank"
            rel="noreferrer"
            onClick={open(place.waze)}
            className="flex items-center justify-center gap-1 rounded-lg bg-sky-500 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-sky-600"
          >
            🚗 Waze
          </a>
        </div>
      </div>
    </div>
  );
}
