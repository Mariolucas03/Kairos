const { test, describe } = require('node:test');
const assert = require('node:assert');

const { esMismoDiaEnMadrid, getMadridDateString } = require('../utils/dateHelpers');

/**
 * EL HABITO DIARIO Y LA MADRUGADA.
 *
 * Un habito diario se reinicia "cuando cambia el dia". Eso se comprobaba con
 * `a.toDateString() === b.toDateString()`, que da el dia del SERVIDOR. En
 * Render el servidor va en UTC, y Madrid va por delante: de 00:00 a 02:00 en
 * Madrid todavia es el dia de ayer en UTC.
 *
 * Eso rompia las dos direcciones, y la segunda cuesta dinero:
 *
 *   1. Marcas un habito a las 21:00. Abres la app a las 00:30, que en Madrid
 *      ya es manana: para UTC es el mismo dia, el habito sigue tachado y no
 *      puedes hacer el de hoy hasta las 02:00.
 *
 *   2. Marcas un habito a la 01:30. A las 10:00 del MISMO dia de Madrid, UTC
 *      ya ha cambiado de dia: el habito se reinicia y se puede volver a
 *      completar. Y completar paga XP, monedas y fichas. El mismo habito,
 *      cobrado dos veces el mismo dia.
 *
 * Estas pruebas usan instantes exactos en UTC para que el resultado no dependa
 * de donde corran.
 */

// 2026-10-10 es un sabado; en octubre Madrid va en CEST (UTC+2) hasta el dia 25.
const MADRID_09_21h = new Date('2026-10-09T19:00:00Z'); // 9 de octubre, 21:00 en Madrid
const MADRID_10_00h30 = new Date('2026-10-09T22:30:00Z'); // 10 de octubre, 00:30 en Madrid
const MADRID_10_01h30 = new Date('2026-10-09T23:30:00Z'); // 10 de octubre, 01:30 en Madrid
const MADRID_10_10h = new Date('2026-10-10T08:00:00Z'); // 10 de octubre, 10:00 en Madrid

describe('El dia de un habito es el de Madrid, no el del servidor', () => {
    test('los instantes de prueba caen donde se espera', () => {
        assert.strictEqual(getMadridDateString(MADRID_09_21h), '2026-10-09');
        assert.strictEqual(getMadridDateString(MADRID_10_00h30), '2026-10-10');
        assert.strictEqual(getMadridDateString(MADRID_10_01h30), '2026-10-10');
        assert.strictEqual(getMadridDateString(MADRID_10_10h), '2026-10-10');
    });

    test('anoche a las 21:00 y hoy a las 00:30 son dias DISTINTOS', () => {
        // Para UTC los dos caen el 9: por eso el habito de ayer seguia tachado.
        assert.strictEqual(MADRID_09_21h.toUTCString().slice(0, 16), MADRID_10_00h30.toUTCString().slice(0, 16),
            'en UTC son el mismo dia, que es lo que provocaba el fallo');

        assert.strictEqual(esMismoDiaEnMadrid(MADRID_09_21h, MADRID_10_00h30), false,
            'en Madrid ya es manana: el habito tiene que reiniciarse');
    });

    test('la 01:30 y las 10:00 del mismo dia son el MISMO dia', () => {
        // Aqui esta la fuga: para UTC son dias distintos (el 9 y el 10), asi
        // que el habito se reiniciaba y se volvia a cobrar.
        assert.notStrictEqual(MADRID_10_01h30.toUTCString().slice(0, 16), MADRID_10_10h.toUTCString().slice(0, 16),
            'en UTC son dias distintos, que es lo que provocaba el doble cobro');

        assert.strictEqual(esMismoDiaEnMadrid(MADRID_10_01h30, MADRID_10_10h), true,
            'mismo dia en Madrid: ya esta hecho y no se puede volver a cobrar');
    });

    test('dos momentos del mismo dia normal cuentan como el mismo dia', () => {
        assert.strictEqual(esMismoDiaEnMadrid(new Date('2026-06-15T08:00:00Z'), new Date('2026-06-15T16:00:00Z')), true);
    });

    test('sin fecha no se reinicia nada por accidente', () => {
        assert.strictEqual(esMismoDiaEnMadrid(null, MADRID_10_10h), false);
        assert.strictEqual(esMismoDiaEnMadrid(MADRID_10_10h, null), false);
    });
});
