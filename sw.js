/* --- SW.JS (Version Force Update) --- */
const CACHE_NAME = 'agent-ia-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js'
];

// 1. INSTALLATION : On force le "skipWaiting"
self.addEventListener('install', (e) => {
    // Cette ligne force le SW à ne pas attendre
    self.skipWaiting(); 
    
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

// 2. ACTIVATION : On prend le contrôle immédiatement et on nettoie
self.addEventListener('activate', (e) => {
    e.waitUntil(
        Promise.all([
            // Cette ligne permet au SW de contrôler la page ouverte immédiatement
            self.clients.claim(), 
            
            // Nettoyage des vieux caches
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_NAME) {
                            console.log('Nettoyage ancien cache :', key);
                            return caches.delete(key);
                        }
                    })
                );
            })
        ])
    );
});

// 3. FETCH : Stratégie "Network First" pour les fichiers critiques
// (Pour éviter d'être bloqué sur un vieux index.html)
self.addEventListener('fetch', (e) => {
    // Si c'est une requête vers l'API ou un fichier local
    e.respondWith(
        fetch(e.request)
            .then((res) => {
                // Si on a le réseau, on met à jour le cache et on renvoie la réponse
                const resClone = res.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    // On ne cache pas les appels API (POST)
                    if(e.request.method === 'GET') cache.put(e.request, resClone);
                });
                return res;
            })
            .catch(() => {
                // Si pas de réseau, on prend le cache
                return caches.match(e.request);
            })
    );
});
