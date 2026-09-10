const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar, fingirPeticion } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const Exercise = require('../models/Exercise');
const WorkoutLog = require('../models/WorkoutLog');
const { getRepartoMuscular } = require('../controllers/gymController');

/**
 * EL REPARTO DEL TRABAJO POR MUSCULO
 *
 * Responde a "¿estoy descuidando la pierna?", que es la pregunta que se hace
 * todo el que entrena solo y que no tenia respuesta en ningun sitio de la app.
 *
 * ⚠️ CUENTA KILOS MOVIDOS, NO SERIES.
 *
 * Hubo un endpoint que contaba series por grupo (`/gym/body-status`). Se quito
 * porque no lo llamaba nadie, pero la razon de fondo es esta: cuatro series de
 * curl de biceps y cuatro de sentadilla son las mismas series y no se parecen en
 * nada. Contando series, un dia de brazo pesa igual que uno de pierna y el
 * reparto mentiria justo en lo que se le pregunta.
 */

let siguiente = 0;
const crearUsuario = async () => {
    siguiente++;
    return User.create({
        username: `repartidor${siguiente}`,
        email: `repartidor${siguiente}@kairos.test`,
        password: 'da-igual'
    });
};

const catalogo = (pares) => Promise.all(
    Object.entries(pares).map(([name, muscle]) =>
        Exercise.create({ name, muscle, user: null, isCustom: false })
    )
);

/** Un entreno con { nombreEjercicio: [[kg, reps], ...] }. */
const entreno = (userId, ejercicios, hace = 0) => WorkoutLog.create({
    user: userId,
    type: 'gym',
    // El modelo los exige; para esta prueba dan igual, pero omitirlos hace que
    // falle la validacion y no el reparto, que es lo que se quiere medir.
    routineName: 'Prueba',
    duration: 3600,
    date: new Date(Date.now() - hace * 86400000),
    exercises: Object.entries(ejercicios).map(([name, series]) => ({
        name,
        muscle: 'Pecho',
        sets: series.map(([weight, reps]) => ({ weight, reps }))
    }))
});

const pedirReparto = async (user, query = {}) => {
    const p = fingirPeticion({ user, query });
    await getRepartoMuscular(p.req, p.res);
    return p.res.enviado;
};

const de = (datos, musculo) => datos.reparto.find(g => g.musculo === musculo);

describe('Reparto muscular: a que le dedicas el trabajo', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    test('reparte el volumen entre los grupos y saca el porcentaje', async () => {
        const user = await crearUsuario();
        await catalogo({ 'Press Banca': 'Pecho', 'Sentadilla': 'Pierna' });

        // Pecho: 100x10 = 1000. Pierna: 100x10 x3 = 3000. Total 4000.
        await entreno(user._id, {
            'Press Banca': [[100, 10]],
            'Sentadilla': [[100, 10], [100, 10], [100, 10]]
        });

        const datos = await pedirReparto(user);

        assert.strictEqual(datos.total, 4000);
        assert.strictEqual(de(datos, 'Pierna').volumen, 3000);
        assert.strictEqual(de(datos, 'Pierna').porcentaje, 75);
        assert.strictEqual(de(datos, 'Pecho').porcentaje, 25);
    });

    test('viene ordenado de mas a menos', async () => {
        const user = await crearUsuario();
        await catalogo({ 'Curl': 'Bíceps', 'Sentadilla': 'Pierna', 'Press': 'Pecho' });

        await entreno(user._id, {
            'Curl': [[20, 10]],          // 200
            'Sentadilla': [[120, 10]],   // 1200
            'Press': [[60, 10]]          // 600
        });

        const datos = await pedirReparto(user);
        const conTrabajo = datos.reparto.filter(g => g.volumen > 0).map(g => g.musculo);

        assert.deepStrictEqual(conTrabajo, ['Pierna', 'Pecho', 'Bíceps']);
    });

    test('LOS DE PESO CORPORAL TAMBIEN CUENTAN', async () => {
        // Con kg = 0, peso x repeticiones da cero: una sesion entera de
        // dominadas y fondos apareceria como que no has trabajado la espalda.
        const user = await crearUsuario();
        await catalogo({ 'Dominadas': 'Espalda' });

        await entreno(user._id, { 'Dominadas': [[0, 10], [0, 8]] });

        const datos = await pedirReparto(user);

        // Misma cuenta que en el resto de la app: sin peso, cada repeticion vale 2
        assert.strictEqual(de(datos, 'Espalda').volumen, 36);
        assert.strictEqual(de(datos, 'Espalda').porcentaje, 100);
    });

    test('solo mira el periodo que se pide', async () => {
        const user = await crearUsuario();
        await catalogo({ 'Press Banca': 'Pecho' });

        await entreno(user._id, { 'Press Banca': [[100, 10]] }, 5);    // hace 5 dias
        await entreno(user._id, { 'Press Banca': [[100, 10]] }, 200);  // hace 200

        const tresMeses = await pedirReparto(user, { dias: '90' });
        assert.strictEqual(tresMeses.total, 1000, 'el de hace 200 dias queda fuera');

        const unAño = await pedirReparto(user, { dias: '365' });
        assert.strictEqual(unAño.total, 2000);
    });

    test('el periodo esta acotado: no se puede pedir un barrido infinito', async () => {
        // Sin tope, un `?dias=99999` haria leer el historial entero en cada
        // carga de la pantalla.
        const user = await crearUsuario();

        assert.strictEqual((await pedirReparto(user, { dias: '99999' })).dias, 365);
        assert.strictEqual((await pedirReparto(user, { dias: '1' })).dias, 7);
        assert.strictEqual((await pedirReparto(user, { dias: 'abc' })).dias, 90);
        assert.strictEqual((await pedirReparto(user, {})).dias, 90);
    });

    test('lo que no se puede clasificar se DICE, no se esconde', async () => {
        // Un ejercicio a medida que ya no esta en el catalogo. Si su volumen
        // desapareciera sin mas, los porcentajes no sumarian 100 y pareceria un
        // fallo de la app.
        const user = await crearUsuario();
        await catalogo({ 'Press Banca': 'Pecho' });

        await entreno(user._id, {
            'Press Banca': [[100, 10]],
            'Invento Raro': [[50, 10]]
        });

        const datos = await pedirReparto(user);

        assert.strictEqual(datos.total, 1500);
        assert.strictEqual(datos.sinClasificar, 500);
        assert.strictEqual(de(datos, 'Pecho').volumen, 1000);
    });

    test('sin entrenos devuelve ceros, no revienta', async () => {
        const user = await crearUsuario();

        const datos = await pedirReparto(user);

        assert.strictEqual(datos.total, 0);
        assert.ok(Array.isArray(datos.reparto));
        assert.ok(datos.reparto.every(g => g.porcentaje === 0), 'ningun porcentaje puede ser NaN');
    });

    test('el entreno de otro no se cuela en el tuyo', async () => {
        const yo = await crearUsuario();
        const otro = await crearUsuario();
        await catalogo({ 'Press Banca': 'Pecho' });

        await entreno(otro._id, { 'Press Banca': [[200, 10]] });

        assert.strictEqual((await pedirReparto(yo)).total, 0);
    });
});
