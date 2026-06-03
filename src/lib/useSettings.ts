import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, subscribeSettings, type SiteSettings } from './settingsStore';

/** Live site settings, updating in real time as an admin changes them. */
export function useSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  useEffect(() => subscribeSettings(setSettings), []);
  return settings;
}
