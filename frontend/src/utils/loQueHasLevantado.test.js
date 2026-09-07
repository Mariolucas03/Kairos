import { loQueHasLevantado, COSAS } from './loQueHasLevantado';

/**
 * QUE HAS LEVANTADO, EN COSAS DE VERDAD
 *
 * La regla que sostiene todo esto es UNA: la cosa que se enseña nunca puede
 * pesar mas de lo que has movido. Si se rompe, la app te felicita por levantar
 * una ballena que no has levantado, y eso no es un fallo gracioso: es la app
 * mintiendote en la unica pantalla que lees despues de entrenar.
 */

describe('Siempre UNA cosa, nunca "3 camiones"', () => {

    test('10.000 kg dan un tiranosaurio, un moai o algo de ese tamaño', () => {
        // Nada de "7 sofas": eso es una cuenta, no una imagen.
        const r = loQueHasLevantado(10000);
        expect(r.cosa).toMatch(/^(un|una|el|la) /);
        expect(r.frase).toBe(`Has levantado ${r.cosa}`);
    });

    test('la frase nunca lleva un numero delante de la cosa', () => {
        for (const kilos of [100, 500, 1000, 5000, 10000, 50000, 200000, 1000000]) {
            const r = loQueHasLevantado(kilos);
            expect(r.cosa).not.toMatch(/^\d/);
        }
    });
});

describe('LA REGLA: nunca se dice que has levantado mas de lo que has levantado', () => {

    test('en todo el rango, la cosa pesa como mucho lo que has movido', () => {
        // Se barre de 60 kg a 300 millones en saltos multiplicativos, para pasar
        // por todos los huecos de la lista.
        for (let kilos = 60; kilos < 300000000; kilos = Math.ceil(kilos * 1.15)) {
            const r = loQueHasLevantado(kilos);
            expect(r, `sin frase con ${kilos} kg`).not.toBeNull();

            const cosa = COSAS.find(c => c.uno === r.cosa);
            expect(cosa.kg, `${kilos} kg -> ${r.cosa} (${cosa.kg} kg): se ha pasado`)
                .toBeLessThanOrEqual(kilos);
        }
    });

    test('y tampoco se queda ridiculamente corta', () => {
        // Un entreno de 10.000 kg saliendo como "un sofa" es cierto y absurdo.
        // La cosa pesa al menos el 25% de lo movido (el suelo normal es el 55%,
        // el 25% solo se usa si un hueco de la lista lo obliga).
        for (let kilos = 60; kilos < 300000000; kilos = Math.ceil(kilos * 1.15)) {
            const r = loQueHasLevantado(kilos);
            const cosa = COSAS.find(c => c.uno === r.cosa);
            expect(cosa.kg, `${kilos} kg -> ${r.cosa} (${cosa.kg} kg): se queda corta`)
                .toBeGreaterThanOrEqual(kilos * 0.25);
        }
    });
});

describe('El azar', () => {

    test('el mismo entreno no da siempre la misma frase', () => {
        // Media gracia esta en que cambie: si el lunes y el jueves dice lo mismo,
        // deja de leerse.
        const vistas = new Set();
        for (let i = 0; i < 60; i++) vistas.add(loQueHasLevantado(9000).cosa);
        expect(vistas.size).toBeGreaterThan(1);
    });

    test('pero todas las que salen son validas', () => {
        for (let i = 0; i < 60; i++) {
            const r = loQueHasLevantado(9000);
            const cosa = COSAS.find(c => c.uno === r.cosa);
            expect(cosa.kg).toBeLessThanOrEqual(9000);
        }
    });
});

describe('Los bordes', () => {

    test('por debajo de lo mas ligero no se dice nada', () => {
        // Antes que forzar una comparacion, ninguna.
        expect(loQueHasLevantado(59)).toBeNull();
        expect(loQueHasLevantado(0)).toBeNull();
    });

    test('la basura no revienta', () => {
        expect(loQueHasLevantado(null)).toBeNull();
        expect(loQueHasLevantado(undefined)).toBeNull();
        expect(loQueHasLevantado('abc')).toBeNull();
        expect(loQueHasLevantado(-1000)).toBeNull();
    });

    test('un volumen enorme sigue dando una sola cosa', () => {
        const r = loQueHasLevantado(500000000);
        expect(r).not.toBeNull();
        expect(r.cosa).not.toMatch(/^\d/);
    });

    test('el detalle dice los kilos de verdad y los de la cosa', () => {
        const r = loQueHasLevantado(8500);
        expect(r.detalle).toContain('8500 kg en total');
        expect(r.detalle).toMatch(/pesa unos [\d.]+ kg/);
    });

    test('los miles llevan punto a partir de cinco cifras', () => {
        // ⚠️ NO es un fallo que "8500" no lleve punto: en español los numeros de
        // CUATRO cifras no se separan, y a partir de cinco si. Lo hace bien
        // `toLocaleString('es-ES')`; esto queda escrito para que a nadie le
        // parezca un error y lo "arregle".
        expect(loQueHasLevantado(150000).detalle).toContain('150.000 kg en total');
        expect(loQueHasLevantado(9500).detalle).toContain('9500 kg en total');
    });
});

describe('La lista', () => {

    test('esta ordenada de menos a mas', () => {
        // El filtro por rango da por hecho que lo esta.
        for (let i = 1; i < COSAS.length; i++) {
            expect(COSAS[i].kg, `${COSAS[i].uno} rompe el orden`).toBeGreaterThan(COSAS[i - 1].kg);
        }
    });

    test('no hay huecos que dejen a nadie sin frase', () => {
        // Entre una cosa y la siguiente no puede haber mas del cuadruple, o
        // habria volumenes que caen en tierra de nadie.
        for (let i = 1; i < COSAS.length; i++) {
            expect(COSAS[i].kg / COSAS[i - 1].kg,
                `hueco entre ${COSAS[i - 1].uno} y ${COSAS[i].uno}`).toBeLessThan(4);
        }
    });

    test('todas tienen nombre, emoji y peso', () => {
        for (const c of COSAS) {
            expect(typeof c.uno).toBe('string');
            expect(c.uno.length).toBeGreaterThan(2);
            expect(c.emoji.length).toBeGreaterThan(0);
            expect(c.kg).toBeGreaterThan(0);
        }
    });

    test('hay de sobra para que no se repitan', () => {
        expect(COSAS.length).toBeGreaterThanOrEqual(70);
    });
});
