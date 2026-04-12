self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

// Background push — fires even when PWA is fully closed
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Dr. Fonseca Portal';
  const options = {
    body: data.body || 'Tienes un nuevo mensaje',
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'new-message',      // groups notifications by room
    renotify: true,                       // vibrate even if same tag
    data: { url: data.url || '/inbox' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// When user taps the notification, open the correct chat
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/inbox';

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
