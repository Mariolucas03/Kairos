const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
    SCRATCH_SYMBOLS, SLOT_SYMBOLS, FORTUNE_PRIZES, FORTUNE_COSTS, TOWER_MULTIPLIERS, TOWER_ULTIMA, TOWER_PISTA,
    PLINKO_MULTIPLICADORES, PLINKO_FILAS
} = require('../controllers/gamesController');

const { premioDelRasca } = require('../controllers/gamesController');

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

    // Reparto de premios cuando toca, tal como lo hace playScratch
    const REPARTO_RASCA = [
        { simbolo: SCRATCH_SYMBOLS.DIAMOND, probabilidad: 0.05 },
        { simbolo: SCRATCH_SYMBOLS.XP, probabilidad: 0.15 },
        { simbolo: SCRATCH_SYMBOLS.COIN, probabilidad: 0.30 },
        { simbolo: SCRATCH_SYMBOLS.LEMON, probabilidad: 0.50 }
    ];

    const loQueDevuelveElRasca = (apuesta) => {
        const RITMO_DE_VICTORIA = 0.35;
        // El XP no son fichas: no cuenta para lo que devuelve el juego
        const mediaEnFichas = REPARTO_RASCA
            .filter(r => r.simbolo.type !== 'xp')
            .reduce((total, r) => total + r.probabilidad * premioDelRasca(r.simbolo, apuesta), 0);
        return (RITMO_DE_VICTORIA * mediaEnFichas / apuesta) * 100;
    };

    test('el rasca devuelve entre el 70% y el 100%', () => {
        const devuelve = loQueDevuelveElRasca(10);

        assert.ok(devuelve < TOPE_SANO,
            `El rasca devuelve el ${devuelve.toFixed(1)}%: esta REGALANDO dinero`);
        assert.ok(devuelve > SUELO_SANO,
            `El rasca devuelve el ${devuelve.toFixed(1)}%: es tan duro que no merece la pena jugar`);
    });

    test('y devuelve lo mismo apuestes lo que apuestes', () => {
        // Desde que la apuesta del rasca es libre, el porcentaje tiene que ser
        // el mismo a 10 que a 1.000: si escalara mal, apostar fuerte seria una
        // impresora de dinero o un atraco, y en ninguno de los dos casos daria
        // error en ningun sitio.
        for (const apuesta of [10, 25, 50, 100, 500, 1000]) {
            const devuelve = loQueDevuelveElRasca(apuesta);
            assert.ok(devuelve < TOPE_SANO && devuelve > SUELO_SANO,
                `Con ${apuesta} fichas el rasca devuelve el ${devuelve.toFixed(1)}%`);
        }
    });

    test('a 10 fichas paga EXACTAMENTE lo de siempre', () => {
        // La apuesta de 10 era la unica que existia. Que sus premios no se hayan
        // movido es lo que hace que este cambio sea de escala y no de economia.
        assert.strictEqual(premioDelRasca(SCRATCH_SYMBOLS.DIAMOND, 10), 150);
        assert.strictEqual(premioDelRasca(SCRATCH_SYMBOLS.COIN, 10), 30);
        assert.strictEqual(premioDelRasca(SCRATCH_SYMBOLS.LEMON, 10), 15);
        assert.strictEqual(premioDelRasca(SCRATCH_SYMBOLS.XP, 10), 75);
    });

    test('el XP del rasca NO escala con la apuesta', () => {
        // El XP decide el ranking mensual. Ya se bajo una vez de 200 a 75 porque
        // el ranking se ganaba dandole al rasca en vez de entrenando; si
        // escalara, apostar 500 daria 3.750 XP por tirada.
        for (const apuesta of [10, 100, 1000]) {
            assert.strictEqual(premioDelRasca(SCRATCH_SYMBOLS.XP, apuesta), 75,
                `Con ${apuesta} fichas el XP deberia seguir siendo 75`);
        }
    });

    test('LOS MULTIPLOS ESTAN TAMBIEN EN EL MOVIL', () => {
        // ⚠️ Esta prueba no mide nada: es un aviso.
        //
        // frontend/src/pages/games/ScratchGame.jsx pinta la tabla de premios con
        // estos mismos numeros. Ya se desincronizaron una vez —la app enseñaba
        // 500/200/100/50 cuando el servidor pagaba 150/75/30/15, o sea 3,3 veces
        // mas de lo que cobrabas— y nadie se entero durante meses.
        //
        // Si esto falla, cambia tambien la tabla del movil.
        assert.strictEqual(SCRATCH_SYMBOLS.DIAMOND.multiplo, 15);
        assert.strictEqual(SCRATCH_SYMBOLS.COIN.multiplo, 3);
        assert.strictEqual(SCRATCH_SYMBOLS.LEMON.multiplo, 1.5);
        assert.strictEqual(SCRATCH_SYMBOLS.XP.prize, 75);
    });

    test('un premio partido se redondea hacia abajo, no hacia arriba', () => {
        // 1,5 x 25 son 37,5 fichas, y media ficha no existe. Redondear hacia
        // arriba en cada tirada sube lo que devuelve el juego sin que se vea.
        assert.strictEqual(premioDelRasca(SCRATCH_SYMBOLS.LEMON, 25), 37);
        assert.strictEqual(premioDelRasca(SCRATCH_SYMBOLS.LEMON, 15), 22);
    });

    test('una calavera no paga nada, se apueste lo que se apueste', () => {
        assert.strictEqual(premioDelRasca(SCRATCH_SYMBOLS.SKULL, 1000), 0);
        assert.strictEqual(premioDelRasca(SCRATCH_SYMBOLS.POOP, 1000), 0);
        assert.strictEqual(premioDelRasca(null, 100), 0);
    });

    test('TODAS las ruedas de pago devuelven entre el 70% y el 100%', () => {
        // Se recorren las que haya, no una lista escrita aqui: el dia que se
        // añada una rueda queda vigilada sin tocar la prueba. Las de XP no se
        // miden en fichas y van aparte.
        const soloFichas = (m) => FORTUNE_PRIZES[m].every(p => p.t === 'c');
        const dePago = Object.keys(FORTUNE_COSTS).filter(m => FORTUNE_COSTS[m] > 0 && soloFichas(m));
        assert.ok(dePago.length >= 4, 'tiene que haber varias ruedas de pago');
        for (const modo of dePago) {
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

    test('las ruedas de pago devuelven EXACTAMENTE el 85%: el mismo margen que los dados', () => {
        // Entre 70 y 100 es "sano". Pero la regla de la casa es 85 clavado, y
        // una rueda al 99% seria "sana" y aun asi la mejor forma de ganar
        // fichas de la app. Redondeo de 1% por los enteros de los premios.
        for (const modo of Object.keys(FORTUNE_COSTS)) {
            const coste = FORTUNE_COSTS[modo];
            if (coste === 0 || !FORTUNE_PRIZES[modo].every(p => p.t === 'c')) continue;
            const premios = FORTUNE_PRIZES[modo].map(p => p.v);
            const media = premios.reduce((a, b) => a + b, 0) / premios.length;
            assert.ok(Math.abs(media / coste - 0.85) < 0.01,
                `La rueda "${modo}" devuelve el ${(media / coste * 100).toFixed(1)}%, no el 85%`);
        }
    });

    test('la rueda de experiencia es modesta: un entreno da mas', () => {
        const xp = Object.keys(FORTUNE_PRIZES).filter(m => FORTUNE_PRIZES[m].every(p => p.t === 'xp'));
        for (const modo of xp) {
            const premios = FORTUNE_PRIZES[modo].map(p => p.v);
            const media = premios.reduce((a, b) => a + b, 0) / premios.length;
            assert.ok(media <= 100, `La rueda "${modo}" da ${media} XP de media: comprar niveles a golpe de ruleta`);
            assert.ok(FORTUNE_COSTS[modo] > 0, 'la de XP no puede ser gratis');
        }
    });

    test('la rueda de vida es modesta y de pago: la vida no se compra a golpe de ruleta', () => {
        const vida = Object.keys(FORTUNE_PRIZES).filter(m => FORTUNE_PRIZES[m].every(p => p.t === 'hp'));
        assert.ok(vida.length >= 1, 'tiene que haber una rueda de vida');
        for (const modo of vida) {
            const premios = FORTUNE_PRIZES[modo].map(p => p.v);
            const media = premios.reduce((a, b) => a + b, 0) / premios.length;
            assert.ok(media <= 25, `La rueda "${modo}" da ${media} de vida de media: demasiado`);
            assert.ok(FORTUNE_COSTS[modo] > 0, 'la de vida no puede ser gratis');
        }
    });

    test('en las ruedas mezcladas, la parte en fichas sola no llega al 85%', () => {
        // Si las fichas solas ya devolvieran el 85%, lo demas (XP, vida) seria
        // regalo encima: la rueda saldria mejor que cualquier otra.
        const mezcladas = Object.keys(FORTUNE_PRIZES).filter(m => {
            const tipos = new Set(FORTUNE_PRIZES[m].map(p => p.t));
            return tipos.size > 1;
        });
        assert.ok(mezcladas.length >= 1, 'tiene que haber una rueda de mezcla');
        for (const modo of mezcladas) {
            const coste = FORTUNE_COSTS[modo];
            const fichas = FORTUNE_PRIZES[modo].filter(p => p.t === 'c').map(p => p.v);
            const media = fichas.reduce((a, b) => a + b, 0) / FORTUNE_PRIZES[modo].length;
            assert.ok(media / coste < 0.85, `La rueda "${modo}" devuelve el ${(media / coste * 100).toFixed(0)}% solo en fichas, y encima da XP y vida`);
            assert.ok(media / coste > 0.5, `La rueda "${modo}" casi no da fichas`);
        }
    });

    test('cada rueda del catalogo tiene lo que el movil necesita para pintarla', () => {
        // El movil ya no tiene ninguna copia: si aqui falta el nombre o el color,
        // la rueda sale sin el.
        const { RUEDAS } = require('../controllers/gamesController');
        for (const r of RUEDAS) {
            assert.ok(r.id && r.nombre && r.acento && r.descripcion, `rueda incompleta: ${JSON.stringify(r).slice(0, 60)}`);
            assert.ok(r.premios.length >= 6 && r.premios.length <= 8, `${r.id}: entre 6 y 8 premios, para que se lean`);
            for (const p of r.premios) assert.ok(typeof p.v === 'number' && ['c', 'xp', 'hp'].includes(p.t));
        }
        const ids = RUEDAS.map(r => r.id);
        assert.strictEqual(new Set(ids).size, ids.length, 'dos ruedas con el mismo id');
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
        // La ultima planta tiene sus propias losas y trampas.
        const ULTIMA = (TOWER_ULTIMA.tiles - TOWER_ULTIMA.traps) / TOWER_ULTIMA.tiles;
        const esLaUltima = (i) => i === TOWER_MULTIPLIERS.length - 1;

        let anterior = Infinity;
        TOWER_MULTIPLIERS.forEach((multiplicador, i) => {
            const planta = i + 1;
            const acertarHastaAqui = Math.pow(PROBABILIDAD_DE_ACERTAR, esLaUltima(i) ? planta - 1 : planta) * (esLaUltima(i) ? ULTIMA : 1);
            const devuelve = acertarHastaAqui * multiplicador * 100;

            assert.ok(devuelve < TOPE_SANO,
                `La planta ${planta} de la torre devuelve el ${devuelve.toFixed(1)}%: REGALA dinero`);

            // Que empeore al subir es lo que hace que arriesgar signifique algo
            assert.ok(devuelve < anterior,
                `La planta ${planta} paga mejor que la anterior: subir deberia ser mas arriesgado, no mas rentable`);
            anterior = devuelve;
        });
    });

    test('el plinko devuelve EXACTAMENTE el 85%, y los bordes son lo que mas paga', () => {
        // La bola cae a un lado u otro en cada fila: la casilla k tiene
        // probabilidad C(filas, k) / 2^filas.
        const n = PLINKO_FILAS;
        assert.strictEqual(PLINKO_MULTIPLICADORES.length, n + 1, 'una casilla por cada numero de derechas posible');
        const comb = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
        const devuelve = PLINKO_MULTIPLICADORES.reduce((acc, m, k) => acc + (comb(n, k) / Math.pow(2, n)) * m, 0);
        assert.ok(Math.abs(devuelve - 0.85) < 0.01, `El plinko devuelve el ${(devuelve * 100).toFixed(1)}%, no el 85%`);

        // Como el plinko de verdad: hacia los bordes se paga mas, en el centro
        // se pierde algo. Y que no sea un juego imposible: al menos un tercio
        // de las bolas tiene que devolver la bola entera o mas.
        const centro = Math.floor(n / 2);
        for (let k = 1; k <= centro; k++) {
            assert.ok(PLINKO_MULTIPLICADORES[k] <= PLINKO_MULTIPLICADORES[k - 1], `la casilla ${k} paga mas que la ${k - 1}`);
            assert.strictEqual(PLINKO_MULTIPLICADORES[k], PLINKO_MULTIPLICADORES[n - k], 'el triangulo es simetrico');
        }
        assert.ok(PLINKO_MULTIPLICADORES[centro] < 1, 'en el centro se pierde algo');
        assert.ok(PLINKO_MULTIPLICADORES[0] >= 10, 'en las puntas hay premio gordo');
        const recuperan = PLINKO_MULTIPLICADORES.reduce((acc, m, k) => acc + (m >= 1 ? comb(n, k) / Math.pow(2, n) : 0), 0);
        assert.ok(recuperan >= 0.33, `solo el ${(recuperan * 100).toFixed(0)}% de las bolas devuelve algo: demasiado dificil`);
    });

    test('ruleta: a caballo y esquina solo entre numeros que se tocan en el tapete', () => {
        const { getCanonicalRouletteBet: canon } = require('../controllers/gamesController');
        assert.deepStrictEqual(canon('split', '5-8'), { numbers: [5, 8], multiplier: 18 });   // de lado
        assert.deepStrictEqual(canon('split', '5-6'), { numbers: [5, 6], multiplier: 18 });   // arriba-abajo
        assert.strictEqual(canon('split', '1-36'), null);
        assert.strictEqual(canon('split', '3-4'), null);      // el 3 arriba de una columna y el 4 abajo de la siguiente: no se tocan
        assert.strictEqual(canon('split', '5-5'), null);
        assert.deepStrictEqual(canon('corner', '5-6-8-9'), { numbers: [5, 6, 8, 9], multiplier: 9 });
        assert.deepStrictEqual(canon('corner', '9-8-5-6'), { numbers: [5, 6, 8, 9], multiplier: 9 });
        assert.strictEqual(canon('corner', '3-4-6-7'), null);   // el 3 no tiene fila de abajo
        assert.strictEqual(canon('corner', '1-2-3-4'), null);
        // Y pagan lo justo: 36 casillas + el cero, sin regalar
        assert.ok(18 * 2 / 37 < 1 && 9 * 4 / 37 < 1);
    });

    test('la pista de la torre no es un regalo: cuesta mas de lo que vale', () => {
        // Pasar de 1/2 a 2/3 de acertar vale (2/3 - 1/2) = 1/6 del premio final.
        // Si se cobrara menos, comprar la pista seria ganar dinero a la casa.
        const sinPista = (TOWER_ULTIMA.tiles - TOWER_ULTIMA.traps) / TOWER_ULTIMA.tiles;
        const conPista = (TOWER_ULTIMA.tiles - TOWER_ULTIMA.traps) / (TOWER_ULTIMA.tiles - 1);
        const valeDeVerdad = conPista - sinPista;
        assert.ok(TOWER_PISTA > valeDeVerdad, `La pista cuesta el ${(TOWER_PISTA * 100).toFixed(0)}% del premio y vale el ${(valeDeVerdad * 100).toFixed(1)}%: REGALA dinero`);
        assert.ok(TOWER_PISTA < valeDeVerdad * 1.5, 'La pista es tan cara que nadie la compraria');
    });
});

/**
 * LOS COFRES
 *
 * Se compran con fichas y dan fichas, XP u objetos. Comparten el problema del
 * casino: si dan de mas, imprimen fichas; si dan de menos, comprarlos es tirar
 * el dinero. Y no se nota abriendo uno. Aqui se mide cada tabla: los objetos
 * valen su precio de tienda, las fichas lo que son, y el XP no cuenta (es el
 * extra). Cada cofre tiene que devolver entre el 60% y el 90% de su precio.
 */
describe('Cofres: diez tablas, y ninguna regala ni estafa', () => {
    const { COFRES, resumenDe, tirar } = require('../services/cofresService');
    const { SEED_ITEMS } = require('../controllers/shopController');

    // El precio medio de un objeto del catalogo por rareza y categoria, que es
    // lo que vale de verdad sacarlo de un cofre.
    const precioMedio = (rareza, categorias) => {
        const lista = SEED_ITEMS.filter(i => i.rarity === rareza && categorias.includes(i.category) && i.price > 0 && i.category !== 'chest');
        assert.ok(lista.length > 0, `no hay objetos ${rareza} en ${categorias.join(',')}: el cofre daria fichas de relleno`);
        return lista.reduce((a, i) => a + i.price, 0) / lista.length;
    };

    const valorMedio = (cofre) => {
        const total = cofre.tabla.reduce((a, e) => a + e.peso, 0);
        return cofre.tabla.reduce((acc, e) => {
            const p = e.peso / total;
            if (e.t === 'fichas') return acc + p * (e.min + e.max) / 2;
            if (e.t === 'xp') return acc;
            return acc + p * precioMedio(e.rareza, e.categorias);
        }, 0);
    };

    test('hay diez cofres, con id, precio y tabla', () => {
        assert.strictEqual(COFRES.length, 10);
        const ids = new Set(COFRES.map(c => c.id));
        assert.strictEqual(ids.size, 10, 'dos cofres con el mismo id');
        for (const c of COFRES) {
            assert.ok(c.precio > 0 && c.nombre && c.icono && c.descripcion, `cofre incompleto: ${c.id}`);
            assert.ok(c.tabla.length >= 2, `${c.id}: una tabla de un solo premio no es un cofre`);
        }
    });

    test('ningun cofre devuelve mas del 90% ni menos del 60% de lo que cuesta', () => {
        for (const c of COFRES) {
            const devuelve = valorMedio(c) / c.precio * 100;
            assert.ok(devuelve < 90, `El ${c.nombre} devuelve el ${devuelve.toFixed(0)}%: REGALA fichas`);
            assert.ok(devuelve > 60, `El ${c.nombre} devuelve el ${devuelve.toFixed(0)}%: es tirar el dinero`);
        }
    });

    test('los cofres no dan monedas de oro: fichas, XP u objetos, nada mas', () => {
        for (const c of COFRES) for (const e of c.tabla) {
            assert.ok(['fichas', 'xp', 'objeto'].includes(e.t), `${c.id}: premio de tipo ${e.t}`);
            if (e.t === 'objeto') assert.ok(!e.categorias.includes('chest') && !e.categorias.includes('reward'), `${c.id}: un cofre no puede dar cofres ni premios personales`);
        }
    });

    test('los porcentajes que se enseñan suman 100 y salen de la misma tabla que paga', () => {
        for (const c of COFRES) {
            const resumen = resumenDe(c);
            const suma = resumen.reduce((a, r) => a + r.porcentaje, 0);
            assert.ok(Math.abs(suma - 100) < 0.5, `${c.id}: los porcentajes suman ${suma}`);
            assert.strictEqual(resumen.length, c.tabla.length);
        }
    });

    test('la tirada respeta los pesos', () => {
        const tabla = [{ t: 'a', peso: 90 }, { t: 'b', peso: 10 }];
        let b = 0;
        for (let i = 0; i < 20000; i++) if (tirar(tabla).t === 'b') b++;
        const pct = b / 200;
        assert.ok(pct > 8 && pct < 12, `el premio del 10% sale el ${pct}%`);
    });
});
