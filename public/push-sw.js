/* =====================================================================
   public/push-sw.js — Session 5
   Web Push handlers, imported into the vite-plugin-pwa generated service
   worker via workbox.importScripts (see vite.config.js). Kept separate so
   the auto-generated precaching SW stays untouched. These run in the SW
   global scope (self), NOT the page.
   ===================================================================== */

self.addEventListener('push', (event) => {
  let payload = { title: 'NurseHolic', body: 'Time to study!' };
  try { if (event.data) payload = event.data.json(); } catch (e) {}
  const { title, body, icon, badge, tag, renotify, data } = payload;
  event.waitUntil(
    self.registration.showNotification(title || 'NurseHolic', {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-192.png',
      tag: tag || 'norcet-daily',
      renotify: renotify !== false,
      data: data || { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) { client.focus(); return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
