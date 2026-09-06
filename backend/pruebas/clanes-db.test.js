const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar, fingirPeticion } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const Clan = require('../models/Clan');
const {
    createClan, joinClan, leaveClan, kickMember, getMyClan, searchClans
} = require('../controllers/clanController');

/**
 * EL PODER DE LOS CLANES, CONTRA UNA BASE DE DATOS DE VERDAD
 *
 * `clan-poder.test.js` prueba la aritmetica: que sumar niveles da lo que tiene
 * que dar. Esto prueba el CONTROLADOR: que entrar, subir de nivel, salir y
 * expulsar dejan el numero donde debe quedarse.
 *
 * La diferencia importa. La prueba pura tuvo que reescribir a mano el contador
 * viejo para ensenar el fallo, asi que sigue en verde si manana alguien vuelve a
 * meter un `$inc: { totalPower: ... }` en `joinClan`. Esta no: aqui se entra al
 * clan de verdad y se mira lo que quedo guardado.
 */

const nivel = (n) => ({ level: n });

let siguiente = 0;
const crearUsuario = async (props = {}) => {
    siguiente++;
    return User.create({
        username: `probador${siguiente}`,
        email: `probador${siguiente}@kairos.test`,
        password: 'da-igual-no-se-usa',
        ...props
    });
};

const poderGuardado = async (clanId) =>
    (await Clan.findById(clanId).select('totalPower').lean()).totalPower;

describe('Clanes: el poder sale de la gente que hay dentro', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    test('EL FALLO: entras a nivel 3, subes a 8 y te vas — el clan no pierde poder que nunca tuvo', async () => {
        const fundador = await crearUsuario(nivel(10));
        const socio = await crearUsuario(nivel(3));

        // 1. El fundador crea el clan
        let p = fingirPeticion({ user: fundador, body: { name: 'Los Probadores' } });
        await createClan(p.req, p.res);
        const clanId = p.res.enviado._id;

        assert.strictEqual(await poderGuardado(clanId), 1000, 'uno de nivel 10 son 1000');

        // 2. Entra el de nivel 3
        p = fingirPeticion({ user: socio, params: { id: String(clanId) } });
        await joinClan(p.req, p.res);

        assert.strictEqual(await poderGuardado(clanId), 1300, '10 + 3 son 1300');

        // 3. Entrena dos meses DENTRO del clan y sube a nivel 8.
        //    Con el contador viejo, el clan no se enteraba de esto jamas.
        await User.findByIdAndUpdate(socio._id, { $set: { level: 8 } });

        const alDia = await User.findById(fundador._id);
        p = fingirPeticion({ user: alDia });
        await getMyClan(p.req, p.res);

        assert.strictEqual(p.res.enviado.totalPower, 1800, '10 + 8 son 1800: mirar el clan lo pone al dia');
        assert.strictEqual(await poderGuardado(clanId), 1800, 'y queda guardado, no solo pintado');

        // 4. Y ahora se va. El contador viejo restaba 8 x 100 de lo que habia
        //    sumado cuando era nivel 3: el clan se quedaba en 500.
        const socioAhora = await User.findById(socio._id);
        p = fingirPeticion({ user: socioAhora });
        await leaveClan(p.req, p.res);

        assert.strictEqual(await poderGuardado(clanId), 1000, 'queda el fundador de nivel 10: 1000');
    });

    test('con varias bajas el poder nunca se va por debajo de cero', async () => {
        const jefe = await crearUsuario(nivel(50));
        let p = fingirPeticion({ user: jefe, body: { name: 'Los Que Se Van' } });
        await createClan(p.req, p.res);
        const clanId = p.res.enviado._id;

        // Cinco entran de nivel 2 y se van de nivel 20, que es lo que pasa en un
        // clan que lleva un tiempo funcionando.
        for (let i = 0; i < 5; i++) {
            const quien = await crearUsuario(nivel(2));
            p = fingirPeticion({ user: quien, params: { id: String(clanId) } });
            await joinClan(p.req, p.res);

            await User.findByIdAndUpdate(quien._id, { $set: { level: 20 } });
            const alDia = await User.findById(quien._id);

            p = fingirPeticion({ user: alDia });
            await leaveClan(p.req, p.res);
        }

        const final = await poderGuardado(clanId);
        assert.ok(final >= 0, 'jamas negativo, salio ' + final);
        assert.strictEqual(final, 5000, 'queda el jefe de nivel 50 y nadie mas');
    });

    test('expulsar deja el poder de los que quedan, no el de quien se fue', async () => {
        const jefe = await crearUsuario(nivel(20));
        let p = fingirPeticion({ user: jefe, body: { name: 'Con Portero' } });
        await createClan(p.req, p.res);
        const clanId = p.res.enviado._id;

        const sobra = await crearUsuario(nivel(4));
        p = fingirPeticion({ user: sobra, params: { id: String(clanId) } });
        await joinClan(p.req, p.res);
        assert.strictEqual(await poderGuardado(clanId), 2400);

        // Sube de nivel dentro y luego lo echan
        await User.findByIdAndUpdate(sobra._id, { $set: { level: 15 } });

        const jefeAhora = await User.findById(jefe._id);
        p = fingirPeticion({ user: jefeAhora, body: { memberId: String(sobra._id) } });
        await kickMember(p.req, p.res);

        assert.strictEqual(await poderGuardado(clanId), 2000, 'queda solo el jefe de nivel 20');
    });

    test('un miembro fantasma no infla el poder del clan', async () => {
        // Una cuenta borrada a mano en la base deja su id en el array del clan.
        // Antes eso sumaba para siempre; ahora el repaso lo limpia.
        const jefe = await crearUsuario(nivel(10));
        let p = fingirPeticion({ user: jefe, body: { name: 'Con Fantasma' } });
        await createClan(p.req, p.res);
        const clanId = p.res.enviado._id;

        const muerto = await crearUsuario(nivel(30));
        p = fingirPeticion({ user: muerto, params: { id: String(clanId) } });
        await joinClan(p.req, p.res);
        assert.strictEqual(await poderGuardado(clanId), 4000);

        await User.deleteOne({ _id: muerto._id });

        // Mirar el clan ya corrige el PODER: los miembros llegan poblados y el
        // borrado no aparece entre ellos.
        const jefeAhora = await User.findById(jefe._id);
        p = fingirPeticion({ user: jefeAhora });
        await getMyClan(p.req, p.res);

        assert.strictEqual(await poderGuardado(clanId), 1000, 'el fantasma deja de contar');

        // Pero su id SIGUE en la lista de miembros: sacarlo de ahi es trabajo del
        // repaso, no de la pantalla. Se comprueba aparte a proposito — son dos
        // arreglos distintos y conviene saber cual de los dos se ha roto si un
        // dia falla esto.
        let clan = await Clan.findById(clanId).lean();
        assert.strictEqual(clan.members.length, 2, 'la pantalla no limpia la lista');

        // El explorador de clanes repasa todos, y ahi si cae.
        p = fingirPeticion({ user: jefeAhora });
        await searchClans(p.req, p.res);

        clan = await Clan.findById(clanId).lean();
        assert.strictEqual(clan.members.length, 1, 'el repaso lo saca de la lista');
        assert.strictEqual(clan.totalPower, 1000, 'y el poder sigue bien');
    });

    test('el que crea el clan tiene el poder de su nivel, no 100 fijo', async () => {
        const veterano = await crearUsuario(nivel(42));
        const p = fingirPeticion({ user: veterano, body: { name: 'Solitario' } });
        await createClan(p.req, p.res);

        assert.strictEqual(await poderGuardado(p.res.enviado._id), 4200);
    });
});
