const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
    SCRATCH_SYMBOLS, SLOT_SYMBOLS, FORTUNE_PRIZES, FORTUNE_COSTS, TOWER_MULTIPLIERS
} = require('../controllers/gamesController');
const { premioDeCofre } = require('../controllers/shopController');

/**
 * LA ECONOMÍA DEL CASINO
 *
 * Estas pruebas existen porque el casino REGALABA DINERO y nadie se entero
 * durante meses: el rasca devolvia el 279% de lo apostado y los tres modos de la
 * ruleta de la fortuna pagaban mas de lo que costaban. Como las fichas se
 * cambian por monedas, eso era una impresora: con darle al boton se compraba la
 * tienda entera.
 *
 * Un fallo asi no da error, no aparece en ningun registro y no rompe ninguna
 * pantalla. Solo se ve midiendo. Por eso se mide aqui.
 *
 * La regla: ningun juego puede devolver el 100% o mas. Un juego que devuelve
 * mas de lo que cobra no es un juego, es un grifo.
 */

const TOPE_SANO = 100;   // por encima de esto, el juego regala dinero
const SUELO_SANO = 70;   // por debajo, es tan duro que jugar no tiene gracia

describe('Casino: ningun juego puede regalar dinero', () => {

    test('el rasca devuelve entre el 70% y el 100%', () => {
        const COSTE = 10;
        const RITMO_DE_VICTORIA = 0.35;

        // Reparto de premios cuando toca, tal como lo hace playScratch
        const reparto = [
            { simbolo: SCRATCH_SYMBOLS.DIAMOND, probabilidad: 0.05 },
            { simbolo: SCRATCH_SYMBOLS.XP, probabilidad: 0.15 },
            { simbolo: SCRATCH_SYMBOLS.COIN, probabilidad: 0.30 },
            { simbolo: SCRATCH_SYMBOLS.LEMON, probabilidad: 0.50 }
        ];

        // El XP no son fichas: no cuenta para lo que devuelve el juego
        const mediaEnFichas = reparto
            .filter(r => r.simbolo.type !== 'xp')
            .reduce((total, r) => total + r.probabilidad * r.simbolo.prize, 0);

        const devuelve = (RITMO_DE_VICTORIA * mediaEnFichas / COSTE) * 100;

        assert.ok(devuelve < TOPE_SANO,
            `El rasca devuelve el ${devuelve.toFixed(1)}%: esta REGALANDO dinero`);
        assert.ok(devuelve > SUELO_SANO,
            `El rasca devuelve el ${devuelve.toFixed(1)}%: es tan duro que no merece la pena jugar`);
    });

    test('las tiradas de pago de la ruleta devuelven entre el 70% y el 100%', () => {
        for (const modo of ['hardcore', 'premium']) {
            const coste = FORTUNE_COSTS[modo];
            const premios = FORTUNE_PRIZES[modo].map(p => p.v);
            const media = premios.reduce((a, b) => a + b, 0) / premios.length;
            const devuelve = (media / coste) * 100;

            assert.ok(devuelve < TOPE_SANO,
                `La ruleta "${modo}" devuelve el ${devuelve.toFixed(1)}%: esta REGALANDO dinero`);
            assert.ok(devuelve > SUELO_SANO,
                `La ruleta "${modo}" devuelve el ${devuelve.toFixed(1)}%: demasiado dura`);
        }
    });

    test('la tirada gratis de la ruleta sigue siendo gratis y modesta', () => {
        assert.strictEqual(FORTUNE_COSTS.daily, 0, 'La tirada diaria debe seguir siendo gratuita');

        const premios = FORTUNE_PRIZES.daily.map(p => p.v);
        const media = premios.reduce((a, b) => a + b, 0) / premios.length;

        // Es gratis, asi que lo unico que la contiene es el limite de una al dia
        // (que se comprueba en el servidor) y que el premio medio sea razonable.
        assert.ok(media <= 50,
            `La tirada gratis da ${media} fichas de media: demasiado para ser gratis`);
    });

    test('los slots devuelven entre el 70% y el 100%', () => {
        // Se simula porque el pago depende de que salgan lineas de 3 o 4 iguales
        // en una cuadricula, y eso no tiene formula corta.
        const TIRADAS = 200000;
        const APUESTA = 10;
        const pesoTotal = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);

        const sacarSimbolo = () => {
            let r = Math.random() * pesoTotal;
            for (const s of SLOT_SYMBOLS) {
                if (r < s.weight) return s;
                r -= s.weight;
            }
            return SLOT_SYMBOLS[0];
        };

        let apostado = 0;
        let pagado = 0;

        for (let i = 0; i < TIRADAS; i++) {
            apostado += APUESTA;
            const cuadricula = Array.from({ length: 4 }, () => Array.from({ length: 4 }, sacarSimbolo));

            for (const fila of cuadricula) {
                if (fila[0].val === 0) continue;
                let iguales = [];
                if (fila[0].id === fila[1].id && fila[1].id === fila[2].id && fila[2].id === fila[3].id) iguales = [0, 1, 2, 3];
                else if (fila[0].id === fila[1].id && fila[1].id === fila[2].id) iguales = [0, 1, 2];
                else if (fila[1].id === fila[2].id && fila[2].id === fila[3].id && fila[1].val > 0) iguales = [1, 2, 3];

                if (iguales.length >= 3) {
                    pagado += APUESTA * fila[iguales[0]].val * (iguales.length === 4 ? 2 : 1);
                }
            }
        }

        const devuelve = (pagado / apostado) * 100;
        assert.ok(devuelve < TOPE_SANO, `Los slots devuelven el ${devuelve.toFixed(1)}%: REGALAN dinero`);
        assert.ok(devuelve > SUELO_SANO, `Los slots devuelven el ${devuelve.toFixed(1)}%: demasiado duros`);
    });

    test('en la torre, cuanto mas subes peor te sale (ninguna planta regala)', () => {
        const PROBABILIDAD_DE_ACERTAR = 2 / 3;   // 3 casillas, 1 trampa

        let anterior = Infinity;
        TOWER_MULTIPLIERS.forEach((multiplicador, i) => {
            const planta = i + 1;
            const devuelve = Math.pow(PROBABILIDAD_DE_ACERTAR, planta) * multiplicador * 100;

            assert.ok(devuelve < TOPE_SANO,
                `La planta ${planta} de la torre devuelve el ${devuelve.toFixed(1)}%: REGALA dinero`);

            // Que empeore al subir es lo que hace que arriesgar signifique algo
            assert.ok(devuelve < anterior,
                `La planta ${planta} paga mejor que la anterior: subir deberia ser mas arriesgado, no mas rentable`);
            anterior = devuelve;
        });
    });
});

/**
 * LOS COFRES
 *
 * Son el puente entre las fichas del casino y las monedas de la tienda, asi que
 * comparten el problema del casino: si dan de mas, imprimen monedas; si dan de
 * menos, comprarlos es tirar el dinero. Y no se nota abriendo uno.
 *
 * Lo que habia: los CUATRO devolvian exactamente lo mismo (100 o 10) costaran 50
 * fichas o 1.000. El Legendario costaba veinte veces mas que el Ronoso y daba lo
 * mismo, con "alto riesgo, alta recompensa" en la descripcion.
 */
describe('Cofres: lo caro tiene que dar mas que lo barato', () => {

    const PRECIOS = [50, 120, 250, 1000];
    const TIRADAS = 60000;

    const mediaDe = (precio) => {
        let total = 0;
        for (let i = 0; i < TIRADAS; i++) total += premioDeCofre(precio);
        return total / TIRADAS;
    };

    test('todos devuelven la misma proporcion, y ninguno regala dinero', () => {
        for (const precio of PRECIOS) {
            const porcentaje = (mediaDe(precio) / precio) * 100;

            assert.ok(porcentaje < 100,
                `El cofre de ${precio} devuelve el ${porcentaje.toFixed(1)}%: esta REGALANDO monedas`);

            // La proporcion de referencia es la que ya tenia el cofre barato
            // (56%): si un cofre se sale de ahi, es que su premio dejo de
            // depender de su precio, que es justo el fallo que hubo.
            assert.ok(Math.abs(porcentaje - 56) < 3,
                `El cofre de ${precio} devuelve el ${porcentaje.toFixed(1)}%, y deberia rondar el 56% como los demas`);
        }
    });

    test('cuanto mas caro es el cofre, mas da', () => {
        let anterior = 0;
        for (const precio of PRECIOS) {
            const media = mediaDe(precio);
            assert.ok(media > anterior,
                `El cofre de ${precio} no da mas que el anterior: pagar mas tiene que servir para algo`);
            anterior = media;
        }
    });

    test('el cofre barato sigue dando lo mismo que siempre', () => {
        // 50 fichas -> 100 monedas una de cada cinco veces, 10 el resto. Es el
        // unico que estaba bien, asi que el arreglo no puede haberlo movido.
        const salidas = new Set();
        for (let i = 0; i < 2000; i++) salidas.add(premioDeCofre(50));
        assert.deepStrictEqual([...salidas].sort((a, b) => a - b), [10, 100]);
    });

    test('un precio imposible no genera premios imposibles', () => {
        for (const basura of ['mucho', -50, 0, null, undefined, Infinity, NaN]) {
            const premio = premioDeCofre(basura);
            assert.strictEqual(premio, 0, `premioDeCofre(${basura}) deberia dar 0 y da ${premio}`);
        }
    });
});
