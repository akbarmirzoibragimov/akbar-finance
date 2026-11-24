/* Akbar Finance 3.0 — offline app shell. Caches only the app's own static files; ledger data stays in IndexedDB and never goes over the network. */
var CACHE = 'akbar-finance-v3.0.1';
var SHELL = ['./', './index.html', './manifest.webmanifest', './src/styles.css', './src/core.js', './src/icons.js', './src/charts.js', './src/db.js', './src/app.js', './src/screens-home.js', './src/modals-record.js', './src/modals-more.js', './src/modals-extra.js', './src/screens-planning.js', './src/screens-stats.js', './src/screens-more.js', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (res) { if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); } return res; }).catch(function () { return caches.match('./index.html'); });
  }));
});
