// TerraHomes Service Worker v1.0
// Cross-browser: Chrome Android, Safari iOS, Firefox

const CACHE_NAME = 'terrahomes-v1';
const APP_SHELL = [
  './terrahomes.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
];

// Install — cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW install error:', err))
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first για app shell, network-first για Supabase
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Supabase & Cloudinary — πάντα network (real-time data)
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('cloudinary.com') ||
      url.hostname.includes('emailjs.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // App shell — cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            // Cache νέα resources
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Offline fallback για HTML pages
            if (event.request.destination === 'document') {
              return caches.match('./terrahomes.html');
            }
          });
      })
  );
});

// Message handler — force update
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
