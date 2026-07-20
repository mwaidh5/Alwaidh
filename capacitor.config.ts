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
    // Hosts that must open INSIDE the app's webview. Without this, the
    // Google sign-in redirect chain (site -> firebaseapp.com auth handler
    // -> accounts.google.com -> back) gets kicked out to Safari and the
    // app never receives the signed-in session.
    allowNavigation: [
      'alwaidh-baeb5.web.app',
      'alwaidh-baeb5.firebaseapp.com',
      'accounts.google.com',
      '*.google.com',
      '*.googleapis.com',
      '*.gstatic.com',
    ],
  },
};

export default config;
