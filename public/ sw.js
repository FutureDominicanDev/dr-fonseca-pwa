// Service Worker
self.addEventListener('install', function(event) {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker activating.');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Dr. Fonseca Portal';
  const options = {
    body: data.body || 'Tienes un nuevo mensaje',
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/inbox' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || '/inbox'));
});