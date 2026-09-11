import { describe, test, expect } from 'vitest';
import { trayectoriaRueda, premioArriba, DURACION } from './fisicaRuedaFortuna';

/**
 * LA RUEDA DE LA FORTUNA
 *
 * La condición que no se rompe: al final, arriba queda el premio que dijo el
 * servidor. El balanceo del final es lo más peligroso: si se pasara más de
 * medio segmento, cruzaría un pivote y enseñaría el premio de al lado.
 */

const casos = [];
for (const giroAlEmpezar of [0, 123, 1800, -400, 3599]) {
    for (const segmentos of [6, 8]) {
        for (const indiceGanador of [0, 1, segmentos - 1]) {
            casos.push({ giroAlEmpezar, segmentos, indiceGanador });
        }
    }
}

describe('La rueda', () => {

    test('⚠️ ACABA CON EL PREMIO GANADOR ARRIBA, siempre', () => {
        for (const c of casos) {
            const tr = trayectoriaRueda(c);
            expect(premioArriba(tr.rueda(DURACION), c.segmentos)).toBe(c.indiceGanador);
            expect(premioArriba(tr.rueda(DURACION + 999), c.segmentos)).toBe(c.indiceGanador);
        }
    });

    test('y en el centro del premio, no en la raya', () => {
        for (const c of casos) {
            const tr = trayectoriaRueda(c);
            const seg = 360 / c.segmentos;
            const arriba = ((-tr.rueda(DURACION)) % 360 + 360) % 360;
            const centro = c.indiceGanador * seg + seg / 2;
            expect(Math.abs(arriba - centro)).toBeLessThan(1e-6);
        }
    });

    test('⚠️ EL BALANCEO FINAL NUNCA CRUZA UN PIVOTE', () => {
        // Se pasa un poco y vuelve, pero siempre dentro del premio ganador. Si
        // en algún instante del balanceo asomara el premio de al lado, la
        // rueda enseñaría un premio distinto del que paga durante un segundo.
        for (const c of casos) {
            const tr = trayectoriaRueda(c);
            for (let ms = tr.msLlegada - 200; ms <= DURACION; ms += 10) {
                expect(premioArriba(tr.rueda(ms), c.segmentos)).toBe(c.indiceGanador);
            }
        }
    });

    test('se pasa y vuelve: el balanceo existe', () => {
        const tr = trayectoriaRueda(casos[0]);
        let maximo = -Infinity;
        for (let ms = tr.msLlegada - 50; ms <= DURACION; ms += 5) maximo = Math.max(maximo, tr.rueda(ms));
        expect(maximo).toBeGreaterThan(tr.giroFinal + 2);
    });

    test('da varias vueltas y frena', () => {
        const tr = trayectoriaRueda(casos[0]);
        expect(tr.giroFinal - casos[0].giroAlEmpezar).toBeGreaterThan(4 * 360);
        expect(tr.velocidad(200)).toBeGreaterThan(tr.velocidad(tr.msLlegada - 100) * 4);
    });
});

describe('La lengüeta', () => {

    test('está doblada justo después de un pivote y recta antes del siguiente', () => {
        const tr = trayectoriaRueda({ giroAlEmpezar: 0, indiceGanador: 0, segmentos: 6 });
        // Se busca un instante en que la rueda acabe de pasar un pivote.
        let msJustoDespues = null;
        for (let ms = 100; ms < 2000; ms += 1) {
            if (tr.pivotesEntre(ms - 1, ms) > 0) { msJustoDespues = ms; break; }
        }
        expect(msJustoDespues).not.toBeNull();
        expect(tr.lengueta(msJustoDespues)).toBeGreaterThan(20);
    });

    test('al final está recta: apunta al premio', () => {
        const tr = trayectoriaRueda({ giroAlEmpezar: 0, indiceGanador: 2, segmentos: 6 });
        // En el centro de un segmento la lengüeta ya se ha recuperado.
        expect(tr.lengueta(DURACION)).toBe(0);
    });

    test('los tics se espacian: muchos al principio, pocos al final', () => {
        const tr = trayectoriaRueda({ giroAlEmpezar: 0, indiceGanador: 3, segmentos: 6 });
        const tics = (desde, hasta) => {
            let n = 0;
            for (let ms = desde + 16; ms <= hasta; ms += 16) n += tr.pivotesEntre(ms - 16, ms);
            return n;
        };
        const alPrincipio = tics(0, 800);
        // Con frenado por rozamiento el ultimo pivote pasa unas 7 decimas antes
        // de pararse: en el ultimo segundo tiene que haber al menos uno.
        const alFinal = tics(tr.msLlegada - 1000, tr.msLlegada);
        expect(alPrincipio).toBeGreaterThan(alFinal * 3);
        expect(alFinal).toBeGreaterThanOrEqual(1);
    });
});
