import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Android's package name, fixed forever once Play has seen it. iOS keeps
  // its original com.alwaidh.staff bundle id (set in Xcode), because that
  // one is already provisioned, signed and on TestFlight.
  appId: 'com.alwaidh.app',
  appName: 'Alwaidh',
  webDir: 'dist',
  server: {
    // The apps load the live site, so every web deploy updates them
    // instantly — no app-store release needed for content changes.
    // The shop, not the dashboard: customers use this app too. Staff reach
    // the dashboard from the account menu, as they do on the website.
    url: 'https://alwaidh-baeb5.web.app/',
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
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    FirebaseMessaging: {
      // Without this, iOS silently swallows a notification that arrives
      // while the app is open — no banner, no sound.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
