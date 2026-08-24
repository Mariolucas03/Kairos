// v1.1: se sube la versión para que la activación borre las cachés viejas, que
// pueden traer GIFs del CDN guardados por la regla de imágenes de antes.
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

            // ⚠️ Uno a uno, y no con addAll.
            //
            // addAll es todo o nada: si UNO solo de los ficheros de la lista
            // devuelve 404, la promesa se rompe entera, la instalación falla y el
            // service worker no llega a activarse nunca. Y este service worker no
            // solo guarda ficheros: es el que recibe las NOTIFICACIONES PUSH. O
            // sea que renombrar una imagen del listado —algo que pasa sin
            // pensarlo— dejaría a todo el mundo sin avisos, en silencio y sin
            // relación aparente con el cambio.
            //
            // Así, lo que exista se guarda y lo que falte solo se registra.
            return Promise.all(
                CORE_ASSETS.map((ruta) =>
                    cache.add(ruta).catch((e) => {
                        console.warn('[Service Worker] No se pudo precachear ' + ruta + ':', e.message);
                    })
                )
            );
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

    // 1.b RECURSOS DE OTROS DOMINIOS: que los lleve la caché HTTP del navegador
    // Los GIFs y miniaturas del catálogo de ejercicios vienen del CDN de
    // jsDelivr, y sus rutas acaban en .gif, así que caían en la regla de
    // imágenes de abajo. Eso guardaba respuestas OPACAS (una petición de <img>
    // a otro dominio no se puede leer) en una caché sin límite: 1.291 GIFs de
    // ~300 KB, y en varios navegadores cada respuesta opaca ocupa varios MB de
    // cuota aunque pese menos. Se llenaba el almacenamiento del móvil.
    // El CDN ya manda cabeceras de caché largas: con dejarlo pasar basta.
    if (url.origin !== self.location.origin) return;

    // 2. ESTRATEGIA PARA IMÁGENES Y ASSETS: Cache First, fallback a Network
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