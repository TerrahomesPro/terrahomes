// TerraHomes CRM — Service Worker
const CACHE = 'terrahomes-v2';

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

  // HTML (το ίδιο το app) — NETWORK-FIRST ώστε να φορτώνει πάντα η νεότερη έκδοση.
  // Έτσι ΔΕΝ χρειάζεται ποτέ να αλλάζουμε το version του sw.js χειροκίνητα.
  // Offline → fallback στο cached index.html.
  const isHTML = e.request.mode === 'navigate' ||
                 url.pathname === '/' ||
                 url.pathname.endsWith('/index.html');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put('/index.html', copy));
        }
        return res;
      }).catch(() => caches.match('/index.html').then(c => c || caches.match('/')))
    );
    return;
  }

  // Static assets (βιβλιοθήκες/fonts) — cache-first, fallback network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        caches.open(CACHE).then(cache => cache.put(e.request, res.clone()));
      }
      return res;
    }))
  );
});
