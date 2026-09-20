const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');
const User = require('../models/User');
const Sabelotodo = require('../models/Sabelotodo');
const { PREGUNTAS, CATEGORIAS } = require('../data/preguntas');
const ctrl = require('../controllers/sabelotodoController');

/**
 * EL SABELOTODO: el banco de preguntas y la partida en pareja.
 */

describe('El banco de preguntas', () => {
    test('cada pregunta tiene cuatro opciones distintas, categoria conocida e id unico', () => {
        const ids = new Set();
        for (const p of PREGUNTAS) {
            assert.ok(CATEGORIAS[p.categoria], `categoria rara: ${p.categoria}`);
            assert.strictEqual(p.opciones.length, 4, p.texto);
            assert.strictEqual(new Set(p.opciones.map(o => o.trim().toLowerCase())).size, 4, `opciones repetidas en: ${p.texto}`);
            assert.ok(p.texto.trim().endsWith('?'), `sin interrogacion: ${p.texto}`);
            assert.ok(!ids.has(p.id)); ids.add(p.id);
        }
    });

    test('hay al menos veinte por categoria: una partida entera sin repetir', () => {
        for (const c of Object.keys(CATEGORIAS)) {
            assert.ok(PREGUNTAS.filter(p => p.categoria === c).length >= 20, c);
        }
    });

    test('al servirla, la correcta queda barajada y su posicion apuntada', () => {
        const partida = { coronas: [], usadas: [] };
        const posiciones = new Set();
        for (let i = 0; i < 60; i++) {
            const s = ctrl.siguientePregunta(partida);
            const original = PREGUNTAS.find(p => p.id === s.preguntaId);
            assert.strictEqual(s.opciones[s.correcta], original.opciones[0]);
            posiciones.add(s.correcta);
        }
        assert.ok(posiciones.size >= 3, 'la correcta siempre cae en el mismo sitio');
    });

    test('no elige categorias ya coronadas ni repite preguntas usadas', () => {
        const partida = { coronas: ['geografia', 'historia', 'ciencia', 'deporte', 'arte'], usadas: [] };
        for (let i = 0; i < 25; i++) {
            const s = ctrl.siguientePregunta(partida);
            assert.strictEqual(s.categoria, 'ocio');
            assert.ok(!partida.usadas.includes(s.preguntaId), 'repetida: ' + s.preguntaId);
            partida.usadas.push(s.preguntaId);
        }
    });
});

// Un `res` de mentira para llamar a los controladores sin Express
const llamar = async (fn, { user, params = {}, body = {} }) => {
    let estado = 200; let dato = null;
    const res = { status(c) { estado = c; return this; }, json(d) { dato = d; return this; } };
    try { await fn({ user, params, body }, res, (e) => { throw e; }); }
    catch (e) { return { estado: estado === 200 ? 500 : estado, error: e.message }; }
    return { estado, dato };
};

describe('La partida en pareja', () => {
    let a, b, c;
    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => {
        await limpiar();
        a = await User.create({ username: 'ana', email: 'ana@k.test', password: 'x', gameCoins: 0, currentXP: 0 });
        b = await User.create({ username: 'bea', email: 'bea@k.test', password: 'x', gameCoins: 0, currentXP: 0 });
        c = await User.create({ username: 'cai', email: 'cai@k.test', password: 'x', gameCoins: 0, currentXP: 0 });
        await User.updateOne({ _id: a._id }, { $set: { friends: [b._id, c._id] } });
        await User.updateOne({ _id: b._id }, { $set: { friends: [a._id, c._id] } });
        await User.updateOne({ _id: c._id }, { $set: { friends: [a._id, b._id] } });
    });

    const empezar = async () => {
        const c = await llamar(ctrl.crear, { user: a, body: { amigoId: b._id.toString() } });
        assert.strictEqual(c.estado, 201, c.error);
        const r = await llamar(ctrl.responderInvitacion, { user: b, params: { id: c.dato._id }, body: { respuesta: 'aceptar' } });
        assert.strictEqual(r.estado, 200, r.error);
        assert.strictEqual(r.dato.estado, 'activa');
        return c.dato._id;
    };

    // Contesta la pregunta en curso, bien o mal, leyendo la correcta de la base de datos
    const contestar = async (id, quien, bien) => {
        const p = await Sabelotodo.findById(id).lean();
        const correcta = p.enCurso.correcta;
        const opcion = bien ? correcta : (correcta + 1) % 4;
        return llamar(ctrl.contestar, { user: quien, params: { id }, body: { opcion } });
    };

    test('solo se invita a amigos, y una partida viva por pareja', async () => {
        const otro = await User.create({ username: 'dan', email: 'dan@k.test', password: 'x' });
        const mal = await llamar(ctrl.crear, { user: a, body: { amigoId: otro._id.toString() } });
        assert.strictEqual(mal.estado, 400);
        const id = await empezar();
        assert.ok(id);
        const dos = await llamar(ctrl.crear, { user: b, body: { amigoId: a._id.toString() } });
        assert.strictEqual(dos.estado, 400);
    });

    test('la pregunta viaja sin la correcta, solo a quien le toca, y no se repite al recargar', async () => {
        const id = await empezar();
        const noToca = await llamar(ctrl.girar, { user: b, params: { id } });
        assert.strictEqual(noToca.estado, 400);

        const g = await llamar(ctrl.girar, { user: a, params: { id } });
        assert.strictEqual(g.estado, 200, g.error);
        assert.strictEqual(g.dato.enCurso.opciones.length, 4);
        assert.strictEqual(g.dato.enCurso.correcta, undefined);

        const otraVez = await llamar(ctrl.girar, { user: a, params: { id } });
        assert.strictEqual(otraVez.dato.enCurso.preguntaId, g.dato.enCurso.preguntaId);

        const vistaB = await llamar(ctrl.verPartida, { user: b, params: { id } });
        assert.strictEqual(vistaB.dato.enCurso.texto, undefined, 'la companera no ve la pregunta');
        assert.strictEqual(vistaB.dato.meToca, false);
    });

    test('acertar da la corona y sigues; a las tres seguidas pasa el turno', async () => {
        const id = await empezar();
        for (let i = 0; i < 3; i++) {
            await llamar(ctrl.girar, { user: a, params: { id } });
            const r = await contestar(id, a, true);
            assert.strictEqual(r.estado, 200, r.error);
            assert.strictEqual(r.dato.resultado.acierto, true);
        }
        const p = await Sabelotodo.findById(id).lean();
        assert.strictEqual(p.coronas.length, 3);
        assert.strictEqual(p.turno, 1, 'tras tres seguidas le toca a la otra');
        assert.strictEqual(p.racha, 0);
        assert.strictEqual(p.vidas, 3);
    });

    test('fallar quita una vida al equipo y pasa el turno; a la tercera se pierde y hay consuelo', async () => {
        const id = await empezar();
        const turnos = [a, b, a];
        for (let i = 0; i < 3; i++) {
            await llamar(ctrl.girar, { user: turnos[i], params: { id } });
            const r = await contestar(id, turnos[i], false);
            assert.strictEqual(r.dato.resultado.acierto, false);
            assert.ok(r.dato.resultado.correcta);
        }
        const p = await Sabelotodo.findById(id).lean();
        assert.strictEqual(p.vidas, 0);
        assert.strictEqual(p.estado, 'perdida');
        const ana = await User.findById(a._id).lean();
        assert.strictEqual(ana.currentXP, ctrl.PREMIO_PERDER.xp);
    });

    test('con las seis coronas ganan los dos y cobran los dos lo mismo', async () => {
        const id = await empezar();
        // Sin fallar nunca: 3 seguidas ana, 3 seguidas bea = 6 coronas
        const turnos = [a, a, a, b, b, b];
        let ultima = null;
        for (const q of turnos) {
            await llamar(ctrl.girar, { user: q, params: { id } });
            ultima = await contestar(id, q, true);
            assert.strictEqual(ultima.estado, 200, ultima.error);
        }
        assert.strictEqual(ultima.dato.estado, 'ganada');
        assert.strictEqual(ultima.dato.coronas.length, 6);
        const [ana, bea] = await Promise.all([User.findById(a._id).lean(), User.findById(b._id).lean()]);
        // Con 250 XP suben de nivel, y subir regala fichas aparte: lo que se
        // comprueba es que las del premio estan y que las dos cobran igual.
        assert.ok(ana.gameCoins >= ctrl.PREMIO_GANAR.fichas);
        assert.strictEqual(ana.gameCoins, bea.gameCoins);
        assert.strictEqual(ana.level, 2);
        // Y no se puede seguir jugando
        const g = await llamar(ctrl.girar, { user: b, params: { id } });
        assert.strictEqual(g.estado, 400);
    });

    test('una pregunta solo se contesta una vez, y fuera de tiempo cuenta como fallo', async () => {
        const id = await empezar();
        await llamar(ctrl.girar, { user: a, params: { id } });
        const r1 = await contestar(id, a, true);
        assert.strictEqual(r1.estado, 200);
        const r2 = await llamar(ctrl.contestar, { user: a, params: { id }, body: { opcion: 0 } });
        assert.strictEqual(r2.estado, 400);

        await llamar(ctrl.girar, { user: a, params: { id } });
        await Sabelotodo.updateOne({ _id: id }, { $set: { 'enCurso.servidaEn': new Date(Date.now() - ctrl.TIEMPO_MS - 5000) } });
        const tarde = await contestar(id, a, true);
        assert.strictEqual(tarde.dato.resultado.acierto, false);
        assert.strictEqual(tarde.dato.resultado.aTiempo, false);
        assert.strictEqual(tarde.dato.vidas, 2);
    });

    test('en equipo de tres: se empieza cuando todos han contestado y el turno va rotando', async () => {
        const cr = await llamar(ctrl.crear, { user: a, body: { amigosIds: [b._id.toString(), c._id.toString()] } });
        assert.strictEqual(cr.estado, 201, cr.error);
        assert.strictEqual(cr.dato.pendientes.length, 2);
        assert.strictEqual(cr.dato.puedeEmpezar, false, 'sin nadie dentro no se puede empezar');

        const r1 = await llamar(ctrl.responderInvitacion, { user: b, params: { id: cr.dato._id }, body: { respuesta: 'aceptar' } });
        assert.strictEqual(r1.dato.estado, 'invitacion', 'falta cai por contestar');
        const vistaA = await llamar(ctrl.verPartida, { user: a, params: { id: cr.dato._id } });
        assert.strictEqual(vistaA.dato.puedeEmpezar, true, 'con dos dentro, ana ya puede arrancar sin esperar');

        const r2 = await llamar(ctrl.responderInvitacion, { user: c, params: { id: cr.dato._id }, body: { respuesta: 'aceptar' } });
        assert.strictEqual(r2.dato.estado, 'activa', 'al contestar el ultimo, arranca sola');
        assert.strictEqual(r2.dato.jugadores.length, 3);

        // Turno: ana -> bea -> cai -> ana
        const id = cr.dato._id;
        const quienToca = async () => (await Sabelotodo.findById(id).lean()).turno;
        assert.strictEqual(await quienToca(), 0);
        await llamar(ctrl.girar, { user: a, params: { id } });
        await contestar(id, a, false);
        assert.strictEqual(await quienToca(), 1);
        await llamar(ctrl.girar, { user: b, params: { id } });
        await contestar(id, b, true); await llamar(ctrl.girar, { user: b, params: { id } });
        await contestar(id, b, true); await llamar(ctrl.girar, { user: b, params: { id } });
        await contestar(id, b, true);
        assert.strictEqual(await quienToca(), 2, 'tras tres seguidas de bea le toca a cai');
        await llamar(ctrl.girar, { user: c, params: { id } });
        await contestar(id, c, false);
        assert.strictEqual(await quienToca(), 0, 'y de cai vuelve a ana');
    });

    test('si uno de tres se va, los otros dos siguen; si sois dos, se acaba', async () => {
        const cr = await llamar(ctrl.crear, { user: a, body: { amigosIds: [b._id.toString(), c._id.toString()] } });
        const id = cr.dato._id;
        await llamar(ctrl.responderInvitacion, { user: b, params: { id }, body: { respuesta: 'aceptar' } });
        await llamar(ctrl.responderInvitacion, { user: c, params: { id }, body: { respuesta: 'aceptar' } });
        // Le toca a ana y tiene una pregunta en el aire: se va
        await llamar(ctrl.girar, { user: a, params: { id } });
        const fuera = await llamar(ctrl.abandonar, { user: a, params: { id } });
        assert.strictEqual(fuera.dato.estado, 'activa');
        const p = await Sabelotodo.findById(id).lean();
        assert.strictEqual(p.jugadores.length, 2);
        assert.strictEqual(p.jugadores[p.turno].nombre, 'bea', 'el turno pasa al siguiente');
        assert.strictEqual(p.enCurso, null, 'la pregunta en el aire se descarta');
        assert.strictEqual(p.vidas, 3, 'sin castigo');
        const fuera2 = await llamar(ctrl.abandonar, { user: b, params: { id } });
        assert.strictEqual(fuera2.dato.estado, 'abandonada');
    });

    test('el creador arranca sin esperar, y los que no contestaron se quedan fuera', async () => {
        const cr = await llamar(ctrl.crear, { user: a, body: { amigosIds: [b._id.toString(), c._id.toString()] } });
        const id = cr.dato._id;
        const pronto = await llamar(ctrl.empezar, { user: a, params: { id } });
        assert.strictEqual(pronto.estado, 400, 'sin nadie dentro, no');
        await llamar(ctrl.responderInvitacion, { user: b, params: { id }, body: { respuesta: 'aceptar' } });
        const ya = await llamar(ctrl.empezar, { user: a, params: { id } });
        assert.strictEqual(ya.dato.estado, 'activa');
        assert.strictEqual(ya.dato.jugadores.length, 2);
        assert.strictEqual(ya.dato.pendientes.length, 0);
        assert.strictEqual(await ctrl.pendientesDe(c._id), 0, 'a cai ya no le cuenta la invitacion');
    });

    test('los pendientes cuentan invitaciones y partidas en las que te toca', async () => {
        const c = await llamar(ctrl.crear, { user: a, body: { amigoId: b._id.toString() } });
        assert.strictEqual(await ctrl.pendientesDe(b._id), 1, 'una invitacion');
        assert.strictEqual(await ctrl.pendientesDe(a._id), 0);
        await llamar(ctrl.responderInvitacion, { user: b, params: { id: c.dato._id }, body: { respuesta: 'aceptar' } });
        assert.strictEqual(await ctrl.pendientesDe(a._id), 1, 'le toca a ana');
        assert.strictEqual(await ctrl.pendientesDe(b._id), 0);
    });
});
