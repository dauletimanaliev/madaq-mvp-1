// Madaq PWA Service Worker
//
// Caching rules:
// - Pages (HTML navigations) always come from the network and are never
//   stored: they are personal to the signed-in user and change on deploy.
// - /_next/static/* files have content hashes in their names, so they are
//   cached forever (cache-first).
// - Other public files (fonts, covers, icons, pdf worker) use
//   stale-while-revalidate.
// - API, streams, RSC and range requests are not intercepted.

// Bumping the version deletes older caches (which held HTML pages).
const CACHE_NAME = "madaq-cache-v2";
const STATIC_ASSETS = ["/manifest.json", "/icon.svg", "/pdf.worker.min.mjs"];

const OFFLINE_HTML = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Madaq — нет сети</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#f4efe6;color:#2b2723;font-family:Georgia,serif;text-align:center;padding:16px}
button{margin-top:16px;padding:8px 16px;border-radius:8px;border:1px solid #cfc6b8;background:#fff;font:inherit;cursor:pointer}</style>
</head><body><div><p>Нет подключения к интернету.</p>
<button onclick="location.reload()">Повторить</button></div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined))
        )
      )
  );
  self.clients.claim();
});

function isCacheable(response) {
  return response && response.status === 200 && response.type === "basic";
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/") ||
    url.pathname.includes("/pdf-stream") ||
    url.pathname.includes("/epub-stream") ||
    url.searchParams.has("_rsc") ||
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("range")
  ) {
    return;
  }

  // Pages: network only, with a small offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(OFFLINE_HTML, {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
      )
    );
    return;
  }

  // Hashed build files: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isCacheable(response)) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Anything else that is not a static public file goes straight to the network.
  if (url.pathname.startsWith("/_next/")) return;

  // Public static files: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
