// Al subir este número, la activación borra TODAS las cachés anteriores.
// Hay que tocarlo cuando cambie la estrategia de caché (como ahora).
const CACHE_VERSION = 'kairos-v1.1';
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

// Solo se guarda en caché lo que se puede guardar sin romper nada:
// respuestas correctas, del mismo origen y por http(s). Antes se hacía
// cache.put() de CUALQUIER respuesta —incluidos errores 4xx/5xx, redirecciones
// y respuestas opacas de otros dominios—, así que un fallo puntual del servidor
// se quedaba guardado y se seguía sirviendo después.
const sePuedeCachear = (request, response) => {
    if (!response || !response.ok || response.type === 'opaque') return false;
    const url = new URL(request.url);
    if (!url.protocol.startsWith('http')) return false;
    return url.origin === self.location.origin;
};

const guardarEnCache = (request, response) => {
    if (!sePuedeCachear(request, response)) return;
    const copia = response.clone();
    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, copia)).catch(() => { });
};

// --- INTERCEPTOR DE PETICIONES (ESTRATEGIA DE CACHÉ) ---
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. REGLA DE ORO: Las peticiones a la API o autenticación NUNCA se cachean (Network Only)
    if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
        return; // Deja que el navegador haga la petición normal a internet
    }

    // 2. NAVEGACIÓN (abrir la app): SIEMPRE se intenta la red primero y, si no hay,
    //    se sirve el index guardado. Es lo que evita quedarse con un index.html
    //    viejo que apunta a trozos de código que ya no existen en el servidor:
    //    ese desajuste es lo que dejaba la pantalla en NEGRO tras un despliegue.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => { guardarEnCache(event.request, response); return response; })
                .catch(() => caches.match(event.request).then(r => r || caches.match('/index.html')))
        );
        return;
    }

    // 3. IMÁGENES Y ASSETS CON HASH: Cache First (son inmutables)
    if (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|woff2)$/)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                // Si falla la red, antes se rompía la respuesta entera y la imagen
                // (o el trozo de código) quedaba sin cargar sin ningún aviso.
                return fetch(event.request)
                    .then((networkResponse) => { guardarEnCache(event.request, networkResponse); return networkResponse; })
                    .catch(() => caches.match(event.request));
            })
        );
        return;
    }

    // 4. EL RESTO: Network First, con la caché como red de seguridad
    event.respondWith(
        fetch(event.request)
            .then((response) => { guardarEnCache(event.request, response); return response; })
            .catch(() => caches.match(event.request))
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

    const destino = event.notification.data?.url || '/';

    // Abre la app en la ruta enviada por el servidor.
    // ⚠️ Antes comparaba client.url === '/', y client.url es la URL COMPLETA
    // ("https://tuapp.com/home"), así que nunca coincidía: la rama de "traer al
    // frente" no se ejecutaba jamás y siempre se abría una ventana nueva.
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    if ('navigate' in client) client.navigate(destino).catch(() => { });
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(destino);
        })
    );
});