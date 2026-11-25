const VERSION = '__SUBS_BUILD__';
const CACHE = `subs-shell-${VERSION}`;
const SHELL = ['/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

async function fresh(path) {
  const url = new URL(path, self.location.origin);
  url.searchParams.set('__subs_build', VERSION);
  const response = await fetch(url, {cache:'no-store'});
  if (!response.ok) throw new Error(`Offline shell unavailable: ${path}`);
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const page = await fresh('/');
    const html = await page.clone().text();
    // A CDN may briefly serve the previous deployment. Never activate a mixed shell.
    if (!html.includes(`<meta name="subs-build" content="${VERSION}">`)) throw new Error('Deployment not ready');
    await cache.put('/', page.clone());
    await cache.put('/index.html', page);
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)[^"]*"/g)].map(match => match[1]);
    await Promise.all([...new Set([...SHELL, ...assets])].map(async path => cache.put(path, await fresh(path))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith('subs-shell-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
    // Only the page knows whether a form is open. Never force-navigate legacy
    // clients that cannot yet defer a refresh to protect their in-memory drafts.
    for (const client of await self.clients.matchAll({type:'window'})) {
      client.postMessage({type:'SUBS_UPDATE', version:VERSION});
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SUBS_VERSION') event.ports[0]?.postMessage({version:VERSION});
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/sw.js') return;
  event.respondWith((async () => {
    // Serve one complete, precached release, online or offline. Updates replace it
    // atomically only after the next release's HTML, JS and CSS are all available.
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request.mode === 'navigate' ? '/' : event.request);
    return cached || fetch(event.request);
  })());
});
