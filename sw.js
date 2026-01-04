const CACHE_NAME = 'nexus-agent-v5.1-force';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
];

// 1. Installation : Force l'attente
self.addEventListener('install', (e) => {
    self.skipWaiting(); // Force l'activation immédiate du nouveau SW
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

// 2. Activation : Nettoyage et Prise de contrôle
self.addEventListener('activate', (e) => {
    e.waitUntil(
        Promise.all([
            self.clients.claim(), // Contrôle immédiat des pages ouvertes
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_NAME) return caches.delete(key);
                    })
                );
            })
        ])
    );
});

// 3. Fetch : Stratégie hybride
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then((res) => {
                const resClone = res.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    if(e.request.method === 'GET') cache.put(e.request, resClone);
                });
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
