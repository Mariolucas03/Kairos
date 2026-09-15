const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const ShopItem = require('../models/ShopItem');
const { COFRES, abrirCofre } = require('../services/cofresService');

/**
 * ABRIR COFRES CONTRA LA BASE DE DATOS.
 *
 * La tabla de cada cofre se mide en economia.test.js. Aqui se prueba lo que
 * pasa al abrirlo de verdad: que el premio se APLICA (fichas sumadas, XP
 * sumado, objeto en el inventario), que un cosmetico repetido se convierte en
 * fichas y no en un segundo marco igual, y que las pociones se apilan.
 */

let siguiente = 0;
const crearUsuario = async (props = {}) => {
    siguiente++;
    return User.create({
        username: `cofrero${siguiente}`,
        email: `cofrero${siguiente}@kairos.test`,
        password: 'da-igual',
        gameCoins: 0,
        currentXP: 0,
        ...props
    });
};

// Un cofre de mentira que SIEMPRE da lo que se le diga: asi se prueba cada
// rama sin depender del azar.
const cofreQueDa = (entrada) => ({ id: 'prueba', nombre: 'Cofre de prueba', precio: 100, tabla: [{ ...entrada, peso: 1 }] });

describe('Cofres: abrirlos aplica el premio', () => {
    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => {
        await limpiar();
        await ShopItem.create([
            { name: 'Marco de prueba', price: 800, category: 'frame', icon: '🟨', rarity: 'epico', user: null },
            { name: 'Pocion de prueba', price: 40, category: 'consumable', icon: '🧪', rarity: 'comun', user: null, effectType: 'xp', effectValue: 100 }
        ]);
    });

    test('las fichas se suman al saldo, dentro del rango', async () => {
        const u = await crearUsuario();
        const premio = await abrirCofre(u._id, cofreQueDa({ t: 'fichas', min: 200, max: 300 }));
        assert.strictEqual(premio.tipo, 'fichas');
        assert.ok(premio.valor >= 200 && premio.valor <= 300);
        const despues = await User.findById(u._id);
        assert.strictEqual(despues.gameCoins, premio.valor);
    });

    test('el XP se suma (y puede subir de nivel)', async () => {
        const u = await crearUsuario();
        const premio = await abrirCofre(u._id, cofreQueDa({ t: 'xp', min: 500, max: 500 }));
        assert.strictEqual(premio.tipo, 'xp');
        const despues = await User.findById(u._id);
        assert.ok(despues.level > 1 || despues.currentXP === 500, 'el XP no se ha aplicado');
    });

    test('un objeto nuevo va al inventario; repetido, se convierte en la mitad de su precio en fichas', async () => {
        const u = await crearUsuario();
        const entrada = { t: 'objeto', rareza: 'epico', categorias: ['frame'] };

        const primero = await abrirCofre(u._id, cofreQueDa(entrada));
        assert.strictEqual(primero.tipo, 'objeto');
        assert.strictEqual(primero.objeto.name, 'Marco de prueba');
        let despues = await User.findById(u._id);
        assert.strictEqual(despues.inventory.length, 1);
        assert.strictEqual(despues.gameCoins, 0);

        const segundo = await abrirCofre(u._id, cofreQueDa(entrada));
        assert.strictEqual(segundo.tipo, 'fichas');
        assert.strictEqual(segundo.duplicado, true);
        assert.strictEqual(segundo.valor, 400);
        despues = await User.findById(u._id);
        assert.strictEqual(despues.inventory.length, 1, 'no puede haber dos marcos iguales');
        assert.strictEqual(despues.inventory[0].quantity, 1);
        assert.strictEqual(despues.gameCoins, 400);
    });

    test('las pociones se apilan', async () => {
        const u = await crearUsuario();
        const entrada = { t: 'objeto', rareza: 'comun', categorias: ['consumable'] };
        await abrirCofre(u._id, cofreQueDa(entrada));
        const segundo = await abrirCofre(u._id, cofreQueDa(entrada));
        assert.strictEqual(segundo.tipo, 'objeto');
        const despues = await User.findById(u._id);
        assert.strictEqual(despues.inventory.length, 1);
        assert.strictEqual(despues.inventory[0].quantity, 2);
    });

    test('los diez cofres del catalogo se pueden abrir sin que ninguno reviente', async () => {
        // Con el catalogo minimo de arriba, una entrada sin candidatos cae a
        // fichas de relleno en vez de a un cofre vacio.
        const u = await crearUsuario();
        for (const cofre of COFRES) {
            const premio = await abrirCofre(u._id, cofre);
            assert.ok(['fichas', 'xp', 'objeto'].includes(premio.tipo), `${cofre.id}: premio de tipo ${premio.tipo}`);
            assert.ok(premio.valor > 0);
        }
    });
});
