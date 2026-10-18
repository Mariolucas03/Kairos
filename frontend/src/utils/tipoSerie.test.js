import { describe, it, expect } from 'vitest';
import { esfuerzoSegunTipo, cuentaParaElObjetivo, anuncioDeLaSiguiente } from './tipoSerie';

/**
 * EL TIPO DE SERIE TIENE QUE CAMBIAR LO QUE SE PREGUNTA.
 *
 * Marcar una serie como calentamiento, al fallo o drop ya cambiaba cómo se
 * pinta la fila, pero nada más: durante el descanso se preguntaba siempre
 * "¿cuántas más podías hacer?" y se comparaba siempre con el objetivo del día.
 */

describe('Qué se pregunta según el tipo de serie', () => {
    it('en una serie normal, la pregunta de siempre', () => {
        const r = esfuerzoSegunTipo('N');

        expect(r.preguntar).toBe(true);
        expect(r.pregunta).toBe('¿Cuántas más podías hacer?');
        expect(r.valorFijo).toBeUndefined();
    });

    it('en un CALENTAMIENTO no se pregunta: no hay respuesta útil', () => {
        const r = esfuerzoSegunTipo('W');

        expect(r.preguntar).toBe(false);
        expect(r.nota).toMatch(/calentamiento/i);
        // Y tampoco se da por hecho ningún valor: un calentamiento no tiene RIR.
        expect(r.valorFijo).toBeUndefined();
    });

    it('una serie AL FALLO ya trae la respuesta: cero', () => {
        const r = esfuerzoSegunTipo('F');

        expect(r.preguntar).toBe(false);
        expect(r.valorFijo).toBe(0);
    });

    it('en un DROP se pregunta, pero por el final del drop', () => {
        const r = esfuerzoSegunTipo('D');

        expect(r.preguntar).toBe(true);
        expect(r.pregunta).toMatch(/drop/i);
    });

    it('un tipo desconocido se trata como normal', () => {
        expect(esfuerzoSegunTipo(undefined).preguntar).toBe(true);
        expect(esfuerzoSegunTipo('X').preguntar).toBe(true);
    });
});

describe('Qué series se comparan con el objetivo del día', () => {
    it('el calentamiento NO', () => {
        // Enseñar "no llegaste" en una serie que no pretendía llegar es
        // decirle a alguien que ha fallado algo que ha hecho bien.
        expect(cuentaParaElObjetivo('W')).toBe(false);
    });

    it('la normal, la de fallo y el drop sí', () => {
        expect(cuentaParaElObjetivo('N')).toBe(true);
        expect(cuentaParaElObjetivo('F')).toBe(true);
        expect(cuentaParaElObjetivo('D')).toBe(true);
    });
});

describe('Cómo se anuncia la serie que viene', () => {
    it('un calentamiento se dice por su nombre, sin meta', () => {
        expect(anuncioDeLaSiguiente('W', 'C', '80 kg × 10 reps')).toBe('Ahora: calentamiento');
    });

    it('un drop también, porque la meta no aplica', () => {
        expect(anuncioDeLaSiguiente('D', '2.1', '80 kg × 10 reps')).toBe('Ahora: drop 2.1');
    });

    it('una al fallo avisa de que va al fallo', () => {
        expect(anuncioDeLaSiguiente('F', 3, '80 kg × 10 reps')).toBe('Ahora: serie 3, al fallo');
    });

    it('una normal lleva su meta delante', () => {
        expect(anuncioDeLaSiguiente('N', 2, '80 kg × 10 reps')).toBe('Ahora: serie 2 · 80 kg × 10 reps');
    });

    it('sin meta no se queda un separador suelto', () => {
        expect(anuncioDeLaSiguiente('N', 2, '')).toBe('Ahora: serie 2');
    });
});
