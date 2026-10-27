// SnapLab NG service worker (docs/plans/pwa-offline.md).
//
// The routing decision below is the same logic as `routeFor` in
// apps/web/src/pwa/routing.ts, copied into plain JavaScript because a
// service worker cannot import that module. Keep the two in sync.
// `/api/*` responses are never cached.
const CACHE = "snaplab-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/golden/note1.json",
  "/golden/note1.jpg",
];

function routeFor(url, method, mode) {
  if (method !== "GET") return "bypass";
  if (url.origin !== self.location.origin) return "bypass";
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return "bypass";
  if (mode === "navigate") return "navigate-network-first";
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/golden/")) {
    return "cache-first";
  }
  return "bypass";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("snaplab-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const route = routeFor(new URL(request.url), request.method, request.mode);
  if (route === "bypass") return;

  if (route === "navigate-network-first") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/index.html");
        return cached ?? Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
