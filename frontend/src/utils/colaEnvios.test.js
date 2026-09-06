import { beforeEach, vi } from 'vitest';

/**
 * LA COLA DE LO QUE NO SE PUDO ENVIAR
 *
 * Es el codigo con mas responsabilidad del frontend: sostiene el entreno que
 * acabas de hacer en el sotano del gimnasio hasta que hay cobertura. Si se
 * equivoca, no sale ningun error — simplemente el entreno no existe.
 *
 * Se prueba entera porque cada regla suya nacio de un fallo concreto:
 *
 *   - la mudanza de la clave vieja GUARDA antes de borrar, porque preguntar
 *     "cuantos hay pendientes" llegaba a borrar el entreno de quien tuviera uno
 *     esperando al actualizar la app
 *   - un 4xx se descarta y un fallo de red se reintenta, porque insistir con
 *     algo que el servidor nunca va a aceptar atasca la cola para siempre
 *   - los envios van EN ORDEN y de uno en uno, porque dos avances de la misma
 *     mision tienen que sumarse como ocurrieron
 */

// El modulo guarda el recuento en memoria, asi que cada prueba necesita el
// modulo recien cargado. Por eso se importa dentro de cada test y no arriba.
const cargar = async () => {
    vi.resetModules();
    return import('./colaEnvios');
};

const api = { post: vi.fn(), put: vi.fn() };
vi.mock('../services/api', () => ({ default: api }));

const CLAVE = 'kairos_envios_pendientes';
const CLAVE_VIEJA = 'kairos_entrenos_pendientes';

const guardado = () => JSON.parse(localStorage.getItem(CLAVE) || '[]');

const falloDeRed = () => Object.assign(new Error('Network Error'), { response: undefined });
const respuesta = (status) => Object.assign(new Error('HTTP ' + status), { response: { status } });

beforeEach(() => {
    localStorage.clear();
    api.post.mockReset();
    api.put.mockReset();
    api.post.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });
});

describe('colaEnvios: guardar lo que no se pudo enviar', () => {

    test('encolar guarda el envio y lo cuenta', async () => {
        const { encolar, pendientes } = await cargar();

        encolar({ ruta: '/gym/log', envio: { clienteId: 'a' }, etiqueta: 'entreno' });

        expect(pendientes()).toBe(1);
        expect(guardado()[0].ruta).toBe('/gym/log');
    });

    test('el mismo envio dos veces se sustituye, no se duplica', async () => {
        // Reintentar el mismo entreno no puede dejar dos entrenos en la cola.
        const { encolar, pendientes } = await cargar();

        encolar({ ruta: '/gym/log', envio: { clienteId: 'a', kg: 80 }, etiqueta: 'entreno' });
        encolar({ ruta: '/gym/log', envio: { clienteId: 'a', kg: 90 }, etiqueta: 'entreno' });

        expect(pendientes()).toBe(1);
        expect(guardado()[0].envio.kg).toBe(90);
    });

    test('el resumen dice QUE hay esperando, no solo cuanto', async () => {
        const { encolar, resumenCola } = await cargar();

        encolar({ ruta: '/gym/log', envio: { clienteId: 'a' }, etiqueta: 'entreno' });
        encolar({ ruta: '/food/log/1', envio: { clienteId: 'b' }, etiqueta: 'alimento' });
        encolar({ ruta: '/food/log/1', envio: { clienteId: 'c' }, etiqueta: 'alimento' });

        const r = resumenCola();
        expect(r.total).toBe(3);
        // Ordenadas de mas a menos, para que el aviso empiece por lo gordo
        expect(r.etiquetas[0]).toEqual({ nombre: 'alimento', cuantos: 2 });
        expect(r.etiquetas[1]).toEqual({ nombre: 'entreno', cuantos: 1 });
    });

    test('el resumen conserva su identidad si nada ha cambiado', async () => {
        // React compara el resultado por identidad: devolver un objeto nuevo
        // cada vez le hace creer que hay cambios siempre y repinta sin parar.
        const { resumenCola, encolar } = await cargar();

        const a = resumenCola();
        expect(resumenCola()).toBe(a);

        encolar({ ruta: '/gym/log', envio: { clienteId: 'x' }, etiqueta: 'entreno' });
        expect(resumenCola()).not.toBe(a);
    });

    test('avisa a quien este mirando cuando cambia', async () => {
        const { suscribirse, encolar, resumenCola } = await cargar();
        const aviso = vi.fn();

        // ⚠️ Se lee ANTES de suscribirse, que es el orden en que lo hace React:
        // `useSyncExternalStore` pide el estado al montar y despues se engancha.
        //
        // Importa porque el PRIMER recuento no avisa a nadie a proposito: puede
        // ocurrir durante un pintado, y avisar ahi seria pedirle a React que
        // repinte a mitad de pintar. Suscribirse sobre un modulo recien cargado
        // y esperar aviso al primer encolar seria probar una secuencia que no
        // pasa nunca.
        resumenCola();

        const soltar = suscribirse(aviso);
        encolar({ ruta: '/gym/log', envio: { clienteId: 'a' }, etiqueta: 'entreno' });
        expect(aviso).toHaveBeenCalled();

        soltar();
        aviso.mockClear();
        encolar({ ruta: '/gym/log', envio: { clienteId: 'b' }, etiqueta: 'entreno' });
        expect(aviso).not.toHaveBeenCalled();
    });

    test('no guarda mas de 40: con mas que eso el problema no es la red', async () => {
        const { encolar, pendientes } = await cargar();

        for (let i = 0; i < 50; i++) {
            encolar({ ruta: '/gym/log', envio: { clienteId: 'c' + i }, etiqueta: 'entreno' });
        }

        expect(pendientes()).toBe(40);
        // Se quedan los ULTIMOS: lo mas reciente es lo que mas importa
        expect(guardado().at(-1).clienteId).toBe('c49');
    });
});

describe('colaEnvios: la mudanza de la clave vieja', () => {

    test('EL FALLO: preguntar cuantos hay pendientes NO puede borrar el entreno', async () => {
        // Antes solo borraba la clave vieja y devolvia la lista junta, confiando
        // en que alguien escribiera despues. `pendientes()` no escribe: solo
        // cuenta. Asi que preguntar borraba el entreno de la unica persona a la
        // que esto tenia que proteger.
        localStorage.setItem(CLAVE_VIEJA, JSON.stringify([
            { envio: { clienteId: 'viejo', kg: 100 } }
        ]));

        const { pendientes } = await cargar();

        expect(pendientes()).toBe(1);
        // Y sigue ahi despues de preguntar
        expect(guardado()).toHaveLength(1);
        expect(guardado()[0].envio.clienteId).toBe('viejo');
    });

    test('a las entradas viejas se les pone la ruta que tenian implicita', async () => {
        // Cuando esto solo guardaba entrenos, no hacia falta apuntar la ruta.
        localStorage.setItem(CLAVE_VIEJA, JSON.stringify([{ envio: { clienteId: 'v' } }]));

        const { pendientes } = await cargar();
        pendientes();

        expect(guardado()[0].ruta).toBe('/gym/log');
        expect(guardado()[0].etiqueta).toBe('entreno');
        expect(localStorage.getItem(CLAVE_VIEJA)).toBeNull();
    });
});

describe('colaEnvios: distinguir un fallo de red de un rechazo', () => {

    test('sin respuesta es la red: se reintenta', async () => {
        const { esFalloDeRed } = await cargar();
        expect(esFalloDeRed(falloDeRed())).toBe(true);
        expect(esFalloDeRed(undefined)).toBe(true);
    });

    test('un 500 es el servidor, no el envio: tambien se reintenta', async () => {
        const { esFalloDeRed } = await cargar();
        expect(esFalloDeRed(respuesta(500))).toBe(true);
        expect(esFalloDeRed(respuesta(503))).toBe(true);
    });

    test('un 400 o un 401 es un rechazo: NO se reintenta', async () => {
        const { esFalloDeRed } = await cargar();
        expect(esFalloDeRed(respuesta(400))).toBe(false);
        expect(esFalloDeRed(respuesta(401))).toBe(false);
        expect(esFalloDeRed(respuesta(404))).toBe(false);
    });
});

describe('colaEnvios: vaciar la cola', () => {

    test('lo que entra, sale, y la cola queda vacia', async () => {
        const { encolar, vaciarCola, pendientes } = await cargar();

        encolar({ ruta: '/gym/log', envio: { clienteId: 'a' }, etiqueta: 'entreno' });
        encolar({ ruta: '/food/log/1', envio: { clienteId: 'b' }, etiqueta: 'alimento' });

        const r = await vaciarCola();

        expect(r.enviados).toBe(2);
        expect(r.quedan).toBe(0);
        expect(pendientes()).toBe(0);
        expect(api.post).toHaveBeenCalledTimes(2);
    });

    test('usa put cuando el envio lo pide', async () => {
        // El avance de una mision va por PUT. Mandarlo por POST seria un 404 y,
        // como un 404 se descarta, el avance se perderia en silencio.
        const { encolar, vaciarCola } = await cargar();

        encolar({ ruta: '/missions/1/progress', metodo: 'put', envio: { clienteId: 'm' }, etiqueta: 'misión' });
        await vaciarCola();

        expect(api.put).toHaveBeenCalledWith('/missions/1/progress', { clienteId: 'm' });
        expect(api.post).not.toHaveBeenCalled();
    });

    test('lo que el servidor RECHAZA sale de la cola: insistir la atascaria', async () => {
        const { encolar, vaciarCola, pendientes } = await cargar();

        api.post.mockRejectedValueOnce(respuesta(400));
        encolar({ ruta: '/gym/log', envio: { clienteId: 'malo' }, etiqueta: 'entreno' });

        const r = await vaciarCola();

        expect(r.enviados).toBe(0);
        expect(pendientes()).toBe(0);
    });

    test('lo que falla por red se queda para la proxima', async () => {
        const { encolar, vaciarCola, pendientes } = await cargar();

        api.post.mockRejectedValue(falloDeRed());
        encolar({ ruta: '/gym/log', envio: { clienteId: 'a' }, etiqueta: 'entreno' });

        const r = await vaciarCola();

        expect(r.quedan).toBe(1);
        expect(pendientes()).toBe(1);
        expect(guardado()[0].intentos).toBe(1);
    });

    test('un rechazo no se lleva por delante lo bueno que viene detras', async () => {
        const { encolar, vaciarCola, pendientes } = await cargar();

        api.post
            .mockRejectedValueOnce(respuesta(422))
            .mockResolvedValueOnce({ data: {} });

        encolar({ ruta: '/gym/log', envio: { clienteId: 'malo' }, etiqueta: 'entreno' });
        encolar({ ruta: '/food/log/1', envio: { clienteId: 'bueno' }, etiqueta: 'alimento' });

        const r = await vaciarCola();

        expect(r.enviados).toBe(1);
        expect(r.etiquetas).toEqual(['alimento']);
        expect(pendientes()).toBe(0);
    });

    test('van EN ORDEN y de uno en uno', async () => {
        // Dos avances de la misma mision apuntados sin cobertura tienen que
        // sumarse en el orden en que ocurrieron.
        const { encolar, vaciarCola } = await cargar();

        const orden = [];
        api.post.mockImplementation(async (ruta, envio) => {
            orden.push(envio.clienteId);
            await new Promise(r => setTimeout(r, 5));
            return { data: {} };
        });

        encolar({ ruta: '/x', envio: { clienteId: '1' }, etiqueta: 'cambio' });
        encolar({ ruta: '/x', envio: { clienteId: '2' }, etiqueta: 'cambio' });
        encolar({ ruta: '/x', envio: { clienteId: '3' }, etiqueta: 'cambio' });

        await vaciarCola();

        expect(orden).toEqual(['1', '2', '3']);
    });

    test('sin conexion no se intenta nada, y no se pierde nada', async () => {
        const { encolar, vaciarCola, pendientes } = await cargar();

        encolar({ ruta: '/gym/log', envio: { clienteId: 'a' }, etiqueta: 'entreno' });

        const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        try {
            const r = await vaciarCola();
            expect(r.enviados).toBe(0);
            expect(r.quedan).toBe(1);
            expect(api.post).not.toHaveBeenCalled();
        } finally {
            if (original) Object.defineProperty(Navigator.prototype, 'onLine', original);
        }

        expect(pendientes()).toBe(1);
    });

    test('vaciar una cola vacia no revienta ni llama a nadie', async () => {
        const { vaciarCola } = await cargar();

        const r = await vaciarCola();

        expect(r).toEqual({ enviados: 0, quedan: 0, etiquetas: [] });
        expect(api.post).not.toHaveBeenCalled();
    });
});
