import { useEffect, useState } from 'react';
import {
  channelsFor,
  enablePush,
  isNativeApp,
  notificationPrefs,
  pushBlocker,
  pushState,
  setNotificationChannel,
  type NotificationKey,
  type NotificationPrefs,
  type PushState,
  webPushConfigured,
  type Roles,
} from '../lib/push';
import { useLang } from '../lib/i18n';

/**
 * Turn notifications on for this device and choose what they cover.
 * Each switch maps to one topic, so the choice applies to this phone or
 * browser only — somebody else's device keeps its own settings.
 */
export default function NotificationSettings({
  roles,
  email,
  onClose,
}: {
  roles: Roles;
  email: string | null;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [state, setState] = useState<PushState>('unsupported');
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => notificationPrefs());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    pushState().then(setState);
  }, []);

  const channels = channelsFor(roles);
  const granted = state === 'granted';
  const blocker = pushBlocker();

  async function turnOn() {
    setBusy(true);
    setError('');
    const result = await enablePush(roles, email);
    setState(result.state);
    if (result.error) setError(result.error);
    setBusy(false);
  }

  async function toggle(key: NotificationKey, on: boolean) {
    setPrefs((p) => ({ ...p, [key]: on }));
    await setNotificationChannel(key, on, email);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-bold text-slate-900">🔔 {t('Notifications')}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          {state === 'unsupported' ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {blocker === 'old-app'
                ? t(
                    'This version of the app was built before notifications existed. Install the newest build from TestFlight (or Play Store), then open this panel again.',
                  )
                : blocker === 'ios-browser'
                  ? t(
                      'iPhone browsers only allow notifications for apps added to the Home Screen. Use the Alwaidh app, or tap Share → Add to Home Screen and open it from there.',
                    )
                  : t('This browser cannot show notifications. Try Chrome, or use the phone app.')}
            </p>
          ) : state === 'denied' ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {t(
                'Notifications are blocked. Allow them for Alwaidh in your phone or browser settings, then come back.',
              )}
            </p>
          ) : !granted ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm text-slate-700">
                {t('Get a notification on this device when something needs you.')}
              </p>
              <button
                type="button"
                onClick={turnOn}
                disabled={busy}
                className="btn-primary mt-3 w-full py-2 text-sm disabled:opacity-60"
              >
                {busy ? t('Turning on…') : t('Turn on notifications')}
              </button>
            </div>
          ) : (
            <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              ✅ {t('Notifications are on for this device.')}
            </p>
          )}

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </p>
          )}

          <div className={granted ? '' : 'pointer-events-none opacity-50'}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('Tell me about')}
            </p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {channels.map((c) => {
                const on = prefs[c.key] !== false;
                return (
                  <li key={c.key} className="flex items-start gap-3 p-3">
                    <label className="flex flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => toggle(c.key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          {t(c.label)}
                        </span>
                        <span className="block text-xs text-slate-500">{t(c.description)}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              {isNativeApp()
                ? t('These settings apply to this phone only.')
                : webPushConfigured()
                  ? t('These settings apply to this browser only.')
                  : t('In this browser, notifications only arrive while a dashboard tab is open.')}
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('Done')}
          </button>
        </div>
      </div>
    </div>
  );
}
