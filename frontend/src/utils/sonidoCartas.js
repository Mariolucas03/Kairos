import { crearSintetizador, melodias } from './sintetizador';

/**
 * LOS SONIDOS DE UNA MESA DE CARTAS.
 *
 * Comunes al blackjack, al póquer y a la carta alta: una carta que se desliza
 * por el fieltro, una que se voltea con un chasquido, una ficha que cae sobre
 * otras. Los fabrica el sintetizador común; aquí solo se dice cómo suenan.
 *
 * Se crea uno por partida (o por mano) y se `para()` al terminar, para que el
 * móvil no mantenga el contexto de audio abierto.
 */
export const crearSonidoCartas = () => {
    const s = crearSintetizador();

    return {
        /** Una carta deslizándose por el fieltro: un soplo corto y sordo. */
        repartir: () => s.golpe({ frecuencia: 1100 + Math.random() * 300, duracion: 0.09, volumen: 0.16, q: 1.5 }),

        /** Se da la vuelta: el chasquido del canto contra la mesa. */
        voltear: () => {
            s.golpe({ frecuencia: 2400, duracion: 0.03, volumen: 0.2, q: 6 });
            setTimeout(() => s.golpe({ frecuencia: 900, duracion: 0.05, volumen: 0.14, q: 3 }), 30);
        },

        /** Una ficha sobre el montón: dos toques de arcilla, agudos y secos. */
        ficha: () => {
            s.golpe({ frecuencia: 3600, duracion: 0.03, volumen: 0.18, q: 10 });
            setTimeout(() => s.golpe({ frecuencia: 3100, duracion: 0.04, volumen: 0.12, q: 10 }), 40);
        },

        /** Varias fichas juntas: el bote que se recoge o se paga. */
        fichas: (cuantas = 4) => {
            for (let i = 0; i < cuantas; i++) {
                setTimeout(() => s.golpe({ frecuencia: 3000 + Math.random() * 900, duracion: 0.035, volumen: 0.14, q: 9 }), i * 55);
            }
        },

        ganar: () => melodias.ganar(s),
        granPremio: () => melodias.granPremio(s),
        perder: () => melodias.perder(s),
        /** Un empate: una sola nota neutra. */
        empate: () => s.nota({ frecuencia: 440, duracion: 0.25, volumen: 0.12, tipo: 'triangle' }),

        parar: s.parar
    };
};
