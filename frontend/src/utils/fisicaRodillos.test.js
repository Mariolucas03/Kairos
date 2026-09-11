import { describe, test, expect } from 'vitest';
import { trayectoriaRodillo, montarTira, PARADAS, RELLENO } from './fisicaRodillos';

/**
 * LOS RODILLOS DE LAS TRAGAPERRAS
 *
 * La condición que no se puede romper: al terminar, la ventana enseña
 * EXACTAMENTE los símbolos que dijo el servidor. Todo el frenado y el encaje
 * son adorno alrededor de eso. Un rodillo que se queda medio símbolo fuera
 * enseña un premio que no se paga, o esconde uno que sí.
 */

describe('Un rodillo', () => {

    test('empieza en 0 y acaba clavado en su sitio', () => {
        for (let i = 0; i < PARADAS.length; i++) {
            const r = trayectoriaRodillo({ relleno: RELLENO[i], duracion: PARADAS[i] });
            expect(r.posicion(0)).toBe(0);
            expect(r.posicion(r.duracion)).toBe(r.fin);
            // Y más allá tampoco se mueve: el bucle puede pasarse un frame.
            expect(r.posicion(r.duracion + 500)).toBe(r.fin);
        }
    });

    test('frena: primero rápido, luego cada vez menos', () => {
        const r = trayectoriaRodillo({ relleno: 30, duracion: 2000 });
        let anterior = Infinity;
        for (let ms = 100; ms <= r.msLlegada; ms += 100) {
            const avance = r.posicion(ms) - r.posicion(ms - 100);
            expect(avance).toBeGreaterThan(0);
            expect(avance).toBeLessThanOrEqual(anterior + 1e-9);
            anterior = avance;
        }
    });

    test('ENCAJA: se pasa un poco y vuelve', () => {
        // Es el "clonc". Sin sobrepasar, el rodillo parece que se congela en
        // vez de pararse contra un tope.
        const r = trayectoriaRodillo({ relleno: 30, duracion: 2000 });
        let maximo = -Infinity;
        for (let ms = r.msLlegada; ms <= r.duracion; ms += 5) maximo = Math.max(maximo, r.posicion(ms));
        expect(maximo).toBeGreaterThan(r.fin + 0.1);
        expect(maximo).toBeLessThan(r.fin + 0.5);   // un poco, no medio símbolo
    });

    test('nunca retrocede antes de llegar ni se queda corto', () => {
        const r = trayectoriaRodillo({ relleno: 40, duracion: 3000 });
        for (let ms = 0; ms <= r.duracion; ms += 10) {
            expect(r.posicion(ms)).toBeGreaterThanOrEqual(0);
            if (ms <= r.msLlegada) expect(r.posicion(ms)).toBeLessThanOrEqual(r.fin + 1e-9);
        }
    });

    test('los rodillos se paran uno detrás de otro, cada vez más separados', () => {
        for (let i = 1; i < PARADAS.length; i++) {
            expect(PARADAS[i]).toBeGreaterThan(PARADAS[i - 1]);
        }
        // Y el hueco crece: el último tiene que hacer sufrir.
        const huecos = PARADAS.slice(1).map((p, i) => p - PARADAS[i]);
        for (let i = 1; i < huecos.length; i++) expect(huecos[i]).toBeGreaterThanOrEqual(huecos[i - 1]);
    });

    test('la velocidad es alta al principio y cero al final', () => {
        const r = trayectoriaRodillo({ relleno: 30, duracion: 2000 });
        expect(r.velocidad(100)).toBeGreaterThan(r.velocidad(r.msLlegada - 50));
        expect(r.velocidad(r.duracion + 50)).toBe(0);
    });
});

describe('La tira de símbolos', () => {

    const catalogo = ['a', 'b', 'c', 'd'];

    test('acaba con los definitivos, en su orden', () => {
        const tira = montarTira({ relleno: 10, definitivos: ['c', 'a', 'd', 'b'], catalogo });
        expect(tira.length).toBe(14);
        expect(tira.slice(-4)).toEqual(['c', 'a', 'd', 'b']);
    });

    test('el relleno no repite dos iguales seguidos', () => {
        // Con un azar fijo que siempre daría 'a', el reintento tiene que
        // romper la repetición.
        let n = 0;
        const azar = () => { n++; return (n % 4) / 4; };
        const tira = montarTira({ relleno: 20, definitivos: ['b'], catalogo, azar });
        for (let i = 1; i < 20; i++) expect(tira[i]).not.toBe(tira[i - 1]);
    });

    test('⚠️ el último de relleno no es igual al primero real', () => {
        // Si el rodillo frena sobre tres cerezas justo ANTES de las de verdad,
        // parece que ha fallado por un pelo. Eso no es azar: es la trampa
        // clásica de las tragaperras. Aquí no se engaña al ojo.
        for (let semilla = 0; semilla < 50; semilla++) {
            let x = semilla;
            const azar = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
            const tira = montarTira({ relleno: 8, definitivos: ['a', 'a', 'a', 'a'], catalogo, azar });
            expect(tira[7]).not.toBe('a');
        }
    });
});
