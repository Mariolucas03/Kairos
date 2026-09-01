import api from '../services/api';

/**
 * ENTRENOS QUE NO SE PUDIERON ENVIAR.
 *
 * EL PROBLEMA
 * Los gimnasios son sótanos. Al dar a "terminar" sin cobertura salía "Error al
 * guardar" y ahí se quedaba: el borrador sobrevivía en el móvil, sí, pero
 * tenías que ACORDARTE de volver a entrar y darle otra vez al salir a la calle.
 * Justo después de entrenar, que es cuando menos ganas hay de pelearse con una
 * app.
 *
 * CÓMO FUNCIONA
 * Si el envío falla por RED (no por un error del entreno), se guarda aquí y la
 * pantalla se cierra como si nada. Se reintenta solo cuando vuelve la conexión
 * y cada vez que se abre la app. El usuario no tiene que hacer nada.
 *
 * ⚠️ ESTO SOLO ES SEGURO PORQUE EL SERVIDOR RECHAZA EL MISMO ENTRENO DOS VECES.
 *
 * Cada entreno lleva un `clienteId` que se pone al EMPEZAR, así que todos los
 * reintentos usan el mismo. Sin eso, el caso malo (el entreno se guarda pero la
 * respuesta se pierde por el camino) duplicaría el entreno, su XP y su entrada
 * en el registro del día cada vez que se reintentara. Es decir: la cola sin la
 * idempotencia sería peor que no tener cola.
 */

const CLAVE = 'kairos_entrenos_pendientes';

// Techo de entrenos en espera. Con más que esto no hay un problema de red: hay
// un problema de otra cosa, y llenar el móvil no lo va a arreglar.
const MAX_EN_COLA = 20;

const leer = () => {
    try {
        const bruto = JSON.parse(localStorage.getItem(CLAVE) || '[]');
        return Array.isArray(bruto) ? bruto : [];
    } catch {
        return [];
    }
};

const escribir = (lista) => {
    try {
        localStorage.setItem(CLAVE, JSON.stringify(lista.slice(-MAX_EN_COLA)));
    } catch {
        // Cuota llena: no hay nada mejor que hacer que seguir
    }
};

/** Cuántos entrenos están esperando a que vuelva la red. */
export const pendientes = () => leer().length;

/**
 * Guarda un entreno que no se pudo enviar.
 *
 * Si ya hay uno con el mismo clienteId se sustituye en vez de añadirse: es el
 * mismo entreno, no dos.
 */
export const encolar = (envio) => {
    const lista = leer().filter(e => e.envio?.clienteId !== envio.clienteId);
    lista.push({ envio, guardadoEn: Date.now(), intentos: 0 });
    escribir(lista);
    return lista.length;
};

/** ¿El fallo fue de red, o el servidor ha rechazado el entreno? */
export const esFalloDeRed = (error) => {
    // Sin respuesta = no llegó a hablar con el servidor. Eso se reintenta.
    if (!error?.response) return true;
    // 5xx: el servidor está mal, no el entreno. También se reintenta.
    return error.response.status >= 500;
};

/**
 * Intenta enviar lo que haya en espera.
 *
 * Los que el servidor RECHAZA (un 4xx: el entreno no le cuadra) se sacan de la
 * cola. Reintentar eternamente algo que nunca va a entrar es dejar la cola
 * atascada para siempre, y con ella los entrenos buenos que vengan detrás.
 *
 * @returns {Promise<{enviados: number, quedan: number}>}
 */
export const vaciarCola = async () => {
    const lista = leer();
    if (lista.length === 0) return { enviados: 0, quedan: 0 };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return { enviados: 0, quedan: lista.length };
    }

    const quedan = [];
    let enviados = 0;

    for (const entrada of lista) {
        try {
            await api.post('/gym/log', entrada.envio);
            enviados++;
        } catch (error) {
            if (esFalloDeRed(error)) {
                // Sigue sin haber red: se queda para la próxima
                quedan.push({ ...entrada, intentos: (entrada.intentos || 0) + 1 });
            } else {
                // El servidor lo ha rechazado. No va a entrar por insistir.
                console.error('Entreno descartado de la cola:', error.response?.data?.message || error.message);
            }
        }
    }

    escribir(quedan);
    return { enviados, quedan: quedan.length };
};

/**
 * Deja la cola vaciándose sola: al volver la conexión y al abrir la app.
 *
 * Se llama una vez, al arrancar. Devuelve una función para desengancharlo, que
 * no se usa hoy pero evita dejar un listener colgado si algún día esto se monta
 * y desmonta.
 */
export const vigilarCola = (alEnviar) => {
    const intentar = async () => {
        const r = await vaciarCola();
        if (r.enviados > 0 && typeof alEnviar === 'function') alEnviar(r);
    };

    window.addEventListener('online', intentar);
    // Y al abrir la app: puede que la conexión volviera con la app cerrada, y
    // entonces el evento 'online' no lo oyó nadie.
    intentar();

    return () => window.removeEventListener('online', intentar);
};
