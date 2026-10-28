// Psalmodia hors connexion. La page est prise sur le réseau d'abord (pour avoir toujours la dernière version),
// le reste en cache. Le cache « psalmodia-audio » (les chants enregistrés) n'est jamais effacé.
const C = 'psalmodia-282b8f3d44';
const KEEP = 'psalmodia-audio';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && k !== KEEP).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (r.mode === 'navigate' || (u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname))) {
    e.respondWith(fetch(r, { cache: 'no-store' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(C).then(c => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html', { cacheName: C }).then(h => h || caches.match(r))));
    return;
  }
  // L'audio (même adresse que l'appli) passe directement : Safari exige des réponses par morceaux (206),
  // et l'appli enregistre déjà les chants elle-même ; les mettre ici en ferait un double sur l'iPhone.
  if (r.headers.has('range') || /\/psalmodia-audio\/|\.(m4a|mp3|aac|wav|ogg)$/i.test(u.pathname)) return;
  if (u.origin !== location.origin && !/(^|\.)(gstatic|googleapis)\.com$/.test(u.hostname)) return;
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(r, { ignoreSearch: u.origin === location.origin });
    const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
