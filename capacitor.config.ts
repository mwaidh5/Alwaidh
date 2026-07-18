import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alwaidh.staff',
  appName: 'Alwaidh Staff',
  webDir: 'dist',
  server: {
    // The apps load the live site, so every web deploy updates them
    // instantly — no app-store release needed for content changes.
    url: 'https://alwaidh-baeb5.web.app/admin',
    cleartext: false,
  },
};

export default config;
