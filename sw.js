const CACHE_NAME = 'agent-ia-v6-cache';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    // Stratégie : Network First (pour l'API) puis Cache (pour l'UI)
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
