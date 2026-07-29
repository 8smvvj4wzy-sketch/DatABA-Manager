/* Service worker de l'application Suivi ABA (cadres pédagogiques).
   Même stratégie que l'app tablette : le réseau a 2,5 s pour répondre à
   l'ouverture, au-delà on ouvre depuis le cache et la mise à jour se termine
   en arrière-plan. Sans ce garde-fou, une connexion lente laisse un écran
   blanc plusieurs minutes.

   APRÈS CHAQUE MISE EN LIGNE : incrémentez CACHE_VERSION. */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `aba-cadre-${CACHE_VERSION}`;
const NETWORK_TIMEOUT_MS = 2500;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['./', './index.html', './manifest.webmanifest']).catch(() => {})
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const enCache = (await cache.match(request)) || (await cache.match('./index.html')) || (await cache.match('./'));
        const reseau = fetch(request)
          .then((r) => { if (r && r.status === 200) cache.put(request, r.clone()); return r; })
          .catch(() => null);
        if (!enCache) return (await reseau) || Response.error();
        const attente = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));
        const gagnant = await Promise.race([reseau, attente]);
        if (gagnant) return gagnant;
        event.waitUntil(reseau);
        return enCache;
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((enCache) => {
      if (enCache) return enCache;
      return fetch(request).then((r) => {
        if (r && (r.status === 200 || r.type === 'opaque')) {
          const copie = r.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
        }
        return r;
      }).catch(() => enCache);
    })
  );
});
