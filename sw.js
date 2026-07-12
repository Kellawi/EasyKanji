// EasyKanji service worker — offline shell + cached stroke data.
const V = "ek-v1";
const SHELL = [
  "./", "index.html", "css/style.css", "manifest.webmanifest", "assets/favicon.svg",
  "js/app.js", "js/data.js", "js/ui.js", "js/kana.js", "js/srs.js", "js/stroke.js",
  "js/views/home.js", "js/views/kanji.js", "js/views/browse.js", "js/views/learn.js",
  "js/views/review.js", "js/views/practice.js", "js/views/about.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // immutable per-kanji data: cache first
  if (url.pathname.includes("/data/kanjivg/") || url.pathname.includes("/data/words/")) {
    e.respondWith(
      caches.open(V).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }
  // everything else: network first, fall back to cache (offline)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) caches.open(V).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("index.html")))
  );
});
