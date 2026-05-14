// Lumina Service Worker — hand-rolled, no Workbox.
// 策略：
//   - 静态资源 (JS/CSS/字体/图标/SVG)：stale-while-revalidate
//   - HTML 入口 (index.html / "/")：network-first，离线 fallback 到缓存
//   - 第三方字体 (fonts.gstatic.com / fonts.googleapis.com)：cache-first
//   - Supabase/API/POST 请求：直通不缓存
//   - 新版本部署后用户刷新即生效 (skipWaiting + clients.claim)

const VERSION = 'v2';
const CACHE_STATIC = `lumina-static-${VERSION}`;
const CACHE_HTML = `lumina-html-${VERSION}`;
const CACHE_FONTS = `lumina-fonts-${VERSION}`;

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon.svg',
  '/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_HTML).then((cache) => cache.addAll(STATIC_PRECACHE)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![CACHE_STATIC, CACHE_HTML, CACHE_FONTS].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isHTMLRequest(req) {
  if (req.mode === 'navigate') return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

function isFontRequest(url) {
  return url.host === 'fonts.gstatic.com' || url.host === 'fonts.googleapis.com';
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    /\.(js|mjs|css|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 不缓存 API / Supabase
  if (
    url.pathname.startsWith('/api/') ||
    url.host.includes('supabase.co') ||
    url.host.includes('luminaio.dpdns.org/api')
  ) {
    return;
  }

  if (isHTMLRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_HTML);
          cache.put('/index.html', fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = await caches.match('/index.html');
          if (cached) return cached;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  if (isFontRequest(url)) {
    event.respondWith(
      caches.open(CACHE_FONTS).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      })
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((fresh) => {
            if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
            return fresh;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
