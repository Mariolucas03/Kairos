const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
    PALOS, NUMEROS, FUERZA, barajaCompleta, barajar, mazoNuevo,
    fuerzaDe, nombreDe, ganadorDe
} = require('../services/barajaEspanola');

/**
 * LA BARAJA
 *
 * Carta Alta se juega contra un amigo y con fichas de verdad, asi que lo que
 * pasa aqui decide quien se lleva el dinero. Y todo esto se puede demostrar del
 * todo, sin base de datos: que estan las 40, que no hay ninguna repetida, que el
 * orden de fuerza es el que un jugador espera, y que barajar no deja rastros.
 *
 * Importa mas de lo que parece: el juego promete que se puede CONTAR CARTAS. Si
 * la baraja tuviera 39, o dos ases de oros, esa promesa seria mentira y no
 * habria forma de darse cuenta jugando.
 */

describe('La baraja espanola tiene que ser una baraja espanola', () => {

    test('son 40 cartas', () => {
        assert.strictEqual(barajaCompleta().length, 40);
        assert.strictEqual(mazoNuevo().length, 40);
    });

    test('no hay ochos ni nueves', () => {
        assert.ok(!NUMEROS.includes(8), 'La baraja espanola no tiene ochos');
        assert.ok(!NUMEROS.includes(9), 'La baraja espanola no tiene nueves');
        assert.deepStrictEqual(NUMEROS, [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]);
    });

    test('cuatro palos, diez cartas cada uno, ni una repetida', () => {
        const mazo = barajaCompleta();
        const vistas = new Set(mazo.map(c => `${c.numero}-${c.palo}`));
        assert.strictEqual(vistas.size, 40, 'Hay cartas repetidas');

        for (const palo of PALOS) {
            assert.strictEqual(mazo.filter(c => c.palo === palo).length, 10,
                `El palo de ${palo} no tiene diez cartas`);
        }
    });

    test('barajar no pierde ni inventa cartas', () => {
        for (let i = 0; i < 50; i++) {
            const mazo = mazoNuevo();
            const vistas = new Set(mazo.map(c => `${c.numero}-${c.palo}`));
            assert.strictEqual(mazo.length, 40);
            assert.strictEqual(vistas.size, 40, 'Barajar ha duplicado o perdido alguna carta');
        }
    });

    test('barajar de verdad cambia el orden', () => {
        // Con 40 cartas, que salga el mismo orden dos veces seguidas es
        // imposible en la practica: si pasa, es que no se esta barajando.
        const original = barajaCompleta().map(c => `${c.numero}${c.palo}`).join();
        let iguales = 0;
        for (let i = 0; i < 20; i++) {
            if (barajar(barajaCompleta()).map(c => `${c.numero}${c.palo}`).join() === original) iguales++;
        }
        assert.strictEqual(iguales, 0, 'El mazo sale sin barajar');
    });
});

describe('Quien gana la mano', () => {

    test('la escalera es la de la brisca, no la numerica', () => {
        // El as manda y el tres va detras. Un jugador espanol lo da por hecho, y
        // hacerlo por numero convertiria el juego en otra cosa.
        assert.deepStrictEqual(FUERZA, [2, 4, 5, 6, 7, 10, 11, 12, 3, 1]);

        const as = { numero: 1, palo: 'oros' };
        const tres = { numero: 3, palo: 'copas' };
        const rey = { numero: 12, palo: 'espadas' };
        const dos = { numero: 2, palo: 'bastos' };

        assert.strictEqual(ganadorDe(as, tres), 'a', 'El as gana al tres');
        assert.strictEqual(ganadorDe(tres, rey), 'a', 'El tres gana al rey');
        assert.strictEqual(ganadorDe(rey, dos), 'a', 'El rey gana al dos');
        assert.strictEqual(ganadorDe(dos, as), 'b', 'El dos es la mas floja');
    });

    test('el palo no decide nada: mismo numero es empate', () => {
        for (const palo of PALOS) {
            for (const otro of PALOS) {
                if (palo === otro) continue;
                assert.strictEqual(
                    ganadorDe({ numero: 7, palo }, { numero: 7, palo: otro }),
                    'empate',
                    `Un siete de ${palo} contra un siete de ${otro} tiene que ser empate`
                );
            }
        }
    });

    test('cada carta tiene su sitio en la escalera, sin repartir empates', () => {
        // Si dos numeros distintos tuvieran la misma fuerza, habria empates que
        // el jugador no puede prever, y contar cartas dejaria de servir.
        const fuerzas = NUMEROS.map(n => fuerzaDe({ numero: n, palo: 'oros' }));
        assert.strictEqual(new Set(fuerzas).size, NUMEROS.length);
        assert.ok(!fuerzas.includes(-1), 'Hay una carta que no esta en la escalera');
    });

    test('la escalera cubre exactamente los numeros que existen', () => {
        assert.deepStrictEqual([...FUERZA].sort((a, b) => a - b), [...NUMEROS].sort((a, b) => a - b));
    });

    test('los nombres se leen como se dicen', () => {
        assert.strictEqual(nombreDe({ numero: 12, palo: 'bastos' }), 'Rey de bastos');
        assert.strictEqual(nombreDe({ numero: 1, palo: 'oros' }), 'As de oros');
        assert.strictEqual(nombreDe({ numero: 10, palo: 'copas' }), 'Sota de copas');
        assert.strictEqual(nombreDe(null), '');
    });
});

describe('Contar cartas tiene que servir de algo', () => {

    test('una partida entera gasta las 40 y no repite ninguna', () => {
        // Es la promesa del juego: 20 manos, dos cartas cada una, y a la ultima
        // sabes exactamente lo que queda. Si el mazo repitiera, seria mentira.
        const mazo = mazoNuevo();
        const salidas = [];
        while (mazo.length >= 2) {
            salidas.push(mazo.shift(), mazo.shift());
        }
        assert.strictEqual(salidas.length, 40, 'Una partida son 20 manos exactas');
        assert.strictEqual(mazo.length, 0, 'No puede sobrar ninguna carta');
        assert.strictEqual(new Set(salidas.map(c => `${c.numero}-${c.palo}`)).size, 40);
    });

    test('las cuatro copias de cada numero acaban saliendo', () => {
        const mazo = mazoNuevo();
        for (const n of NUMEROS) {
            assert.strictEqual(mazo.filter(c => c.numero === n).length, 4,
                `Del ${n} tiene que haber exactamente cuatro`);
        }
    });
});
