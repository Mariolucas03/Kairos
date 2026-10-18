const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const DailyLog = require('../models/DailyLog');
const Routine = require('../models/Routine');
const { borrarEntreno, xpQueDio } = require('../services/borradoEntrenoService');
const { addRewards, quitarXp } = require('../services/levelService');
const { getMadridDateString } = require('../utils/dateHelpers');

/**
 * BORRAR UN ENTRENO DE VERDAD.
 *
 * ⚠️ BORRAR EL DOCUMENTO NO ERA BORRAR EL ENTRENO.
 *
 * Un entreno, al guardarse, escribe en varios sitios. Las estadisticas que se
 * CALCULAN leyendo los entrenos (volumen, marcas, graficas) se arreglan solas
 * al desaparecer el documento. Las que son COPIAS, no: el registro del dia, el
 * XP que pago y la fecha de "ultima vez" de la rutina se quedaban.
 *
 * Y el XP es el importante: si borrar lo dejara puesto, guardar un entreno,
 * borrarlo y volverlo a guardar seria una impresora de experiencia.
 */

const crearEntreno = async (usuario, { kcal = 300, fecha = new Date(), rutina = null } = {}) =>
    WorkoutLog.create({
        user: usuario._id,
        routine: rutina,
        routineName: 'Pecho',
        duration: 3600,
        type: 'gym',
        caloriesBurned: kcal,
        date: fecha,
        exercises: [{ name: 'Press', muscle: 'Pecho', sets: [{ weight: 100, reps: 10 }] }]
    });

describe('Borrar un entreno se lleva lo que dejo por ahi', () => {
    let usuario;

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });

    beforeEach(async () => {
        await limpiar();
        usuario = await User.create({ username: 'borrador', email: 'borrador@k.test', password: 'x' });
    });

    test('el entreno desaparece', async () => {
        const log = await crearEntreno(usuario);
        const r = await borrarEntreno(log._id, usuario._id);

        assert.strictEqual(r.ok, true);
        assert.strictEqual(await WorkoutLog.countDocuments({ _id: log._id }), 0);
    });

    test('y se va del registro del dia, que es lo que pinta el inicio', async () => {
        const log = await crearEntreno(usuario);
        const hoy = getMadridDateString();

        await DailyLog.create({
            user: usuario._id, date: hoy,
            gymWorkouts: [{ name: 'Pecho', duration: 3600, caloriesBurned: 300, timestamp: log.date }]
        });

        await borrarEntreno(log._id, usuario._id);

        const dia = await DailyLog.findOne({ user: usuario._id, date: hoy }).lean();
        assert.strictEqual(dia.gymWorkouts.length, 0, 'no puede quedar la linea del entreno borrado');
    });

    test('pero NO se lleva los otros entrenos del mismo dia', async () => {
        const uno = await crearEntreno(usuario);
        await crearEntreno(usuario, { kcal: 200 });
        const hoy = getMadridDateString();
        await DailyLog.create({ user: usuario._id, date: hoy, gymWorkouts: [] });

        await borrarEntreno(uno._id, usuario._id);

        const dia = await DailyLog.findOne({ user: usuario._id, date: hoy }).lean();
        assert.strictEqual(dia.gymWorkouts.length, 1, 'el otro entreno del dia se queda');
        assert.strictEqual(dia.gymWorkouts[0].caloriesBurned, 200);
    });

    test('devuelve el XP que habia pagado', async () => {
        const log = await crearEntreno(usuario, { kcal: 300 });
        const xp = xpQueDio(log);          // 150
        await addRewards(usuario._id, xp, 0, 0);

        const antes = await User.findById(usuario._id).select('currentXP').lean();
        assert.strictEqual(antes.currentXP, 50, '150 XP suben al nivel 2 y sobran 50');

        await borrarEntreno(log._id, usuario._id);

        const despues = await User.findById(usuario._id).select('currentXP level').lean();
        assert.strictEqual(despues.level, 1, 'se vuelve al nivel de antes');
        assert.strictEqual(despues.currentXP, 0, 'y al XP de antes');
    });

    test('guardar, borrar y volver a guardar NO regala el premio de nivel', async () => {
        // Esta es la impresora que habria sin el techo de nivel.
        const premioPrimero = (await addRewards(usuario._id, 150, 0, 0)).premioDeNivel;
        assert.ok(premioPrimero, 'la primera vez si se paga');

        const monedasTrasSubir = (await User.findById(usuario._id).select('coins').lean()).coins;

        await quitarXp(usuario._id, 150);
        const segunda = await addRewards(usuario._id, 150, 0, 0);

        assert.strictEqual(segunda.premioDeNivel, null, 'la segunda vez no se paga');
        const monedasAhora = (await User.findById(usuario._id).select('coins').lean()).coins;
        assert.strictEqual(monedasAhora, monedasTrasSubir, 'y las monedas no se mueven');
    });

    test('la rutina deja de decir que la hiciste ese dia', async () => {
        const rutina = await Routine.create({ user: usuario._id, name: 'Torso', exercises: [] });
        const log = await crearEntreno(usuario, { rutina: rutina._id });
        await Routine.updateOne({ _id: rutina._id }, { $set: { lastPerformed: log.date } });

        await borrarEntreno(log._id, usuario._id);

        const r = await Routine.findById(rutina._id).lean();
        assert.strictEqual(r.lastPerformed, null, 'si era el unico, se queda sin fecha');
    });

    test('si quedaban otros, la rutina apunta al anterior', async () => {
        const rutina = await Routine.create({ user: usuario._id, name: 'Torso', exercises: [] });
        const viejo = await crearEntreno(usuario, { rutina: rutina._id, fecha: new Date(Date.now() - 86400000) });
        const nuevo = await crearEntreno(usuario, { rutina: rutina._id });
        await Routine.updateOne({ _id: rutina._id }, { $set: { lastPerformed: nuevo.date } });

        await borrarEntreno(nuevo._id, usuario._id);

        const r = await Routine.findById(rutina._id).lean();
        assert.strictEqual(new Date(r.lastPerformed).getTime(), new Date(viejo.date).getTime());
    });

    test('no se puede borrar el entreno de otro', async () => {
        const otro = await User.create({ username: 'otro', email: 'otro@k.test', password: 'x' });
        const log = await crearEntreno(otro);

        const r = await borrarEntreno(log._id, usuario._id);

        assert.strictEqual(r.ok, false);
        assert.strictEqual(r.motivo, 'no-es-tuyo');
        assert.strictEqual(await WorkoutLog.countDocuments({ _id: log._id }), 1, 'sigue ahi');
    });

    test('borrar uno que ya no existe no revienta', async () => {
        const log = await crearEntreno(usuario);
        await borrarEntreno(log._id, usuario._id);

        const otra = await borrarEntreno(log._id, usuario._id);
        assert.strictEqual(otra.ok, false);
        assert.strictEqual(otra.motivo, 'no-existe');
    });
});

describe('Quitar XP baja de nivel cuando toca', () => {
    let usuario;
    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => {
        await limpiar();
        usuario = await User.create({ username: 'bajada', email: 'bajada@k.test', password: 'x' });
    });

    test('dentro del mismo nivel solo resta', async () => {
        await addRewards(usuario._id, 80, 0, 0);
        await quitarXp(usuario._id, 30);

        const u = await User.findById(usuario._id).select('level currentXP').lean();
        assert.strictEqual(u.level, 1);
        assert.strictEqual(u.currentXP, 50);
    });

    test('si no llega, se baja de nivel', async () => {
        await addRewards(usuario._id, 150, 0, 0);   // nivel 2, 50 XP
        await quitarXp(usuario._id, 80);            // 50 - 80 = -30 -> nivel 1

        const u = await User.findById(usuario._id).select('level currentXP').lean();
        assert.strictEqual(u.level, 1);
        assert.strictEqual(u.currentXP, 70, '100 del nivel 1 menos los 30 que faltaban');
    });

    test('en el nivel 1 no se baja mas: el XP se queda en cero', async () => {
        await addRewards(usuario._id, 20, 0, 0);
        await quitarXp(usuario._id, 500);

        const u = await User.findById(usuario._id).select('level currentXP').lean();
        assert.strictEqual(u.level, 1);
        assert.strictEqual(u.currentXP, 0, 'nunca negativo');
    });
});
