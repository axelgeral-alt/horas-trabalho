const CACHE_NAME = "horas-trabalho-v4";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./libs/xlsx.full.min.js",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

// =========================================================
// INSTALAÇÃO
// =========================================================
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// =========================================================
// ATIVAÇÃO
// =========================================================
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// =========================================================
// FETCH (OFFLINE FIRST)
// =========================================================
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return (
                response ||
                fetch(event.request).catch(() => {
                    return caches.match("./index.html");
                })
            );
        })
    );
});


