// Service Worker for Help Desk Notifications

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  event.waitUntil(clients.claim());
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification);
  
  event.notification.close();
  
  const data = event.notification.data;
  const urlToOpen = `${self.location.origin}/dashboard?userId=${data.userId}&roomId=${data.roomId}`;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          // Focus existing window and send message to select user
          client.postMessage({
            type: 'SELECT_USER',
            userId: data.userId,
            roomId: data.roomId,
            userName: data.userName
          });
          return client.focus();
        }
      }
      
      // No window open, open new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle push notifications (if needed in future)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: data.data,
      requireInteraction: true,
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});
