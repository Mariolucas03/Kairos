import { describe, test, expect } from 'vitest';
import { limpiarRango, cerrarRango, RANGO_POR_DEFECTO } from './rangoDeReps';

describe('El rango de repeticiones de la rutina', () => {

    test('los tres formatos que entiende el servidor pasan enteros', () => {
        // "5" fuerza pura, "3-5" fuerza, "10-12" hipertrofia. Los tres los sabe
        // leer `rangoDeReps` en progresionService.
        expect(limpiarRango('5')).toBe('5');
        expect(limpiarRango('3-5')).toBe('3-5');
        expect(limpiarRango('10-12')).toBe('10-12');
    });

    test('se puede escribir a medias sin que la casilla te pelee', () => {
        // Por aquí pasa todo el mundo tecleando "12-15". Si el guion se borrara
        // solo, el segundo número no se podría escribir nunca.
        expect(limpiarRango('12-')).toBe('12-');
    });

    test('las letras no entran', () => {
        expect(limpiarRango('8 a 10 aprox')).toBe('810');
        expect(limpiarRango('abc')).toBe('');
    });

    test('un solo guion aunque insistas', () => {
        expect(limpiarRango('8---12')).toBe('8-12');
    });

    test('no cabe un número absurdo', () => {
        // El tope es de caracteres, no de valor: "100-120" cabe justo, y lo de
        // detrás sobra en cualquier rango real.
        expect(limpiarRango('100-120')).toBe('100-120');
        expect(limpiarRango('123456789').length).toBeLessThanOrEqual(7);
    });

    test('al salir de la casilla no queda nada a medias', () => {
        expect(cerrarRango('12-')).toBe('12');
        expect(cerrarRango('-8')).toBe('8');
    });

    test('vacío vuelve al rango de siempre', () => {
        // No se guarda '' : el servidor lo leería como "sin rango" y usaría 8-12
        // por su cuenta, o sea otro número distinto del que verías en pantalla.
        expect(cerrarRango('')).toBe(RANGO_POR_DEFECTO);
        expect(cerrarRango('-')).toBe(RANGO_POR_DEFECTO);
        expect(cerrarRango(null)).toBe(RANGO_POR_DEFECTO);
    });

    test('un rango bueno sale de la casilla igual que entró', () => {
        expect(cerrarRango('3-5')).toBe('3-5');
        expect(cerrarRango('5')).toBe('5');
    });
});
