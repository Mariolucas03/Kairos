import { unaRepeticionMaxima, conUnaRepeticion, loQueTienesAbandonado, desdeHace } from './estadisticas';

/**
 * LAS CUENTAS DE ESTADISTICAS
 *
 * Las dos hacen lo mismo mal si nadie las mira: enseñar un numero con pinta de
 * cierto. Un 1RM inflado o un "hace 3 semanas" que en realidad son 3 dias no dan
 * error en ningun sitio — simplemente te hacen tomar decisiones sobre datos
 * inventados, que en una app de gimnasio es peor que no enseñar nada.
 */

const DIA = 86400000;

describe('1RM estimado (Epley)', () => {

    test('80 kg por 10 repeticiones son 107', () => {
        // 80 x (1 + 10/30) = 106,67 -> 107
        expect(unaRepeticionMaxima(80, 10)).toBe(107);
    });

    test('lo que hace util el numero: 80x10 y 90x6 pesan casi lo mismo', () => {
        // Esta es LA razon de enseñarlo. A ojo parece que 90 kg es mejor que
        // 80; el 1RM dice que has movido casi lo mismo, y por tanto que no has
        // progresado, solo cambiado repeticiones por peso.
        const a = unaRepeticionMaxima(80, 10);   // 107
        const b = unaRepeticionMaxima(90, 6);    // 108
        expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
    });

    test('una sola repeticion YA es tu 1RM: no se estima nada', () => {
        // Aplicar la formula lo inflaria un 3% sin motivo: si has movido 100 kg
        // una vez, tu 1RM es 100, no 103.
        expect(unaRepeticionMaxima(100, 1)).toBe(100);
    });

    test('sin peso no hay 1RM', () => {
        // Los de peso corporal. Multiplicar por cero daria una grafica plana en
        // el suelo, que parece un fallo de la app.
        expect(unaRepeticionMaxima(0, 12)).toBeNull();
        expect(unaRepeticionMaxima(null, 10)).toBeNull();
    });

    test('POR ENCIMA DE 12 REPETICIONES NO SE INVENTA', () => {
        // Epley se dispara ahi: una serie de 20 daria 1,67 veces el peso, que no
        // se parece a lo que levantarias de verdad. Antes que un numero falso,
        // ninguno.
        expect(unaRepeticionMaxima(60, 12)).toBe(84);
        expect(unaRepeticionMaxima(60, 13)).toBeNull();
        expect(unaRepeticionMaxima(60, 20)).toBeNull();
    });

    test('la basura no revienta ni da NaN', () => {
        expect(unaRepeticionMaxima(undefined, undefined)).toBeNull();
        expect(unaRepeticionMaxima('abc', 'x')).toBeNull();
        expect(unaRepeticionMaxima(-50, 5)).toBeNull();
    });

    test('siempre sube al subir el peso con las mismas repeticiones', () => {
        // Una grafica que baja cuando levantas mas seria peor que no tenerla.
        let anterior = 0;
        for (const kg of [40, 50, 60, 70, 80, 100]) {
            const actual = unaRepeticionMaxima(kg, 8);
            expect(actual).toBeGreaterThan(anterior);
            anterior = actual;
        }
    });

    test('conUnaRepeticion añade el dato sin tocar lo demas', () => {
        const puntos = [
            { date: '2026-01-01', bestWeight: 80, bestReps: 10, volume: 2400 },
            { date: '2026-01-08', bestWeight: 0, bestReps: 15, volume: 300 }
        ];
        const salida = conUnaRepeticion(puntos);

        expect(salida[0].rm1).toBe(107);
        expect(salida[0].volume).toBe(2400);
        expect(salida[1].rm1).toBeNull();
        expect(puntos[0].rm1).toBeUndefined();   // no muta la entrada
    });
});

describe('Lo que tienes abandonado', () => {

    const ahora = new Date('2026-09-06T12:00:00Z').getTime();
    const haceDias = (n) => new Date(ahora - n * DIA).toISOString();

    test('saca lo que llevas semanas sin tocar, lo mas olvidado primero', () => {
        const salida = loQueTienesAbandonado([
            { name: 'Press Banca', sessions: 20, last: haceDias(2) },
            { name: 'Peso Muerto', sessions: 8, last: haceDias(50) },
            { name: 'Dominadas', sessions: 5, last: haceDias(30) }
        ], { ahora });

        expect(salida.map(e => e.name)).toEqual(['Peso Muerto', 'Dominadas']);
        expect(salida[0].dias).toBe(50);
    });

    test('lo de esta semana NO esta abandonado', () => {
        const salida = loQueTienesAbandonado(
            [{ name: 'Sentadilla', sessions: 10, last: haceDias(4) }],
            { ahora }
        );
        expect(salida).toEqual([]);
    });

    test('PROBAR ALGO UNA VEZ NO ES ABANDONARLO', () => {
        // Si contara, la lista se llenaria de ejercicios que nunca fueron tuyos
        // y el aviso dejaria de significar nada.
        const salida = loQueTienesAbandonado([
            { name: 'Lo probe un dia', sessions: 1, last: haceDias(200) },
            { name: 'Esto si era mio', sessions: 12, last: haceDias(40) }
        ], { ahora });

        expect(salida.map(e => e.name)).toEqual(['Esto si era mio']);
    });

    test('se enseñan como mucho cuatro', () => {
        const muchos = Array.from({ length: 12 }, (_, i) => ({
            name: 'Ejercicio ' + i,
            sessions: 5,
            last: haceDias(30 + i)
        }));
        expect(loQueTienesAbandonado(muchos, { ahora })).toHaveLength(4);
    });

    test('sin fecha de la ultima vez no se cuenta', () => {
        const salida = loQueTienesAbandonado([
            { name: 'Sin fecha', sessions: 9, last: null },
            { name: 'Sin nada', sessions: 9 }
        ], { ahora });
        expect(salida).toEqual([]);
    });

    test('una lista vacia o rota no revienta', () => {
        expect(loQueTienesAbandonado([])).toEqual([]);
        expect(loQueTienesAbandonado(null)).toEqual([]);
        expect(loQueTienesAbandonado(undefined)).toEqual([]);
    });
});

describe('desdeHace: cuanto tiempo en palabras', () => {

    test('en semanas, no en dias', () => {
        // "hace 47 dias" obliga a dividir mentalmente; lo que quieres saber es
        // si es mucho o poco.
        expect(desdeHace(21)).toBe('hace 3 semanas');
        expect(desdeHace(7)).toBe('hace 1 semana');
    });

    test('a partir del mes, en meses', () => {
        expect(desdeHace(30)).toBe('hace un mes');
        expect(desdeHace(75)).toBe('hace 2 meses');
    });

    test('se redondea: 51 dias son dos meses, no uno', () => {
        // Truncando salia "hace un mes" hasta los 59 dias, y ahi es donde el
        // dato importa: dejarlo hace uno o hace dos es retomarlo o empezar.
        expect(desdeHace(51)).toBe('hace 2 meses');
        expect(desdeHace(59)).toBe('hace 2 meses');
        expect(desdeHace(44)).toBe('hace un mes');
    });

    test('y a partir del año, en años', () => {
        expect(desdeHace(365)).toBe('hace un año');
        expect(desdeHace(800)).toBe('hace 2 años');
    });
});
