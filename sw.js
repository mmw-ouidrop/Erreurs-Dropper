/**
 * OUIDROP — Service Worker
 * Stratégie : Cache First pour les assets statiques,
 *             Network First pour les données GAS,
 *             Offline fallback sur la page login.html
 */

const CACHE_NAME = 'ouidrop-v1';
const OFFLINE_PAGE = './login.html';

// Assets à mettre en cache immédiatement à l'installation
const PRECACHE_ASSETS = [
  './',
  './login.html',
  './index.html',
  './search.html',
  './error.html',
  './table-automate.html',
  './table-lexium.html',
  './notes.html',
  './stats.html',
  './style.css',
  './core.js',
  './manifest.json',
  './favicon/favicon-16x16.png',
  './favicon/favicon-32x32.png',
  './favicon/apple-touch-icon.png',
  './favicon/android-chrome-192x192.png',
  './favicon/android-chrome-512x512.png',
];

// ── Installation ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // On met en cache les assets essentiels, on ignore les erreurs individuelles
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(() => {
            // Ignore les ressources manquantes (ex: icon-192 si pas encore généré)
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activation ────────────────────────────────────
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

// ── Fetch ─────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Requêtes Google Apps Script → Network Only (données dynamiques)
  if (url.hostname === 'script.google.com') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'Hors ligne — données non disponibles' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        )
      )
    );
    return;
  }

  // Ressources Google Fonts → Cache First avec fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Assets du site → Cache First, Network Fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // En background, on met à jour le cache (stale-while-revalidate)
        fetch(request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response));
          }
        }).catch(() => {});
        return cached;
      }

      // Pas en cache → réseau
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Navigation HTML → page offline
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_PAGE);
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

// ── Messages ──────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.source?.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
