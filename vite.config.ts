import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
// Baghdad time, not UTC: the stamp exists so the owner can match "the
// build at 4am" to what he sees, and he reads his clock, not Greenwich.
const BUILD_STAMP = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Baghdad' }).slice(0, 16);

/**
 * The stamp, written beside the build as /version.json. The running app
 * compares itself to it (src/lib/swUpdate.ts) and reloads when they
 * differ — the one update path that works even when the service worker
 * never notices a newer copy.
 */
function versionFile() {
  return {
    name: 'alwaidh-version-file',
    closeBundle() {
      const dir = resolve(process.cwd(), 'dist');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'version.json'), JSON.stringify({ build: BUILD_STAMP }));
    },
  };
}

export default defineConfig({
  // Stamped at build time so the dashboard can show which version a device
  // is actually running — the quickest way to spot a stale one.
  define: {
    // Baghdad time, not UTC: the stamp exists so the owner can match "the
    // build at 4am" to what he sees, and he reads his clock, not Greenwich.
    __APP_BUILD__: JSON.stringify(BUILD_STAMP),
  },
  plugins: [
    react(),
    versionFile(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered by hand in src/lib/swUpdate.ts, which also keeps checking
      // for a newer build and reloads once it has taken over.
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Alwaidh-الواعظ',
        short_name: 'Alwaidh-الواعظ',
        description: 'Alwaidh staff dashboard — products, solar jobs, and prices.',
        start_url: '/admin',
        scope: '/',
        display: 'standalone',
        // A shop in your hand is held upright; the installed web app says so too.
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // A newer worker takes over the moment it is installed and claims
        // the pages already open. Without these the generated worker only
        // stepped forward when sent SKIP_WAITING, and nothing sent it: the
        // live site sat with a newer copy stuck in "waiting" while every
        // browser kept the old one, refresh or no refresh.
        skipWaiting: true,
        clientsClaim: true,
        // The app talks to Firebase live; only precache the shell.
        navigateFallback: '/index.html',
        // …but never for /__/*. Firebase Hosting serves the sign-in handler
        // at /__/auth/handler, and since sign-in moved to alwaidh.com that
        // page is on our own origin — so the service worker was answering
        // it with the app shell, and the router showed "Page not found"
        // instead of finishing the Google sign-in.
        // /f/** is the file proxy — a navigation there must reach the server
        // for the real PDF, not be swallowed into the app shell.
        navigateFallbackDenylist: [/^\/__\//, /^\/f\//],
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Firebase registers this one itself, on its own scope.
        globIgnores: ['firebase-messaging-sw.js'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  server: {
    port: 5173,
    // Don't launch a browser. Starting the dev server used to throw open a
    // Chrome window every time, which is a nuisance when the page is being
    // looked at somewhere else.
    open: false,
  },
});
