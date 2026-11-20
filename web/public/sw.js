// Service Worker for BrainLift Web App
const CACHE_NAME = 'brainlift-v2';

// Only cache the shell - hashed assets are cached on fetch
const SHELL_URLS = [
  '/',
  '/index.html',
];

// Install event - cache shell only
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network-first for HTML, cache-first for hashed assets
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests
  if (event.request.url.includes('/api/')) return;

  // Skip chrome-extension requests
  if (event.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(event.request.url);

  // Network-first for HTML/navigation requests
  if (event.request.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((response) => {
            return response || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // Cache-first for hashed assets (they're immutable by content hash)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          return response || new Response('Not found', { status: 404 });
        });
      })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let notification;
  try {
    notification = event.data.json();
  } catch (error) {
    notification = {
      title: 'BrainLift',
      body: event.data.text(),
    };
  }

  const options = {
    body: notification.body || 'You have a new notification',
    icon: notification.icon || '/icon-192x192.png',
    badge: notification.badge || '/icon-96x96.png',
    image: notification.image,
    tag: notification.tag || 'brainlift-notification',
    data: notification.data || {},
    requireInteraction: notification.requireInteraction || false,
    actions: notification.actions || [],
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(notification.title || 'BrainLift', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  if (data.type === 'quiz_completed') {
    url = `/quizzes`;
  } else if (data.type === 'content_shared') {
    if (data.navigation) {
      if (data.navigation.screen === 'QuizDetails' && data.navigation.params?.quizId) {
        url = `/quiz/${data.navigation.params.quizId}/take`;
      } else if (data.navigation.screen === 'FlashcardDeck' && data.navigation.params?.deckId) {
        url = `/flashcards/${data.navigation.params.deckId}/study`;
      }
    } else if (data.share_url) {
      url = data.share_url;
    }
  } else if (data.type === 'study_reminder') {
    url = '/flashcards';
  } else if (data.type === 'achievement_unlocked') {
    url = '/profile';
  } else if (data.url) {
    url = data.url;
  }

  if (event.action) {
    switch (event.action) {
      case 'view':
        break;
      case 'dismiss':
        return;
      default:
        if (data.actions && data.actions[event.action]) {
          url = data.actions[event.action];
        }
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            return client.navigate(url);
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  try {
    const cache = await caches.open('notification-sync');
    const requests = await cache.keys();

    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
        }
      } catch (error) {
        console.error('Failed to sync notification action:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
