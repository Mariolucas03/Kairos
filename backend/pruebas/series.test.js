const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
    ejerciciosSeguros, volumenDe, minutosSeguros, caloriasSeguras, MAX_VOLUMEN_SESION
} = require('../controllers/gymController');

/**
 * LO QUE LLEGA DEL MÓVIL AL GUARDAR UN ENTRENO
 *
 * Esto es la frontera entre lo que escribe el usuario y el dinero: el volumen
 * (peso x repeticiones) sube los rangos musculares, y los rangos PAGAN monedas.
 * Las calorias se convierten en XP, y el XP decide el ranking mensual.
 *
 * Los tres agujeros que hubo aqui, y que estas pruebas vigilan:
 *
 *  - Sin ningun tope, una serie de 999.999 kg x 999.999 reps subia los ocho
 *    grupos musculares a Leyenda de golpe y vaciaba la tienda.
 *  - Las calorias que manda un reloj "mandaban siempre": 9.999.999 kcal daban
 *    cinco millones de XP y la cima del ranking.
 *  - Los topes por serie no bastaban: 500 kg y 200 reps son creibles por
 *    separado, pero con 50 ejercicios de 30 series se llegaba a 150 millones de
 *    volumen, y el rango maximo pide 1.000.000.
 */

describe('Series: lo que se guarda es lo que de verdad se ha movido', () => {

    test('una serie normal se guarda tal cual', () => {
        const [ex] = ejerciciosSeguros([{ name: 'Press banca', sets: [{ weight: 80, reps: 10 }] }], 0);
        assert.strictEqual(ex.sets[0].weight, 80);
        assert.strictEqual(ex.sets[0].reps, 10);
        assert.strictEqual(volumenDe([ex]), 800);
    });

    test('peso corporal: se suma tu peso al lastre', () => {
        const [ex] = ejerciciosSeguros(
            [{ name: 'Dominadas', esPesoCorporal: true, sets: [{ reps: 8, lastre: 15 }] }],
            80
        );
        assert.strictEqual(ex.sets[0].weight, 95, 'Deberia contar 80 kg de cuerpo + 15 de lastre');
        assert.strictEqual(ex.sets[0].lastre, 15, 'El lastre se guarda aparte para poder ensenarlo');
    });

    test('el lastre se acepta tambien en la casilla de kg', () => {
        // La pantalla escribe el lastre donde normalmente van los kilos, asi que
        // aceptar las dos formas evita perder el dato en silencio
        const [ex] = ejerciciosSeguros(
            [{ name: 'Dominadas', esPesoCorporal: true, sets: [{ reps: 8, weight: 15 }] }],
            80
        );
        assert.strictEqual(ex.sets[0].weight, 95);
    });

    test('por lado: 12 repeticiones son 12 con cada brazo', () => {
        const [ex] = ejerciciosSeguros(
            [{ name: 'Curl', sets: [{ weight: 14, reps: 12, porLado: true }] }], 0
        );
        assert.strictEqual(ex.sets[0].reps, 24, 'Para el volumen cuentan los dos lados');
        assert.strictEqual(ex.sets[0].porLado, true, 'Y se marca, para poder ensenar "12 por lado"');
    });

    test('por tiempo: 10 segundos equivalen a una repeticion', () => {
        const [ex] = ejerciciosSeguros(
            [{ name: 'Plancha', esPorTiempo: true, esPesoCorporal: true, sets: [{ segundos: 90 }] }],
            80
        );
        assert.strictEqual(ex.sets[0].segundos, 90, 'Los segundos se guardan tal cual');

        // Una plancha de 90 s (720) tiene que parecerse a una serie dura de press
        // banca (800), no valer el triple como pasaba con 3 segundos por repeticion
        const volumenPlancha = volumenDe([ex]);
        assert.ok(volumenPlancha > 500 && volumenPlancha < 900,
            `Una plancha de 90 s da ${volumenPlancha} de volumen: deberia parecerse a una serie dura, no valer el triple`);
    });

    test('los numeros imposibles se quedan en cero', () => {
        const casos = [
            ['texto', { weight: 'mucho', reps: 12 }],
            ['negativo', { weight: -50, reps: -10 }],
            ['infinito', { weight: Infinity, reps: 8 }]
        ];

        for (const [nombre, serie] of casos) {
            const [ex] = ejerciciosSeguros([{ name: 'X', sets: [serie] }], 0);
            const v = volumenDe([ex]);
            assert.ok(Number.isFinite(v) && v >= 0, `Con ${nombre} sale un volumen invalido: ${v}`);
        }
    });

    test('un ejercicio sin nombre se descarta', () => {
        assert.strictEqual(ejerciciosSeguros([{ name: '', sets: [{ weight: 50, reps: 10 }] }], 0).length, 0);
        assert.strictEqual(ejerciciosSeguros('esto no es una lista', 0).length, 0);
    });

    test('una sesion inventada no puede reventar los rangos musculares', () => {
        const inventada = Array.from({ length: 50 }, () => ({
            name: 'X', sets: Array.from({ length: 30 }, () => ({ weight: 999999, reps: 999999 }))
        }));

        const volumen = volumenDe(ejerciciosSeguros(inventada, 80));
        assert.ok(volumen > MAX_VOLUMEN_SESION,
            'Esta sesion deberia pasarse del techo para que el servidor la rechace');

        // Y una sesion dura de verdad tiene que caber de sobra: la mas bestia
        // registrada en la app son 9.100 de volumen
        const real = [
            { name: 'Press', sets: [{ weight: 80, reps: 10 }, { weight: 80, reps: 10 }, { weight: 85, reps: 8 }] },
            { name: 'Sentadilla', sets: [{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }] }
        ];
        assert.ok(volumenDe(ejerciciosSeguros(real, 80)) < MAX_VOLUMEN_SESION,
            'Un entreno normal NUNCA deberia chocar con el techo');
    });
});

describe('Duracion y calorias: lo que se convierte en XP', () => {

    test('un reloj honesto pasa intacto', () => {
        assert.strictEqual(caloriasSeguras(350, 30), 350);
        assert.strictEqual(minutosSeguros(45), 45);
    });

    test('un reloj imposible se topa', () => {
        // 15 kcal/min sostenidos ya es ritmo de competicion
        assert.strictEqual(caloriasSeguras(9999999, 30), 450);
        assert.strictEqual(minutosSeguros(1000000), 600, 'Nadie entrena mas de 10 horas seguidas');
    });

    test('la basura da cero, nunca NaN', () => {
        for (const valor of ['mucho', -500, Infinity, null, undefined]) {
            assert.strictEqual(caloriasSeguras(valor, 30), 0, `caloriasSeguras(${valor}) deberia dar 0`);
        }
        assert.strictEqual(minutosSeguros(-5), 0);
    });
});
