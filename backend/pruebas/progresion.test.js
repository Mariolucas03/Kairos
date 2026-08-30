const { test, describe } = require('node:test');
const assert = require('node:assert');

const { sugerirSiguiente, rangoDeReps, aDiscoReal } = require('../services/progresionService');

/**
 * PROGRESIÓN AUTOMÁTICA
 *
 * Lo que propone esto entra directo en las casillas del entreno, así que un
 * fallo aquí no se ve: simplemente entrenas con el peso equivocado durante
 * semanas. Dos ya aparecieron y estan cubiertos abajo:
 *
 *  - Un rango escrito al reves ("12-8") dejaba el tope por debajo del suelo, la
 *    serie se daba por completada SIEMPRE y el peso subia cada sesion.
 *  - Una serie apuntada a cero mandaba en el calculo (porque manda la peor) y la
 *    app proponia repetir peso eternamente.
 */

describe('Progresion: lo que propone para la proxima sesion', () => {

    test('LINEAL sube el peso solo si completaste todas las series', () => {
        const config = { progresion: 'lineal', reps: '8', incremento: 2.5 };

        const completada = sugerirSiguiente(config, [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }]);
        assert.strictEqual(completada.peso, 82.5);

        // Manda la PEOR serie: tres buenas y una mala no es sesion completada
        const aMedias = sugerirSiguiente(config, [{ weight: 80, reps: 8 }, { weight: 80, reps: 6 }]);
        assert.strictEqual(aMedias.peso, 80, 'No deberia subir peso si una serie se quedo corta');
    });

    test('DOBLE sube repeticiones hasta el tope, y solo entonces el peso', () => {
        const config = { progresion: 'doble', reps: '8-12', incremento: 2.5 };

        const dentroDelRango = sugerirSiguiente(config, [{ weight: 60, reps: 9 }, { weight: 60, reps: 9 }]);
        assert.strictEqual(dentroDelRango.peso, 60, 'Dentro del rango no se toca el peso');
        assert.strictEqual(dentroDelRango.reps, 10, 'Deberia pedir una repeticion mas');

        const enElTope = sugerirSiguiente(config, [{ weight: 60, reps: 12 }, { weight: 60, reps: 12 }]);
        assert.strictEqual(enElTope.peso, 62.5, 'Al llegar al tope toca subir peso');
        assert.strictEqual(enElTope.reps, 8, 'Y volver al minimo del rango');
    });

    test('GREYSKULL baja un 10% cuando fallas', () => {
        const config = { progresion: 'greyskull', reps: '5', incremento: 2.5 };

        const fallada = sugerirSiguiente(config, [{ weight: 100, reps: 5 }, { weight: 100, reps: 3 }]);
        assert.strictEqual(fallada.peso, 90);

        const completada = sugerirSiguiente(config, [{ weight: 100, reps: 5 }]);
        assert.strictEqual(completada.peso, 102.5);
    });

    test('un rango escrito al reves ("12-8") se entiende igual', () => {
        assert.deepStrictEqual(rangoDeReps('12-8'), { min: 8, max: 12 });
        assert.deepStrictEqual(rangoDeReps('8-12'), { min: 8, max: 12 });

        // Con el tope por debajo del suelo, esto subia peso cada sesion
        const r = sugerirSiguiente({ progresion: 'doble', reps: '12-8' }, [{ weight: 60, reps: 10 }]);
        assert.strictEqual(r.peso, 60, 'No deberia subir peso con 10 repeticiones y objetivo 12');
    });

    test('las series a cero no cuentan', () => {
        const config = { progresion: 'lineal', reps: '8', incremento: 2.5 };

        // Una serie en blanco no puede impedir que progreses
        const conBasura = sugerirSiguiente(config, [{ weight: 80, reps: 8 }, { weight: 80, reps: 0 }]);
        assert.strictEqual(conBasura.peso, 82.5);

        // Y si TODAS estan a cero, no hay nada que proponer
        assert.strictEqual(sugerirSiguiente(config, [{ weight: 60, reps: 0 }]), null);
    });

    test('sin historial, o sin sistema elegido, no se propone nada', () => {
        assert.strictEqual(sugerirSiguiente({ progresion: 'lineal', reps: '8' }, []), null);
        assert.strictEqual(sugerirSiguiente({ progresion: 'ninguna' }, [{ weight: 80, reps: 8 }]), null);
        assert.strictEqual(sugerirSiguiente({ progresion: 'inventada' }, [{ weight: 80, reps: 8 }]), null);
    });

    test('la basura del cliente no genera pesos imposibles', () => {
        const config = { progresion: 'lineal', reps: '8' };

        assert.strictEqual(sugerirSiguiente(config, [{ weight: NaN, reps: 8 }]), null);
        assert.strictEqual(sugerirSiguiente(config, [{ weight: 'mucho', reps: 8 }]), null);

        // Un incremento negativo o absurdo cae al valor por defecto
        const r = sugerirSiguiente({ ...config, incremento: -5 }, [{ weight: 80, reps: 8 }]);
        assert.strictEqual(r.peso, 82.5);
    });

    test('los pesos propuestos existen en un gimnasio', () => {
        // Medios kilos: no hay mancuernas de 41,3
        assert.strictEqual(aDiscoReal(41.3), 41.5);
        assert.strictEqual(aDiscoReal(-10), 0, 'Nunca un peso negativo');

        const r = sugerirSiguiente({ progresion: 'greyskull', reps: '5' }, [{ weight: 87, reps: 3 }]);
        assert.strictEqual(r.peso % 0.5, 0, 'Todo peso propuesto debe caer en medios kilos');
    });
});
