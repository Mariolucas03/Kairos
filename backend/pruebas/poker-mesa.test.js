const { test, describe } = require('node:test');
const assert = require('node:assert');

const { repartirBote, rondaTerminada, ponerFichas } = require('../services/pokerMesa');

/**
 * EL REPARTO DEL BOTE
 *
 * Es donde un poquer se rompe siempre, y de la peor manera: no da ningun error,
 * simplemente le paga de mas a uno y de menos a otro. Nadie se entera salvo que
 * alguien se sepa las reglas mejor que el codigo.
 *
 * La regla que lo gobierna todo: SE REPARTE EXACTAMENTE LO QUE SE PUSO. Si la
 * suma pagada no es la suma apostada, hay fichas inventadas o desaparecidas, y
 * eso es un fallo aunque el ganador sea el correcto.
 */

const carta = (texto) => {
    const mapa = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
    const palos = { s: 'picas', c: 'corazones', d: 'diamantes', t: 'treboles' };
    return { valor: mapa[texto.slice(0, -1)] || Number(texto.slice(0, -1)), palo: palos[texto.slice(-1)] };
};

const jugador = (nombre, cartas, apostado, opciones = {}) => ({
    nombre,
    cartas: cartas.map(carta),
    apostadoMano: apostado,
    apostadoRonda: 0,
    fichas: opciones.fichas ?? 0,
    retirado: !!opciones.retirado,
    allIn: !!opciones.allIn,
    haActuado: opciones.haActuado !== false,
    sentado: opciones.sentado !== false
});

const mesa = (jugadores, comunitarias) => ({
    jugadores,
    comunitarias: comunitarias.map(carta),
    bote: jugadores.reduce((t, j) => t + j.apostadoMano, 0),
    ciegaGrande: 20
});

/** Suma de todo lo que se paga en un reparto. */
const totalPagado = (pagos) => pagos.reduce((t, p) => t + (p.porCabeza * p.puestos.length) + (p.resto || 0), 0);

describe('Reparto sencillo, sin botes laterales', () => {

    test('gana la mejor mano y se lleva todo lo apostado', () => {
        const m = mesa([
            jugador('Ana', ['As', 'Ac'], 100),      // trio de ases
            jugador('Beto', ['Ks', 'Kc'], 100)      // trio de reyes
        ], ['Ad', 'Kd', '7t', '2s', '9c']);

        const pagos = repartirBote(m);
        assert.strictEqual(pagos.length, 1);
        assert.deepStrictEqual(pagos[0].puestos, [0], 'Tendria que ganar Ana');
        assert.strictEqual(totalPagado(pagos), 200, 'Se reparte lo que se puso, ni mas ni menos');
    });

    test('en un empate se parte por la mitad', () => {
        const m = mesa([
            jugador('Ana', ['As', '2c'], 100),
            jugador('Beto', ['Ac', '2d'], 100)
        ], ['Kd', 'Qt', 'Js', 'Th', '9c'].map(x => x.replace('h', 'c')));

        const pagos = repartirBote(m);
        assert.strictEqual(pagos[0].puestos.length, 2, 'Los dos juegan la escalera de la mesa');
        assert.strictEqual(pagos[0].porCabeza, 100);
        assert.strictEqual(totalPagado(pagos), 200);
    });

    test('quien se retira no cobra aunque hubiera tenido la mejor mano', () => {
        const m = mesa([
            jugador('Ana', ['As', 'Ac'], 50, { retirado: true }),
            jugador('Beto', ['7s', '2c'], 100)
        ], ['Ad', 'Kd', '7t', '2s', '9c']);

        const pagos = repartirBote(m);
        assert.deepStrictEqual(pagos.flatMap(p => p.puestos), [1, 1],
            'Beto cobra los dos escalones: el suyo y el que Ana dejo al retirarse');
        assert.strictEqual(totalPagado(pagos), 150, 'Se reparten las 150 que habia');
    });
});

describe('Botes laterales: quien va corto no puede llevarse lo que no cubrio', () => {

    test('el corto gana su bote, y el resto se lo pelean los otros dos', () => {
        // Ana va all-in con 50. Beto y Carlos siguen hasta 200 cada uno.
        // Ana tiene la mejor mano; Beto la segunda.
        const m = mesa([
            jugador('Ana', ['As', 'Ac'], 50, { allIn: true }),   // trio de ases
            jugador('Beto', ['Ks', 'Kc'], 200),                  // trio de reyes
            jugador('Carlos', ['5s', '4c'], 200)                 // nada
        ], ['Ad', 'Kd', '7t', '2s', '9c']);

        const pagos = repartirBote(m);
        assert.strictEqual(totalPagado(pagos), 450, 'Se reparten las 450 puestas');

        // Bote principal: 50 x 3 = 150, para Ana
        const principal = pagos[0];
        assert.deepStrictEqual(principal.puestos, [0]);
        assert.strictEqual(principal.fichas, 150, 'El bote principal son 50 de cada uno');

        // Bote lateral: (200-50) x 2 = 300, para Beto. Ana NO opta.
        const lateral = pagos[1];
        assert.deepStrictEqual(lateral.puestos, [1], 'Ana no puede llevarse lo que no cubrio');
        assert.strictEqual(lateral.fichas, 300);
    });

    test('con dos all-in de distinta cantidad salen tres botes', () => {
        const m = mesa([
            jugador('Ana', ['2s', '3c'], 30, { allIn: true }),
            jugador('Beto', ['4s', '5c'], 80, { allIn: true }),
            jugador('Carlos', ['As', 'Ac'], 150)
        ], ['Ad', 'Kd', 'Qt', '9s', '8c']);

        const pagos = repartirBote(m);
        assert.strictEqual(pagos.length, 3, 'Tres cantidades distintas, tres botes');
        assert.strictEqual(totalPagado(pagos), 260, '30+80+150 = 260');
        // Carlos tiene el trio de ases: se lleva los tres
        for (const p of pagos) assert.deepStrictEqual(p.puestos, [2]);
    });

    test('la suma repartida es SIEMPRE la suma apostada, salgan las cartas como salgan', () => {
        // Es la propiedad que de verdad importa: da igual quien gane, no puede
        // aparecer ni desaparecer una ficha.
        const { mazoNuevo } = require('../services/pokerManos');

        for (let vuelta = 0; vuelta < 300; vuelta++) {
            const mazo = mazoNuevo();
            const apuestas = [
                10 + Math.floor(Math.random() * 90),
                10 + Math.floor(Math.random() * 190),
                10 + Math.floor(Math.random() * 190)
            ];
            const m = {
                jugadores: apuestas.map((a, i) => ({
                    nombre: 'J' + i,
                    cartas: [mazo.shift(), mazo.shift()],
                    apostadoMano: a,
                    apostadoRonda: 0,
                    fichas: 0,
                    retirado: false,
                    allIn: false,
                    haActuado: true,
                    sentado: true
                })),
                comunitarias: [mazo.shift(), mazo.shift(), mazo.shift(), mazo.shift(), mazo.shift()],
                bote: apuestas.reduce((a, b) => a + b, 0),
                ciegaGrande: 20
            };

            const pagos = repartirBote(m);
            assert.strictEqual(totalPagado(pagos), m.bote,
                `Vuelta ${vuelta}: se han repartido ${totalPagado(pagos)} de un bote de ${m.bote}`);
        }
    });
});

describe('Cuando se cierra una ronda de apuestas', () => {

    const mesaDe = (js, apuestaActual) => ({ jugadores: js, apuestaActual, ciegaGrande: 20 });

    test('no se cierra mientras falte alguien por hablar', () => {
        const m = mesaDe([
            { sentado: true, retirado: false, allIn: false, haActuado: true, apostadoRonda: 20 },
            { sentado: true, retirado: false, allIn: false, haActuado: false, apostadoRonda: 20 }
        ], 20);
        assert.strictEqual(rondaTerminada(m), false, 'El segundo aun no ha dicho nada');
    });

    test('no se cierra si alguien no ha igualado', () => {
        const m = mesaDe([
            { sentado: true, retirado: false, allIn: false, haActuado: true, apostadoRonda: 40 },
            { sentado: true, retirado: false, allIn: false, haActuado: true, apostadoRonda: 20 }
        ], 40);
        assert.strictEqual(rondaTerminada(m), false, 'Al segundo le faltan 20 por poner');
    });

    test('se cierra cuando todos han hablado e igualado', () => {
        const m = mesaDe([
            { sentado: true, retirado: false, allIn: false, haActuado: true, apostadoRonda: 40 },
            { sentado: true, retirado: false, allIn: false, haActuado: true, apostadoRonda: 40 }
        ], 40);
        assert.strictEqual(rondaTerminada(m), true);
    });

    test('no se espera a quien esta all-in: ya no puede hablar', () => {
        const m = mesaDe([
            { sentado: true, retirado: false, allIn: true, haActuado: false, apostadoRonda: 15 },
            { sentado: true, retirado: false, allIn: false, haActuado: true, apostadoRonda: 40 },
            { sentado: true, retirado: false, allIn: false, haActuado: true, apostadoRonda: 40 }
        ], 40);
        assert.strictEqual(rondaTerminada(m), true, 'Esperar a un all-in cuelga la mesa para siempre');
    });

    test('con uno solo sin retirarse, se acabo', () => {
        const m = mesaDe([
            { sentado: true, retirado: true, allIn: false, haActuado: true, apostadoRonda: 20 },
            { sentado: true, retirado: false, allIn: false, haActuado: false, apostadoRonda: 40 }
        ], 40);
        assert.strictEqual(rondaTerminada(m), true, 'No hay contra quien jugar');
    });
});

describe('Poner fichas nunca pasa de lo que tienes', () => {

    test('apostar mas de lo que hay te deja all-in, no en negativo', () => {
        const m = { jugadores: [{ fichas: 30, apostadoRonda: 0, apostadoMano: 0, allIn: false }], bote: 0 };
        const puesto = ponerFichas(m, 0, 100);
        assert.strictEqual(puesto, 30, 'Solo se puede poner lo que se tiene');
        assert.strictEqual(m.jugadores[0].fichas, 0);
        assert.strictEqual(m.jugadores[0].allIn, true);
        assert.strictEqual(m.bote, 30);
    });

    test('una cantidad imposible no rompe el monton', () => {
        for (const basura of [-50, NaN, Infinity, 'mucho', null, undefined]) {
            const m = { jugadores: [{ fichas: 100, apostadoRonda: 0, apostadoMano: 0, allIn: false }], bote: 0 };
            ponerFichas(m, 0, basura);
            assert.ok(m.jugadores[0].fichas >= 0 && Number.isFinite(m.jugadores[0].fichas),
                `Con ${basura} el monton queda en ${m.jugadores[0].fichas}`);
            assert.ok(Number.isFinite(m.bote) && m.bote >= 0);
        }
    });
});
