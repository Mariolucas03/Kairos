const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const { saveSportLog } = require('../controllers/gymController');

/**
 * GUARDAR LA MISMA ACTIVIDAD DOS VECES.
 *
 * `saveWorkoutLog` (gimnasio) lleva desde siempre una marca de cliente para
 * que un reintento no cuente como un entreno nuevo. `saveSportLog` (correr,
 * nadar, padel...) no la tenia, y las dos acaban dando XP.
 *
 * ⚠️ EL CASO REAL NO ES EL DOBLE TOQUE.
 *
 * La pantalla ya tiene candado para eso. Es este otro: con la instancia de
 * Render dormida, guardar tarda media minuto o se corta. Parece que no ha ido,
 * se vuelve a tocar, y habia guardado. Dos actividades iguales en el dia y el
 * XP cobrado dos veces. Y el XP sube de nivel, y subir de nivel paga monedas y
 * fichas.
 */
const llamar = async (fn, peticion) => {
    let estado = 200; let dato = null;
    const res = { status(c) { estado = c; return this; }, json(d) { dato = d; return this; } };
    await fn({ query: {}, body: {}, ...peticion }, res, () => { });
    return { estado, dato };
};

describe('La misma actividad mandada dos veces', () => {
    let usuario;

    before(async () => {
        await arrancar();
        // Mongoose construye los indices en segundo plano: sin esperarlos, la
        // prueba de los dos a la vez correria SIN el indice unico, que es
        // justo lo que pretende comprobar.
        await WorkoutLog.init();
    });
    after(async () => { await parar(); });

    beforeEach(async () => {
        await limpiar();
        usuario = await User.create({ username: 'corredor', email: 'corredor@k.test', password: 'x' });
    });

    const correr = (clienteId) => llamar(saveSportLog, {
        user: usuario,
        body: { sportId: 'running', name: 'Correr', time: 30, intensity: 'Media', calories: 300, clienteId }
    });

    const cuantasHay = () => WorkoutLog.countDocuments({ user: usuario._id, type: 'sport' });
    const xpDe = async () => (await User.findById(usuario._id).select('currentXP level').lean());

    test('con la misma marca, el reintento no crea otra', async () => {
        const primera = await correr('abc-123');
        assert.strictEqual(primera.estado, 201, 'la primera se guarda');

        const xpTrasLaPrimera = await xpDe();

        const reintento = await correr('abc-123');
        assert.strictEqual(reintento.estado, 200, 'el reintento no crea nada');
        assert.strictEqual(reintento.dato.duplicado, true);

        assert.strictEqual(await cuantasHay(), 1, 'tiene que haber UNA actividad');

        const xpAhora = await xpDe();
        assert.strictEqual(xpAhora.currentXP, xpTrasLaPrimera.currentXP,
            'y el XP no se puede cobrar dos veces');
        assert.strictEqual(xpAhora.level, xpTrasLaPrimera.level);
    });

    test('dos reintentos a la vez tampoco: para el indice unico', async () => {
        await Promise.all([correr('a-la-vez'), correr('a-la-vez')]);

        assert.strictEqual(await cuantasHay(), 1, 'una sola, aunque salgan juntas');
    });

    test('dos actividades DISTINTAS si se guardan las dos', async () => {
        await correr('primera');
        await correr('segunda');

        assert.strictEqual(await cuantasHay(), 2, 'son dos sesiones de verdad');
    });

    test('sin marca sigue funcionando (moviles con la app vieja)', async () => {
        const r = await correr(undefined);
        assert.strictEqual(r.estado, 201);
        assert.strictEqual(await cuantasHay(), 1);
    });
});

/**
 * EL INDICE QUE SOSTIENE TODO LO DE ARRIBA.
 *
 * ⚠️ ESTE INDICE NO EXISTIA.
 *
 * Estaba declarado con `sparse` y `partialFilterExpression` a la vez, y Mongo
 * rechaza esa mezcla: "cannot mix partialFilterExpression and sparse options".
 * Mongoose construye los indices por su cuenta despues de arrancar, asi que el
 * error salia en un sitio que nadie mira y el indice sencillamente no se
 * creaba. Ni aqui ni en produccion.
 *
 * Y sin el, la unica defensa contra un entreno duplicado era la comprobacion
 * previa del controlador, que es precisamente la que tiene la carrera que este
 * indice venia a cerrar. La cola de envios sin conexion suelta todo lo
 * pendiente de golpe al volver la cobertura: ese es el momento en el que dos
 * reintentos del mismo entreno salen juntos.
 *
 * Por eso se comprueba el indice y no solo el comportamiento: si alguien vuelve
 * a tocar la definicion y deja de crearse, las pruebas de arriba podrian seguir
 * pasando por casualidad y esta no.
 */
describe('El indice unico de la marca de cliente', () => {
    before(async () => { await arrancar(); await WorkoutLog.init(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    test('existe, y es unico', async () => {
        const indices = await WorkoutLog.collection.indexes();
        const marca = indices.find(i => i.key && i.key.user === 1 && i.key.clienteId === 1);

        assert.ok(marca, 'el indice de { user, clienteId } tiene que existir');
        assert.strictEqual(marca.unique, true, 'y tiene que ser unico');
        assert.ok(marca.partialFilterExpression, 'solo sobre los que llevan marca');
        assert.ok(!marca.sparse, 'sparse junto a partialFilterExpression hace que Mongo lo rechace');
    });

    test('la base de datos rechaza el segundo con la misma marca', async () => {
        const usuario = await User.create({ username: 'repe', email: 'repe@k.test', password: 'x' });
        const comun = { user: usuario._id, routineName: 'X', duration: 600, type: 'gym', clienteId: 'misma' };

        await WorkoutLog.create(comun);
        await assert.rejects(
            () => WorkoutLog.create(comun),
            (e) => e.code === 11000,
            'el segundo tiene que chocar contra el indice'
        );
    });

    test('dos usuarios pueden usar la misma marca sin estorbarse', async () => {
        const a = await User.create({ username: 'uno', email: 'uno@k.test', password: 'x' });
        const b = await User.create({ username: 'dos', email: 'dos@k.test', password: 'x' });

        await WorkoutLog.create({ user: a._id, routineName: 'X', duration: 600, type: 'gym', clienteId: 'igual' });
        await WorkoutLog.create({ user: b._id, routineName: 'X', duration: 600, type: 'gym', clienteId: 'igual' });

        assert.strictEqual(await WorkoutLog.countDocuments({ clienteId: 'igual' }), 2);
    });

    test('los entrenos SIN marca no chocan entre si', async () => {
        const usuario = await User.create({ username: 'viejo', email: 'viejo@k.test', password: 'x' });
        const comun = { user: usuario._id, routineName: 'X', duration: 600, type: 'gym' };

        await WorkoutLog.create(comun);
        await WorkoutLog.create(comun);

        assert.strictEqual(await WorkoutLog.countDocuments({ user: usuario._id }), 2,
            'los de antes de la marca tienen que poder convivir');
    });
});
