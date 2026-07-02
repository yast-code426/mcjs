const CACHE_NAME = 'mcjs-cache-v1';
const MAX_CACHE_SIZE = 100 * 1024 * 1024;
const STATIC_ASSETS = [
    './',
    './index.html'
];
const DYNAMIC_ASSETS = [
    'classes.js.gz',
    'assets.epk.gz'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('mcjs-cache')) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    if (url.pathname.endsWith('classes.js.gz') || url.pathname.endsWith('assets.epk.gz')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                try {
                    const networkResponse = await fetch(event.request);
                    if (networkResponse.ok) {
                        const clone = networkResponse.clone();
                        const body = await clone.blob();
                        
                        cache.match(event.request).then(async (existing) => {
                            if (existing) {
                                const existingBody = await existing.blob();
                                await trimCacheIfNeeded(cache, existingBody.size);
                            }
                            await cache.put(event.request, new Response(body, {
                                headers: networkResponse.headers,
                                status: networkResponse.status,
                                statusText: networkResponse.statusText
                            }));
                        });
                    }
                    return networkResponse;
                } catch (error) {
                    return new Response('Network error', { status: 408 });
                }
            })
        );
        return;
    }
    
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse.ok && event.request.method === 'GET') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
        );
        return;
    }
    
    if (url.href.includes('cdn.jsdelivr.net/npm/pako')) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) return response;
                return fetch(event.request).then((networkResponse) => {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                });
            })
        );
        return;
    }
});

async function trimCacheIfNeeded(cache, newItemSize) {
    try {
        const keys = await cache.keys();
        let totalSize = newItemSize;
        const items = [];
        
        for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                const size = blob.size;
                items.push({ request, size });
                totalSize += size;
            }
        }
        
        if (totalSize > MAX_CACHE_SIZE) {
            items.sort((a, b) => a.size - b.size);
            
            while (totalSize > MAX_CACHE_SIZE * 0.8 && items.length > 0) {
                const item = items.shift();
                await cache.delete(item.request);
                totalSize -= item.size;
            }
        }
    } catch (e) {
        console.warn('Cache trim error:', e);
    }
}
