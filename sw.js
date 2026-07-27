// TerraHomes CRM — Service Worker
const CACHE = 'terrahomes-v5';

// Αρχεία που cache-άρουμε για γρήγορο άνοιγμα
const STATIC = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Σελίδα «αναβάθμισης» — εμφανίζεται ΜΟΝΟ ως έσχατη λύση: όταν ο server απαντά
// 404/σφάλμα (ή είμαστε offline) ΚΑΙ δεν υπάρχει cached έκδοση του app να δείξουμε.
// Έτσι ο χρήστης δεν βλέπει ποτέ ωμό 404.
const MAINTENANCE = `<!doctype html><html lang="el"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TerraHomes</title>
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,Inter,'Segoe UI',Roboto,sans-serif;
    background:#0f1115;color:#e8eaed;text-align:center;padding:24px}
  .box{max-width:420px}
  .ic{font-size:44px;margin-bottom:14px}
  h1{font-size:19px;font-weight:700;margin:0 0 10px}
  p{font-size:15px;line-height:1.5;color:#aab0b8;margin:0 0 20px}
  button{font:inherit;font-weight:600;color:#0f1115;background:#d4af37;
    border:0;border-radius:10px;padding:11px 22px;cursor:pointer}
</style></head><body><div class="box">
  <div class="ic">🛠️</div>
  <h1>Αναβάθμιση σε εξέλιξη</h1>
  <p>Αυτήν τη στιγμή πραγματοποιούμε αναβάθμιση στην εφαρμογή. Προσπαθήστε ξανά σε λίγο.</p>
  <button onclick="location.reload()">Δοκιμάστε ξανά</button>
</div></body></html>`;

function maintenancePage() {
  return new Response(MAINTENANCE, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Έσχατη λύση για ανοίγματα σελίδας: cached app → cached «/» → σελίδα αναβάθμισης
function htmlFallback() {
  return caches.match('/index.html')
    .then(c => c || caches.match('/'))
    .then(c => c || maintenancePage());
}

// Install: cache τα static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC))
  );
});

// Skip waiting ΜΟΝΟ όταν ο χρήστης πατήσει το toast «Ανανέωση»
// (το index.html στέλνει postMessage('SKIP_WAITING')). Έτσι ΔΕΝ γίνεται
// ξαφνικό auto-reload πάνω σε ανοιχτή φόρμα.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
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

  // ===== MAP MODULE =====
  // Map tiles: ΠΟΤΕ cache. Είναι εκατοντάδες μικρές εικόνες ανά zoom/pan και
  // θα γέμιζαν τη μνήμη της συσκευής (εύκολα 200-300MB σε λίγες μέρες χρήσης).
  // Ο browser τα κρατά ήδη στο δικό του HTTP cache — αρκεί.
  // (Αν αφαιρεθεί το map module, αυτό το μπλοκ μπορεί να φύγει.)
  if (url.hostname.includes('basemaps.cartocdn.com') ||
      url.hostname.includes('arcgisonline.com') ||
      url.hostname.includes('tile.openstreetmap.org')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }
  // ===== MAP MODULE END =====

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
          return res;
        }
        // 404/500 κ.λπ. → μη δείχνεις το ωμό σφάλμα· δώσε το cached app,
        // αλλιώς τη σελίδα «Αναβάθμιση σε εξέλιξη».
        return htmlFallback();
      }).catch(() => htmlFallback())   // offline / δικτυακό σφάλμα
    );
    return;
  }

  // Static assets (βιβλιοθήκες/fonts) — cache-first, fallback network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Κλωνοποίηση ΠΡΙΝ οποιαδήποτε χρήση του body. Αποκλείουμε μόνο opaque responses.
        if (res && res.ok && e.request.method === 'GET' && res.type !== 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
