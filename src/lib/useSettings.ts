import { useEffect, useState } from 'react';
import { cachedSettings, subscribeSettings, type SiteSettings } from './settingsStore';

/** Live site settings, updating in real time as an admin changes them. */
export function useSettings(): SiteSettings {
  return useSettingsStatus().settings;
}

/**
 * Settings plus whether the server has answered yet. Pages that would
 * otherwise fall back to a stock placeholder use `loaded` to hold off,
 * rather than flashing a demo image over the real one.
 */
export function useSettingsStatus(): { settings: SiteSettings; loaded: boolean } {
  const [settings, setSettings] = useState<SiteSettings>(cachedSettings);
  const [loaded, setLoaded] = useState(false);
  useEffect(
    () =>
      subscribeSettings((s) => {
        setSettings(s);
        setLoaded(true);
      }),
    [],
  );
  return { settings, loaded };
}
