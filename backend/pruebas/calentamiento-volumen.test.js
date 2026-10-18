const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const { getResumenEntrenos, getWeeklyStats, getRepartoMuscular } = require('../controllers/gymController');

/**
 * EL CALENTAMIENTO FUERA DEL VOLUMEN, EN TODAS PARTES.
 *
 * ⚠️ POR QUE ESTAS PRUEBAS VAN CONTRA UNA BASE DE DATOS DE VERDAD.
 *
 * El volumen se calcula en CINCO sitios y tres de ellos son consultas de
 * agregacion de Mongo. Una agregacion mal escrita no da error al arrancar ni
 * al hacer lint: revienta (o peor, devuelve numeros raros) la primera vez que
 * alguien abre esa pantalla. Probar solo la funcion de JavaScript dejaria los
 * tres sin cubrir, que es justo donde es mas facil equivocarse.
 *
 * Y si uno se queda atras no es un detalle: los rangos dirian una cosa y la
 * grafica otra, sobre los mismos entrenos.
 */
const llamar = async (fn, peticion) => {
    let estado = 200; let dato = null;
    const res = { status(c) { estado = c; return this; }, json(d) { dato = d; return this; } };
    await fn({ query: {}, body: {}, params: {}, ...peticion }, res, () => { });
    return { estado, dato };
};

describe('El calentamiento no cuenta en ninguna de las pantallas', () => {
    let usuario;

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });

    beforeEach(async () => {
        await limpiar();
        usuario = await User.create({ username: 'calentito', email: 'calentito@k.test', password: 'x' });

        // Un entreno con dos series de trabajo (1.000 + 800) y dos de
        // calentamiento que, contando, sumarian otros 800.
        await WorkoutLog.create({
            user: usuario._id,
            routineName: 'Pecho',
            duration: 3600,
            type: 'gym',
            date: new Date(),
            musclesWorked: ['Pecho'],
            exercises: [{
                name: 'Press de banca',
                muscle: 'Pecho',
                sets: [
                    { weight: 40, reps: 10, type: 'W' },
                    { weight: 40, reps: 10, type: 'W' },
                    { weight: 100, reps: 10, type: 'N' },
                    { weight: 100, reps: 8, type: 'N' }
                ]
            }]
        });
    });

    const DE_TRABAJO = 100 * 10 + 100 * 8;   // 1.800
    const DE_CALENTAMIENTO = 40 * 10 * 2;    // 800, que NO deben aparecer

    test('el resumen de entrenos solo cuenta el trabajo', async () => {
        const r = await llamar(getResumenEntrenos, { user: usuario });

        assert.strictEqual(r.estado, 200);
        assert.strictEqual(r.dato.volumen, DE_TRABAJO,
            `deberia ser ${DE_TRABAJO} y no ${DE_TRABAJO + DE_CALENTAMIENTO}`);
    });

    test('la grafica semanal tampoco los suma', async () => {
        const r = await llamar(getWeeklyStats, { user: usuario });

        assert.strictEqual(r.estado, 200);
        assert.strictEqual(r.dato.currentVolume, DE_TRABAJO);
    });

    test('el reparto por musculo, que es el que sube los rangos, tampoco', async () => {
        const r = await llamar(getRepartoMuscular, { user: usuario });

        assert.strictEqual(r.estado, 200);
        assert.strictEqual(r.dato.total, DE_TRABAJO,
            `el total deberia ser ${DE_TRABAJO} y no ${DE_TRABAJO + DE_CALENTAMIENTO}`);
    });

    test('un entreno SOLO de calentamiento no mueve el volumen', async () => {
        await limpiar();
        usuario = await User.create({ username: 'solocalor', email: 'solocalor@k.test', password: 'x' });
        await WorkoutLog.create({
            user: usuario._id, routineName: 'Suave', duration: 600, type: 'gym', date: new Date(),
            exercises: [{ name: 'Press', muscle: 'Pecho', sets: [{ weight: 40, reps: 10, type: 'W' }] }]
        });

        const r = await llamar(getResumenEntrenos, { user: usuario });
        assert.strictEqual(r.dato.volumen, 0, 'calentar no es entrenar');
    });

    test('los entrenos de antes del tipo siguen contando enteros', async () => {
        await limpiar();
        usuario = await User.create({ username: 'antiguo', email: 'antiguo@k.test', password: 'x' });
        await WorkoutLog.create({
            user: usuario._id, routineName: 'Viejo', duration: 3600, type: 'gym', date: new Date(),
            // Sin `type`: asi se guardaba antes de que existiera el ajuste.
            exercises: [{ name: 'Press', muscle: 'Pecho', sets: [{ weight: 100, reps: 10 }] }]
        });

        const r = await llamar(getResumenEntrenos, { user: usuario });
        assert.strictEqual(r.dato.volumen, 1000, 'el historial viejo no se puede recortar');
    });
});
