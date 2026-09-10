const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar, fingirPeticion } = require('./ayuda/baseDeDatos');

const User = require('../models/User');
const Routine = require('../models/Routine');
const WorkoutLog = require('../models/WorkoutLog');
const { saveWorkoutLog } = require('../controllers/gymController');
const { mensajeDeEntreno } = require('../utils/scheduler');

/**
 * "LA ÚLTIMA FUE HACE 6 DÍAS"
 *
 * ⚠️ NUNCA LO FUE. TODAS LAS RUTINAS DECÍAN "AÚN SIN ESTRENAR".
 *
 * El aviso de "hoy toca Pierna" lee `lastPerformed` para cerrar la frase con
 * cuánto hace de la última vez. Ese campo existía en el esquema desde el
 * principio, el aviso lo leía... y no lo escribía NADIE. Ni al guardar el
 * entreno, ni en ningún otro sitio. Así que el aviso decía "Aún sin estrenar"
 * en todas tus rutinas, para siempre, entrenaras lo que entrenaras.
 *
 * Es el patrón de los ajustes muertos pero del revés. Hasta ahora los campos
 * muertos eran los que la pantalla escribía y nadie leía —el descanso de la
 * rutina, el selector de progresión, el tipo de serie—. Este se leía y nadie lo
 * escribía, que es más difícil de ver: no hay una pantalla donde configuras
 * algo y no pasa nada, solo una frase que siempre dice lo mismo.
 *
 * ⚠️ POR QUÉ ESTA PRUEBA LLAMA AL CONTROLADOR ENTERO.
 *
 * Porque el fallo no estaba en ninguna pieza, estaba en el hueco entre dos. Una
 * prueba de `mensajeDeEntreno` con una fecha a mano pasaba en verde —y pasaba,
 * está en aviso-entreno.test.js— mientras la app decía lo contrario. La única
 * forma de demostrarlo es guardar un entreno de verdad y mirar qué queda
 * escrito en la rutina.
 *
 * La última prueba recorre el camino entero hasta el texto del aviso, que es lo
 * que de verdad se rompió.
 */

let siguiente = 0;
const crearUsuario = async () => {
    siguiente++;
    return User.create({
        username: `atleta${siguiente}`,
        email: `atleta${siguiente}@kairos.test`,
        password: 'da-igual'
    });
};

const crearRutina = (userId, props = {}) => Routine.create({
    user: userId,
    name: 'Torso',
    dias: [1],
    exercises: [{ name: 'Press Banca', muscle: 'Pecho' }],
    ...props
});

/** Guarda un entreno como lo hace la app. */
const entrenar = async (user, cuerpo = {}) => {
    const p = fingirPeticion({
        user,
        body: {
            routineName: 'Torso',
            duration: 3600,
            intensity: 'Media',
            exercises: [{
                name: 'Press Banca',
                muscle: 'Pecho',
                sets: [{ weight: 80, reps: 8, type: 'N' }]
            }],
            ...cuerpo
        }
    });
    await saveWorkoutLog(p.req, p.res);
    return p.res;
};

/**
 * El marcado de la rutina va SUELTO, sin `await`: el entreno ya está guardado y
 * la fecha no puede tumbar la respuesta. Eso es correcto en producción y obliga
 * a esperar aquí, porque si no la prueba lee antes de que Mongo haya escrito.
 */
const esperarAlMarcado = () => new Promise(r => setImmediate(r));

describe('La rutina se marca como hecha al entrenarla', () => {

    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    test('entrenar una rutina le pone la fecha de hoy', async () => {
        const user = await crearUsuario();
        const rutina = await crearRutina(user._id);

        assert.strictEqual(rutina.lastPerformed, undefined, 'nace sin estrenar, como debe');

        const res = await entrenar(user, { routineId: String(rutina._id) });
        assert.strictEqual(res.statusCode, 201, 'el entreno tiene que haberse guardado');
        await esperarAlMarcado();

        const despues = await Routine.findById(rutina._id).lean();
        assert.ok(despues.lastPerformed, 'la rutina sigue sin fecha: nadie la marcó');

        // La MISMA fecha del entreno, no un `new Date()` aparte. Con dos relojes
        // distintos, un entreno guardado a las 23:59:59 puede dejar la rutina
        // marcada al día siguiente.
        const log = await WorkoutLog.findById(res.enviado.log._id).lean();
        assert.strictEqual(
            new Date(despues.lastPerformed).getTime(),
            new Date(log.date).getTime(),
            'la fecha de la rutina y la del entreno no coinciden'
        );
    });

    test('un entreno libre no toca ninguna rutina', async () => {
        const user = await crearUsuario();
        const rutina = await crearRutina(user._id);

        // Sin `routineId`: "Entrenamiento Libre". Marcar algo aquí sería marcar
        // una rutina que no se ha hecho.
        await entrenar(user, { routineName: 'Entrenamiento Libre' });
        await esperarAlMarcado();

        const despues = await Routine.findById(rutina._id).lean();
        assert.ok(!despues.lastPerformed, 'un entreno libre ha marcado una rutina');
    });

    test('no se puede marcar la rutina de otra persona', async () => {
        const mia = await crearUsuario();
        const suya = await crearUsuario();
        const rutinaAjena = await crearRutina(suya._id, { name: 'Pierna' });

        // El dueño va en el filtro, no en una comprobación aparte: mandar el id
        // de la rutina de otro es escribir un número distinto en el cuerpo.
        await entrenar(mia, { routineId: String(rutinaAjena._id) });
        await esperarAlMarcado();

        const despues = await Routine.findById(rutinaAjena._id).lean();
        assert.ok(!despues.lastPerformed, 'se ha marcado la rutina de otra persona');
    });

    test('un reintento del mismo entreno no mueve la fecha', async () => {
        const user = await crearUsuario();
        const rutina = await crearRutina(user._id);

        const primera = await entrenar(user, { routineId: String(rutina._id), clienteId: 'abc-123' });
        await esperarAlMarcado();
        const fecha = (await Routine.findById(rutina._id).lean()).lastPerformed;

        // Sin esto la prueba no prueba nada: si nadie escribiera la fecha,
        // abajo se compararían dos `undefined` y pasaría en verde. Lo enseñó la
        // comprobación por mutación —quitar el arreglo dejaba esta en verde—, y
        // una prueba que aprueba el fallo es peor que no tenerla.
        assert.ok(fecha, 'la primera vez ya tenía que haber dejado fecha');

        // El móvil reintenta porque perdió la respuesta. El entreno no se
        // duplica —lo impide el índice único de `clienteId`— y la fecha tampoco
        // se toca: no has entrenado dos veces.
        const segunda = await entrenar(user, { routineId: String(rutina._id), clienteId: 'abc-123' });
        await esperarAlMarcado();

        assert.strictEqual(segunda.statusCode, 200, 'el reintento debería ser un duplicado reconocido');
        assert.strictEqual(segunda.enviado.duplicado, true);
        assert.strictEqual(String(primera.enviado.log._id), String(segunda.enviado.log._id));

        const despues = await Routine.findById(rutina._id).lean();
        assert.strictEqual(
            new Date(despues.lastPerformed).getTime(),
            new Date(fecha).getTime(),
            'el reintento ha movido la fecha'
        );
    });

    test('el aviso de "hoy toca" ya no dice que está sin estrenar', async () => {
        const user = await crearUsuario();
        const rutina = await crearRutina(user._id);

        // ANTES del arreglo, este era el texto que recibías siempre.
        const antes = mensajeDeEntreno([await Routine.findById(rutina._id).lean()]);
        assert.match(antes.body, /Aún sin estrenar/, 'sin entrenar tiene que decir eso');

        await entrenar(user, { routineId: String(rutina._id) });
        await esperarAlMarcado();

        const ahora = mensajeDeEntreno([await Routine.findById(rutina._id).lean()]);
        assert.match(ahora.body, /La última fue hoy/, 'el aviso sigue diciendo que no la has estrenado');
        assert.doesNotMatch(ahora.body, /sin estrenar/);
    });
});
