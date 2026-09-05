const { test, describe } = require('node:test');
const assert = require('node:assert');

const { poderDe, PODER_POR_NIVEL } = require('../controllers/clanController');

/**
 * EL PODER DE UN CLAN
 *
 * Estas pruebas existen porque el poder de los clanes podia acabar EN NEGATIVO
 * y nadie lo iba a ver venir: no da error, no rompe ninguna pantalla, solo
 * ordena mal la clasificacion y enseña un numero raro.
 *
 * `totalPower` era un contador guardado. Al entrar en un clan se le sumaba tu
 * nivel por cien; al salir, se le restaba tu nivel por cien. Parece simetrico,
 * pero el nivel de cuando entras no es el de cuando sales — y subir de nivel es
 * justo lo que uno hace mientras esta en un clan.
 *
 * Aqui se comprueban las dos formas de contarlo, la vieja y la nueva, sobre la
 * misma historia. La regla que se defiende es una sola:
 *
 *   el poder de un clan es la suma de los niveles de quien esta dentro AHORA.
 *
 * Si eso se cumple siempre, no hay deriva posible.
 */

/** El contador de antes, tal cual estaba escrito, para poder compararlo. */
const contadorViejo = () => {
    let total = 0;
    return {
        entra: (nivel) => { total += nivel * 100; },
        sale: (nivel) => { total -= nivel * 100; },
        get valor() { return total; }
    };
};

describe('El poder del clan sale de mirar a la gente que hay dentro', () => {

    test('es la suma de los niveles por cien', () => {
        assert.strictEqual(poderDe([{ level: 3 }, { level: 8 }, { level: 1 }]), 1200);
        assert.strictEqual(PODER_POR_NIVEL, 100);
    });

    test('un clan vacio no tiene poder, y no revienta', () => {
        assert.strictEqual(poderDe([]), 0);
        assert.strictEqual(poderDe(), 0);
    });

    test('quien no tiene nivel cuenta como nivel 1', () => {
        // Cuentas viejas o a medio crear: sin esto sumarian NaN y el clan
        // entero se quedaria con el poder en blanco.
        assert.strictEqual(poderDe([{ level: undefined }, { level: 0 }, {}]), 300);
        assert.ok(Number.isFinite(poderDe([{ level: null }])));
    });

    test('EL FALLO: entras a nivel 3, sales a nivel 8, y el clan pierde 500 que nunca tuvo', () => {
        const viejo = contadorViejo();

        // Un clan de una persona de nivel 10
        const fundador = { level: 10 };
        viejo.entra(10);
        assert.strictEqual(viejo.valor, poderDe([fundador]));

        // Entra alguien de nivel 3
        const nuevo = { level: 3 };
        viejo.entra(3);
        assert.strictEqual(viejo.valor, poderDe([fundador, nuevo]));

        // Entrena dos meses dentro del clan y sube a 8. El contador ni se entera.
        nuevo.level = 8;
        assert.strictEqual(poderDe([fundador, nuevo]), 1800);
        assert.strictEqual(viejo.valor, 1300, 'el contador se quedo con el nivel del dia que entro');

        // Y al irse se le resta el nivel de HOY, no el que se sumo.
        viejo.sale(8);
        assert.strictEqual(viejo.valor, 500);
        assert.strictEqual(poderDe([fundador]), 1000);

        // El clan se queda con la mitad del poder de su unico miembro.
        assert.notStrictEqual(viejo.valor, poderDe([fundador]));
    });

    test('con unas cuantas bajas, el contador viejo se iba por debajo de cero', () => {
        const viejo = contadorViejo();

        // Cinco personas entran de nivel 2 y se van de nivel 20. Nada raro:
        // es un clan que lleva funcionando un tiempo.
        for (let i = 0; i < 5; i++) viejo.entra(2);
        for (let i = 0; i < 5; i++) viejo.sale(20);

        assert.ok(viejo.valor < 0, 'asi acababa: poder negativo');

        // Contando a la gente que queda —ninguna— sale cero, que es la respuesta.
        assert.strictEqual(poderDe([]), 0);
    });

    test('subir de nivel dentro del clan sube el poder del clan', () => {
        // Que es lo que uno espera de un clan, y lo que no pasaba.
        const miembros = [{ level: 5 }, { level: 5 }];
        const antes = poderDe(miembros);

        miembros[0].level = 6;

        assert.strictEqual(poderDe(miembros) - antes, PODER_POR_NIVEL);
    });

    test('el orden del ranking sale bien aunque los clanes hayan vivido cosas distintas', () => {
        // Dos clanes con la misma gente dentro pesan igual, se hayan movido
        // como se hayan movido. El contador viejo los ordenaba por su historia,
        // no por quien hay.
        const clanA = [{ level: 12 }, { level: 9 }];
        const clanB = [{ level: 9 }, { level: 12 }];

        assert.strictEqual(poderDe(clanA), poderDe(clanB));

        const clanC = [{ level: 30 }];
        assert.ok(poderDe(clanC) > poderDe(clanA), 'uno de nivel 30 pesa mas que 12 + 9');
    });
});
