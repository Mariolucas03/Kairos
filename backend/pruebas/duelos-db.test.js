const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar, fingirPeticion } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const Challenge = require('../models/Challenge');
const WorkoutLog = require('../models/WorkoutLog');
const Notification = require('../models/Notification');
const DailyLog = require('../models/DailyLog');
const { getMadridDateString } = require('../utils/dateHelpers');

const { createChallenge, respondChallenge, getChallenges, deleteChallenge } = require('../controllers/challengeController');
const { resolverDuelos, finDelDuelo } = require('../services/duelosService');

/**
 * LOS DUELOS, DE PRINCIPIO A FIN
 *
 * ⚠️ ANTES NO TERMINABAN NUNCA.
 *
 * Se podía retar a un amigo y él podía aceptar. Ahí se acababa: nada ponía
 * ganador, nada ponía fecha de fin, y la apuesta se comprobaba pero no se
 * cobraba jamás. Los duelos se quedaban activos para siempre y las fichas no se
 * movían ni un céntimo.
 *
 * ⚠️ AQUÍ HAY DINERO, Y POR ESO ESTAS PRUEBAS VAN CONTRA UNA BASE DE VERDAD.
 *
 * Todo lo que puede salir mal en un duelo es de contabilidad: cobrar dos veces,
 * no cobrar, pagar dos veces el mismo bote, o borrar el documento con las fichas
 * de los dos dentro. Nada de eso se puede demostrar con funciones puras, porque
 * el fallo vive precisamente en el orden de las escrituras.
 *
 * La regla que se comprueba una y otra vez es la misma: LAS FICHAS NI SE CREAN
 * NI SE DESTRUYEN. Lo que sale de uno entra en el otro, y el total de los dos
 * jugadores más lo retenido en el duelo es siempre el mismo número.
 */

let siguiente = 0;
const crearUsuario = async (fichas = 1000) => {
    siguiente++;
    return User.create({
        username: `duelista${siguiente}`,
        email: `duelista${siguiente}@kairos.test`,
        password: 'da-igual',
        gameCoins: fichas
    });
};

/** Dos amigos, que es el único caso en que se puede retar. */
const dosAmigos = async (fichasA = 1000, fichasB = 1000) => {
    const a = await crearUsuario(fichasA);
    const b = await crearUsuario(fichasB);
    await User.updateOne({ _id: a._id }, { $push: { friends: b._id } });
    await User.updateOne({ _id: b._id }, { $push: { friends: a._id } });
    return [await User.findById(a._id), await User.findById(b._id)];
};

const fichasDe = async (user) => (await User.findById(user._id).select('gameCoins').lean()).gameCoins;

const retar = async (yo, rival, apuesta = 100) => {
    const p = fingirPeticion({ user: yo, body: { opponentId: String(rival._id), type: 'gym', betAmount: apuesta } });
    await createChallenge(p.req, p.res);
    return p.res;
};

/**
 * Los avisos se mandan SUELTOS, sin `await`: el reto ya esta creado y un aviso
 * perdido no puede convertirse en un error que haga pensar que no se ha enviado.
 * Eso es correcto en produccion y obliga a esperar aqui, porque si no la prueba
 * mira el buzon antes de que se haya escrito nada.
 */
const esperarAvisos = () => new Promise(r => setImmediate(() => setImmediate(r)));

const responder = async (yo, duelo, action) => {
    const p = fingirPeticion({ user: yo, body: { challengeId: String(duelo._id), action } });
    await respondChallenge(p.req, p.res);
    return p.res;
};

/** Un entreno con el volumen que se pida, en la fecha que se pida. */
const entrenar = (userId, kilos, fecha) => WorkoutLog.create({
    user: userId,
    type: 'gym',
    routineName: 'Torso',
    duration: 3600,
    date: fecha,
    // 1 repetición del peso que haga falta: `volumenDe` multiplica peso por reps.
    exercises: [{ name: 'Press Banca', muscle: 'Pecho', sets: [{ weight: kilos, reps: 1 }] }]
});

describe('Duelos: la apuesta se cobra de verdad', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); siguiente = 0; });

    test('retar no cuesta nada todavía: solo aceptar cobra', async () => {
        const [yo, rival] = await dosAmigos();

        await retar(yo, rival, 100);

        // Mientras el otro no conteste no hay duelo, y cobrar por un reto que
        // puede que nunca se juegue sería quitarle fichas por nada.
        assert.strictEqual(await fichasDe(yo), 1000);
        assert.strictEqual(await fichasDe(rival), 1000);
    });

    test('EL FALLO: aceptar tiene que quitar las fichas a LOS DOS', async () => {
        const [yo, rival] = await dosAmigos();
        const res = await retar(yo, rival, 100);
        const duelo = res.enviado;

        await responder(rival, duelo, 'accept');

        assert.strictEqual(await fichasDe(yo), 900, 'al retador no le han cobrado');
        assert.strictEqual(await fichasDe(rival), 900, 'al retado no le han cobrado');

        const guardado = await Challenge.findById(duelo._id).lean();
        assert.strictEqual(guardado.status, 'active');
        assert.ok(guardado.startDate, 'sin fecha de inicio no hay periodo que medir');
        assert.ok(guardado.endDate, 'sin fecha de fin el duelo no termina nunca');
    });

    test('aceptar devuelve el usuario con el saldo ya actualizado', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;

        const res = await responder(rival, duelo, 'accept');

        // ⚠️ La cabecera de la pantalla enseña las fichas. Si la respuesta no
        // trae el usuario, el móvil tendría que restar la apuesta por su cuenta:
        // la misma cuenta en dos sitios, y con que el servidor rechazara el
        // cobro estaría enseñando un saldo que no es el tuyo.
        assert.ok(res.enviado.user, 'la respuesta no trae el usuario');
        assert.strictEqual(res.enviado.user.gameCoins, 900);
        assert.strictEqual(res.enviado.user.password, undefined, 'la contraseña no sale de aquí');
    });

    test('los siete días empiezan al ACEPTAR, no al retar', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival)).enviado;

        await responder(rival, duelo, 'accept');
        const guardado = await Challenge.findById(duelo._id).lean();

        // Si contara desde el reto, quien tarda un día en contestar empezaría
        // perdiendo un día.
        assert.strictEqual(
            guardado.endDate.getTime(),
            finDelDuelo(guardado.startDate).getTime()
        );
    });

    test('aceptar dos veces no cobra dos veces', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;

        await responder(rival, duelo, 'accept');
        // Un segundo toque al botón en un móvil lento. Sin la condición dentro
        // del filtro, el saldo se iría bajando en cada toque.
        await assert.rejects(() => responder(rival, duelo, 'accept'));

        assert.strictEqual(await fichasDe(yo), 900);
        assert.strictEqual(await fichasDe(rival), 900);
    });

    test('sin fichas no se acepta, y el duelo sigue esperando', async () => {
        const [yo, rival] = await dosAmigos(1000, 50);
        const duelo = (await retar(yo, rival, 100)).enviado;

        await assert.rejects(() => responder(rival, duelo, 'accept'), /no te llegan las fichas/i);

        // Ni se le cobra al retador ni se pierde el duelo: si el retado consigue
        // fichas, todavía puede aceptarlo.
        assert.strictEqual(await fichasDe(yo), 1000);
        assert.strictEqual(await fichasDe(rival), 50);
        assert.strictEqual((await Challenge.findById(duelo._id).lean()).status, 'pending');
    });

    test('si el RETADOR se gastó las suyas mientras tanto, se devuelve y se cancela', async () => {
        const [yo, rival] = await dosAmigos(1000, 1000);
        const duelo = (await retar(yo, rival, 100)).enviado;

        // Entre retar y que le contesten pasan días, y en ese rato ha podido
        // perderlas en el casino. La comprobación del momento de retar caduca.
        await User.updateOne({ _id: yo._id }, { $set: { gameCoins: 10 } });

        await assert.rejects(() => responder(rival, duelo, 'accept'), /ya no tiene fichas/i);

        // Lo importante: al retado se le devuelve lo suyo. Si no, el duelo se
        // cancela y él ha pagado por nada.
        assert.strictEqual(await fichasDe(rival), 1000, 'no le han devuelto la apuesta');
        assert.strictEqual(await Challenge.countDocuments(), 0, 'el duelo imposible sigue ahí');
    });

    test('⚠️ QUE TE RETEN TIENE QUE NOTARSE', async () => {
        const [yo, rival] = await dosAmigos();
        await retar(yo, rival, 100);
        await esperarAvisos();

        // Antes no se creaba ningún aviso. Un reto se queda esperando en una
        // pantalla en la que hay que entrar a propósito, así que el retado no se
        // enteraba nunca y el duelo se moría solo: el que reta cree que pasan de
        // él, y el otro ni lo ha visto.
        const avisos = await Notification.find({ type: 'reto' }).lean();
        assert.strictEqual(avisos.length, 1);
        assert.strictEqual(avisos[0].user.toString(), rival._id.toString(), 'el aviso no es para el retado');
        assert.strictEqual(avisos[0].actor.toString(), yo._id.toString());
    });

    test('el aviso del reto se va en cuanto contestas', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;
        await esperarAvisos();
        assert.strictEqual(await Notification.countDocuments({ type: 'reto' }), 1);

        await responder(rival, duelo, 'accept');
        await esperarAvisos();

        // Ese aviso pide que hagas algo, y ya lo has hecho. Dejarlo en el buzón
        // sería tenerte pidiendo una respuesta que ya diste.
        assert.strictEqual(await Notification.countDocuments({ type: 'reto' }), 0);
    });

    test('rechazarlo también se lleva el aviso', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;
        await esperarAvisos();

        await responder(rival, duelo, 'reject');
        await esperarAvisos();

        assert.strictEqual(await Notification.countDocuments({ type: 'reto' }), 0);
    });

    test('solo se puede retar a un amigo', async () => {
        const yo = await crearUsuario();
        const desconocido = await crearUsuario();

        // La pantalla solo lo ofrece desde la lista de amigos, pero la ruta
        // aceptaba cualquier id: sin esto se le podía llenar el buzón a nadie.
        await assert.rejects(() => retar(yo, desconocido), /solo puedes retar a tus amigos/i);
    });

    test('un duelo cada vez con la misma persona', async () => {
        const [yo, rival] = await dosAmigos();
        await retar(yo, rival);

        // Con varios a la vez, los siete días se solapan y los MISMOS kilos
        // contarían para dos duelos distintos.
        await assert.rejects(() => retar(yo, rival), /ya hay un duelo/i);
        await assert.rejects(() => retar(rival, yo), /ya hay un duelo/i);
    });
});

describe('Duelos: quién gana y quién cobra', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); siguiente = 0; });

    /** Un duelo aceptado y ya vencido, listo para que lo cierre la noche. */
    const dueloVencido = async (apuesta = 100, fichasA = 1000, fichasB = 1000) => {
        const [yo, rival] = await dosAmigos(fichasA, fichasB);
        const duelo = (await retar(yo, rival, apuesta)).enviado;
        await responder(rival, duelo, 'accept');

        // Se mueven las fechas al pasado para no tener que esperar una semana.
        const inicio = new Date(Date.now() - 8 * 86400000);
        await Challenge.updateOne({ _id: duelo._id },
            { $set: { startDate: inicio, endDate: finDelDuelo(inicio) } });

        return { yo, rival, duelo, inicio };
    };

    test('gana el que más kilos movió, y se lleva el bote entero', async () => {
        const { yo, rival, inicio } = await dueloVencido(100);
        const dentro = new Date(inicio.getTime() + 86400000);

        await entrenar(yo._id, 5000, dentro);
        await entrenar(rival._id, 3000, dentro);

        const resumen = await resolverDuelos();
        assert.strictEqual(resumen.cerrados, 1);
        assert.strictEqual(resumen.pagados, 1);

        // 900 que le quedaban + 200 de bote.
        assert.strictEqual(await fichasDe(yo), 1100, 'el ganador no ha cobrado el bote');
        assert.strictEqual(await fichasDe(rival), 900, 'al perdedor le han devuelto algo');
    });

    test('las fichas ni se crean ni se destruyen', async () => {
        const { yo, rival, inicio } = await dueloVencido(250);
        await entrenar(yo._id, 1000, new Date(inicio.getTime() + 3600000));

        await resolverDuelos();

        // Es la regla que lo resume todo: entre los dos siguen teniendo lo
        // mismo que al empezar. Si esta suma cambia, el casino se ha roto.
        assert.strictEqual(await fichasDe(yo) + await fichasDe(rival), 2000);
    });

    test('empate: cada uno recupera lo suyo', async () => {
        const { yo, rival, inicio } = await dueloVencido(100);
        const dentro = new Date(inicio.getTime() + 86400000);

        await entrenar(yo._id, 4000, dentro);
        await entrenar(rival._id, 4000, dentro);

        await resolverDuelos();

        assert.strictEqual(await fichasDe(yo), 1000);
        assert.strictEqual(await fichasDe(rival), 1000);

        const cerrado = await Challenge.findOne().lean();
        assert.strictEqual(cerrado.winner, null);
        assert.ok(cerrado.resueltoEn, 'sin `resueltoEn` no se distingue un empate de un duelo sin mirar');
    });

    test('si no entrena NINGUNO es empate, no gana el retador', async () => {
        const { yo, rival } = await dueloVencido(100);

        await resolverDuelos();

        // 0 a 0. Cobrar por no hacer nada sería premiar justo lo contrario de
        // lo que la app intenta.
        assert.strictEqual(await fichasDe(yo), 1000);
        assert.strictEqual(await fichasDe(rival), 1000);
    });

    test('los entrenos de FUERA del periodo no cuentan', async () => {
        const { yo, rival, inicio } = await dueloVencido(100);

        // El retador movió una barbaridad, pero antes de que empezara el duelo.
        await entrenar(yo._id, 99000, new Date(inicio.getTime() - 86400000));
        await entrenar(rival._id, 1000, new Date(inicio.getTime() + 86400000));

        await resolverDuelos();

        assert.strictEqual(await fichasDe(rival), 1100, 'ha ganado quien entrenó fuera de plazo');
    });

    test('un duelo que aún no ha vencido no se toca', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;
        await responder(rival, duelo, 'accept');

        const resumen = await resolverDuelos();

        assert.strictEqual(resumen.cerrados, 0);
        assert.strictEqual((await Challenge.findById(duelo._id).lean()).status, 'active');
        assert.strictEqual(await fichasDe(yo), 900, 'le han devuelto la apuesta antes de tiempo');
    });

    test('⚠️ PASAR DOS VECES NO PAGA DOS VECES', async () => {
        const { yo, rival, inicio } = await dueloVencido(100);
        await entrenar(yo._id, 5000, new Date(inicio.getTime() + 86400000));

        await resolverDuelos();
        const trasLaPrimera = await fichasDe(yo);

        // Render reinicia la instancia a menudo y hay una puesta al día al
        // arrancar. Sin la marca `pagado`, cada pasada regalaría otro bote: eso
        // no es un fallo de pantalla, es fabricar fichas de la nada.
        const segunda = await resolverDuelos();

        assert.strictEqual(segunda.pagados, 0);
        assert.strictEqual(await fichasDe(yo), trasLaPrimera, 'el bote se ha pagado dos veces');
    });

    test('⚠️ NI AUNQUE DOS PASADAS COINCIDAN EN EL TIEMPO', async () => {
        const { yo, rival, inicio } = await dueloVencido(100);
        await entrenar(yo._id, 5000, new Date(inicio.getTime() + 86400000));

        // ESTE es el caso que de verdad protege la marca `pagado`, y la prueba
        // de arriba NO lo cubría: en la segunda pasada el duelo ya está cerrado
        // y pagado, así que no aparece en ninguna consulta y no se llega a
        // tocar la marca. Lo enseñó la comprobación por mutación —quitar el
        // guardia dejaba las 22 en verde—.
        //
        // Hay que atacar el RESCATE, no el cierre. Cerrar ya tiene su propio
        // guardia (`status: 'active'` dentro del filtro), así que dos pasadas
        // sobre un duelo vencido solo lo cierran una vez aunque falte esta
        // marca. El hueco de verdad está en el duelo que se cerró y cuyo pago
        // se quedó a medias, que es justo el que el rescate va a buscar.
        await Challenge.updateOne({}, {
            $set: { status: 'finished', winner: yo._id, pagado: false, resueltoEn: new Date() }
        });

        // El mantenimiento nocturno y la puesta al día del arranque, con Render
        // reiniciando la instancia. Los dos lo ven pendiente de pago a la vez.
        await Promise.all([resolverDuelos(), resolverDuelos()]);

        // Se paga UNA vez: 900 que le quedaban + los 200 del bote.
        assert.strictEqual(await fichasDe(yo), 1100, 'el bote se ha pagado dos veces');
        assert.strictEqual(await fichasDe(yo) + await fichasDe(rival), 2000);
    });

    test('un duelo cerrado sin pagar se rescata en la siguiente pasada', async () => {
        const { yo, rival, inicio } = await dueloVencido(100);
        await entrenar(yo._id, 5000, new Date(inicio.getTime() + 86400000));

        // Se simula un reinicio JUSTO entre cerrar y pagar: el duelo queda
        // terminado y las fichas de los dos, retenidas para siempre.
        await Challenge.updateOne({}, {
            $set: { status: 'finished', winner: yo._id, pagado: false, resueltoEn: new Date() }
        });

        const resumen = await resolverDuelos();

        assert.strictEqual(resumen.rescatados, 1);
        assert.strictEqual(await fichasDe(yo), 1100, 'las fichas se han quedado atrapadas');
    });

    test('al cerrarse avisa a los dos', async () => {
        const { yo, rival, inicio } = await dueloVencido(100);
        await entrenar(yo._id, 5000, new Date(inicio.getTime() + 86400000));

        await resolverDuelos();

        const avisos = await Notification.find({ type: 'duelo' }).lean();
        assert.strictEqual(avisos.length, 2, 'el resultado tiene que llegarle a los dos');
        // También al que perdió: enterarse es parte del juego.
        const paraQuien = avisos.map(a => a.user.toString()).sort();
        assert.deepStrictEqual(paraQuien, [yo._id.toString(), rival._id.toString()].sort());
    });
});

describe('Duelos: cada tipo mide lo suyo', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); siguiente = 0; });

    /** Un duelo del tipo que se pida, aceptado y ya vencido. */
    const dueloDe = async (tipo, apuesta = 100) => {
        const [yo, rival] = await dosAmigos();
        const p = fingirPeticion({ user: yo, body: { opponentId: String(rival._id), type: tipo, betAmount: apuesta } });
        await createChallenge(p.req, p.res);
        const duelo = p.res.enviado;
        await responder(rival, duelo, 'accept');

        const inicio = new Date(Date.now() - 8 * 86400000);
        await Challenge.updateOne({ _id: duelo._id },
            { $set: { startDate: inicio, endDate: finDelDuelo(inicio) } });

        return { yo, rival, inicio };
    };

    /** Un día del usuario con la XP y las misiones que se le digan. */
    const diaDe = (userId, fecha, { xp = 0, misiones = 0 }) => DailyLog.create({
        user: userId,
        date: getMadridDateString(fecha),
        gains: { xp, coins: 0, lives: 0 },
        missionStats: { completed: misiones, total: 3, listCompleted: [] }
    });

    test('un tipo de duelo inventado se rechaza', async () => {
        const [yo, rival] = await dosAmigos();
        const p = fingirPeticion({ user: yo, body: { opponentId: String(rival._id), type: 'pasos', betAmount: 50 } });

        // Los pasos y los kilómetros salen de una casilla donde tecleas un
        // número. Con una apuesta de por medio eso es "quién escribe más".
        await assert.rejects(() => createChallenge(p.req, p.res), /no existe/i);
    });

    test('ENTRENOS: gana quien más veces fue, no quien más levantó', async () => {
        const { yo, rival, inicio } = await dueloDe('entrenos');
        const d = (n) => new Date(inicio.getTime() + n * 86400000);

        // El rival mueve MUCHÍSIMO más peso, pero en una sola sesión. En un
        // duelo de kilos ganaría de calle; aquí lo que cuenta es aparecer.
        await entrenar(rival._id, 50000, d(1));
        await entrenar(yo._id, 100, d(1));
        await entrenar(yo._id, 100, d(2));
        await entrenar(yo._id, 100, d(3));

        await resolverDuelos();

        assert.strictEqual(await fichasDe(yo), 1100, 'no ha ganado quien más entrenó');
        const cerrado = await Challenge.findOne().lean();
        assert.strictEqual(cerrado.volumenChallenger, 3, 'se están contando kilos, no sesiones');
        assert.strictEqual(cerrado.volumenOpponent, 1);
    });

    test('XP: suma la de todos los días del duelo', async () => {
        const { yo, rival, inicio } = await dueloDe('xp');
        const d = (n) => new Date(inicio.getTime() + n * 86400000);

        await diaDe(yo._id, d(1), { xp: 300 });
        await diaDe(yo._id, d(2), { xp: 250 });
        await diaDe(rival._id, d(1), { xp: 400 });

        await resolverDuelos();

        const cerrado = await Challenge.findOne().lean();
        assert.strictEqual(cerrado.volumenChallenger, 550);
        assert.strictEqual(cerrado.volumenOpponent, 400);
        assert.strictEqual(await fichasDe(yo), 1100);
    });

    test('XP: los días de FUERA del duelo no cuentan', async () => {
        const { yo, rival, inicio } = await dueloDe('xp');

        // Un día antes de empezar y otro después de acabar. Ninguno es suyo.
        await diaDe(yo._id, new Date(inicio.getTime() - 86400000), { xp: 9999 });
        await diaDe(yo._id, new Date(inicio.getTime() + 9 * 86400000), { xp: 9999 });
        await diaDe(rival._id, new Date(inicio.getTime() + 86400000), { xp: 10 });

        await resolverDuelos();

        const cerrado = await Challenge.findOne().lean();
        assert.strictEqual(cerrado.volumenChallenger, 0, 'ha contado XP de fuera del plazo');
        assert.strictEqual(await fichasDe(rival), 1100);
    });

    test('MISIONES: se cuentan las completadas de cada día', async () => {
        const { yo, rival, inicio } = await dueloDe('misiones');
        const d = (n) => new Date(inicio.getTime() + n * 86400000);

        await diaDe(yo._id, d(1), { misiones: 3 });
        await diaDe(yo._id, d(2), { misiones: 2 });
        await diaDe(rival._id, d(1), { misiones: 3 });
        await diaDe(rival._id, d(2), { misiones: 3 });

        await resolverDuelos();

        const cerrado = await Challenge.findOne().lean();
        assert.strictEqual(cerrado.volumenChallenger, 5);
        assert.strictEqual(cerrado.volumenOpponent, 6);
        assert.strictEqual(await fichasDe(rival), 1100, 'no ha ganado quien más misiones hizo');
    });

    test('cada tipo mira SU dato y no el de al lado', async () => {
        // Un duelo de XP no puede fijarse en los kilos: si lo hiciera, entrenar
        // ganaría un duelo de misiones y la app estaría midiendo otra cosa
        // distinta de la que te prometió al aceptar.
        const { yo, rival, inicio } = await dueloDe('xp');
        const dentro = new Date(inicio.getTime() + 86400000);

        await entrenar(yo._id, 99000, dentro);          // muchos kilos, cero XP
        await diaDe(rival._id, dentro, { xp: 5 });      // nada de gimnasio, 5 XP

        await resolverDuelos();

        assert.strictEqual(await fichasDe(rival), 1100, 'el duelo de XP está mirando los kilos');
    });

    test('EL MARCADOR EN VIVO: un duelo en marcha dice cómo va', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;
        await responder(rival, duelo, 'accept');

        await entrenar(yo._id, 4000, new Date());
        await entrenar(rival._id, 2500, new Date());

        const p = fingirPeticion({ user: { ...yo.toObject(), id: String(yo._id) } });
        await getChallenges(p.req, p.res);
        const enMarcha = p.res.enviado.duelos.find(d => d.status === 'active');

        // ⚠️ Sin esto, un duelo son siete días sin que pase nada: aceptas y no
        // sabes nada hasta la última noche. Lo que hace volver al gimnasio es
        // ver que vas por detrás y que quedan tres días.
        assert.ok(enMarcha.marcador, 'un duelo en marcha no dice cómo va');
        assert.strictEqual(enMarcha.marcador.retador, 4000);
        assert.strictEqual(enMarcha.marcador.rival, 2500);
        assert.strictEqual(enMarcha.marcador.unidad, 'kg');
    });

    test('el marcador en vivo usa la MISMA cuenta que reparte el bote', async () => {
        const { yo, rival, inicio } = await dueloDe('xp');
        const dentro = new Date(inicio.getTime() + 86400000);
        await diaDe(yo._id, dentro, { xp: 700 });
        await diaDe(rival._id, dentro, { xp: 300 });

        // Se mira el marcador ANTES de cerrarlo...
        const p = fingirPeticion({ user: { ...yo.toObject(), id: String(yo._id) } });
        await getChallenges(p.req, p.res);
        const antes = p.res.enviado.duelos.find(d => d.status === 'active').marcador;

        // ...y los números guardados DESPUÉS.
        await resolverDuelos();
        const cerrado = await Challenge.findOne().lean();

        // Tienen que coincidir. Si el marcador que miras toda la semana no es el
        // que reparte el bote, la app te está enseñando un duelo distinto del
        // que estás jugando.
        assert.strictEqual(antes.retador, cerrado.volumenChallenger);
        assert.strictEqual(antes.rival, cerrado.volumenOpponent);
    });

    test('los pendientes y los terminados no traen marcador', async () => {
        const [yo, rival] = await dosAmigos();
        await retar(yo, rival, 100);

        const p = fingirPeticion({ user: { ...yo.toObject(), id: String(yo._id) } });
        await getChallenges(p.req, p.res);

        // Uno pendiente no ha empezado, así que no hay nada que contar, y
        // calcularlo serían dos consultas por duelo para pintar un cero.
        assert.strictEqual(p.res.enviado.duelos[0].marcador, undefined);
    });

    test('la lista dice qué se puede medir, para no escribirlo en el móvil', async () => {
        const [yo, rival] = await dosAmigos();
        await retar(yo, rival);

        const p = fingirPeticion({ user: { ...yo.toObject(), id: String(yo._id) } });
        await getChallenges(p.req, p.res);

        const medidas = p.res.enviado.medidas;
        assert.ok(Array.isArray(medidas) && medidas.length >= 4);
        for (const m of medidas) {
            assert.ok(m.clave && m.etiqueta && m.unidad, `medida incompleta: ${JSON.stringify(m)}`);
        }
        // Y las que se quitaron siguen fuera.
        const claves = medidas.map(m => m.clave);
        assert.ok(!claves.includes('steps') && !claves.includes('distance'));
    });
});

describe('Duelos: salirse a medias', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); siguiente = 0; });

    test('rechazar uno pendiente no cuesta nada', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;

        await responder(rival, duelo, 'reject');

        assert.strictEqual(await Challenge.countDocuments(), 0);
        assert.strictEqual(await fichasDe(yo), 1000);
        assert.strictEqual(await fichasDe(rival), 1000);
    });

    test('⚠️ HUIR DE UNO EMPEZADO NO PUEDE EVAPORAR LAS FICHAS', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;
        await responder(rival, duelo, 'accept');

        // Antes esto BORRABA el documento, y con él las fichas de los dos, que
        // están retenidas dentro. Desaparecían sin ir a ninguna parte.
        await responder(rival, duelo, 'flee');

        // Rendirse cuesta la apuesta: es lo que significa la palabra. El bote
        // entero es para el que se queda.
        assert.strictEqual(await fichasDe(yo), 1100, 'el que se queda no ha cobrado');
        assert.strictEqual(await fichasDe(rival), 900);
        assert.strictEqual(await fichasDe(yo) + await fichasDe(rival), 2000);

        const cerrado = await Challenge.findById(duelo._id).lean();
        assert.strictEqual(cerrado.status, 'finished');
        assert.strictEqual(cerrado.winner.toString(), yo._id.toString());
    });

    test('borrar un duelo en marcha no se permite', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;
        await responder(rival, duelo, 'accept');

        const p = fingirPeticion({ user: yo, params: { id: String(duelo._id) } });
        await assert.rejects(() => deleteChallenge(p.req, p.res), /ya está en marcha/i);

        assert.strictEqual(await Challenge.countDocuments(), 1);
    });

    test('el duelo de otras dos personas no se toca', async () => {
        const [yo, rival] = await dosAmigos();
        const duelo = (await retar(yo, rival, 100)).enviado;
        const cotilla = await crearUsuario();

        const p = fingirPeticion({ user: cotilla, body: { challengeId: String(duelo._id), action: 'accept' } });
        await assert.rejects(() => respondChallenge(p.req, p.res), /no es tuyo/i);
    });
});

describe('Duelos: lo que ve la pantalla', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); siguiente = 0; });

    test('la lista trae los tuyos y la duración desde el servidor', async () => {
        const [yo, rival] = await dosAmigos();
        await retar(yo, rival, 100);

        const p = fingirPeticion({ user: { ...yo.toObject(), id: String(yo._id) } });
        await getChallenges(p.req, p.res);

        assert.strictEqual(p.res.enviado.duelos.length, 1);
        // La pantalla necesita poder escribir "dura 7 días" en un duelo que aún
        // no ha empezado. Ese 7 escrito a mano en el móvil sería la regla en dos
        // sitios, y el día que cambie aquí la pantalla seguiría prometiendo una
        // semana.
        assert.strictEqual(typeof p.res.enviado.duracionDias, 'number');
        assert.ok(p.res.enviado.duracionDias > 0);
    });
});
