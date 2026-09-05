import api from '../services/api';

/**
 * LO QUE NO SE PUDO ENVIAR.
 *
 * EL PROBLEMA
 * Los gimnasios son sótanos. Al dar a "terminar" sin cobertura salía "Error al
 * guardar" y ahí se quedaba: el borrador sobrevivía en el móvil, sí, pero
 * tenías que ACORDARTE de volver a entrar y darle otra vez al salir a la calle.
 * Justo después de entrenar, que es cuando menos ganas hay de pelearse con una
 * app.
 *
 * Esto ya existía para los entrenos. Lo que no existía era para el resto: en el
 * mismo sótano, apuntar un batido o marcar una misión daba "Error de red" y se
 * perdía. La cobertura es la misma; el que la sufría era solo el gimnasio.
 *
 * CÓMO FUNCIONA
 * Si el envío falla por RED (no porque el servidor lo rechace), se guarda aquí y
 * la pantalla sigue como si nada. Se reintenta solo cuando vuelve la conexión y
 * cada vez que se abre la app. El usuario no tiene que hacer nada.
 *
 * ⚠️ ESTO SOLO ES SEGURO SI EL SERVIDOR RECHAZA EL MISMO ENVÍO DOS VECES.
 *
 * Cada envío lleva un `clienteId` que se pone ANTES de mandarlo, así que todos
 * los reintentos usan el mismo. Sin eso, el caso malo —se guarda pero la
 * respuesta se pierde por el camino— duplicaría el entreno con su XP, o el
 * alimento con sus calorías, o el avance de una misión, que al llegar al
 * objetivo PAGA. Es decir: la cola sin la idempotencia sería peor que no tener
 * cola.
 *
 * Las tres rutas que se encolan lo comprueban en el servidor:
 *   /gym/log                  WorkoutLog.clienteId, con índice único
 *   /food/log/:mealId         el filtro exige que la marca no esté ya
 *   /missions/:id/progress    la marca se apunta en la misma escritura que suma
 */

const CLAVE = 'kairos_envios_pendientes';

// La clave vieja, de cuando esto solo guardaba entrenos. Se lee una vez para no
// tirar el entreno de quien tenga uno esperando al actualizar la app.
const CLAVE_VIEJA = 'kairos_entrenos_pendientes';

// Techo de envíos en espera. Con más que esto no hay un problema de red: hay un
// problema de otra cosa, y llenar el móvil no lo va a arreglar.
const MAX_EN_COLA = 40;

const leerBruto = (clave) => {
    try {
        const bruto = JSON.parse(localStorage.getItem(clave) || '[]');
        return Array.isArray(bruto) ? bruto : [];
    } catch {
        return [];
    }
};

/**
 * Las entradas viejas no llevaban ruta porque solo había una. Se les pone la
 * que tenían implícita en vez de descartarlas: son entrenos de verdad de
 * alguien que estaba sin cobertura cuando se actualizó la app.
 */
const alDia = (e) => (e.ruta ? e : {
    ...e,
    ruta: '/gym/log',
    metodo: 'post',
    etiqueta: 'entreno',
    clienteId: e.envio?.clienteId
});

const leer = () => {
    const nuevas = leerBruto(CLAVE).map(alDia);
    const viejas = leerBruto(CLAVE_VIEJA);
    if (viejas.length === 0) return nuevas;

    // ⚠️ La mudanza se GUARDA aquí mismo, antes de borrar la clave vieja.
    //
    // Antes solo borraba y devolvía la lista junta, confiando en que alguien
    // escribiera después. `pendientes()` no escribe: solo cuenta. Así que
    // preguntar cuántos hay pendientes borraba el entreno de quien tuviera uno
    // esperando al actualizar la app — la única persona a la que esto tenía que
    // proteger.
    const juntas = [...viejas.map(alDia), ...nuevas];
    escribir(juntas);
    try { localStorage.removeItem(CLAVE_VIEJA); } catch { /* da igual */ }
    return juntas;
};

const escribir = (lista) => {
    try {
        localStorage.setItem(CLAVE, JSON.stringify(lista.slice(-MAX_EN_COLA)));
    } catch {
        // Cuota llena: no hay nada mejor que hacer que seguir
    }
};

/**
 * ⚠️ EL NÚMERO SE GUARDA EN MEMORIA, NO SE LEE DEL DISCO CADA VEZ.
 *
 * `pendientes()` la llama React en cada pintado a través de `useSyncExternalStore`,
 * y esa función tiene que ser barata y devolver SIEMPRE lo mismo mientras nada
 * cambie. Leer `localStorage` ahí sería ir al disco en cada pintado; peor aún,
 * `leer()` a veces ESCRIBE (la mudanza de la clave vieja), y escribir mientras
 * React pinta es la receta del bucle infinito.
 *
 * Así que el número vive aquí y solo se recalcula cuando la cola se toca de
 * verdad: al encolar y al vaciar.
 */
let resumen = null;
const oyentes = new Set();

/** El resumen vacío, en una constante para que su identidad no cambie nunca. */
const NADA = Object.freeze({ total: 0, etiquetas: Object.freeze([]) });

/** Se avisa a quien esté mirando. Un oyente que reviente no puede tumbar al resto. */
const avisar = () => {
    for (const fn of oyentes) {
        try { fn(); } catch { /* el problema es suyo */ }
    }
};

/**
 * Recuenta y, si algo ha cambiado, avisa.
 *
 * ⚠️ EL OBJETO SOLO SE SUSTITUYE SI EL CONTENIDO ES OTRO.
 *
 * React compara el resultado de `getSnapshot` por identidad. Devolver un objeto
 * nuevo cada vez —aunque lleve los mismos números dentro— le hace creer que
 * siempre hay cambios y repinta sin parar. Por eso se compara el contenido y se
 * conserva el objeto de antes cuando es igual.
 */
const recontar = () => {
    const lista = leer();

    const cuenta = {};
    for (const e of lista) {
        const etiqueta = e.etiqueta || 'cambio';
        cuenta[etiqueta] = (cuenta[etiqueta] || 0) + 1;
    }

    const nuevo = lista.length === 0 ? NADA : {
        total: lista.length,
        // Ordenadas de más a menos para que el aviso empiece por lo gordo.
        etiquetas: Object.entries(cuenta)
            .sort((a, b) => b[1] - a[1])
            .map(([nombre, cuantos]) => ({ nombre, cuantos }))
    };

    const igual = resumen &&
        resumen.total === nuevo.total &&
        JSON.stringify(resumen.etiquetas) === JSON.stringify(nuevo.etiquetas);

    // La primera cuenta no avisa a nadie: puede ocurrir DURANTE un pintado (es
    // la que hace React al montar) y avisar ahí sería pedirle que repinte a
    // mitad de pintar.
    const primeraVez = resumen === null;
    if (!igual) {
        resumen = nuevo;
        if (!primeraVez) avisar();
    }
    return resumen;
};

/**
 * Qué hay esperando: `{ total, etiquetas: [{ nombre, cuantos }] }`.
 *
 * Pensada para `useSyncExternalStore`: barata y con identidad estable.
 */
export const resumenCola = () => (resumen === null ? recontar() : resumen);

/** Cuántos envíos están esperando a que vuelva la red. */
export const pendientes = () => resumenCola().total;

/**
 * Avisa cuando cambia el número. Devuelve la función para desengancharse.
 *
 * La firma es la que pide `useSyncExternalStore`, que es como lo mira React.
 */
export const suscribirse = (fn) => {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
};

/** Una marca por envío. Se pone antes de mandarlo, no al reintentar. */
export const nuevaMarca = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Guarda un envío que no se pudo mandar.
 *
 * @param {Object} p
 * @param {string} p.ruta       ya resuelta, con sus ids dentro
 * @param {Object} p.envio      el cuerpo, con su clienteId ya puesto
 * @param {string} [p.metodo]   'post' (por defecto) o 'put'
 * @param {string} [p.etiqueta] para poder decir qué se ha enviado al volver
 *
 * Si ya hay uno con el mismo clienteId se sustituye en vez de añadirse: es el
 * mismo envío, no dos.
 */
export const encolar = ({ ruta, envio, metodo = 'post', etiqueta = 'cambio' }) => {
    const clienteId = envio?.clienteId;
    const lista = leer().filter(e => !clienteId || e.clienteId !== clienteId);
    lista.push({ ruta, metodo, envio, etiqueta, clienteId, guardadoEn: Date.now(), intentos: 0 });
    escribir(lista);
    return recontar().total;
};

/** ¿El fallo fue de red, o el servidor ha rechazado el envío? */
export const esFalloDeRed = (error) => {
    // Sin respuesta = no llegó a hablar con el servidor. Eso se reintenta.
    if (!error?.response) return true;
    // 5xx: el servidor está mal, no el envío. También se reintenta.
    return error.response.status >= 500;
};

/**
 * Intenta mandar lo que haya en espera.
 *
 * Los que el servidor RECHAZA (un 4xx: el envío no le cuadra) se sacan de la
 * cola. Reintentar eternamente algo que nunca va a entrar es dejar la cola
 * atascada para siempre, y con ella lo bueno que venga detrás.
 *
 * Van EN ORDEN y de uno en uno, no en paralelo: dos avances de la misma misión
 * apuntados sin cobertura tienen que sumarse en el orden en que ocurrieron.
 *
 * @returns {Promise<{enviados: number, quedan: number, etiquetas: string[]}>}
 */
export const vaciarCola = async () => {
    const lista = leer();
    if (lista.length === 0) { recontar(); return { enviados: 0, quedan: 0, etiquetas: [] }; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        escribir(lista);   // por si venían de la clave vieja
        recontar();
        return { enviados: 0, quedan: lista.length, etiquetas: [] };
    }

    const quedan = [];
    const etiquetas = [];
    let enviados = 0;

    for (const entrada of lista) {
        try {
            const metodo = entrada.metodo === 'put' ? api.put : api.post;
            await metodo(entrada.ruta, entrada.envio);
            enviados++;
            etiquetas.push(entrada.etiqueta || 'cambio');
        } catch (error) {
            if (esFalloDeRed(error)) {
                // Sigue sin haber red: se queda para la próxima
                quedan.push({ ...entrada, intentos: (entrada.intentos || 0) + 1 });
            } else {
                // El servidor lo ha rechazado. No va a entrar por insistir.
                console.error('Envío descartado de la cola:', error.response?.data?.message || error.message);
            }
        }
    }

    escribir(quedan);
    recontar();
    return { enviados, quedan: quedan.length, etiquetas };
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
