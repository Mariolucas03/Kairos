const CACHE_VERSION = 'kairos-v1.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// 1. ARCHIVOS CRÍTICOS (Se instalan al entrar por primera vez)
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png',
    '/assets/icons/ficha.png',
    '/assets/icons/moneda.png',
    '/assets/icons/corazon.png',
    '/assets/icons/xp.png',
    '/assets/images/reverso-carta.png',
    '/assets/body/cuerpo.png'
];

// --- FASE DE INSTALACIÓN ---
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Fuerza a que el nuevo SW tome el control inmediatamente
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[Service Worker] Precaching recursos críticos...');
            return cache.addAll(CORE_ASSETS);
        })
    );
});

// --- FASE DE ACTIVACIÓN (Limpieza) ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Si la caché no es la versión actual, la borramos para liberar espacio
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('[Service Worker] Borrando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Toma control de todas las pestañas abiertas
    );
});

// --- INTERCEPTOR DE PETICIONES (ESTRATEGIA DE CACHÉ) ---
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. REGLA DE ORO: Las peticiones a la API o autenticación NUNCA se cachean (Network Only)
    if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
        return; // Deja que el navegador haga la petición normal a internet
    }

    // 2. ESTRATEGIA PARA IMÁGENES Y ASSETS: Cache First, fallback a Network
    if (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|woff2)$/)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse; // Devuelve al instante desde el disco duro
                }

                // Si no está en caché, lo baja de internet y lo guarda
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(DYNAMIC_CACHE).then((cache) => {
                        // Guardamos un clon de la respuesta para el futuro
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 3. ESTRATEGIA PARA EL RESTO (HTML, JS de Vite): Network First, fallback a Cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                return caches.open(DYNAMIC_CACHE).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            })
            .catch(() => {
                // Si el usuario no tiene internet, le mostramos lo último que guardó
                return caches.match(event.request);
            })
    );
});

// --- SISTEMA DE NOTIFICACIONES PUSH (Mantenido y Mejorado) ---
self.addEventListener('push', function (event) {
    if (!event.data) return;

    try {
        const data = event.data.json();

        const options = {
            body: data.body,
            icon: data.icon || '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/icon-192x192.png', // Icono monocolor para la barra de estado de Android
            vibrate: [200, 100, 200, 100, 200], // Patrón de vibración agresivo (para castigos)
            requireInteraction: true, // Evita que la notificación desaparezca sola
            data: {
                url: data.url || '/'
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    } catch (e) {
        console.error('[Service Worker] Error al parsear notificación push:', e);
    }
});

// --- CLIC EN LA NOTIFICACIÓN ---
self.addEventListener('notificationclick', function (event) {
    event.notification.close(); // Cierra el popup

    // Abre la app en la ruta enviada por el servidor
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            // Si la app ya está abierta en segundo plano, la trae al frente
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si estaba cerrada del todo, la abre
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});