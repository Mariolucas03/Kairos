const { test, describe } = require('node:test');
const assert = require('node:assert');

const { getRankForPoints, RANKS, ESCALONES, SUBRANGOS } = require('../services/muscleRankService');
const { premioPorSubir } = require('../services/rankUpService');

/**
 * LOS RANGOS POR MUSCULO: diez rangos, tres escalones cada uno.
 */
describe('Rangos musculares con tres escalones', () => {
    test('hay treinta escalones, seguidos y crecientes', () => {
        assert.strictEqual(ESCALONES.length, RANKS.length * SUBRANGOS);
        for (let i = 1; i < ESCALONES.length; i++) {
            assert.ok(ESCALONES[i].min > ESCALONES[i - 1].min, `el escalon ${ESCALONES[i].label} no sube`);
        }
        assert.deepStrictEqual(ESCALONES.slice(3, 6).map(e => e.label), ['Madera I', 'Madera II', 'Madera III']);
    });

    test('el escalon 1 de cada rango empieza donde empieza el rango', () => {
        for (const r of RANKS) {
            const primero = ESCALONES.find(e => e.key === r.key && e.tier === 1);
            assert.strictEqual(primero.min, r.min);
        }
    });

    test('con los puntos justos se esta en el escalon, y el progreso es hacia el siguiente', () => {
        const madera2 = ESCALONES.find(e => e.label === 'Madera II');
        const r = getRankForPoints(madera2.min);
        assert.strictEqual(r.rankLabel, 'Madera II');
        assert.strictEqual(r.rank, 'madera');
        assert.strictEqual(r.tier, 2);
        assert.strictEqual(r.progress, 0);
        assert.strictEqual(r.nextRankLabel, 'Madera III');
        assert.strictEqual(getRankForPoints(0).rankLabel, 'Novato I');
        assert.strictEqual(getRankForPoints(1e9).rankLabel, 'Leyenda III');
        assert.strictEqual(getRankForPoints(1e9).nextRankLabel, null);
    });

    test('la escala es alcanzable: Madera en la primera semana, Leyenda en años', () => {
        const madera = RANKS.find(r => r.key === 'madera').min;
        const leyenda = RANKS.find(r => r.key === 'leyenda').min;
        const SESION = 2000;   // kg que deja una sesion normal en un grupo
        assert.ok(madera / SESION <= 3, `Madera cuesta ${madera / SESION} sesiones: demasiado para el primer rango`);
        assert.ok(leyenda / SESION >= 250, 'Leyenda no puede sacarse en un año');
    });

    test('los colores se distinguen: ninguno repetido y ninguno casi igual a su vecino', () => {
        const hex = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
        const dist = (a, b) => Math.hypot(...hex(a).map((v, i) => v - hex(b)[i]));
        const colores = RANKS.map(r => r.color);
        assert.strictEqual(new Set(colores).size, colores.length);
        for (let i = 0; i < colores.length; i++) for (let j = i + 1; j < colores.length; j++) {
            assert.ok(dist(colores[i], colores[j]) > 60, `${RANKS[i].label} y ${RANKS[j].label} se parecen demasiado`);
        }
    });

    test('el premio por subir crece con el rango, no con el escalon', () => {
        // Los tres escalones de Madera pagan lo mismo entre si...
        assert.strictEqual(premioPorSubir(3, 4), premioPorSubir(4, 5));
        // ...y Bronce paga mas que Madera
        assert.ok(premioPorSubir(6, 7) > premioPorSubir(3, 4));
        // Y subir varios de golpe suma cada uno
        assert.strictEqual(premioPorSubir(3, 5), premioPorSubir(3, 4) + premioPorSubir(4, 5));
    });
});
