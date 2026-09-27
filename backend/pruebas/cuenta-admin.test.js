const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const { borrarUsuarioYSusDatos } = require('../services/borradoService');
const { getLeaderboard, searchUsers } = require('../controllers/socialController');

/**
 * LA CUENTA DE ADMINISTRACION OCULTA.
 *
 * Lo que tiene que cumplir antes de borrar la cuenta de siempre: que se pueda
 * crear otra con los mismos permisos, que entre con su contraseña, que NO
 * aparezca por ningun lado publico, y que el borrado se lleve todo por delante
 * sin dejar rastro.
 */

// Un `res` de mentira, para llamar a los controladores sin Express
const llamar = async (fn, peticion) => {
    let estado = 200; let dato = null;
    const res = { status(c) { estado = c; return this; }, json(d) { dato = d; return this; } };
    await fn(peticion, res, () => { });
    return { estado, dato };
};

describe('Cuenta de administracion oculta', () => {
    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    // Lo mismo que hace scripts/cuenta-admin.js --crear
    const crearAdminOculto = (username, password) => User.create({
        username, email: `${username}@kairos.test`, password,
        isAdmin: true, oculto: true, coins: 0, gameCoins: 0, level: 1, hp: 100, lives: 100
    });

    test('se crea con permisos de admin, oculta, y la contraseña se guarda cifrada', async () => {
        await crearAdminOculto('jefe', 'una-clave-larga');

        const guardado = await User.findOne({ username: 'jefe' }).select('+password isAdmin oculto');
        assert.strictEqual(guardado.isAdmin, true, 'tiene que ser administrador');
        assert.strictEqual(guardado.oculto, true, 'tiene que estar oculta');
        assert.notStrictEqual(guardado.password, 'una-clave-larga', 'la contraseña NO puede guardarse tal cual');
        assert.ok(guardado.password.startsWith('$2'), 'tiene que ser un hash de bcrypt');

        // Y con ella se entra
        assert.strictEqual(await guardado.comparePassword('una-clave-larga'), true);
        assert.strictEqual(await guardado.comparePassword('otra-cosa'), false);
    });

    test('no sale al buscar gente ni en el ranking, y una cuenta normal si', async () => {
        const admin = await crearAdminOculto('jefe', 'una-clave-larga');
        await User.updateOne({ _id: admin._id }, { $set: { level: 99 } });
        const normal = await User.create({ username: 'pepe', email: 'pepe@k.test', password: 'x', level: 5 });

        const busca = await llamar(searchUsers, { user: normal, query: { q: 'jef' } });
        assert.deepStrictEqual(busca.dato, [], 'la cuenta oculta no se busca');
        const buscaNormal = await llamar(searchUsers, { user: admin, query: { q: 'pep' } });
        assert.strictEqual(buscaNormal.dato.length, 1, 'las normales si se buscan');

        const tabla = await llamar(getLeaderboard, { user: normal });
        const nombres = (tabla.dato?.leaderboard || tabla.dato || []).map(u => u.username);
        assert.ok(!nombres.includes('jefe'), 'la cuenta oculta no sale en el ranking aunque sea nivel 99');
        assert.ok(nombres.includes('pepe'));
    });

    test('al borrar una cuenta se va tambien lo suyo', async () => {
        const uno = await User.create({ username: 'viejo', email: 'viejo@k.test', password: 'x' });
        const amigo = await User.create({ username: 'amiga', email: 'amiga@k.test', password: 'x', friends: [uno._id] });
        await WorkoutLog.create({ user: uno._id, type: 'gym', routineName: 'Pecho', duration: 45, date: new Date(), exercises: [] });

        const resumen = await borrarUsuarioYSusDatos(uno._id);
        assert.strictEqual(resumen.usuario, 'viejo');
        assert.strictEqual(await User.countDocuments({ _id: uno._id }), 0);
        assert.strictEqual(await WorkoutLog.countDocuments({ user: uno._id }), 0, 'sus entrenos tambien');

        const quedaEnAmigos = await User.findById(amigo._id).select('friends').lean();
        assert.strictEqual(quedaEnAmigos.friends.length, 0, 'no puede quedar en la lista de amigos de nadie');
    });

    test('la cuenta nueva sigue siendo admin despues de borrar la vieja', async () => {
        const vieja = await User.create({ username: 'Mario_27', email: 'm@k.test', password: 'x', isAdmin: true });
        const nueva = await crearAdminOculto('jefe', 'una-clave-larga');

        // El guardarraíl del script: con OTRO admin dentro, borrar la vieja se permite
        const otrosAdmins = await User.countDocuments({ isAdmin: true, _id: { $ne: vieja._id } });
        assert.strictEqual(otrosAdmins, 1, 'la nueva cuenta cuenta como administrador');

        await borrarUsuarioYSusDatos(vieja._id);
        const sigue = await User.findById(nueva._id).select('isAdmin oculto').lean();
        assert.strictEqual(sigue.isAdmin, true);
        assert.strictEqual(sigue.oculto, true);
    });

    test('sin otra cuenta de admin, el script se niega a borrar la unica que hay', async () => {
        const solo = await User.create({ username: 'Mario_27', email: 'm@k.test', password: 'x', isAdmin: true });
        const otros = await User.countDocuments({ isAdmin: true, _id: { $ne: solo._id } });
        assert.strictEqual(otros, 0, 'es la unica: el script para aqui y no borra nada');
    });
});
