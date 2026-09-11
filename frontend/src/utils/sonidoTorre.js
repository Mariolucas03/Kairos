import { crearSintetizador, melodias } from './sintetizador';

/**
 * LOS SONIDOS DE LA TORRE.
 *
 * Una losa que se pisa (un golpe sordo de piedra), una que aguanta (una nota
 * que sube con cada planta: la tensión se oye), una que se rompe (el crujido
 * y el derrumbe), y las fichas al retirarse.
 */
export const crearSonidoTorre = () => {
    const s = crearSintetizador();

    return {
        /** El pie sobre la piedra. */
        pisar: () => s.golpe({ frecuencia: 160, duracion: 0.09, volumen: 0.4, q: 2 }),

        /** Aguanta. La nota sube con la planta: en la octava se oye lo alto que estás. */
        aguanta: (planta = 0) => {
            const base = 392;   // sol
            s.nota({ frecuencia: base * Math.pow(2, planta / 12), duracion: 0.22, volumen: 0.16, tipo: 'triangle' });
        },

        /** Se rompe: primero el crujido, luego el derrumbe grave. */
        romper: () => {
            s.golpe({ frecuencia: 1800, duracion: 0.06, volumen: 0.35, q: 2 });
            setTimeout(() => s.golpe({ frecuencia: 700, duracion: 0.08, volumen: 0.3, q: 2 }), 60);
            setTimeout(() => s.golpe({ frecuencia: 90, duracion: 0.5, volumen: 0.5, q: 1 }), 140);
            setTimeout(() => melodias.perder(s), 500);
        },

        /** Te retiras con el bote: las fichas y la melodía. */
        cobrar: (grande = false) => {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => s.golpe({ frecuencia: 3000 + Math.random() * 900, duracion: 0.035, volumen: 0.14, q: 9 }), i * 55);
            }
            setTimeout(() => (grande ? melodias.granPremio : melodias.ganar)(s), 250);
        },

        parar: s.parar
    };
};
