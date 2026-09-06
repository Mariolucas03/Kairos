const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar, fingirPeticion } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const Mission = require('../models/Mission');
const { getDailyLog } = require('../controllers/dailyController');

/**
 * EL "3 DE 5" DEL WIDGET DE MISIONES
 *
 * Las dos mitades del contador se calculaban de formas distintas: el total se
 * DERIVABA (contar las misiones de hoy) y las hechas eran un CONTADOR que subia
 * de uno en uno al completar. Dos formas de contar lo mismo siempre acaban
 * dando dos respuestas, y aqui pasaba en cuanto ocurria cualquier cosa normal:
 * completar una mision y borrarla, pasar una diaria a semanal, o que el otro
 * cancele una cooperativa.
 *
 * Estas pruebas van contra la base de datos porque el fallo NO estaba en la
 * aritmetica —sumar uno esta bien sumado— sino en que los dos numeros salian de
 * sitios distintos. Eso solo se ve guardando misiones de verdad y volviendo a
 * pedir el registro del dia.
 */

let siguiente = 0;
const crearUsuario = async () => {
    siguiente++;
    return User.create({
        username: `misionero${siguiente}`,
        email: `misionero${siguiente}@kairos.test`,
        password: 'da-igual-no-se-usa'
    });
};

const crearMision = (userId, props = {}) => Mission.create({
    user: userId,
    title: 'Hacer algo',
    frequency: 'daily',
    difficulty: 'easy',
    ...props
});

/** Pide el registro de hoy y devuelve su `missionStats`. */
const statsDeHoy = async (user) => {
    const p = fingirPeticion({ user });
    await getDailyLog(p.req, p.res);
    return p.res.enviado.missionStats;
};

describe('Misiones: el "x de y" cuenta las dos mitades igual', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    test('cinco misiones sin tocar son 0 de 5', async () => {
        const user = await crearUsuario();
        for (let i = 0; i < 5; i++) await crearMision(user._id);

        const stats = await statsDeHoy(user);
        assert.strictEqual(stats.total, 5);
        assert.strictEqual(stats.completed, 0);
    });

    test('tres hechas de cinco son 3 de 5', async () => {
        const user = await crearUsuario();
        for (let i = 0; i < 5; i++) await crearMision(user._id);
        await statsDeHoy(user);   // se crea el registro del dia

        await Mission.updateMany({ user: user._id }, { $set: { completed: true } }, { limit: 0 });
        // Solo tres: se deshacen dos
        const dos = await Mission.find({ user: user._id }).limit(2);
        await Mission.updateMany({ _id: { $in: dos.map(m => m._id) } }, { $set: { completed: false } });

        const stats = await statsDeHoy(user);
        assert.strictEqual(stats.total, 5);
        assert.strictEqual(stats.completed, 3);
    });

    test('EL FALLO: completas una mision y la borras — el contador no se queda arriba', async () => {
        const user = await crearUsuario();
        const misiones = [];
        for (let i = 0; i < 5; i++) misiones.push(await crearMision(user._id));

        // Se completan tres
        await Mission.updateMany(
            { _id: { $in: misiones.slice(0, 3).map(m => m._id) } },
            { $set: { completed: true } }
        );

        let stats = await statsDeHoy(user);
        assert.strictEqual(stats.completed, 3, 'punto de partida: 3 de 5');
        assert.strictEqual(stats.total, 5);

        // Y se borra UNA DE LAS HECHAS.
        //
        // Aqui es donde se rompia: el total bajaba a 4 porque se contaba de
        // nuevo, pero las hechas seguian siendo 3 porque nadie las volvia a
        // contar. Quedaba "3 de 4" con solo dos misiones hechas de verdad.
        await Mission.deleteOne({ _id: misiones[0]._id });

        stats = await statsDeHoy(user);
        assert.strictEqual(stats.total, 4, 'quedan cuatro misiones');
        assert.strictEqual(stats.completed, 2, 'y solo dos hechas: la tercera ya no existe');
    });

    test('una diaria que pasa a semanal sale de los DOS lados a la vez', async () => {
        const user = await crearUsuario();
        const a = await crearMision(user._id);
        await crearMision(user._id);

        await Mission.updateOne({ _id: a._id }, { $set: { completed: true } });
        let stats = await statsDeHoy(user);
        assert.strictEqual(stats.completed, 1);
        assert.strictEqual(stats.total, 2);

        // Se edita la hecha y se convierte en semanal: deja de ser de hoy.
        await Mission.updateOne({ _id: a._id }, { $set: { frequency: 'weekly' } });

        stats = await statsDeHoy(user);
        assert.strictEqual(stats.total, 1, 'ya no cuenta para hoy');
        assert.strictEqual(stats.completed, 0, 'y tampoco cuenta como hecha');
    });

    test('nunca se puede haber hecho mas de lo que hay', async () => {
        // La invariante que el widget nunca debe romper. Antes se sostenia con
        // un recorte de emergencia (`if (completed > total) completed = total`),
        // que tapaba el sintoma y perdia el numero bueno. Ahora se cumple sola
        // porque los dos salen de la misma cuenta.
        const user = await crearUsuario();
        const misiones = [];
        for (let i = 0; i < 4; i++) misiones.push(await crearMision(user._id));

        await Mission.updateMany({ user: user._id }, { $set: { completed: true } });
        await statsDeHoy(user);

        // Se borran tres de las cuatro, todas hechas
        await Mission.deleteMany({ _id: { $in: misiones.slice(0, 3).map(m => m._id) } });

        const stats = await statsDeHoy(user);
        assert.ok(stats.completed <= stats.total,
            `${stats.completed} de ${stats.total} es imposible`);
        assert.strictEqual(stats.total, 1);
        assert.strictEqual(stats.completed, 1);
    });

    test('una cooperativa sin aceptar todavia no cuenta', async () => {
        const user = await crearUsuario();
        await crearMision(user._id);
        await crearMision(user._id, { isCoop: true, invitationStatus: 'pending' });

        const stats = await statsDeHoy(user);
        assert.strictEqual(stats.total, 1, 'la invitacion sin contestar no es una mision tuya');
    });
});
