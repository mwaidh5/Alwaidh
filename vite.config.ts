import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  // Stamped at build time so the dashboard can show which version a device
  // is actually running — the quickest way to spot a stale one.
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Alwaidh Staff',
        short_name: 'Alwaidh',
        description: 'Alwaidh staff dashboard — products, solar jobs, and prices.',
        start_url: '/admin',
        scope: '/',
        display: 'standalone',
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
        // The app talks to Firebase live; only precache the shell.
        navigateFallback: '/index.html',
        // …but never for /__/*. Firebase Hosting serves the sign-in handler
        // at /__/auth/handler, and since sign-in moved to alwaidh.com that
        // page is on our own origin — so the service worker was answering
        // it with the app shell, and the router showed "Page not found"
        // instead of finishing the Google sign-in.
        navigateFallbackDenylist: [/^\/__\//],
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
