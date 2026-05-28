// TerraHomes CRM — Service Worker v2 (auto-update)
// Στρατηγική:
//   - index.html → network-first (πάντα τη νεότερη έκδοση όταν είσαι online,
//                                 cache fallback μόνο για offline)
//   - Static libraries/fonts → cache-first (ταχύτητα)
//   - Supabase/Cloudinary → πάντα network (live data)
//
// Αλλάζοντας τον αριθμό έκδοσης παρακάτω, παλιά caches καθαρίζονται αυτόματα.
const CACHE_VERSION = 'v2';
const CACHE_STATIC = `terrahomes-static-${CACHE_VERSION}`;
const CACHE_HTML = `terrahomes-html-${CACHE_VERSION}`;

// Static assets — cache-άρουμε ΜΟΝΟ τα εξωτερικά libraries/fonts.
// (Το /index.html ΔΕΝ πρέπει να είναι εδώ — έχει δική του network-first πολιτική.)
const STATIC = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Install: προ-cache static + ενεργοποίηση χωρίς αναμονή
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC).catch(() => {})) // αν αποτύχει ένα CDN δεν σπάμε όλο το install
      .then(() => self.skipWaiting())
  );
});

// Activate: καθάρισε παλιές caches και πάρε αμέσως control
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_HTML)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Message: επιτρέπει στον client να ζητήσει άμεση ενεργοποίηση νέου SW
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch: ξεχωριστές στρατηγικές ανά τύπο αιτήματος
self.addEventListener('fetch', e => {
  // Αγνοούμε τα non-GET — δεν θέλουμε καμία ανάμειξη με POST/PUT/DELETE
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // ── Live data (Supabase, Cloudinary): πάντα network, ποτέ cache ──
  if (url.hostname.includes('supabase.co') || url.hostname.includes('cloudinary.com')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // ── HTML navigation requests (index.html): NETWORK-FIRST ──
  // Έτσι, μόλις ανεβάσεις νέα έκδοση, οι χρήστες την παίρνουν αμέσως.
  // Cache fallback μόνο όταν δεν υπάρχει δίκτυο (offline).
  const isHTML =
    e.request.mode === 'navigate' ||
    e.request.destination === 'document' ||
    (url.origin === self.location.origin && (url.pathname === '/' || url.pathname.endsWith('/index.html')));

  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Αποθήκευσε το νέο HTML για offline χρήση
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_HTML).then(cache => cache.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          // Offline: σερβίρισε από cache αν υπάρχει
          caches.match(e.request).then(cached =>
            cached || caches.match('/') || caches.match('/index.html') ||
            new Response('Offline — η εφαρμογή δεν έχει αποθηκευτεί ακόμα.', {
              status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            })
          )
        )
    );
    return;
  }

  // ── Static assets (CDN libraries, fonts): CACHE-FIRST για ταχύτητα ──
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});
