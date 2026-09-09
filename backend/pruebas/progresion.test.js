const { test, describe } = require('node:test');
const assert = require('node:assert');

const { sugerirSiguiente, rangoDeReps, aDiscoReal, escalonDePeso, seriesDeTrabajo, SESIONES_PARA_BAJAR } = require('../services/progresionService');

/**
 * QUÉ TOCA HOY
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

describe('Que toca hoy: lo que propone para la proxima sesion', () => {

    test('el caso de la sentadilla: 10, 10 y 6 a 80 kg -> 80 kg buscando 8', () => {
        // Es el ejemplo que define la regla entera. Hiciste 10, 10 y 6: no
        // aguantas 10, asi que la meta es el numero que si sostienes en las tres.
        const ultimas = [
            { weight: 80, reps: 10 },
            { weight: 80, reps: 10 },
            { weight: 80, reps: 6 }
        ];

        // Y sale 8 con cualquier objetivo razonable de la rutina, que es lo que
        // lo hace fiable: no depende de como tenga escrito el rango.
        for (const reps of ['8-12', '12', '10', '6-8']) {
            const r = sugerirSiguiente({ reps }, ultimas);
            assert.strictEqual(r.peso, 80, `Con objetivo "${reps}" no deberia tocar el peso`);
            assert.strictEqual(r.reps, 8, `Con objetivo "${reps}" deberia pedir 8`);
            assert.strictEqual(r.completada, false);
        }
    });

    test('cuando las aguantas todas, sube el peso y vuelve al minimo del rango', () => {
        const r = sugerirSiguiente({ reps: '8-12' }, [
            { weight: 60, reps: 12 },
            { weight: 60, reps: 12 },
            { weight: 60, reps: 12 }
        ]);

        assert.strictEqual(r.peso, 62.5);
        assert.strictEqual(r.reps, 8, 'Con mas peso se empieza otra vez por abajo');
        assert.strictEqual(r.completada, true);
    });

    test('manda la PEOR serie: tres buenas y una mala no es sesion completada', () => {
        const r = sugerirSiguiente({ reps: '8' }, [
            { weight: 80, reps: 8 },
            { weight: 80, reps: 8 },
            { weight: 80, reps: 8 },
            { weight: 80, reps: 5 }
        ]);

        assert.strictEqual(r.peso, 80, 'No deberia subir peso si una serie se quedo corta');
        assert.strictEqual(r.completada, false);
    });

    test('la propuesta siempre pide algo mas que tu peor serie', () => {
        // Una sola serie: la media es esa misma serie, asi que sin el suelo de
        // "una mas" la app te propondria repetir exactamente lo de la vez
        // anterior, que no es progresar.
        const una = sugerirSiguiente({ reps: '10' }, [{ weight: 50, reps: 6 }]);
        assert.strictEqual(una.reps, 7, 'Deberia pedir una repeticion mas que la ultima vez');

        // Y con dos series iguales por debajo del objetivo, lo mismo
        const dos = sugerirSiguiente({ reps: '10' }, [{ weight: 50, reps: 6 }, { weight: 50, reps: 6 }]);
        assert.strictEqual(dos.reps, 7);
    });

    test('nunca pide mas repeticiones que el objetivo de la rutina', () => {
        // Media 10, pero la rutina pide 8: pedir 10 seria cambiarle la rutina al
        // usuario por su cuenta.
        const r = sugerirSiguiente({ reps: '8' }, [
            { weight: 40, reps: 12 },
            { weight: 40, reps: 12 },
            { weight: 40, reps: 6 }
        ]);
        assert.strictEqual(r.reps, 8);
    });

    test('el salto de peso sale del peso, no de una casilla que nadie rellena', () => {
        // 2,5 kg en un curl de 10 kg es un salto del 25%: te cargas la serie
        assert.strictEqual(escalonDePeso(10), 1);
        assert.strictEqual(escalonDePeso(30), 2);
        assert.strictEqual(escalonDePeso(100), 2.5);

        const curl = sugerirSiguiente({ reps: '12' }, [{ weight: 12, reps: 12 }]);
        assert.strictEqual(curl.peso, 13, 'Un curl no sube de 2,5 en 2,5');

        const sentadilla = sugerirSiguiente({ reps: '5' }, [{ weight: 120, reps: 5 }]);
        assert.strictEqual(sentadilla.peso, 122.5);
    });

    test('un rango escrito al reves ("12-8") se entiende igual', () => {
        assert.deepStrictEqual(rangoDeReps('12-8'), { min: 8, max: 12 });
        assert.deepStrictEqual(rangoDeReps('8-12'), { min: 8, max: 12 });

        // Con el tope por debajo del suelo, esto subia peso cada sesion
        const r = sugerirSiguiente({ reps: '12-8' }, [{ weight: 60, reps: 10 }]);
        assert.strictEqual(r.peso, 60, 'No deberia subir peso con 10 repeticiones y objetivo 12');
    });

    test('las series a cero no cuentan', () => {
        // Una serie en blanco no puede impedir que progreses
        const conBasura = sugerirSiguiente({ reps: '8' }, [
            { weight: 80, reps: 8 },
            { weight: 80, reps: 0 }
        ]);
        assert.strictEqual(conBasura.peso, 82.5);

        // Y si TODAS estan a cero, no hay nada que proponer
        assert.strictEqual(sugerirSiguiente({ reps: '8' }, [{ weight: 60, reps: 0 }]), null);
    });

    test('sin historial no se propone nada', () => {
        assert.strictEqual(sugerirSiguiente({ reps: '8' }, []), null);
        assert.strictEqual(sugerirSiguiente({ reps: '8' }, null), null);
    });

    test('la basura del cliente no genera pesos imposibles', () => {
        assert.strictEqual(sugerirSiguiente({ reps: '8' }, [{ weight: NaN, reps: 8 }]), null);
        assert.strictEqual(sugerirSiguiente({ reps: '8' }, [{ weight: 'mucho', reps: 8 }]), null);
        assert.strictEqual(sugerirSiguiente({ reps: '8' }, [{ weight: 0, reps: 8 }]), null);
    });

    test('los pesos propuestos existen en un gimnasio', () => {
        // Medios kilos: no hay mancuernas de 41,3
        assert.strictEqual(aDiscoReal(41.3), 41.5);
        assert.strictEqual(aDiscoReal(-10), 0, 'Nunca un peso negativo');

        const r = sugerirSiguiente({ reps: '5' }, [{ weight: 87.4, reps: 5 }]);
        assert.strictEqual(r.peso % 0.5, 0, 'Todo peso propuesto debe caer en medios kilos');
    });

    test('tres sesiones clavado en el mismo peso: se baja un 10%', () => {
        const a = (...reps) => reps.map(r => ({ weight: 80, reps: r }));

        // Una mala semana la tiene cualquiera: se insiste
        const primera = sugerirSiguiente({ reps: '8-12' }, a(10, 10, 6), []);
        assert.strictEqual(primera.peso, 80);
        assert.strictEqual(primera.descarga, false);

        // Dos tampoco bastan
        const segunda = sugerirSiguiente({ reps: '8-12' }, a(8, 8, 7), [a(10, 10, 6)]);
        assert.strictEqual(segunda.peso, 80);
        assert.strictEqual(segunda.descarga, false);

        // A la tercera ya no es mala suerte: ese peso no es tu peso ahora mismo
        const tercera = sugerirSiguiente({ reps: '8-12' }, a(8, 7, 7), [a(10, 10, 6), a(8, 8, 7)]);
        assert.strictEqual(tercera.peso, 72, 'Deberia bajar un 10%');
        assert.strictEqual(tercera.reps, 8, 'Y volver al minimo del rango');
        assert.strictEqual(tercera.descarga, true);
        assert.strictEqual(tercera.sesionesAtascado, SESIONES_PARA_BAJAR);
    });

    test('sacar una sesion rompe la racha del atasco', () => {
        const a = (...reps) => reps.map(r => ({ weight: 80, reps: r }));

        // Fallo, fallo... pero en medio hay una que SI sacaste. La pared se
        // rompio ahi: no llevas tres seguidas contra la misma.
        const r = sugerirSiguiente({ reps: '8' }, a(7, 7, 7), [a(6, 6, 6), a(8, 8, 8), a(7, 7, 6)]);
        assert.strictEqual(r.peso, 80, 'No deberia descargar: la racha se corto');
        assert.strictEqual(r.descarga, false);
    });

    test('cambiar de peso rompe la racha: no es la misma pared', () => {
        const en = (kg, ...reps) => reps.map(r => ({ weight: kg, reps: r }));

        // Fallaste tres veces, pero a pesos distintos. Estabas subiendo, no
        // atascado, y bajar aqui seria castigar a alguien que progresa.
        const r = sugerirSiguiente({ reps: '8' }, en(80, 7, 7, 6), [en(70, 7, 7, 6), en(75, 7, 6, 6)]);
        assert.strictEqual(r.peso, 80);
        assert.strictEqual(r.descarga, false);
    });

    test('sin las sesiones anteriores todo sigue funcionando igual', () => {
        // El historial es opcional a proposito: quien llame a esto sin el
        // —el guardado del entreno, por ejemplo— tiene que seguir teniendo
        // propuesta, solo que sin descarga.
        const r = sugerirSiguiente({ reps: '8-12' }, [
            { weight: 80, reps: 10 }, { weight: 80, reps: 10 }, { weight: 80, reps: 6 }
        ]);
        assert.strictEqual(r.peso, 80);
        assert.strictEqual(r.reps, 8);
        assert.strictEqual(r.descarga, false);
    });

    test('el motivo no lleva numeros dentro', () => {
        // Los numeros los traduce el controlador despues (peso corporal,
        // segundos, por lado). Si el texto llevara cifras, contradiria a la
        // casilla de al lado.
        for (const ultimas of [[{ weight: 80, reps: 12 }], [{ weight: 80, reps: 5 }]]) {
            const r = sugerirSiguiente({ reps: '12' }, ultimas);
            assert.ok(!/\d/.test(r.motivo), `El motivo no deberia llevar cifras: "${r.motivo}"`);
        }
    });
});

const s = (weight, reps, type) => ({ weight, reps, type: type || 'N' });

describe('Solo cuentan las series de TRABAJO', () => {

    test('EL FALLO: el calentamiento congelaba la progresion', () => {
        // 40x5 de calentamiento y luego 80x10 tres veces. Hiciste las tres
        // iguales y perfectas; la app proponia 80x8, o sea MENOS de lo que
        // acababas de hacer. Y peor: con el calentamiento dentro, la peor serie
        // nunca llegaba al objetivo, asi que NUNCA subias de peso.
        const r = sugerirSiguiente({ reps: '8-12' }, [
            s(40, 5, 'W'), s(80, 10), s(80, 10), s(80, 10)
        ]);

        assert.strictEqual(r.peso, 80);
        assert.strictEqual(r.reps, 11, 'hiciste 10 en todas: la propuesta es 11');
    });

    test('y con el calentamiento sin marcar, tambien', () => {
        // Mucha gente no marca el tipo. El peso de trabajo se saca por cuantas
        // veces se repite, asi que el 40 suelto se queda fuera igualmente.
        const r = sugerirSiguiente({ reps: '8-12' }, [
            s(40, 5), s(80, 10), s(80, 10), s(80, 10)
        ]);
        assert.strictEqual(r.peso, 80);
        assert.strictEqual(r.reps, 11);
    });

    test('con calentamiento SI se puede subir de peso', () => {
        // La consecuencia mas grave del fallo: quien calentara dentro de la app
        // se quedaba clavado en el mismo peso para siempre.
        const r = sugerirSiguiente({ reps: '10' }, [
            s(50, 6, 'W'), s(90, 10), s(90, 10), s(90, 10)
        ]);
        assert.strictEqual(r.completada, true, 'las tres a 10 con objetivo 10 es completada');
        assert.ok(r.peso > 90, 'tiene que subir de peso');
    });

    test('UN INTENTO DE RECORD no secuestra el peso de trabajo', () => {
        // 80x10 tres veces y un 100x1 al final. Con "el mas pesado manda", la
        // app se creia que tu peso era 100 y proponia 100x2 la proxima.
        const r = sugerirSiguiente({ reps: '8-12' }, [
            s(80, 10), s(80, 10), s(80, 10), s(100, 1)
        ]);
        assert.strictEqual(r.peso, 80);
        assert.strictEqual(r.reps, 11);
    });

    test('en piramide manda la serie de arriba, con SUS repeticiones', () => {
        // 80x10, 85x8, 90x5. Antes promediaba las tres y pedia 90x7, pero a 90
        // solo hiciste 5.
        const r = sugerirSiguiente({ reps: '8-12' }, [s(80, 10), s(85, 8), s(90, 5)]);
        assert.strictEqual(r.peso, 90);
        assert.strictEqual(r.reps, 6, 'a 90 hiciste 5: se pide una mas');
    });

    test('el descendente no cuenta: es la bajada de despues', () => {
        const conDrop = sugerirSiguiente({ reps: '8-12' },
            [s(80, 10), s(80, 9), s(80, 8), s(50, 15, 'D')]);
        const sinDrop = sugerirSiguiente({ reps: '8-12' },
            [s(80, 10), s(80, 9), s(80, 8)]);

        assert.deepStrictEqual(conDrop, sinDrop, 'el dropset no puede cambiar la propuesta');
    });

    test('la serie al fallo SI cuenta: es de trabajo, y de las duras', () => {
        const r = sugerirSiguiente({ reps: '8-12' }, [s(80, 10), s(80, 10), s(80, 7, 'F')]);
        assert.strictEqual(r.peso, 80);
        assert.strictEqual(r.reps, 9, 'la media de 10, 10 y 7');
    });

    test('una sesion de solo calentamiento no propone nada', () => {
        assert.strictEqual(sugerirSiguiente({ reps: '8-12' }, [s(40, 5, 'W')]), null);
    });

    test('a igualdad de veces manda el mas pesado', () => {
        // Dos a 80 y dos a 85: la sesion mas exigente de las dos es la de 85.
        const { peso } = seriesDeTrabajo([s(80, 10), s(80, 10), s(85, 8), s(85, 8)]);
        assert.strictEqual(peso, 85);
    });

    test('el atasco se cuenta con el MISMO criterio', () => {
        // Si aqui contaran todas las series y en la de hoy solo las de trabajo,
        // una sesion con calentamiento pareceria de otro peso y romperia la
        // racha sin motivo, asi que la descarga no llegaria nunca.
        const conCalentamiento = [s(45, 5, 'W'), s(80, 10), s(80, 9), s(80, 7)];
        const r = sugerirSiguiente({ reps: '12' },
            [s(45, 5, 'W'), s(80, 10), s(80, 9), s(80, 7)],
            [conCalentamiento, conCalentamiento]
        );

        assert.strictEqual(r.descarga, true, 'tres sesiones atascado al mismo peso');
        assert.ok(r.peso < 80);
    });
});
