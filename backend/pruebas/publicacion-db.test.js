const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar, fingirPeticion } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const { getPublicacion } = require('../controllers/socialController');

/**
 * UNA PUBLICACION SUELTA (la que abre una notificacion)
 *
 * ⚠️ ESTO ES UNA URL DIRECTA, Y ESO CAMBIA LAS REGLAS.
 *
 * El feed ya filtra por amistad, asi que ahi la privacidad estaba resuelta. Pero
 * `/social/workout/<id>` se puede escribir a mano: sin comprobar nada, cualquiera
 * con el id de un entreno podria leer el de una cuenta privada.
 *
 * Y se responde 404 en vez de 403 cuando no puedes verla. Un 403 diria "existe,
 * pero no te dejo": eso YA es informacion sobre una cuenta privada —confirma que
 * esa persona entreno ese dia—. Las dos respuestas tienen que ser
 * indistinguibles.
 */

let siguiente = 0;
const crearUsuario = async (props = {}) => {
    siguiente++;
    return User.create({
        username: `vecino${siguiente}`,
        email: `vecino${siguiente}@kairos.test`,
        password: 'da-igual',
        ...props
    });
};

const entrenoDe = (userId) => WorkoutLog.create({
    user: userId,
    type: 'gym',
    routineName: 'Torso',
    duration: 3600,
    date: new Date(),
    exercises: [{ name: 'Press Banca', muscle: 'Pecho', sets: [{ weight: 80, reps: 8 }] }]
});

const pedir = async (viewer, workoutId) => {
    const p = fingirPeticion({ user: viewer, params: { workoutId: String(workoutId) } });
    await getPublicacion(p.req, p.res);
    return p.res;
};

describe('Abrir una publicación desde una notificación', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    test('la tuya la ves', async () => {
        const yo = await crearUsuario();
        const log = await entrenoDe(yo._id);

        const res = await pedir(yo, log._id);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.enviado.routineName, 'Torso');
        assert.strictEqual(String(res.enviado._id), String(log._id));
    });

    test('la de una cuenta pública también', async () => {
        const otro = await crearUsuario({ isPrivate: false });
        const yo = await crearUsuario();
        const log = await entrenoDe(otro._id);

        assert.strictEqual((await pedir(yo, log._id)).statusCode, 200);
    });

    test('la de un amigo, aunque sea privado', async () => {
        const amigo = await crearUsuario({ isPrivate: true });
        const yo = await crearUsuario();
        await User.findByIdAndUpdate(amigo._id, { $push: { friends: yo._id } });
        const log = await entrenoDe(amigo._id);

        assert.strictEqual((await pedir(yo, log._id)).statusCode, 200);
    });

    test('LA DE UN PRIVADO QUE NO ES TU AMIGO, NO', async () => {
        // Sin esto, bastaba con tener el id para leer el entreno de cualquiera.
        const desconocido = await crearUsuario({ isPrivate: true });
        const yo = await crearUsuario();
        const log = await entrenoDe(desconocido._id);

        const res = await pedir(yo, log._id);

        assert.strictEqual(res.statusCode, 404);
        assert.ok(!res.enviado.routineName, 'no puede colarse ni el nombre de la rutina');
    });

    test('Y SE RESPONDE LO MISMO QUE SI NO EXISTIERA', async () => {
        // Un 403 diria "existe pero no te dejo", y eso ya confirma que esa
        // persona entreno. Las dos respuestas tienen que ser iguales.
        const desconocido = await crearUsuario({ isPrivate: true });
        const yo = await crearUsuario();
        const log = await entrenoDe(desconocido._id);

        const prohibida = await pedir(yo, log._id);
        const inexistente = await pedir(yo, '507f1f77bcf86cd799439011');

        assert.strictEqual(prohibida.statusCode, inexistente.statusCode);
        assert.deepStrictEqual(prohibida.enviado, inexistente.enviado);
    });

    test('una que ya no existe da 404 y no revienta', async () => {
        const yo = await crearUsuario();

        const res = await pedir(yo, '507f1f77bcf86cd799439011');

        assert.strictEqual(res.statusCode, 404);
    });

    test('un id con forma de basura tampoco revienta', async () => {
        // Alguien escribiendo la URL a mano, o un enlace viejo cortado.
        const yo = await crearUsuario();

        const res = await pedir(yo, 'esto-no-es-un-id');

        assert.ok(res.statusCode >= 400, 'tiene que fallar, pero de forma controlada');
    });

    test('viene con la misma forma que en el feed', async () => {
        // Se pinta con la MISMA tarjeta, asi que si faltara un campo la
        // publicacion saldria a medias sin dar ningun error.
        const yo = await crearUsuario();
        const log = await entrenoDe(yo._id);

        const { enviado } = await pedir(yo, log._id);

        for (const campo of ['_id', 'user', 'routineName', 'type', 'duration',
            'exercises', 'date', 'likesCount', 'likedByMe', 'comments']) {
            assert.ok(campo in enviado, `falta "${campo}", que la tarjeta espera`);
        }
    });
});
