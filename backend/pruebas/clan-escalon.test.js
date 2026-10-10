const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');
const User = require('../models/User');
const Clan = require('../models/Clan');
const { claimEventReward, getCurrentWeekStart } = require('../controllers/clanController');

/**
 * EL ESCALON QUE SE RECLAMA.
 *
 * El evento semanal del clan tiene cinco escalones (Bronce a Diamante) y cada
 * uno paga XP, monedas y fichas. Cual se reclama lo dice el movil, en el
 * cuerpo de la peticion, asi que es una entrada que viene de fuera.
 *
 * ⚠️ Se validaba con `if (!TIER_FACTORS[tier])`, y eso acepta CUALQUIER
 * propiedad heredada de Object. Con tier "constructor" el factor salia siendo
 * una funcion, `goal * factor` daba NaN, y `clanTotal < NaN` es false: la
 * comprobacion de "meta no alcanzada" se pasaba de largo con el clan a cero.
 *
 * Aqui se comprueba que solo pasan los cinco escalones de verdad.
 */
const llamar = async (fn, peticion) => {
    let estado = 200; let dato = null;
    const res = { status(c) { estado = c; return this; }, json(d) { dato = d; return this; } };
    try { await fn({ query: {}, body: {}, ...peticion }, res, () => { }); }
    catch (e) { return { estado: estado === 200 ? 500 : estado, error: e.message }; }
    return { estado, dato };
};

describe('Reclamar la recompensa del evento del clan', () => {
    let usuario, clan;

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });

    beforeEach(async () => {
        await limpiar();
        usuario = await User.create({ username: 'clanero', email: 'clanero@k.test', password: 'x' });
        clan = await Clan.create({
            name: 'Los Pesados',
            leader: usuario._id,
            members: [usuario._id],
            // El evento de ESTA semana, pero sin una sola aportacion: el clan
            // esta a cero, asi que no deberia poder cobrarse ningun escalon.
            weeklyEvent: { startDate: getCurrentWeekStart(), claims: [] }
        });
        usuario.clan = clan._id;
        await usuario.save();
    });

    const reclamar = (tier) => llamar(claimEventReward, { user: usuario, body: { tier } });

    test('con el clan a cero no se cobra ni el escalon mas bajo', async () => {
        const r = await reclamar(1);
        assert.strictEqual(r.estado, 400, 'la meta no esta alcanzada');
    });

    test('"constructor" no es un escalon: la via de escape esta cerrada', async () => {
        // Este era el agujero: colaba la validacion y se saltaba la meta.
        const r = await reclamar('constructor');
        assert.strictEqual(r.estado, 400);

        const despues = await Clan.findById(clan._id).lean();
        assert.strictEqual(despues.weeklyEvent.claims.length, 0,
            'no puede haber quedado apuntado ningun cobro');
    });

    test('tampoco valen toString, valueOf ni __proto__', async () => {
        for (const bicho of ['toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
            const r = await reclamar(bicho);
            assert.strictEqual(r.estado, 400, `"${bicho}" no deberia colar`);
        }
        const despues = await Clan.findById(clan._id).lean();
        assert.strictEqual(despues.weeklyEvent.claims.length, 0);
    });

    test('ni un escalon que no existe, ni texto, ni nada', async () => {
        for (const bicho of [0, 6, -1, 2.5, 'tres', null, undefined, {}, []]) {
            const r = await reclamar(bicho);
            assert.strictEqual(r.estado, 400, `"${JSON.stringify(bicho)}" no deberia colar`);
        }
    });

    test('el usuario no se lleva nada en ninguno de los intentos', async () => {
        const antes = await User.findById(usuario._id).select('xp coins gameCoins').lean();
        for (const bicho of ['constructor', 'toString', 7, 'tres']) await reclamar(bicho);
        const despues = await User.findById(usuario._id).select('xp coins gameCoins').lean();

        assert.strictEqual(despues.xp, antes.xp);
        assert.strictEqual(despues.coins, antes.coins);
        assert.strictEqual(despues.gameCoins, antes.gameCoins);
    });
});
