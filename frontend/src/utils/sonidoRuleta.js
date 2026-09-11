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
 * ⚠️ NO HAY FICHEROS DE AUDIO. TODO SE SINTETIZA.
 *
 * Un mp3 sería una descarga más en un móvil con datos, podría fallar, y habría
 * que buscar uno libre de derechos. Un clac es ruido blanco de 20 milisegundos
 * pasado por un filtro: el navegador lo genera en el acto. Suena a bola de
 * marfil contra metal porque eso es, físicamente, un impulso corto con
 * resonancia.
 *
 * ⚠️ NUNCA PUEDE ROMPER EL JUEGO.
 *
 * Todo va dentro de try/catch. Si el navegador no tiene Web Audio, si el
 * usuario lo tiene bloqueado, si el contexto no arranca: la ruleta gira igual
 * y en silencio. El sonido es lo último que puede permitirse tumbar una tirada
 * con fichas en juego.
 *
 * Empieza ENCENDIDO, al contrario que la música del feed. Aquello es música
 * que arranca sola al pasar por una publicación; esto es el efecto de un botón
 * que has pulsado tú. Y se puede apagar con un toque, y se recuerda.
 */

const CLAVE = 'kairos_ruleta_con_sonido';

let encendido = true;
try {
    // Solo se apaga si el usuario lo apagó. Sin nada guardado, suena.
    encendido = localStorage.getItem(CLAVE) !== '0';
} catch { /* almacenamiento bloqueado: suena por defecto */ }

export const haySonidoRuleta = () => encendido;

export const cambiarSonidoRuleta = (valor) => {
    encendido = !!valor;
    try { localStorage.setItem(CLAVE, encendido ? '1' : '0'); } catch { /* da igual */ }
};

/**
 * Crea el "instrumento" para una tirada. Devuelve funciones que no lanzan
 * nunca. Se crea al pulsar tirar —un gesto del usuario— que es cuando el
 * navegador deja arrancar el audio.
 */
export const crearSonidoRuleta = () => {
    let ctx = null;
    let zumbido = null;     // { fuente, ganancia }
    let ruidoBuffer = null;

    const listo = () => {
        if (!encendido) return false;
        if (ctx) return ctx.state !== 'closed';
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            ctx = new AC();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});

            // Un segundo de ruido blanco, que es la materia prima de todo lo
            // demás: los clacs son trocitos de esto con un filtro encima.
            const n = ctx.sampleRate;
            ruidoBuffer = ctx.createBuffer(1, n, n);
            const datos = ruidoBuffer.getChannelData(0);
            for (let i = 0; i < n; i++) datos[i] = Math.random() * 2 - 1;
            return true;
        } catch {
            ctx = null;
            return false;
        }
    };

    /**
     * Un impacto: ráfaga de ruido corta con un filtro de banda que le da el
     * "tono" metálico, y una caída rápida. `frecuencia` alta = bola pequeña
     * contra metal fino (los separadores); baja = golpe más gordo (deflector).
     */
    const impacto = ({ frecuencia, duracion, volumen, q = 8 }) => {
        try {
            if (!listo()) return;
            const t = ctx.currentTime;

            const fuente = ctx.createBufferSource();
            fuente.buffer = ruidoBuffer;

            const filtro = ctx.createBiquadFilter();
            filtro.type = 'bandpass';
            filtro.frequency.value = frecuencia;
            filtro.Q.value = q;

            const ganancia = ctx.createGain();
            ganancia.gain.setValueAtTime(volumen, t);
            ganancia.gain.exponentialRampToValueAtTime(0.0001, t + duracion);

            fuente.connect(filtro).connect(ganancia).connect(ctx.destination);
            fuente.start(t);
            fuente.stop(t + duracion);
        } catch { /* un clac perdido no importa */ }
    };

    return {
        /** La bola contra un separador. Más fuerte cuanto más rápida va. */
        clac: (fuerza = 1) => impacto({
            frecuencia: 3200 + Math.random() * 900,
            duracion: 0.045,
            volumen: 0.08 + 0.22 * Math.min(fuerza, 1)
        }),

        /** Contra un deflector: más grave y más largo, se nota en el pecho. */
        golpe: () => impacto({ frecuencia: 900 + Math.random() * 300, duracion: 0.12, volumen: 0.45, q: 4 }),

        /** El último traqueteo al quedarse en la casilla: dos clacs rápidos. */
        asiento: () => {
            impacto({ frecuencia: 2600, duracion: 0.06, volumen: 0.3 });
            setTimeout(() => impacto({ frecuencia: 2200, duracion: 0.05, volumen: 0.18 }), 55);
        },

        /**
         * El zumbido de la bola rodando por la pista. Es un ruido grave y
         * continuo cuyo volumen sigue a la velocidad: al frenar, se apaga solo.
         * Se llama en cada frame con la velocidad actual (0..1).
         */
        rodar: (velocidad) => {
            try {
                if (!listo()) return;
                if (!zumbido) {
                    const fuente = ctx.createBufferSource();
                    fuente.buffer = ruidoBuffer;
                    fuente.loop = true;
                    const filtro = ctx.createBiquadFilter();
                    filtro.type = 'lowpass';
                    filtro.frequency.value = 420;
                    const ganancia = ctx.createGain();
                    ganancia.gain.value = 0;
                    fuente.connect(filtro).connect(ganancia).connect(ctx.destination);
                    fuente.start();
                    zumbido = { fuente, ganancia, filtro };
                }
                const v = Math.max(0, Math.min(velocidad, 1));
                // El tono también sube con la velocidad: una bola rápida silba
                // más agudo que una que va muriendo.
                zumbido.filtro.frequency.setTargetAtTime(300 + 500 * v, ctx.currentTime, 0.05);
                zumbido.ganancia.gain.setTargetAtTime(0.16 * v, ctx.currentTime, 0.05);
            } catch { /* silencio */ }
        },

        /** Se apaga todo y se suelta el contexto: el móvil no lo mantiene abierto. */
        parar: () => {
            try {
                if (zumbido) {
                    zumbido.ganancia.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
                    const z = zumbido;
                    setTimeout(() => { try { z.fuente.stop(); } catch { /* ya parado */ } }, 300);
                    zumbido = null;
                }
                if (ctx) {
                    const c = ctx;
                    ctx = null;
                    setTimeout(() => c.close().catch(() => {}), 600);
                }
            } catch { /* nada que hacer */ }
        }
    };
};
