import { describe, it, expect } from 'vitest';
import { ejercicioCambiado, ejercicioNuevo, aplicarHistorial, nuevoUid } from './ejercicios';

/**
 * CAMBIAR UN EJERCICIO POR OTRO A MITAD DEL ENTRENO.
 *
 * Es de lo que más se usa: la máquina está ocupada y haces otra cosa. Tenía
 * dos fallos que solo se notan entrenando, y los dos ensucian el ejercicio
 * equivocado.
 */

/** Una plancha: por tiempo, a peso corporal y por lado. */
const plancha = () => ({
    uid: 'hueco-1',
    name: 'Plancha',
    muscle: 'Core',
    muscleDetail: 'Recto abdominal',
    secondary: ['Hombro'],
    reps: '45',
    rest: 90,
    superserie: 'A',
    esPorTiempo: true,
    esPesoCorporal: true,
    porLado: true,
    pr: { weight: 0, reps: 60 },
    sugerencia: 'Aguanta 5 segundos más',
    ultimasSeries: [{ weight: 0, reps: 60 }],
    lastWeights: [0],
    setsData: [
        { kg: '0', reps: '60', completed: true, type: 'N' },
        { kg: '0', reps: '55', completed: true, type: 'N' }
    ]
});

/** Un press de banca del catálogo: barra, con kilos y repeticiones. */
const pressBanca = {
    _id: 'cat-99',
    name: 'Press de banca',
    muscle: 'Pecho',
    muscleDetail: 'Pectoral mayor',
    secondary: ['Tríceps']
};

describe('Cambiar un ejercicio por otro', () => {
    it('el nuevo deja de comportarse como el viejo', () => {
        const r = ejercicioCambiado(plancha(), pressBanca);

        // Esto es lo que se heredaba: un press de banca pidiendo segundos y
        // sumando tu peso corporal al volumen.
        expect(r.esPorTiempo).toBe(false);
        expect(r.esPesoCorporal).toBe(false);
        expect(r.porLado).toBe(false);
    });

    it('no se queda nada del historial del anterior', () => {
        const r = ejercicioCambiado(plancha(), pressBanca);

        expect(r.pr).toBeNull();
        expect(r.sugerencia).toBeNull();
        expect(r.ultimasSeries).toEqual([]);
        expect(r.lastWeights).toEqual([]);
    });

    it('el músculo y el detalle son los del nuevo, no los del viejo', () => {
        const r = ejercicioCambiado(plancha(), pressBanca);

        expect(r.name).toBe('Press de banca');
        expect(r.muscle).toBe('Pecho');
        expect(r.muscleDetail).toBe('Pectoral mayor');
        expect(r.secondary).toEqual(['Tríceps']);
    });

    it('las series se vacían, pero siguen siendo las mismas que había', () => {
        const r = ejercicioCambiado(plancha(), pressBanca);

        expect(r.setsData).toHaveLength(2);
        expect(r.setsData.every(s => s.kg === '' && s.reps === '' && !s.completed)).toBe(true);
    });

    it('lo que es del hueco y no del ejercicio se conserva', () => {
        const r = ejercicioCambiado(plancha(), pressBanca);

        expect(r.uid).toBe('hueco-1');
        expect(r.superserie).toBe('A');
        expect(r.rest).toBe(90);
    });

    it('un ejercicio del catálogo sin detalle no deja undefined por ahí', () => {
        const r = ejercicioCambiado(plancha(), { name: 'Remo', muscle: 'Espalda' });

        expect(r.muscleDetail).toBe('');
        expect(r.secondary).toEqual([]);
    });
});

describe('Añadir un ejercicio a mitad de entreno', () => {
    it('entra limpio y con tres series', () => {
        const r = ejercicioNuevo(pressBanca, 120);

        expect(r.name).toBe('Press de banca');
        expect(r.setsData).toHaveLength(3);
        expect(r.rest).toBe(120);
        expect(r.esPorTiempo).toBe(false);
        expect(r.uid).toBeTruthy();
    });

    it('dos añadidos no comparten identidad', () => {
        expect(ejercicioNuevo(pressBanca, 60).uid).not.toBe(ejercicioNuevo(pressBanca, 60).uid);
        expect(nuevoUid()).not.toBe(nuevoUid());
    });
});

describe('El historial que llega tarde va a SU ejercicio', () => {
    const datos = {
        'Press de banca': {
            bestSet: { weight: 100, reps: 5 },
            lastSets: [{ weight: 80, reps: 10 }, { weight: 85, reps: 8 }],
            sugerencia: 'Sube a 90'
        }
    };

    it('lo coloca en el hueco al que iba', () => {
        const lista = [
            { uid: 'a', name: 'Sentadilla', setsData: [{ kg: '', reps: '' }] },
            { uid: 'b', name: 'Press de banca', setsData: [{ kg: '', reps: '' }, { kg: '', reps: '' }] }
        ];

        const r = aplicarHistorial(lista, datos, { 'Press de banca': 'b' });

        expect(r[1].pr).toEqual({ weight: 100, reps: 5 });
        expect(r[1].setsData[0].kg).toBe(80);
        expect(r[1].setsData[1].kg).toBe(85);
        expect(r[1].sugerencia).toBe('Sube a 90');
    });

    it('⚠️ si el hueco ya cambió de ejercicio, NO se escribe nada', () => {
        // Este es el fallo: pides el historial del press, y mientras llega
        // cambias ese mismo hueco por otra cosa. Escribiendo por posición, los
        // kilos del press acababan en el ejercicio que hubiera ahí.
        const lista = [
            { uid: 'a', name: 'Sentadilla', setsData: [{ kg: '', reps: '' }] },
            { uid: 'c', name: 'Press de banca', setsData: [{ kg: '', reps: '' }] }
        ];

        const r = aplicarHistorial(lista, datos, { 'Press de banca': 'b' });

        expect(r[1].pr).toBeUndefined();
        expect(r[1].setsData[0].kg).toBe('');
    });

    it('⚠️ si la lista se movió, no se escribe en el vecino', () => {
        // Se pidió para el hueco 'b' cuando estaba el segundo; mientras tanto
        // se borró el primero y ahora 'b' es el primero. Va a 'b' igual.
        const lista = [
            { uid: 'b', name: 'Press de banca', setsData: [{ kg: '', reps: '' }] },
            { uid: 'd', name: 'Curl', setsData: [{ kg: '', reps: '' }] }
        ];

        const r = aplicarHistorial(lista, datos, { 'Press de banca': 'b' });

        expect(r[0].setsData[0].kg).toBe(80);
        expect(r[1].setsData[0].kg).toBe('');
        expect(r[1].pr).toBeUndefined();
    });

    it('un ejercicio sin historial se queda como estaba', () => {
        const lista = [{ uid: 'z', name: 'Ejercicio raro', setsData: [{ kg: '', reps: '' }] }];

        const r = aplicarHistorial(lista, datos, { 'Ejercicio raro': 'z' });

        expect(r[0].setsData[0].kg).toBe('');
    });

    it('con menos series guardadas que las de hoy, se repite la última', () => {
        const lista = [{ uid: 'b', name: 'Press de banca', setsData: [{}, {}, {}] }];

        const r = aplicarHistorial(lista, datos, { 'Press de banca': 'b' });

        expect(r[0].setsData[2].kg).toBe(85);
    });
});
