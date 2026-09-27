const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');
const User = require('../models/User');
const DailyLog = require('../models/DailyLog');
const { updateDailyLog } = require('../controllers/dailyController');
const { getMadridDateString } = require('../utils/dateHelpers');

/**
 * LA FECHA DEL REGISTRO DIARIO.
 *
 * `PUT /daily` admite una fecha para poder corregir un dia pasado desde el
 * calendario del inicio. No se comprobaba ninguna: con una fecha futura se
 * creaba un dia "activo" que aun no ha pasado (y eso infla el mapa de
 * constancia y los dias activos del perfil), y con "9999-12-31" un registro
 * en el año 9999.
 */
const llamar = async (fn, peticion) => {
    let estado = 200; let dato = null;
    const res = { status(c) { estado = c; return this; }, json(d) { dato = d; return this; } };
    try { await fn({ query: {}, body: {}, ...peticion }, res, () => { }); }
    catch (e) { return { estado: estado === 200 ? 500 : estado, error: e.message }; }
    return { estado, dato };
};

const diaRelativo = (dias) => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return getMadridDateString(d);
};

describe('La fecha del registro diario', () => {
    let usuario;
    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => {
        await limpiar();
        usuario = await User.create({ username: 'anita', email: 'anita@k.test', password: 'x' });
        usuario.streak = { current: 0, lastLogDate: new Date(0) };
    });

    test('hoy y los dias pasados recientes se pueden escribir', async () => {
        const hoy = await llamar(updateDailyLog, { user: usuario, body: { type: 'weight', value: 80 } });
        assert.strictEqual(hoy.estado, 200, hoy.error);
        assert.strictEqual(hoy.dato.weight, 80);

        const ayer = await llamar(updateDailyLog, { user: usuario, body: { type: 'weight', value: 81, date: diaRelativo(-1) } });
        assert.strictEqual(ayer.estado, 200, ayer.error);
        assert.strictEqual(ayer.dato.date, diaRelativo(-1));
    });

    test('una fecha futura no crea un dia que todavia no ha pasado', async () => {
        const r = await llamar(updateDailyLog, { user: usuario, body: { type: 'steps', value: 5000, date: diaRelativo(1) } });
        assert.strictEqual(r.estado, 400, 'deberia rechazarla');
        assert.strictEqual(await DailyLog.countDocuments({}), 0, 'y no puede haber creado nada');
    });

    test('ni el año 9999, ni un texto, ni una fecha imposible', async () => {
        // (El texto vacio no entra aqui: sin fecha se escribe el dia de hoy,
        // que es justo lo que hace la app cuando no la manda.)
        for (const fecha of ['9999-12-31', 'ayer', '2026-02-30', '2026-13-01', '26-1-1', '2026-1-1', 'hoy']) {
            const r = await llamar(updateDailyLog, { user: usuario, body: { type: 'steps', value: 10, date: fecha } });
            assert.strictEqual(r.estado, 400, `"${fecha}" no deberia colar`);
        }
        assert.strictEqual(await DailyLog.countDocuments({}), 0);
    });

    test('tampoco un dia de hace años: el historial viejo no se reescribe', async () => {
        const r = await llamar(updateDailyLog, { user: usuario, body: { type: 'weight', value: 70, date: diaRelativo(-400) } });
        assert.strictEqual(r.estado, 400);
    });

    test('los valores siguen acotados: el peso no puede ser 99.999 kg', async () => {
        const r = await llamar(updateDailyLog, { user: usuario, body: { type: 'weight', value: 99999 } });
        assert.strictEqual(r.estado, 200, r.error);
        assert.strictEqual(r.dato.weight, 500, 'se recorta al maximo razonable');
    });
});
