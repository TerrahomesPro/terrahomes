// TerraHomes CRM — Service Worker
const CACHE = 'terrahomes-v8';

// Αρχεία που cache-άρουμε για γρήγορο άνοιγμα
const STATIC = [
  '/',
  '/index.html',
  // Καρφωμένη έκδοση — ΙΔΙΑ με το <script> στο index.html
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// Βιβλιοθήκες PDF — φορτώνονται lazy από το index.html (_PDF_LIB_URLS: ΙΔΙΕΣ URLs).
// Cache-άρονται στο install ΜΕΜΟΝΩΜΕΝΑ: αν αποτύχει κάποια, ΔΕΝ αποτυγχάνει το install.
const PDF_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

// Hosts με σταθερές (καρφωμένες) εκδόσεις → ασφαλές cache-first.
// SW-3: ΟΤΙΔΗΠΟΤΕ ΑΛΛΟ (τρίτα APIs κ.λπ.) περνά απευθείας στο δίκτυο, χωρίς cache.
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

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
    caches.open(CACHE).then(cache =>
      cache.addAll(STATIC).then(() =>
        Promise.all(PDF_LIBS.map(u => cache.add(new Request(u, { mode: 'cors' })).catch(() => {})))
      )
    )
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
  // Μόνο GET· POST/PATCH/DELETE κ.λπ. τα χειρίζεται κανονικά ο browser
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Supabase και Cloudinary — πάντα network (live data)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('cloudinary.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // HTML (το ίδιο το app) — NETWORK-FIRST ώστε να φορτώνει πάντα η νεότερη έκδοση.
  // Έτσι ΔΕΝ χρειάζεται ποτέ να αλλάζουμε το version του sw.js χειροκίνητα.
  // Offline → fallback στο cached index.html.
  // SW-5: ΜΟΝΟ η ίδια η εφαρμογή (/ ή /index.html) αποθηκεύεται ως '/index.html'.
  // Άλλες σελίδες του ίδιου site (αν ανοιχτούν) πάνε στο δίκτυο και δεν
  // αντικαθιστούν ποτέ την αποθηκευμένη εφαρμογή.
  const sameOrigin = url.origin === self.location.origin;
  const isAppPath = sameOrigin && (url.pathname === '/' || url.pathname === '/index.html');
  if (e.request.mode === 'navigate' && !isAppPath) return;
  const isHTML = isAppPath && (e.request.mode === 'navigate' || e.request.destination === 'document' || e.request.destination === '');
  if (isHTML) {
    const net = fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        return caches.open(CACHE).then(cache => cache.put('/index.html', copy)).then(() => res, () => res);
      }
      // 404/500 κ.λπ. → μη δείχνεις το ωμό σφάλμα· δώσε το cached app,
      // αλλιώς τη σελίδα «Αναβάθμιση σε εξέλιξη».
      return htmlFallback();
    }).catch(() => htmlFallback());   // offline / δικτυακό σφάλμα
    // Η λήψη ολοκληρώνεται ΚΑΙ μετά το timeout → το cache ενημερώνεται για το επόμενο άνοιγμα
    e.waitUntil(net.catch(() => {}));
    // Timeout: με «κολλημένο» δίκτυο (σήμα χωρίς data) μην αφήνεις λευκή οθόνη.
    // Αν υπάρχει cached app και το δίκτυο αργεί >5″ → δείξε το cached.
    // Αν ΔΕΝ υπάρχει cached app (πρώτο άνοιγμα) → περίμενε κανονικά το δίκτυο.
    e.respondWith(
      caches.match('/index.html').then(cached => {
        if (!cached) return net;
        const timeout = new Promise(resolve => setTimeout(() => resolve(cached), 5000));
        return Promise.race([net, timeout]);
      })
    );
    return;
  }

  // SW-3: Cache ΜΟΝΟ για στατικά — CDN βιβλιοθήκες/fonts και αρχεία του ίδιου site
  // (εικονίδια, manifest). Όλα τα άλλα: απευθείας δίκτυο, χωρίς αποθήκευση.
  const isCdn = CDN_HOSTS.includes(url.hostname);
  if (!isCdn && !sameOrigin) return;
  if (sameOrigin) {
    // Αρχεία του site μπορεί να αλλάξουν (manifest, εικονίδια) → stale-while-revalidate:
    // δείξε άμεσα το αποθηκευμένο, ενημέρωσε στο παρασκήνιο για την επόμενη φορά.
    e.respondWith(
      caches.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          if (res && res.ok && res.type !== 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, copy)).catch(() => {});
          }
          return res;
        });
        if (cached) { e.waitUntil(net.catch(() => {})); return cached; }
        return net;
      })
    );
    return;
  }

  // CDN (καρφωμένες εκδόσεις) — cache-first, fallback network
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
