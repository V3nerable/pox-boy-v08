const CACHE_NAME = 'pipboy-cache-v76';
// v0.53: radio packs live in their own bucket -- app updates must NEVER wipe them
const RADIO_CACHE = 'pox-radio-v1';

const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.png',
  './icon-192.png',
  './icon-512.png',
  './geiger.mp3',
  './radio-stations.json',
  'https://fonts.googleapis.com/css2?family=VT323&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the new service worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RADIO_CACHE) {
            return caches.delete(cacheName); // Delete old caches automatically
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Take control of all open pages immediately
    })
  );
});

// UPDATE-SAFE STRATEGY (v0.23):
// The old cache-first-everything handler could serve index.html from the NEW cache and
// app.js from a OLD cache (a "frankenbuild" running half-updated code -- exactly how a
// fullscreen fix appears to "not work" on a device whose camera fix DID arrive).
//
// Same-origin files (our HTML/CSS/JS):  NETWORK-FIRST. Online = always fresh code, and the
//           cache copy is refreshed in the background. Offline = instant cache fallback.
// Third-party CDN (Leaflet/Firebase/QR libs/fonts): CACHE-FIRST, otherwise untouched.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let isSameOrigin = false;
  try {
    isSameOrigin = new URL(req.url).origin === self.location.origin;
  } catch (e) {
    isSameOrigin = false;
  }

  if (isSameOrigin) {
    event.respondWith(
      fetch(req).then(networkResp => {
        if (networkResp && networkResp.ok) {
          const copy = networkResp.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(req, copy))
            .catch(() => {});
        }
        return networkResp;
      }).catch(() => {
        return caches.match(req).then(cached => {
          if (cached) return cached;
          // Offline first-load of a navigation: serve the cached app shell.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Promise.reject('offline');
        });
      })
    );
  } else {
    // v0.53: radio CDN traffic -- the downloader owns pox-radio-v1; this branch only
    // (a) serves onboard packs when offline and (b) streams when online WITHOUT
    // double-storing 100MB of audio into the app cache on autopilot.
    const isRadio = req.url.indexOf('pox-radio.netlify.app') !== -1;
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(networkResp => {
          if (networkResp && !isRadio) {
            const copy = networkResp.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(req, copy))
              .catch(() => {});
          }
          return networkResp;
        });
      })
    );
  }
});
