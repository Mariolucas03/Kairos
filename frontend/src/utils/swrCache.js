/**
 * Caché de SWR que sobrevive a las recargas.
 *
 * EL PROBLEMA QUE RESUELVE
 * Home aparecía lleno al instante y el resto de secciones vacías. No era
 * casualidad: el usuario se guarda en localStorage (zustand con `persist`), así
 * que Home pinta con lo de la última sesión. Las demás pantallas usan SWR, cuya
 * caché vive SOLO en memoria: al recargar empiezan de cero y se quedan esperando
 * al servidor, que en Render gratuito tarda 30-50 s en despertar.
 *
 * Con esto, cada sección pinta lo último que sabía y revalida por detrás. No
 * acelera el servidor: elimina la espera EN BLANCO, que es lo que se sufre.
 */

const CLAVE = 'kairos-swr-cache';
const TOPE_BYTES = 1_500_000;   // ~1,5 MB de los ~5 MB de localStorage

/**
 * Lo que NO se guarda. El feed trae fotos de entreno en base64 (hasta 400 KB
 * cada una): guardarlo llenaría la cuota y rompería el resto de escrituras.
 */
const NO_PERSISTIR = [/^\/social\/feed/, /^\/gym\/exercises/];

const persistible = (clave) =>
    typeof clave === 'string' && !NO_PERSISTIR.some(re => re.test(clave));

/**
 * De lo que SWR guarda por clave, solo se persiste el DATO.
 *
 * ⚠️ Antes se guardaba el estado entero, y ahi dentro va tambien el `error`.
 * Eso convertia un fallo de red de un segundo en permanente: la entrada se
 * escribia con `error` puesto y `data` a medias, y al abrir la app se restauraba
 * tal cual — con isLoading en false, asi que la pantalla la daba por buena y no
 * volvia a pedir nada. Encontrado en el mapa de constancia: se quedo diciendo
 * "0 dias activos" a alguien que tenia 20, y sobrevivia a las recargas.
 *
 * Un error es del momento en que ocurrio. El dato es lo unico que sigue
 * valiendo manana.
 */
const soloElDato = (estado) => {
    if (!estado || typeof estado !== 'object') return null;
    if (estado.data === undefined) return null;
    return { data: estado.data };
};

export function proveedorCache() {
    let inicial = [];
    try {
        inicial = JSON.parse(localStorage.getItem(CLAVE) || '[]');
    } catch {
        // Caché corrupta: se empieza limpio en vez de reventar el arranque
        localStorage.removeItem(CLAVE);
    }

    const mapa = new Map(inicial);

    const guardar = () => {
        try {
            const entradas = [...mapa.entries()]
                .filter(([k]) => persistible(k))
                .map(([k, v]) => [k, soloElDato(v)])
                .filter(([, v]) => v !== null);
            const texto = JSON.stringify(entradas);
            // Si se pasa del tope no se guarda nada en vez de dejar algo a medias
            if (texto.length <= TOPE_BYTES) localStorage.setItem(CLAVE, texto);
            else localStorage.removeItem(CLAVE);
        } catch {
            // Cuota llena o modo privado: seguir sin caché es preferible a fallar
            try { localStorage.removeItem(CLAVE); } catch { /* nada que hacer */ }
        }
    };

    // `beforeunload` no se dispara al cerrar la app desde el móvil; `pagehide`
    // sí, y es el que recomienda la propia documentación para PWA.
    window.addEventListener('pagehide', guardar);
    window.addEventListener('beforeunload', guardar);

    return mapa;
}

/** Al cerrar sesión no puede quedar rastro de los datos del anterior. */
export const limpiarCacheSWR = () => {
    try { localStorage.removeItem(CLAVE); } catch { /* da igual */ }
};
