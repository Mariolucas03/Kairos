import { describe, test, expect } from 'vitest';
import { trayectoriaPlinko, clavo, casilla, FILAS, CENTRO_X, PASO, ARRIBA, ALTO } from './fisicaPlinko';

const todoDerecha = Array(FILAS).fill(1);
const todoIzquierda = Array(FILAS).fill(0);
const alterno = Array.from({ length: FILAS }, (_, i) => i % 2);

describe('fisicaPlinko', () => {
    test('la bola aterriza siempre SOBRE un clavo en cada fila', () => {
        // Es lo que hace que rebote: la fila r tiene r+3 clavos y la bola,
        // venga de donde venga, cae justo encima de uno.
        for (const camino of [todoDerecha, todoIzquierda, alterno]) {
            const tr = trayectoriaPlinko({ camino });
            for (let r = 0; r < FILAS; r++) {
                const ms = 220 + r * 150;   // el instante en que llega a la fila r
                const p = tr.posicion(ms);
                const hayClavo = Array.from({ length: r + 3 }, (_, i) => clavo(r, i)).some(c => Math.abs(c.x - p.x) < 0.01 && Math.abs(c.y - p.y) < 0.01);
                expect(hayClavo, `fila ${r} con camino ${camino.join('')}`).toBe(true);
            }
        }
    });

    test('cae en la casilla que dice la cuenta de derechas', () => {
        expect(trayectoriaPlinko({ camino: todoDerecha }).casilla).toBe(FILAS);
        expect(trayectoriaPlinko({ camino: todoIzquierda }).casilla).toBe(0);
        expect(trayectoriaPlinko({ camino: alterno }).casilla).toBe(FILAS / 2);

        // Y la posicion final es el centro de esa casilla
        const tr = trayectoriaPlinko({ camino: alterno });
        const fin = tr.posicion(tr.duracion);
        expect(fin.x).toBeCloseTo(casilla(FILAS / 2).x, 5);
        expect(fin.y).toBeCloseTo(casilla(FILAS / 2).y, 5);
        expect(fin.x).toBeCloseTo(CENTRO_X, 5);
    });

    test('empieza arriba del todo, encima del clavo central, y no da saltos', () => {
        const tr = trayectoriaPlinko({ camino: alterno });
        const p0 = tr.posicion(0);
        expect(p0.x).toBe(CENTRO_X);
        expect(p0.y).toBeLessThan(ARRIBA);

        // Continuidad: entre dos instantes seguidos no se mueve mas que unos px
        let anterior = p0;
        for (let ms = 8; ms <= tr.duracion; ms += 8) {
            const p = tr.posicion(ms);
            const salto = Math.hypot(p.x - anterior.x, p.y - anterior.y);
            expect(salto, `salto de ${salto.toFixed(1)} en ${ms}ms`).toBeLessThan(PASO);
            anterior = p;
        }
    });

    test('entre clavo y clavo, bota: sube un poco antes de caer', () => {
        const tr = trayectoriaPlinko({ camino: alterno });
        const enClavo = tr.posicion(220 + 3 * 150).y;
        const justoDespues = tr.posicion(220 + 3 * 150 + 30).y;
        expect(justoDespues).toBeLessThan(enClavo);   // y crece hacia abajo: menor = mas arriba
        // ...y llega a la fila siguiente, mas abajo
        expect(tr.posicion(220 + 4 * 150).y).toBeCloseTo(ARRIBA + 4 * ALTO, 5);
    });

    test('cuenta un golpe por clavo, y solo doce', () => {
        const tr = trayectoriaPlinko({ camino: alterno });
        expect(tr.golpesHasta(0)).toBe(0);
        expect(tr.golpesHasta(220)).toBe(1);
        expect(tr.golpesHasta(220 + 150 * 5 + 10)).toBe(6);
        expect(tr.golpesHasta(tr.duracion)).toBe(FILAS);
    });

    test('un camino incompleto no vale', () => {
        expect(() => trayectoriaPlinko({ camino: [1, 0, 1] })).toThrow();
    });
});
