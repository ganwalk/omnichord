// Service worker template. The build (vite.config.ts) fills in VERSION and
// PRECACHE and writes the result to dist/sw.js.
//
// • Every built file is precached at install, so the app works offline.
// • Pages are network-first (a new deploy shows up on the next visit) with the
//   cached index.html as the offline fallback.
// • Hashed assets are cache-first; old caches are dropped on activate.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `omniharp-${VERSION}`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        // 'omnisound-' caches are from before the rename.
        keys.filter(k => (k.startsWith('omniharp-') || k.startsWith('omnisound-')) && k !== CACHE).map(k => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          if (res.ok) caches.open(CACHE).then(c => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(caches.match(req).then(hit => hit ?? fetch(req)));
});
