const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');
const User = require('../models/User');
const ShopItem = require('../models/ShopItem');
const { apilarObjeto, entregarUnico } = require('../services/inventarioService');

/**
 * LA MOCHILA, CUANDO LLEGAN DOS COSAS A LA VEZ.
 *
 * Meter un objeto parece una linea y son dos: si ya hay entrada de ese objeto
 * se le suma uno, y si no, se crea. Escrito a mano —mirar y luego escribir—
 * las dos entregas simultaneas ven "no hay entrada" y las dos la crean.
 *
 * En un consumible eso deja el mismo objeto dos veces en la mochila. En un
 * cosmetico, que es UNICO, es peor: lo normal es que un repetido se convierta
 * en fichas, y con la carrera te quedas con dos copias y sin la compensacion.
 */

let n = 0;
const crearObjeto = async (category = 'consumable') => {
    n++;
    return ShopItem.create({
        name: `Objeto ${n}`, category, price: 500, icon: '🧪', user: null
    });
};

const mochilaDe = async (userId) => (await User.findById(userId).select('inventory').lean()).inventory || [];
const entradasDe = (mochila, itemId) => mochila.filter(e => e.item && e.item.toString() === itemId.toString());

describe('La mochila no duplica entradas', () => {
    let usuario;

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });

    beforeEach(async () => {
        await limpiar();
        usuario = await User.create({ username: 'mochilero', email: 'mochilero@k.test', password: 'x' });
    });

    test('dos entregas a la vez del mismo objeto: UNA entrada con cantidad 2', async () => {
        const objeto = await crearObjeto();

        await Promise.all([
            apilarObjeto(usuario._id, objeto._id),
            apilarObjeto(usuario._id, objeto._id)
        ]);

        const entradas = entradasDe(await mochilaDe(usuario._id), objeto._id);
        assert.strictEqual(entradas.length, 1, `deberia haber UNA entrada y hay ${entradas.length}`);
        assert.strictEqual(entradas[0].quantity, 2, `deberian ser 2 unidades y hay ${entradas[0].quantity}`);
    });

    test('cinco a la vez: una entrada con cinco', async () => {
        const objeto = await crearObjeto();

        await Promise.all(Array.from({ length: 5 }, () => apilarObjeto(usuario._id, objeto._id)));

        const entradas = entradasDe(await mochilaDe(usuario._id), objeto._id);
        assert.strictEqual(entradas.length, 1, `deberia haber UNA entrada y hay ${entradas.length}`);
        assert.strictEqual(entradas[0].quantity, 5, `deberian ser 5 unidades y hay ${entradas[0].quantity}`);
    });

    test('un cosmetico unico solo se entrega una vez', async () => {
        const avatar = await crearObjeto('avatar');

        const resultados = await Promise.all([
            entregarUnico(usuario._id, avatar._id),
            entregarUnico(usuario._id, avatar._id)
        ]);

        assert.deepStrictEqual(resultados.sort(), [false, true],
            'uno lo entrega y el otro tiene que enterarse de que ya estaba');

        const entradas = entradasDe(await mochilaDe(usuario._id), avatar._id);
        assert.strictEqual(entradas.length, 1, 'un avatar unico, una sola copia');
    });

    test('uno detras de otro sigue funcionando (control)', async () => {
        const objeto = await crearObjeto();
        for (let i = 0; i < 4; i++) await apilarObjeto(usuario._id, objeto._id);

        const entradas = entradasDe(await mochilaDe(usuario._id), objeto._id);
        assert.strictEqual(entradas.length, 1);
        assert.strictEqual(entradas[0].quantity, 4);
    });

    test('dos objetos distintos son dos entradas, claro', async () => {
        const a = await crearObjeto();
        const b = await crearObjeto();

        await Promise.all([apilarObjeto(usuario._id, a._id), apilarObjeto(usuario._id, b._id)]);

        const mochila = await mochilaDe(usuario._id);
        assert.strictEqual(entradasDe(mochila, a._id).length, 1);
        assert.strictEqual(entradasDe(mochila, b._id).length, 1);
    });
});
