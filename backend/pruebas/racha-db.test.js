const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar, fingirPeticion } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const ShopItem = require('../models/ShopItem');
const { claimDailyReward, getCaminoRacha } = require('../controllers/userController');
const { recompensaDelDia, tramoDelCamino } = require('../utils/caminoRacha');
const { getMadridDateString } = require('../utils/dateHelpers');

/**
 * LA RACHA: DIA 1, DIA 2, DIA 3... Y SI FALLAS UNO, AL 1.
 *
 * Antes habia dos rachas con el mismo nombre (una por misiones, otra por
 * calendario) y se contradecian. Estas pruebas fijan la unica que queda: los
 * dias seguidos que entras y recoges la recompensa, y el premio que da cada
 * dia del camino.
 */

let siguiente = 0;
const crearUsuario = async (props = {}) => {
    siguiente++;
    return User.create({
        username: `racha${siguiente}`,
        email: `racha${siguiente}@kairos.test`,
        password: 'da-igual',
        gameCoins: 0,
        currentXP: 0,
        ...props
    });
};

const haceDias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

/** Deja al usuario como si hubiera cobrado por ultima vez hace `n` dias, en el dia `dia` de racha. */
const cobroHace = async (user, n, dia) => {
    await User.updateOne({ _id: user._id }, {
        $set: {
            'dailyRewards.lastClaimDay': getMadridDateString(haceDias(n)),
            'dailyRewards.lastClaimDate': haceDias(n),
            'streak.current': dia,
            'streak.lastLogDate': haceDias(n)
        }
    });
};

const cobrar = async (user) => {
    const p = fingirPeticion({ user: { _id: user._id } });
    await claimDailyReward(p.req, p.res);
    return p.res;
};

describe('La racha: seguida sube, fallada vuelve al 1', () => {
    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => {
        await limpiar();
        await ShopItem.create({ name: 'Cofre de Madera', price: 100, category: 'chest', icon: '🪵', rarity: 'comun', user: null, effectType: 'madera' });
    });

    test('la primera vez es el dia 1', async () => {
        const u = await crearUsuario();
        const res = await cobrar(u);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.enviado.dia, 1);
        assert.strictEqual(res.enviado.streak.current, 1);
        assert.strictEqual(res.enviado.reward.tipo, 'fichas');
        const despues = await User.findById(u._id);
        assert.strictEqual(despues.gameCoins, res.enviado.reward.valor);
    });

    test('si ayer cobraste, hoy es un dia mas', async () => {
        const u = await crearUsuario();
        await cobroHace(u, 1, 4);
        const res = await cobrar(u);
        assert.strictEqual(res.enviado.dia, 5);
        assert.strictEqual(res.enviado.reward.tipo, 'fichas');   // el 5 del patron
    });

    test('si te saltaste un dia, vuelves al dia 1 aunque llevaras veinte', async () => {
        const u = await crearUsuario();
        await cobroHace(u, 2, 20);
        const res = await cobrar(u);
        assert.strictEqual(res.enviado.dia, 1);
        const despues = await User.findById(u._id);
        assert.strictEqual(despues.streak.current, 1);
    });

    test('dos veces el mismo dia, no', async () => {
        const u = await crearUsuario();
        await cobrar(u);
        const otra = await cobrar(u);
        assert.strictEqual(otra.statusCode, 400);
        assert.strictEqual(otra.enviado.alreadyClaimed, true);
        const despues = await User.findById(u._id);
        assert.strictEqual(despues.streak.current, 1);
    });

    test('el dia 7 da un cofre, y va al inventario', async () => {
        const u = await crearUsuario();
        await cobroHace(u, 1, 6);
        const res = await cobrar(u);
        assert.strictEqual(res.enviado.dia, 7);
        assert.strictEqual(res.enviado.reward.tipo, 'cofre');
        const despues = await User.findById(u._id);
        assert.strictEqual(despues.inventory.length, 1);
        assert.strictEqual(despues.inventory[0].quantity, 1);
    });

    test('el dia de vida cura hasta el maximo y no mas', async () => {
        const u = await crearUsuario({ hp: 95, maxHp: 100 });
        await cobroHace(u, 1, 3);   // hoy es el dia 4: vida
        const res = await cobrar(u);
        assert.strictEqual(res.enviado.reward.tipo, 'hp');
        const despues = await User.findById(u._id);
        assert.strictEqual(despues.hp, 100);
    });

    test('el camino dice que dia toca y si esta cobrado', async () => {
        const u = await crearUsuario();
        await cobroHace(u, 1, 9);
        let p = fingirPeticion({ user: { _id: u._id } });
        await getCaminoRacha(p.req, p.res);
        assert.strictEqual(p.res.enviado.dia, 10);
        assert.strictEqual(p.res.enviado.cobradoHoy, false);
        assert.strictEqual(p.res.enviado.camino[0].dia, 7);
        assert.strictEqual(p.res.enviado.camino.at(-1).dia, 20);

        await cobrar(u);
        p = fingirPeticion({ user: { _id: u._id } });
        await getCaminoRacha(p.req, p.res);
        assert.strictEqual(p.res.enviado.dia, 10);
        assert.strictEqual(p.res.enviado.cobradoHoy, true);
        assert.strictEqual(p.res.enviado.rachaViva, 10);
    });
});

describe('El camino de la racha: premios distintos y crecientes', () => {
    test('cada dia tiene su premio y los hitos dan cofre', () => {
        const semana = [1, 2, 3, 4, 5, 6, 7].map(recompensaDelDia).map(r => r.tipo);
        assert.deepStrictEqual(semana, ['fichas', 'xp', 'fichas', 'hp', 'fichas', 'xp', 'cofre']);
        assert.strictEqual(recompensaDelDia(30).tipo, 'cofre');
        assert.strictEqual(recompensaDelDia(100).cofre, 'legendario');
    });

    test('la semana 5 paga mas que la primera, y la vida tiene tope', () => {
        assert.ok(recompensaDelDia(29).valor > recompensaDelDia(1).valor);
        assert.ok(recompensaDelDia(400).valor <= 50 || recompensaDelDia(400).tipo !== 'hp');
        for (let d = 1; d <= 400; d++) {
            const r = recompensaDelDia(d);
            if (r.tipo === 'hp') assert.ok(r.valor <= 50, `el dia ${d} cura ${r.valor}`);
            if (r.tipo === 'xp') assert.ok(r.valor <= 200, `el dia ${d} da ${r.valor} XP: abrir la app no puede pagar como entrenar`);
        }
    });

    test('el tramo va del dia pedido hacia atras y hacia delante, y nunca por debajo del 1', () => {
        const t = tramoDelCamino(2, 3, 4);
        assert.strictEqual(t[0].dia, 1);
        assert.strictEqual(t.at(-1).dia, 6);
    });
});
