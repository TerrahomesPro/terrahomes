ΧΑΡΤΗΣ ΑΚΙΝΗΤΩΝ — ΟΔΗΓΙΕΣ ΑΦΑΙΡΕΣΗΣ
=====================================
Δοκιμασμένο: το αρχείο δουλεύει κανονικά μετά, χωρίς υπολείμματα.

1) index.html — το κύριο μπλοκ
   Σβήσε ΟΛΟ ό,τι είναι ανάμεσα σε (και μαζί με):
       /* ===== MAP MODULE START ===== */  ...  /* ===== MAP MODULE END ===== */

2) index.html — κουμπί χάρτη (αναζήτησε: MAP MODULE hook)
   Άλλαξε:
       A.innerHTML = (canEdit ? `...+ Καταχώρηση...` : '')
         + `<button ... onclick="MAP_open()">🗺️ Χάρτης</button>`;
   Σε:
       A.innerHTML = canEdit ? `...+ Καταχώρηση...` : '';

3) index.html — μπλοκ πινέζας στη φόρμα
   Σβήσε ό,τι είναι ανάμεσα σε:
       <!-- MAP MODULE hook: θέση στον χάρτη -->  ...  <!-- /MAP MODULE hook -->

4) index.html — εντοπισμός στην αποθήκευση (μέσα στο saveAk)
   Σβήσε ό,τι είναι ανάμεσα σε:
       /* ===== MAP MODULE hook: αυτόματος εντοπισμός θέσης ===== */
       ...
       /* ===== /MAP MODULE hook ===== */

5) index.html — συντεταγμένες στο data (μέσα στο saveAk)
   Σβήσε τις 5 γραμμές:
       /* MAP MODULE hook — αν αφαιρεθεί το module, σβήσε τις 3 γραμμές */
       lat: ... / lng: ... / geo_manual: ... / geo_status: ...

6) sw.js (προαιρετικό)
   Σβήσε το μπλοκ ===== MAP MODULE ===== ... ===== MAP MODULE END =====

ΒΑΣΗ ΔΕΔΟΜΕΝΩΝ (μένουν αβλαβή — τίποτε άλλο δεν τα χρησιμοποιεί)
   Στήλες akinita: lat, lng, geo_manual, geo_src, geo_status
   Πίνακας: perioches_geo
   Αν θες να φύγουν κι αυτά:
       ALTER TABLE akinita DROP COLUMN lat, DROP COLUMN lng,
             DROP COLUMN geo_manual, DROP COLUMN geo_src, DROP COLUMN geo_status;
       DROP TABLE perioches_geo;
