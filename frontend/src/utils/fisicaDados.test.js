import { describe, test, expect } from 'vitest';
import { trayectoriaDado, caraQueEnseña, ORIENTACION, PIPS, DURACION } from './fisicaDados';

/**
 * LA FÍSICA DE LOS DADOS
 *
 * La condición que no se puede romper: al terminar, el cubo enseña la cara
 * que dijo el servidor. Todas las vueltas y los botes son adorno alrededor de
 * eso. Un dado que se queda enseñando un 4 cuando el servidor pagó por un 3 es
 * el peor fallo posible en un juego con fichas.
 */

// Un azar determinista para poder repetir los casos.
const azarFijo = (semilla) => {
    let x = semilla;
    return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
};

describe('Un dado', () => {

    test('⚠️ ACABA ENSEÑANDO LA CARA QUE LE DIJERON, con cualquier azar', () => {
        for (let cara = 1; cara <= 6; cara++) {
            for (let semilla = 1; semilla <= 12; semilla++) {
                const d = trayectoriaDado({ cara, azar: azarFijo(semilla) });
                const fin = d.estado(d.duracion);
                expect(caraQueEnseña(fin.rotX, fin.rotY)).toBe(cara);
            }
        }
    });

    test('y sigue enseñándola aunque se mire tarde', () => {
        const d = trayectoriaDado({ cara: 5, azar: azarFijo(3) });
        const fin = d.estado(d.duracion + 1000);
        expect(caraQueEnseña(fin.rotX, fin.rotY)).toBe(5);
        expect(fin.altura).toBe(0);
    });

    test('da varias vueltas enteras, no medio giro', () => {
        const d = trayectoriaDado({ cara: 1, azar: azarFijo(7) });
        // La cara 1 es (0,0): sin vueltas de adorno no giraría nada.
        expect(Math.abs(d.finX)).toBeGreaterThanOrEqual(720);
        expect(Math.abs(d.finY)).toBeGreaterThanOrEqual(720);
    });

    test('empieza en el aire y acaba en la mesa', () => {
        const d = trayectoriaDado({ cara: 2, azar: azarFijo(1) });
        expect(d.estado(0).altura).toBeLessThan(-100);
        expect(d.estado(0).enElAire).toBe(true);
        expect(d.estado(d.duracion).altura).toBe(0);
        expect(d.estado(d.duracion).enElAire).toBe(false);
    });

    test('BOTA: toca la mesa tres veces, cada bote más bajo', () => {
        const d = trayectoriaDado({ cara: 3, azar: azarFijo(2) });
        // Entre aterrizaje y aterrizaje sube: se mira la altura máxima de cada
        // tramo en el aire.
        const [a1, a2, a3] = d.aterrizajes;
        const maxEntre = (desde, hasta) => {
            let m = 0;
            for (let ms = desde + 5; ms < hasta; ms += 5) m = Math.min(m, d.estado(ms).altura);
            return m;   // negativo = arriba
        };
        const bote1 = maxEntre(a1, a2);
        const bote2 = maxEntre(a2, a3);
        expect(bote1).toBeLessThan(-20);       // sube de verdad
        expect(bote2).toBeLessThan(-5);
        expect(bote2).toBeGreaterThan(bote1);  // pero menos que el anterior
        // Y en cada aterrizaje está en la mesa.
        for (const a of d.aterrizajes) expect(Math.abs(d.estado(a).altura)).toBeLessThan(0.01);
    });

    test('deja de girar al tocar la mesa por última vez', () => {
        const d = trayectoriaDado({ cara: 6, azar: azarFijo(5) });
        const ultimo = d.aterrizajes[2];
        const a = d.estado(ultimo);
        const b = d.estado(ultimo + 300);
        // Un dado que sigue girando después de pararse en la mesa es un dado
        // que flota.
        expect(Math.abs(a.rotX - b.rotX)).toBeLessThan(1e-6);
        expect(Math.abs(a.rotY - b.rotY)).toBeLessThan(1e-6);
    });

    test('el giro frena: al principio rápido, al final lento', () => {
        const d = trayectoriaDado({ cara: 4, azar: azarFijo(9) });
        const v = (ms) => Math.abs(d.estado(ms + 50).rotX - d.estado(ms).rotX);
        expect(v(100)).toBeGreaterThan(v(d.aterrizajes[2] - 100) * 3);
    });

    test('el segundo dado sale un poco después y termina un poco después', () => {
        const a = trayectoriaDado({ cara: 1, azar: azarFijo(1) });
        const b = trayectoriaDado({ cara: 1, azar: azarFijo(1), retraso: 120 });
        expect(b.duracion).toBe(a.duracion + 120);
        // Antes de salir, el segundo está donde el primero al arrancar.
        expect(b.estado(60).altura).toBe(a.estado(0).altura);
    });

    test('dos dados con distinto azar no giran igual', () => {
        const a = trayectoriaDado({ cara: 3, azar: azarFijo(1) });
        const b = trayectoriaDado({ cara: 3, azar: azarFijo(2) });
        // Misma cara final, pero por caminos distintos: si giraran igual se
        // notaría falso al momento.
        expect(a.finX === b.finX && a.finY === b.finY && a.finZ === b.finZ).toBe(false);
    });
});

describe('Las caras', () => {

    test('las opuestas suman 7, como en un dado de verdad', () => {
        // 1-6 son frente y dorso, 2-5 derecha e izquierda, 3-4 arriba y abajo.
        const opuestos = [[1, 6], [2, 5], [3, 4]];
        for (const [a, b] of opuestos) {
            expect(a + b).toBe(7);
            // Y en la orientación, la opuesta es la misma rotación más 180°.
            const oa = ORIENTACION[a], ob = ORIENTACION[b];
            const distancia = Math.abs((oa.x - ob.x) + (oa.y - ob.y));
            expect(distancia % 180).toBe(0);
            expect(distancia).toBeGreaterThan(0);
        }
    });

    test('cada cara tiene el número de puntos que dice', () => {
        for (let n = 1; n <= 6; n++) expect(PIPS[n].length).toBe(n);
    });

    test('caraQueEnseña deshace ORIENTACION', () => {
        for (let n = 1; n <= 6; n++) {
            const o = ORIENTACION[n];
            expect(caraQueEnseña(o.x + 720, o.y - 1080)).toBe(n);
        }
    });

    test('la duración es de un tiro, no de una espera', () => {
        // Entre 2 y 4 segundos: menos no da tiempo a ver los botes, más es
        // una espera con fichas en juego.
        expect(DURACION).toBeGreaterThanOrEqual(2000);
        expect(DURACION).toBeLessThanOrEqual(4000);
    });
});
