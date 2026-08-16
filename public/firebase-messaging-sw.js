/*
 * Background push for the website and the phone's home-screen app.
 *
 * This runs even when no tab is open, which is the whole point: the
 * notifications the dashboard fires itself only work while a page is
 * running. Kept as a plain script (not part of the app bundle) because a
 * service worker has to be served from its own file at a fixed name.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAvnrI9n3-3Rhx9omxO3W9YF-IHPJWrIKM',
  authDomain: 'alwaidh-baeb5.firebaseapp.com',
  projectId: 'alwaidh-baeb5',
  storageBucket: 'alwaidh-baeb5.firebasestorage.app',
  messagingSenderId: '387647473445',
  appId: '1:387647473445:web:2dfbddbf6b5b97de063ccc',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const link = (payload.data && payload.data.link) || '/admin';
  self.registration.showNotification(title || 'Alwaidh', {
    body: body || '',
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    // Newer alerts of the same kind replace the old one instead of stacking.
    tag: link,
    data: { link },
    vibrate: [180, 90, 180],
  });
});

// Tapping the notification focuses an open tab if there is one, rather
// than opening a second copy of the dashboard.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    }),
  );
});
