const { test, describe } = require('node:test');
const assert = require('node:assert');

const { iniciarAutoPing, dentroDeLaFranja, CADA } = require('../utils/autoPing');

/**
 * LA FRANJA EN LA QUE EL SERVIDOR SE MANTIENE DESPIERTO.
 *
 * Render regala 750 horas de instancia al mes y un mes son 744, asi que
 * tenerla despierta las 24 horas se come el presupuesto entero. Pasarse no es
 * que vaya lento: Render SUSPENDE el servicio y todo devuelve 503 al instante.
 *
 * O sea que la franja no es un detalle de comodidad, es lo que separa "la app
 * va rapida" de "la app no existe la ultima semana del mes". Estas pruebas
 * cubren la cuenta de horas y el caso raro: una franja que cruza la medianoche.
 */

describe('La franja del auto-ping', () => {
    test('08:00 a 00:00: despierto de dia, dormido de madrugada', () => {
        for (const h of [8, 12, 20, 23]) {
            assert.strictEqual(dentroDeLaFranja(h, 8, 0), true, `a las ${h}:00 deberia estar despierto`);
        }
        for (const h of [0, 3, 6, 7]) {
            assert.strictEqual(dentroDeLaFranja(h, 8, 0), false, `a las ${h}:00 no hay nadie mirando el movil`);
        }
    });

    test('esa franja cabe de sobra en las 750 horas del mes', () => {
        const horasDespierto = Array.from({ length: 24 }, (_, h) => h)
            .filter(h => dentroDeLaFranja(h, 8, 0)).length;

        assert.strictEqual(horasDespierto, 16, 'de 08:00 a 00:00 son 16 horas');
        assert.ok(horasDespierto * 31 < 750,
            `${horasDespierto * 31} h al mes tiene que quedarse por debajo de las 750 que regala Render`);
    });

    test('estar despierto las 24 h cabe por los pelos; la franja da margen', () => {
        // 24 x 31 = 744, o sea que SI cabe en las 750... con seis horas de
        // sobra en todo el mes. Basta un segundo servicio gratuito en la
        // cuenta, o un mes con reinicios, para pasarse y que Render suspenda.
        const todoElDia = 24 * 31;
        assert.ok(todoElDia < 750, 'cabe, pero');
        assert.ok(750 - todoElDia < 10, `solo deja ${750 - todoElDia} horas de margen en todo el mes`);

        // Con la franja el margen es otra cosa.
        const conFranja = 16 * 31;
        assert.ok(750 - conFranja > 200, 'la franja deja margen de verdad');
    });

    test('una franja que cruza la medianoche se entiende bien', () => {
        // De 22:00 a 02:00: las 22, 23, 00 y 01.
        assert.strictEqual(dentroDeLaFranja(22, 22, 2), true);
        assert.strictEqual(dentroDeLaFranja(23, 22, 2), true);
        assert.strictEqual(dentroDeLaFranja(0, 22, 2), true);
        assert.strictEqual(dentroDeLaFranja(1, 22, 2), true);
        assert.strictEqual(dentroDeLaFranja(2, 22, 2), false);
        assert.strictEqual(dentroDeLaFranja(12, 22, 2), false);
    });

    test('desde y hasta iguales es el dia entero', () => {
        for (let h = 0; h < 24; h++) assert.strictEqual(dentroDeLaFranja(h, 0, 0), true);
    });

    test('se visita cada 10 minutos: Render duerme a los 15', () => {
        assert.ok(CADA < 15 * 60 * 1000, 'con 15 o mas se dormiria igual');
        assert.strictEqual(CADA, 10 * 60 * 1000);
    });
});

describe('El auto-ping no se enciende donde no debe', () => {
    const conEntorno = (vars, fn) => {
        const previo = { ...process.env };
        Object.assign(process.env, vars);
        try { return fn(); } finally { process.env = previo; }
    };

    test('en local no corre: sin RENDER_EXTERNAL_URL no hay nada que despertar', () => {
        const t = conEntorno({ RENDER_EXTERNAL_URL: '', AUTO_PING: '' }, iniciarAutoPing);
        assert.strictEqual(t, null);
    });

    test('AUTO_PING=off lo apaga aunque este en Render', () => {
        const t = conEntorno(
            { RENDER_EXTERNAL_URL: 'https://ejemplo.onrender.com', AUTO_PING: 'off' },
            iniciarAutoPing
        );
        assert.strictEqual(t, null);
    });

    test('en Render si arranca, y no bloquea el cierre del proceso', () => {
        const t = conEntorno(
            { RENDER_EXTERNAL_URL: 'https://ejemplo.onrender.com', AUTO_PING: '' },
            iniciarAutoPing
        );
        assert.ok(t, 'deberia haber arrancado el temporizador');
        clearInterval(t);
    });
});
