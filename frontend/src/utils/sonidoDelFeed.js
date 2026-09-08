/**
 * ¿SUENA EL FEED O NO?
 *
 * Un interruptor para TODAS las publicaciones a la vez, como en Instagram: lo
 * quitas una vez y se queda quitado mientras bajas, y sigue quitado mañana.
 * Si cada tarjeta llevara el suyo habría que silenciar veinte.
 *
 * ⚠️ EMPIEZA SIEMPRE SILENCIADO, Y NO ES UNA CONCESIÓN A LOS NAVEGADORES.
 *
 * Es que abrir una app y que empiece a sonar música sin haberla pedido es de las
 * pocas cosas que hacen cerrar una app en el sitio. Los navegadores además lo
 * bloquean —hace falta que toques la pantalla antes de que se pueda reproducir
 * con sonido— y eso juega a favor: el primer toque en el altavoz es el permiso,
 * y a partir de ahí las siguientes suenan solas al pasar por ellas.
 */
const CLAVE = 'kairos_feed_con_sonido';

let conSonido = false;
const oyentes = new Set();

// Se lee una vez al cargar. Si el usuario lo dejó encendido ayer, se respeta:
// ya dio su permiso, y el navegador lo recuerda dentro de la sesión.
try {
    conSonido = localStorage.getItem(CLAVE) === '1';
} catch { /* modo incógnito, o almacenamiento bloqueado */ }

/** ¿Está el sonido encendido? Barata y estable: la llama React en cada pintado. */
export const haySonido = () => conSonido;

export const cambiarSonido = (valor) => {
    const nuevo = !!valor;
    if (nuevo === conSonido) return;
    conSonido = nuevo;
    try { localStorage.setItem(CLAVE, nuevo ? '1' : '0'); } catch { /* da igual */ }
    for (const fn of oyentes) {
        try { fn(); } catch { /* el problema es suyo */ }
    }
};

/** Firma de `useSyncExternalStore`: devuelve la función para desengancharse. */
export const suscribirseAlSonido = (fn) => {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
};
