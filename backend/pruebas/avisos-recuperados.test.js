const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

const { arrancar, parar, limpiar } = require('./ayuda/baseDeDatos');

const SystemState = require('../models/SystemState');
const { repasarAvisosPendientes } = require('../utils/scheduler');
const { getMadridDateString, getMadridHour } = require('../utils/dateHelpers');

/**
 * LOS AVISOS QUE SE PERDIAN CUANDO RENDER NO ESTABA.
 *
 * El aviso de las 20:00 dependia de que el servidor estuviera vivo justo a esa
 * hora. En el plan gratuito de Render eso no se puede dar por hecho: la
 * instancia se duerme sola a los 15 minutos, y cada vez que se sube una
 * version nueva hay unos minutos en los que quien llama recibe un 503 sin que
 * la peticion toque el codigo. Pasaba cualquiera de las dos cosas y el aviso
 * de ese dia no salia nunca; nadie lo reintentaba.
 *
 * `repasarAvisosPendientes` le da la vuelta: en vez de confiar en el minuto
 * exacto, cada ping comprueba si el aviso de hoy falta por mandar. Lo que hay
 * que garantizar es (a) que lo recupera, (b) que NO lo manda dos veces y
 * (c) que no despierta a nadie a las tres de la madrugada.
 */

/** Un momento de HOY (en Madrid) a la hora pedida. */
const hoyALas = (hora) => {
    const base = new Date();
    const hoy = getMadridDateString(base);
    for (let delta = -24; delta <= 24; delta++) {
        const c = new Date(base.getTime() + delta * 3600000);
        if (getMadridDateString(c) === hoy && getMadridHour(c) === hora) return c;
    }
    throw new Error(`No se pudo construir hoy a las ${hora}`);
};

const marcaDe = async (clave) => (await SystemState.findOne({ key: clave }).lean())?.value || null;

describe('Avisos que se recuperan cuando el servidor vuelve en si', () => {
    before(async () => { await arrancar(); });
    after(async () => { await parar(); });
    beforeEach(async () => { await limpiar(); });

    test('la hora de Madrid sale entre 0 y 23, nunca 24', () => {
        for (let i = 0; i < 24; i++) {
            const h = getMadridHour(new Date(Date.now() + i * 3600000));
            assert.ok(Number.isInteger(h) && h >= 0 && h <= 23, `hora rara: ${h}`);
        }
    });

    test('a las 21:00, si el aviso de las 20:00 no salio, sale ahora', async () => {
        const r = await repasarAvisosPendientes({ forzar: true, ahora: hoyALas(21) });

        assert.ok(r.recuperados.includes('evening-reminder'), 'deberia haberlo recuperado');
        assert.strictEqual(await marcaDe('evening-reminder'), getMadridDateString(),
            'y dejar el dia marcado para que no se repita');
    });

    test('pero si ya salio, no se manda otra vez', async () => {
        const hoy = getMadridDateString();
        await SystemState.create({ key: 'evening-reminder', value: hoy });

        const r = await repasarAvisosPendientes({ forzar: true, ahora: hoyALas(22) });

        assert.deepStrictEqual(r.recuperados, [], 'no tenia nada que recuperar');
    });

    test('a las 03:00 no se despierta a nadie, aunque el aviso falte', async () => {
        const r = await repasarAvisosPendientes({ forzar: true, ahora: hoyALas(3) });

        assert.deepStrictEqual(r.recuperados, []);
        assert.strictEqual(await marcaDe('evening-reminder'), null,
            'un aviso de misiones a las tres de la manana no vale nada');
    });

    test('a las 10:00 se recupera el de entreno, no el de la noche', async () => {
        const r = await repasarAvisosPendientes({ forzar: true, ahora: hoyALas(10) });

        assert.ok(r.recuperados.includes('morning-routine-reminder'));
        assert.ok(!r.recuperados.includes('evening-reminder'),
            'el de las 20:00 todavia no toca: son las diez de la manana');
        assert.strictEqual(await marcaDe('evening-reminder'), null);
    });

    test('a las 14:00 ya es tarde para el aviso de entreno', async () => {
        const r = await repasarAvisosPendientes({ forzar: true, ahora: hoyALas(14) });

        assert.deepStrictEqual(r.recuperados, []);
        assert.strictEqual(await marcaDe('morning-routine-reminder'), null);
    });

    test('el ping entra cada pocos minutos: el repaso tiene freno', async () => {
        await repasarAvisosPendientes({ forzar: true, ahora: hoyALas(21) });

        // El siguiente ping, sin forzar, no vuelve a preguntar a la base de datos.
        const segundo = await repasarAvisosPendientes({ ahora: hoyALas(21) });
        assert.strictEqual(segundo.saltado, true);
    });
});
