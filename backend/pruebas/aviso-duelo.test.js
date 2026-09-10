const { test, describe } = require('node:test');
const assert = require('node:assert');

const { mensajeDeDuelo } = require('../utils/scheduler');

/**
 * EL EMPUJÓN DE LA ÚLTIMA NOCHE
 *
 * Un duelo dura siete días y se cierra de madrugada. Sin este aviso, el último
 * día es igual que los otros seis: no hay ningún momento en que la app te diga
 * "esto se acaba hoy y todavía puedes".
 *
 * Va por delante del recordatorio de misiones a propósito. Un duelo tiene
 * fichas de los dos dentro y solo queda una noche para darle la vuelta, y
 * ademas pasa UNA vez por duelo: no hay riesgo de convertirlo en ruido.
 *
 * ⚠️ SE AVISA IGUAL VAYAS GANANDO O PERDIENDO.
 *
 * Las dos cosas mueven, pero por motivos distintos: perdiendo te levantas para
 * remontar, y ganando para que no te lo quiten. Avisar solo al que pierde
 * convertiría el aviso en una mala noticia, y de esos se apagan rápido.
 *
 * Esto es una función pura porque el fallo aquí no es de base de datos: es que
 * la frase diga algo que no es, o que no quepa en la pantalla de bloqueo.
 */

const base = { mio: 0, suyo: 0, unidad: 'kg', contra: 'Carla', bote: 200 };
const aviso = (props) => mensajeDeDuelo({ ...base, ...props });

describe('El aviso de la última noche de un duelo', () => {

    test('perdiendo: dice por cuánto y que aún da tiempo', () => {
        const m = aviso({ mio: 14200, suyo: 16800 });

        assert.match(m.title, /pierdes por 2600 kg/i);
        // Lo que hace levantarse del sofá es saber que todavía se puede.
        assert.match(m.body, /remontar a Carla/i);
        assert.match(m.body, /200 fichas/);
    });

    test('ganando: no te lo dejes quitar', () => {
        const m = aviso({ mio: 16800, suyo: 14200 });

        assert.match(m.title, /ganas por 2600 kg/i);
        assert.match(m.body, /no te lo dejes quitar/i);
    });

    test('empate: lo de hoy lo decide', () => {
        const m = aviso({ mio: 5000, suyo: 5000 });

        assert.match(m.title, /empatados/i);
        assert.match(m.body, /decide el duelo/i);
    });

    test('0 a 0 NO es "vais empatados"', () => {
        const m = aviso({ mio: 0, suyo: 0 });

        // "Vais empatados" con los dos a cero suena a que la cosa está reñida, y
        // lo que pasa es que el duelo está sin empezar. Son dos situaciones muy
        // distintas para el que lo lee.
        assert.match(m.title, /no ha empezado nadie/i);
        assert.doesNotMatch(m.title, /empatados/i);
    });

    test('la unidad es la del duelo, no siempre kilos', () => {
        // Los duelos ya no son solo de gimnasio: hay de entrenos, de XP y de
        // misiones. Decir "pierdes por 3 kg" en un duelo de misiones sería
        // hablar de otra cosa.
        assert.match(aviso({ mio: 4, suyo: 7, unidad: 'misiones' }).title, /pierdes por 3 misiones/i);
        assert.match(aviso({ mio: 900, suyo: 400, unidad: 'XP' }).title, /ganas por 500 XP/i);
    });

    test('los números grandes se leen', () => {
        // 18500 a secas se lee mal de un vistazo en una pantalla de bloqueo.
        // Ojo: en español, cuatro cifras NO llevan separador, así que "2600" es
        // correcto y "18.500" también. Node ya lo hace bien; lo que se comprueba
        // es que no se le quite el formato por el camino.
        assert.match(aviso({ mio: 0, suyo: 18500, unidad: 'kg' }).title, /18\.500 kg/);
        assert.match(aviso({ mio: 0, suyo: 2600, unidad: 'kg' }).title, /2600 kg/);
    });

    test('sin nombre del rival no se queda un hueco', () => {
        const m = mensajeDeDuelo({ ...base, mio: 10, suyo: 20, contra: undefined });

        // Puede faltar si la cuenta se borró entre que empezó el duelo y esta
        // noche. "Remontar a undefined" es peor que no avisar.
        assert.match(m.body, /tu rival/i);
        assert.doesNotMatch(m.body, /undefined/);
    });

    test('el título cabe en la pantalla de bloqueo de un móvil', () => {
        const casos = [
            aviso({ mio: 999999, suyo: 0, unidad: 'kg' }),
            aviso({ mio: 0, suyo: 999999, unidad: 'misiones' }),
            aviso({ mio: 0, suyo: 0 }),
            aviso({ mio: 7, suyo: 7, unidad: 'entrenos' })
        ];
        for (const m of casos) {
            // Un título más largo se corta a mitad de palabra y el aviso pierde
            // justo el dato por el que se manda.
            assert.ok(m.title.length <= 48, `Titulo de ${m.title.length}: "${m.title}"`);
        }
    });

    test('siempre lleva a los duelos', () => {
        // Un aviso que te deja en el feed te obliga a buscar de qué hablaba.
        for (const m of [aviso({ mio: 1, suyo: 2 }), aviso({ mio: 2, suyo: 1 }), aviso({})]) {
            assert.strictEqual(m.url, '/social/duelos');
        }
    });
});
