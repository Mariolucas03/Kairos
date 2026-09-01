const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
    PALOS, VALORES, barajaCompleta, mazoNuevo,
    valorarCinco, comparar, mejorMano
} = require('../services/pokerManos');

/**
 * EL EVALUADOR DE MANOS DE POQUER
 *
 * Es la unica parte del juego que se puede demostrar del todo, y es justo la
 * que no puede fallar: decide quien se lleva el bote. Un error aqui no da
 * ningun error — simplemente le paga al que no era, y nadie se entera salvo
 * que alguien conozca las reglas mejor que el codigo.
 *
 * Por eso se prueba carta a carta, incluidos los casos que se olvidan siempre:
 * la escalera con el as por abajo, el color que no llega a escalera, el full
 * que compite contra otro full, y los kickers.
 */

const c = (texto) => {
    // "As" = as de picas, "10c" = diez de corazones
    const mapa = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
    const palos = { s: 'picas', c: 'corazones', d: 'diamantes', t: 'treboles' };
    const p = texto.slice(-1);
    const v = texto.slice(0, -1);
    return { valor: mapa[v] || Number(v), palo: palos[p] };
};

const mano = (...textos) => textos.map(c);

describe('La baraja de poquer', () => {

    test('son 52 cartas, cuatro palos de trece', () => {
        const b = barajaCompleta();
        assert.strictEqual(b.length, 52);
        assert.strictEqual(new Set(b.map(x => `${x.valor}${x.palo}`)).size, 52, 'Hay cartas repetidas');
        for (const palo of PALOS) {
            assert.strictEqual(b.filter(x => x.palo === palo).length, 13, `El palo de ${palo} no tiene trece`);
        }
    });

    test('tiene ochos y nueves, al contrario que la espanola', () => {
        assert.ok(VALORES.includes(8) && VALORES.includes(9));
        assert.strictEqual(VALORES.length, 13);
    });

    test('barajar no pierde ni inventa cartas', () => {
        for (let i = 0; i < 40; i++) {
            const m = mazoNuevo();
            assert.strictEqual(m.length, 52);
            assert.strictEqual(new Set(m.map(x => `${x.valor}${x.palo}`)).size, 52);
        }
    });
});

describe('Cada categoria vale lo que tiene que valer', () => {

    const casos = [
        ['Escalera real', mano('As', 'Ks', 'Qs', 'Js', 'Ts'), 8],
        ['Escalera de color', mano('9c', '8c', '7c', '6c', '5c'), 8],
        ['Poquer', mano('7s', '7c', '7d', '7t', 'Ks'), 7],
        ['Full', mano('4s', '4c', '4d', '9t', '9s'), 6],
        ['Color', mano('As', 'Js', '8s', '5s', '2s'), 5],
        ['Escalera', mano('9s', '8c', '7d', '6t', '5s'), 4],
        ['Trio', mano('Qs', 'Qc', 'Qd', '7t', '2s'), 3],
        ['Doble pareja', mano('Ks', 'Kc', '7d', '7t', '3s'), 2],
        ['Pareja', mano('Ts', 'Tc', 'Kd', '6t', '3s'), 1],
        ['Carta alta', mano('As', 'Jc', '9d', '6t', '3s'), 0]
    ];

    for (const [nombre, cartas, categoria] of casos) {
        test(nombre, () => {
            assert.strictEqual(valorarCinco(cartas)[0], categoria, `${nombre} deberia ser categoria ${categoria}`);
        });
    }

    test('el orden entre categorias es el correcto', () => {
        // Cada una gana a la de debajo, sin saltarse ninguna
        for (let i = 1; i < casos.length; i++) {
            const arriba = valorarCinco(casos[i - 1][1]);
            const abajo = valorarCinco(casos[i][1]);
            assert.ok(comparar(arriba, abajo) > 0,
                `${casos[i - 1][0]} tendria que ganar a ${casos[i][0]}`);
        }
    });
});

describe('Los casos que se olvidan siempre', () => {

    test('la rueda: A-2-3-4-5 es escalera, y es la mas floja', () => {
        const rueda = valorarCinco(mano('As', '5c', '4d', '3t', '2s'));
        assert.strictEqual(rueda[0], 4, 'A-2-3-4-5 tiene que ser escalera');
        assert.strictEqual(rueda[1], 5, 'La rueda es escalera al CINCO, no al as');

        const seis = valorarCinco(mano('6s', '5c', '4d', '3t', '2s'));
        assert.ok(comparar(seis, rueda) > 0, 'La escalera al seis gana a la rueda');
    });

    test('A-K-Q-J-10 es la escalera mas alta', () => {
        const real = valorarCinco(mano('As', 'Kc', 'Qd', 'Jt', 'Ts'));
        assert.strictEqual(real[0], 4);
        assert.strictEqual(real[1], 14);
    });

    test('Q-K-A-2-3 NO es escalera: el as no da la vuelta', () => {
        assert.notStrictEqual(valorarCinco(mano('Qs', 'Kc', 'Ad', '2t', '3s'))[0], 4);
    });

    test('cuatro del mismo palo no son color', () => {
        assert.notStrictEqual(valorarCinco(mano('As', 'Js', '8s', '5s', '2c'))[0], 5);
    });

    test('entre dos colores manda la carta mas alta, y luego la siguiente', () => {
        const alto = valorarCinco(mano('As', 'Js', '8s', '5s', '2s'));
        const bajo = valorarCinco(mano('Ks', 'Qs', 'Js', '9s', '8s'));
        assert.ok(comparar(alto, bajo) > 0, 'El color con as gana al color con rey');

        const a = valorarCinco(mano('As', 'Js', '8s', '5s', '2s'));
        const b = valorarCinco(mano('Ac', 'Tc', '9c', '7c', '4c'));
        assert.ok(comparar(a, b) > 0, 'Con el mismo as, decide la segunda carta');
    });

    test('entre dos fulls manda el TRIO, aunque la pareja sea peor', () => {
        const treses = valorarCinco(mano('3s', '3c', '3d', 'As', 'Ac'));   // full de 3 con ases
        const doses = valorarCinco(mano('4s', '4c', '4d', '2s', '2c'));    // full de 4 con doses
        assert.ok(comparar(doses, treses) > 0,
            'Un full de cuatros gana a un full de treses aunque la pareja sea peor');
    });

    test('los kickers deciden cuando la jugada es la misma', () => {
        const conAs = valorarCinco(mano('9s', '9c', 'Ad', '7t', '3s'));
        const conRey = valorarCinco(mano('9d', '9t', 'Ks', '7c', '3d'));
        assert.ok(comparar(conAs, conRey) > 0, 'Misma pareja: decide el kicker');
    });

    test('dos manos identicas en valor empatan', () => {
        const a = valorarCinco(mano('9s', '9c', 'Ad', '7t', '3s'));
        const b = valorarCinco(mano('9d', '9t', 'Ac', '7s', '3c'));
        assert.strictEqual(comparar(a, b), 0, 'Mismo valor, distinto palo: empate');
    });

    test('el palo NUNCA desempata', () => {
        // En poquer los palos no tienen orden. Si esto fallara, el bote iria
        // siempre al mismo sitio en los empates.
        const picas = valorarCinco(mano('As', 'Ks', 'Qs', 'Js', '9s'));
        const corazones = valorarCinco(mano('Ac', 'Kc', 'Qc', 'Jc', '9c'));
        assert.strictEqual(comparar(picas, corazones), 0);
    });
});

describe('La mejor mano entre siete cartas', () => {

    test('coge la escalera aunque haya que descartar una pareja', () => {
        // 2 propias + 5 comunes
        const r = mejorMano(mano('9s', '8c', '7d', '6t', '5s', 'Kh'.replace('h', 'c'), 'Kd'));
        assert.strictEqual(r.valor[0], 4, 'Deberia elegir la escalera, no la pareja de reyes');
    });

    test('coge el color y no la escalera cuando hay las dos', () => {
        const r = mejorMano(mano('As', 'Js', '8s', '5s', '2s', '9c', 'Td'));
        assert.strictEqual(r.valor[0], 5, 'El color gana a lo demas que haya ahi');
    });

    test('encuentra la escalera de color entre siete', () => {
        const r = mejorMano(mano('9c', '8c', '7c', '6c', '5c', 'Ad', 'As'));
        assert.strictEqual(r.valor[0], 8, 'Con escalera de color no vale quedarse con la pareja de ases');
        assert.strictEqual(r.cartas.length, 5);
    });

    test('cuenta lo que ha salido en cristiano', () => {
        assert.strictEqual(mejorMano(mano('As', 'Ks', 'Qs', 'Js', 'Ts', '2c', '3d')).texto, 'Escalera real');
        assert.strictEqual(mejorMano(mano('7s', '7c', '7d', '7t', 'Ks', '2c', '3d')).texto, 'Póquer de 7');
        assert.strictEqual(mejorMano(mano('Ks', 'Kc', '7d', '7t', '3s', '2c', '9d')).texto, 'Doble pareja de K y 7');
    });

    test('con menos de cinco cartas no inventa nada', () => {
        assert.strictEqual(mejorMano(mano('As', 'Ks')), null);
        assert.strictEqual(mejorMano([]), null);
        assert.strictEqual(mejorMano(null), null);
    });

    test('la mejor mano siempre son cinco cartas de las que hay', () => {
        for (let i = 0; i < 30; i++) {
            const mazo = mazoNuevo().slice(0, 7);
            const r = mejorMano(mazo);
            assert.strictEqual(r.cartas.length, 5);
            for (const carta of r.cartas) {
                assert.ok(mazo.some(m => m.valor === carta.valor && m.palo === carta.palo),
                    'Ha devuelto una carta que no estaba');
            }
        }
    });
});
