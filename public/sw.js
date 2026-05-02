const DEFAULT_APP_URL = '/inbox';

const CACHE_NAMES_TO_CLEAR = [
  'dr-fonseca-pwa',
  'dr-fonseca-shell',
  'next-pwa-cache',
  'workbox-precache',
];

function safeAppUrl(value) {
  try {
    const target = new URL(typeof value === 'string' && value.trim() ? value : DEFAULT_APP_URL, self.location.origin);
    if (target.origin !== self.location.origin) return new URL(DEFAULT_APP_URL, self.location.origin).href;
    return target.href;
  } catch {
    return new URL(DEFAULT_APP_URL, self.location.origin).href;
  }
}

function readPushData(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(key) {
              return CACHE_NAMES_TO_CLEAR.some(function(prefix) { return key.indexOf(prefix) === 0; });
            })
            .map(function(key) { return caches.delete(key); })
        );
      })
      .then(function() { return clients.claim(); })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function(event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || url.pathname === '/api/app-version') {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(function() {
        return fetch(request);
      })
    );
  }
});

// Background push — fires even when PWA is fully closed
self.addEventListener('push', function(event) {
  const data = readPushData(event);
  const title = data.title || 'Dr. Fonseca Portal';
  const options = {
    body: data.body || 'Tienes un nuevo mensaje',
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'new-message',      // groups notifications by room
    renotify: true,                       // vibrate even if same tag
    data: { url: safeAppUrl(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// When user taps the notification, open the correct chat
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = safeAppUrl(event.notification.data?.url);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If the app is already open, focus it and navigate
      for (const client of clientList) {
        if ('navigate' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      return clients.openWindow(targetUrl);
    })
  );
});
