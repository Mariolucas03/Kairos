const { test, describe } = require('node:test');
const assert = require('node:assert');

const { workoutLogSchema } = require('../schemas/gymSchemas');
const { ejerciciosSeguros, volumenDe } = require('../controllers/gymController');

/**
 * LA PUERTA POR LA QUE ENTRA UN ENTRENO
 *
 * El validador de la ruta corre con `stripUnknown: true`: todo campo que no
 * esté declarado en el esquema se BORRA en silencio antes de que el controlador
 * lo vea. Eso es correcto como defensa, y es justo lo que lo hace peligroso: no
 * da error, no aparece en ningún registro, y el dato simplemente no llega.
 *
 * Ya pasó. La app mandaba `esPesoCorporal`, `esPorTiempo`, `superserie`,
 * `lastre`, `segundos` y `porLado` desde que se añadieron esas funciones, y el
 * esquema no declaraba ninguno. Los seis se tiraban a la basura en la puerta.
 * Resultado: una dominada con 15 kg de lastre y una plancha de 90 segundos
 * valían CERO volumen, y el volumen es lo que sube los rangos musculares, que
 * son los que pagan monedas.
 *
 * Nadie lo había notado porque nadie tenía todavía ningún ejercicio marcado con
 * esas opciones. Se habría descubierto el día que alguien marcara sus dominadas
 * como "corporal" y viera que su mejor ejercicio no cuenta.
 *
 * Estas pruebas recorren el camino ENTERO —validador y luego limpieza— porque
 * el fallo no estaba en ninguna de las dos piezas: estaba en que no encajaban.
 */

/** Pasa un cuerpo por el validador igual que hace la ruta. */
const porLaPuerta = (cuerpo) => {
    const { error, value } = workoutLogSchema.validate(cuerpo, {
        abortEarly: false,
        stripUnknown: true
    });
    assert.ok(!error, 'El validador ha rechazado un entreno legítimo: ' + error?.message);
    return value;
};

const entrenoBase = (ejercicios) => ({
    routineName: 'Torso',
    duration: 3600,
    intensity: 'Media',
    exercises: ejercicios
});

describe('El validador no puede tirar lo que el servidor necesita', () => {

    test('las dominadas con lastre llegan enteras, y cuentan', () => {
        const enviado = entrenoBase([{
            name: 'Dominadas',
            esPesoCorporal: true,
            superserie: 'A',
            sets: [{ weight: 0, lastre: 15, reps: 8, type: 'N' }]
        }]);

        const limpio = porLaPuerta(enviado);
        const ex = limpio.exercises[0];

        assert.strictEqual(ex.esPesoCorporal, true, 'esPesoCorporal se pierde en la puerta');
        assert.strictEqual(ex.superserie, 'A', 'superserie se pierde en la puerta');
        assert.strictEqual(ex.sets[0].lastre, 15, 'el lastre se pierde en la puerta');

        // Y el camino completo: 80 kg de cuerpo + 15 de lastre, 8 reps = 760
        const [seguro] = ejerciciosSeguros(limpio.exercises, 80);
        assert.strictEqual(seguro.sets[0].weight, 95);
        assert.strictEqual(volumenDe([seguro]), 760,
            'Una dominada lastrada tiene que contar; si da 0 es que el dato no ha llegado');
    });

    test('una plancha por tiempo llega entera, y cuenta', () => {
        const enviado = entrenoBase([{
            name: 'Plancha',
            esPorTiempo: true,
            esPesoCorporal: true,
            sets: [{ weight: 0, reps: 0, segundos: 90, type: 'N' }]
        }]);

        const limpio = porLaPuerta(enviado);
        assert.strictEqual(limpio.exercises[0].esPorTiempo, true, 'esPorTiempo se pierde en la puerta');
        assert.strictEqual(limpio.exercises[0].sets[0].segundos, 90, 'los segundos se pierden en la puerta');

        const [seguro] = ejerciciosSeguros(limpio.exercises, 80);
        assert.strictEqual(seguro.sets[0].segundos, 90);
        assert.ok(volumenDe([seguro]) > 0,
            'Una plancha de 90 s no puede valer 0: es el mismo agujero de las dominadas');
    });

    test('las repeticiones por lado llegan, y valen doble', () => {
        const enviado = entrenoBase([{
            name: 'Curl alterno',
            sets: [{ weight: 14, reps: 12, porLado: true, type: 'N' }]
        }]);

        const limpio = porLaPuerta(enviado);
        assert.strictEqual(limpio.exercises[0].sets[0].porLado, true, 'porLado se pierde en la puerta');

        const [seguro] = ejerciciosSeguros(limpio.exercises, 80);
        assert.strictEqual(seguro.sets[0].reps, 24, '12 por lado son 24 de trabajo');
    });

    test('el esfuerzo de la serie (RIR/RPE) tiene sitio para cuando haya pantalla', () => {
        // Los campos existen en la base de datos y el servidor ya los limpia,
        // pero no habia forma de mandarlos: la puerta los tiraba. Que el esquema
        // los acepte es lo que permite anadir la casilla sin tocar nada mas.
        const limpio = porLaPuerta(entrenoBase([{
            name: 'Press banca',
            sets: [{ weight: 80, reps: 8, esfuerzo: 2, tipoEsfuerzo: 'RIR', type: 'N' }]
        }]));

        assert.strictEqual(limpio.exercises[0].sets[0].esfuerzo, 2);
        assert.strictEqual(limpio.exercises[0].sets[0].tipoEsfuerzo, 'RIR');
    });

    test('un entreno normal de toda la vida sigue pasando igual', () => {
        const limpio = porLaPuerta(entrenoBase([{
            name: 'Press banca',
            sets: [{ weight: 80, reps: 10, completed: true, type: 'N' }, { weight: 80, reps: 8, type: 'D' }]
        }]));

        assert.strictEqual(limpio.exercises[0].sets.length, 2);
        assert.strictEqual(limpio.exercises[0].sets[1].type, 'D');
        const [seguro] = ejerciciosSeguros(limpio.exercises, 80);
        assert.strictEqual(volumenDe([seguro]), 1440);
    });

    test('lo que NO esta declarado se sigue tirando', () => {
        // La defensa tiene que seguir ahi: aceptar campos nuevos no puede
        // significar aceptar cualquier cosa que mande el movil.
        const limpio = porLaPuerta({
            ...entrenoBase([{ name: 'Press', sets: [{ weight: 80, reps: 8 }] }]),
            regaloDeMonedas: 999999,
            xp: 999999
        });

        assert.strictEqual(limpio.regaloDeMonedas, undefined);
        assert.strictEqual(limpio.xp, undefined);
    });
});
