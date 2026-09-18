const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const Clan = require('../models/Clan');
const Notification = require('../models/Notification');
const { ponerAlDiaElEvento, avisarHitos, buildTiers, getCurrentWeekStart } = require('../controllers/clanController');

/**
 * LOS AVISOS DEL CLAN.
 *
 * Cuando empieza el evento de la semana y cuando el clan llega a un escalon
 * con premio, cada miembro recibe un aviso en el buzon (el que enciende el
 * punto rojo de "Clan"). Lo que hay que garantizar es que se manda UNA vez:
 * el clan lo abren varios a la vez y el cron repasa todos los dias.
 */

let n = 0;
const crearUsuario = async () => {
    n++;
    return User.create({ username: `clanero${n}`, email: `clanero${n}@kairos.test`, password: 'da-igual' });
};

const crearClan = async (miembros) => Clan.create({
    name: 'Los del hierro ' + (++n),
    leader: miembros[0]._id,
    members: miembros.map(m => m._id),
    weeklyEvent: { startDate: new Date(0), type: 'volume', claims: [] }
});

describe('Avisos del clan', () => {
    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    test('al cambiar la semana se avisa del evento nuevo a cada miembro, y solo una vez', async () => {
        const [a, b] = [await crearUsuario(), await crearUsuario()];
        const clan = await crearClan([a, b]);

        await ponerAlDiaElEvento(clan);
        // Segunda vez (otro miembro abre el clan, o el cron repasa): nada nuevo
        await ponerAlDiaElEvento(await Clan.findById(clan._id));
        await ponerAlDiaElEvento(await Clan.findById(clan._id));

        const avisos = await Notification.find({ type: 'clan' }).lean();
        assert.strictEqual(avisos.length, 2, 'un aviso por miembro, y nada mas');
        assert.deepStrictEqual(avisos.map(x => x.user.toString()).sort(), [a._id, b._id].map(String).sort());
        assert.match(avisos[0].text, /Empieza el evento/);
        assert.strictEqual(avisos[0].read, false);

        const guardado = await Clan.findById(clan._id).lean();
        assert.strictEqual(guardado.weeklyEvent.startDate.getTime(), getCurrentWeekStart().getTime());
        assert.strictEqual(guardado.weeklyEvent.avisado, true);
    });

    test('al llegar a un escalon se avisa del premio; el mismo escalon no se repite; uno nuevo si', async () => {
        const [a, b] = [await crearUsuario(), await crearUsuario()];
        const clan = await crearClan([a, b]);
        const { weekStart } = await ponerAlDiaElEvento(clan);
        await Notification.deleteMany({});
        const tiers = buildTiers(10000);   // Bronce 1000, Plata 5000, Oro 10000...

        assert.strictEqual(await avisarHitos(clan, weekStart, tiers, 500), null, 'sin llegar a nada, sin aviso');
        assert.strictEqual(await avisarHitos(clan, weekStart, tiers, 1200), 1, 'Bronce alcanzado');
        assert.strictEqual(await avisarHitos(clan, weekStart, tiers, 1300), null, 'Bronce ya avisado');
        assert.strictEqual((await Notification.countDocuments({ type: 'clan' })), 2, 'un aviso por miembro');
        assert.match((await Notification.findOne({ type: 'clan' })).text, /Bronce/);

        // De golpe se pasan Plata y Oro: un solo aviso, el de Oro, y quedan marcados los dos
        assert.strictEqual(await avisarHitos(clan, weekStart, tiers, 10500), 3);
        assert.strictEqual((await Notification.countDocuments({ type: 'clan' })), 4);
        const guardado = await Clan.findById(clan._id).lean();
        assert.deepStrictEqual([...guardado.weeklyEvent.hitosAvisados].sort(), [1, 2, 3]);
        assert.strictEqual(await avisarHitos(clan, weekStart, tiers, 11000), null, 'todo lo alcanzado ya estaba avisado');
    });

    test('la semana nueva vuelve a poner a cero los escalones avisados', async () => {
        const a = await crearUsuario();
        const clan = await crearClan([a]);
        const { weekStart } = await ponerAlDiaElEvento(clan);
        await avisarHitos(clan, weekStart, buildTiers(1000), 200);
        assert.deepStrictEqual((await Clan.findById(clan._id).lean()).weeklyEvent.hitosAvisados, [1]);

        // Se simula que el evento guardado es de la semana pasada
        await Clan.updateOne({ _id: clan._id }, { $set: { 'weeklyEvent.startDate': new Date(0) } });
        await ponerAlDiaElEvento(await Clan.findById(clan._id));
        const guardado = await Clan.findById(clan._id).lean();
        assert.deepStrictEqual(guardado.weeklyEvent.hitosAvisados, []);
        assert.strictEqual(guardado.weeklyEvent.avisado, true);
        assert.strictEqual(await Notification.countDocuments({ type: 'clan', text: /Empieza/ }), 2, 'dos semanas, dos avisos de inicio');
    });
});
