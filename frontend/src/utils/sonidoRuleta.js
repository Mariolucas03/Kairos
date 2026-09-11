import { crearSintetizador, haySonidoJuegos, cambiarSonidoJuegos } from './sintetizador';

/**
 * EL SONIDO DE LA RULETA.
 *
 * ⚠️ UNA RULETA MUDA NO ES UNA RULETA.
 *
 * Lo que se reconoce de una ruleta con los ojos cerrados es el clac-clac de la
 * bola contra los separadores, cada vez más espaciado hasta que se para. Y el
 * golpe seco cuando pega en un deflector. Sin eso, por bien que gire, es un
 * gráfico.
 *
 * Los sonidos en sí los fabrica `sintetizador.js`, que es común a todos los
 * juegos. Aquí solo se dice cuáles son los de la ruleta: un clac es un golpe
 * agudo y corto (bola de marfil contra metal fino), el deflector es más grave,
 * y el zumbido de rodar sigue a la velocidad.
 */

// El interruptor es el de todos los juegos: apagar la ruleta y que sigan
// sonando las tragaperras sería raro.
export const haySonidoRuleta = haySonidoJuegos;
export const cambiarSonidoRuleta = cambiarSonidoJuegos;

export const crearSonidoRuleta = () => {
    const s = crearSintetizador();
    const rodar = s.continuo({ frecuenciaBase: 300, frecuenciaExtra: 500, volumenMax: 0.16 });

    return {
        /** La bola contra un separador. Más fuerte cuanto más rápida va. */
        clac: (fuerza = 1) => s.golpe({
            frecuencia: 3200 + Math.random() * 900,
            duracion: 0.045,
            volumen: 0.08 + 0.22 * Math.min(fuerza, 1)
        }),

        /** Contra un deflector: más grave y más largo, se nota en el pecho. */
        golpe: () => s.golpe({ frecuencia: 900 + Math.random() * 300, duracion: 0.12, volumen: 0.45, q: 4 }),

        /** El último traqueteo al quedarse en la casilla: dos clacs rápidos. */
        asiento: () => {
            s.golpe({ frecuencia: 2600, duracion: 0.06, volumen: 0.3 });
            setTimeout(() => s.golpe({ frecuencia: 2200, duracion: 0.05, volumen: 0.18 }), 55);
        },

        /** El zumbido de rodar por la pista. Se llama cada frame con 0..1. */
        rodar,

        parar: s.parar
    };
};
