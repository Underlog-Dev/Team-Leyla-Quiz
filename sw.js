/* Offline cache. Bump VERSION whenever you change any file so phones pick up updates. */
const VERSION = 'tlqh-v34';
const FILES = ['./', 'index.html', 'stream.html', 'style.css', 'core.js', 'themes.js', 'app.js', 'play.js', 'riddle.js', 'riddles.js', 'hangman.js', 'hangman-words.js', 'questions.js', 'tiebreakers.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'bg-home.jpg', 'bg-setup.jpg', 'bg-home-tall.jpg', 'bg-setup-tall.jpg', 'bg-mode-tall.jpg', 'bg-mode.jpg', 'bg-rsetup-tall.jpg', 'bg-rsetup.jpg', 'bg-hangman-tall.jpg', 'bg-hangman.jpg', 'hm0.jpg', 'hm1.jpg', 'hm2.jpg', 'hm3.jpg', 'hm4.jpg', 'hm5.jpg', 'bg-hsetup-tall.jpg', 'bg-hleader-tall.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
