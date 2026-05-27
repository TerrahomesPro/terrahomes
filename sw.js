// TerraHomes CRM — Service Worker
const CACHE = 'terrahomes-v1';

// Αρχεία που cache-άρουμε για γρήγορο άνοιγμα
const STATIC = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Install: cache τα static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activate: καθάρισε παλιά caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first για Supabase/Cloudinary, cache-first για static
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase και Cloudinary — πάντα network (live data)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('cloudinary.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Static assets — cache-first, fallback network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        caches.open(CACHE).then(cache => cache.put(e.request, res.clone()));
      }
      return res;
    }))
  );
});
