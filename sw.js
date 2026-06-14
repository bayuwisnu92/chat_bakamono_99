const CACHE_NAME = 'chatapp-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './contact.html',
  './login.html',
  './register.html',
  './css/style.css',
  './js/main.js',
  './js/supabaseClient.js',
  './js/contacts.js',
  './js/chat.js',
  './js/socket.js',
  './js/auth.js',
  './notifikasi/pesan.mp3',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css',
];

// ─── Install: Cache static assets ────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: Delete old caches ─────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: Network first, fallback to cache ──────────────────────────────────
self.addEventListener('fetch', (e) => {
  // Skip non-GET requests and Supabase API calls (always need network)
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          // Return offline page for navigation requests
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  const data = e.data?.json() || { title: 'ChatApp', body: 'Pesan baru!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./contact.html'));
});