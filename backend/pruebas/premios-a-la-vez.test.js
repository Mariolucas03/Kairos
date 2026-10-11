const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');
const User = require('../models/User');
const { addRewards } = require('../services/levelService');

/**
 * DOS PREMIOS A LA VEZ.
 *
 * `addRewards` es por donde pasa TODO lo que se cobra en la app: misiones,
 * entrenos, duelos, casino, cofres, el evento del clan, la recompensa diaria.
 *
 * ⚠️ LO QUE SE QUIERE DEMOSTRAR AQUI.
 *
 * Leer el usuario, sumarle en memoria y guardarlo es seguro mientras solo pase
 * una cosa a la vez. Si pasan dos, las dos leen el MISMO saldo de partida y la
 * segunda en guardar escribe su total encima del de la primera: uno de los dos
 * premios desaparece sin dejar rastro, sin error y sin nada en los registros.
 *
 * Y pasa de verdad: la cola de envios sin conexion suelta de golpe todo lo
 * que quedo pendiente en cuanto vuelve la cobertura, y una mision compartida
 * paga a varios en el mismo instante.
 *
 * Estas pruebas no comprueban una funcion: comprueban que el dinero cuadra
 * cuando llegan varios cobros juntos.
 */

describe('Varios premios al mismo tiempo', () => {
    let usuario;

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });

    beforeEach(async () => {
        await limpiar();
        usuario = await User.create({
            username: 'cobrador', email: 'cobrador@k.test', password: 'x',
            level: 1, currentXP: 0, coins: 0, gameCoins: 0
        });
    });

    const saldo = async () => User.findById(usuario._id).select('coins gameCoins currentXP level').lean();

    test('dos cobros a la vez: no se puede perder ninguno', async () => {
        await Promise.all([
            addRewards(usuario._id, 0, 100, 0),
            addRewards(usuario._id, 0, 100, 0)
        ]);

        const s = await saldo();
        assert.strictEqual(s.coins, 200, `deberian ser 200 monedas y hay ${s.coins}`);
    });

    test('diez cobros a la vez: tienen que estar los diez', async () => {
        await Promise.all(
            Array.from({ length: 10 }, () => addRewards(usuario._id, 0, 10, 20))
        );

        const s = await saldo();
        assert.strictEqual(s.coins, 100, `deberian ser 100 monedas y hay ${s.coins}`);
        assert.strictEqual(s.gameCoins, 200, `deberian ser 200 fichas y hay ${s.gameCoins}`);
    });

    test('el XP tampoco se pierde cuando llegan juntos', async () => {
        // Diez de 5 XP: cuarenta en total, sin llegar a subir de nivel
        // (el nivel 1 pide 100), asi que tienen que quedar los 50 enteros.
        await Promise.all(
            Array.from({ length: 10 }, () => addRewards(usuario._id, 5, 0, 0))
        );

        const s = await saldo();
        assert.strictEqual(s.level, 1, 'con 50 XP no se sube de nivel');
        assert.strictEqual(s.currentXP, 50, `deberian ser 50 XP y hay ${s.currentXP}`);
    });

    test('subir de nivel sigue funcionando igual', async () => {
        // El nivel 1 pide 100 XP y el 2 pide 200. Con 250 se sube UNA vez y
        // sobran 150.
        const r = await addRewards(usuario._id, 250, 0, 0);

        assert.strictEqual(r.leveledUp, true);
        assert.strictEqual(r.levelsGained, 1);

        const s = await saldo();
        assert.strictEqual(s.level, 2);
        assert.strictEqual(s.currentXP, 150);
    });

    test('varios niveles de golpe pagan UN premio, no uno por escalon', async () => {
        // 100 + 200 + 300 = 600 XP son tres niveles justos.
        const r = await addRewards(usuario._id, 600, 0, 0);

        assert.strictEqual(r.levelsGained, 3);
        assert.strictEqual((await saldo()).level, 4);
        assert.ok(r.premioDeNivel, 'tiene que haber premio');
        // El premio es el del nivel al que se LLEGA, una sola vez.
        const { premioPorNivel } = require('../services/levelService');
        assert.deepStrictEqual(r.premioDeNivel, premioPorNivel(4));
    });

    test('al subir de nivel se recupera la vida', async () => {
        await User.updateOne({ _id: usuario._id }, { $set: { hp: 10, lives: 10, maxHp: 100 } });
        await addRewards(usuario._id, 100, 0, 0);

        const u = await User.findById(usuario._id).select('hp lives level').lean();
        assert.strictEqual(u.level, 2);
        assert.strictEqual(u.hp, 100, 'la vida tiene que volver al maximo');
        assert.strictEqual(u.lives, 100, 'y `lives` va siempre con `hp`');
    });

    test('dos premios que suben el MISMO nivel no lo suben dos veces', async () => {
        // Cada uno trae 60 XP: por separado ninguno sube, juntos hacen 120 y
        // dan para un nivel. Tiene que subir UNO, no dos.
        await Promise.all([
            addRewards(usuario._id, 60, 0, 0),
            addRewards(usuario._id, 60, 0, 0)
        ]);

        const s = await saldo();
        assert.strictEqual(s.level, 2, `deberia ser nivel 2 y es ${s.level}`);
        assert.strictEqual(s.currentXP, 20, `deberian sobrar 20 XP y hay ${s.currentXP}`);
    });

    test('el premio de ese nivel se paga una sola vez', async () => {
        const { premioPorNivel } = require('../services/levelService');
        const esperado = premioPorNivel(2);

        await Promise.all([
            addRewards(usuario._id, 60, 0, 0),
            addRewards(usuario._id, 60, 0, 0)
        ]);

        const s = await saldo();
        assert.strictEqual(s.coins, esperado.monedas,
            `el premio de nivel se paga una vez: ${esperado.monedas}, no ${s.coins}`);
        assert.strictEqual(s.gameCoins, esperado.fichas);
    });

    test('cargar el perfil con un nivel pendiente no se come el XP que entra', async () => {
        // `ensureLevelConsistency` corre en CADA carga de perfil y tambien
        // recalcula niveles. Antes leia, calculaba en memoria y guardaba el
        // total; si un premio entraba en ese hueco, el guardado escribia su
        // `currentXP` ya viejo encima y el XP del premio desaparecia.
        //
        // El choque SOLO existe si hay una subida pendiente: sin ella la
        // reparacion no escribia nada. Por eso se monta a proposito.
        const { ensureLevelConsistency } = require('../services/levelService');
        await User.updateOne({ _id: usuario._id }, { $set: { currentXP: 150, nextLevelXP: 100, level: 1 } });

        await Promise.all([
            ensureLevelConsistency(usuario._id),
            addRewards(usuario._id, 90, 0, 0)
        ]);

        // 150 que habia + 90 del premio = 240. Sube un nivel (cuesta 100) y
        // quedan 140, mande quien mande primero.
        const s = await saldo();
        assert.strictEqual(s.level, 2, `deberia ser nivel 2 y es ${s.level}`);
        assert.strictEqual(s.currentXP, 140, `deberian quedar 140 XP y hay ${s.currentXP}`);
    });

    test('reparar el perfil NO paga el premio de subir de nivel', async () => {
        // Si lo pagara, abrir el perfil con el XP descuadrado seria una
        // impresora de monedas.
        await User.updateOne({ _id: usuario._id }, { $set: { currentXP: 250, nextLevelXP: 100 } });
        const { ensureLevelConsistency } = require('../services/levelService');

        await ensureLevelConsistency(usuario._id);

        const s = await saldo();
        assert.strictEqual(s.level, 2, 'el nivel si se cuadra');
        assert.strictEqual(s.coins, 0, 'pero reparar no paga');
        assert.strictEqual(s.gameCoins, 0);
    });

    test('uno detras de otro siempre ha funcionado (control)', async () => {
        // Si esta falla, lo roto no es la concurrencia sino la suma.
        for (let i = 0; i < 10; i++) await addRewards(usuario._id, 0, 10, 0);

        const s = await saldo();
        assert.strictEqual(s.coins, 100);
    });
});
