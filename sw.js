// Service Worker: App-Shell cache-first, Wochendaten & Bilder network-first (mit Cache-Fallback offline).
const VERSION = "v5-wochenansicht";
const SHELL = "shell-" + VERSION;
const DATA = "data-" + VERSION;
const SHELL_FILES = [
  "./", "index.html", "styles.css", "app.js", "sync.js", "config.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // Externe Fotos (z.B. Flickr) : stale-while-revalidate; Firebase direkt
    if (req.destination === "image" || url.hostname.endsWith("staticflickr.com")) {
      e.respondWith(caches.open(DATA).then((c) => c.match(req).then((hit) => {
        const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })));
    }
    return;
  }
  const p = url.pathname;
  if (p.includes("/weeks/") || p.includes("/img/")) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(DATA).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
