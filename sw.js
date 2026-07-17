const CACHE = "sejarahgo-v4-multi-mission";
const ASSETS = [
  "./","./index.html","./css/styles.css","./js/data.js","./js/app.js",
  "./manifest.webmanifest","./assets/icons/favicon.svg",
  "./assets/characters/cartoon-amir.svg","./assets/characters/cartoon-alya.svg",
  "./assets/characters/cartoon-hakim.svg","./assets/characters/cartoon-zara.svg",
  "./assets/characters/explorer-amir.svg","./assets/characters/explorer-alya.svg",
  "./assets/characters/explorer-hakim.svg","./assets/characters/explorer-zara.svg"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});