/**
 * EL SINTETIZADOR DE LOS JUEGOS.
 *
 * ⚠️ NO HAY FICHEROS DE AUDIO EN NINGÚN JUEGO. TODO SE GENERA.
 *
 * Un mp3 por efecto sería una descarga más por cada uno en un móvil con datos,
 * podría fallar, y habría que buscarlos libres de derechos. Un golpe es ruido
 * blanco de veinte milisegundos por un filtro; una campana es un seno con
 * caída. El navegador los genera en el acto, pesan cero y no se pueden perder.
 *
 * ⚠️ NUNCA PUEDE ROMPER UN JUEGO.
 *
 * Todo va dentro de try/catch. Si no hay Web Audio, si está bloqueado, si el
 * contexto no arranca: el juego sigue igual y en silencio. El sonido es lo
 * último que puede permitirse tumbar una jugada con fichas.
 *
 * Cada juego crea el suyo con `crearSintetizador()` al empezar una jugada —un
 * gesto del usuario, que es cuando el navegador deja arrancar el audio— y lo
 * `para()` al terminar, para que el móvil no mantenga el contexto abierto.
 *
 * El interruptor es uno para todos los juegos y se acuerda. Empieza
 * ENCENDIDO, al contrario que la música del feed: aquello arranca solo al
 * pasar por una publicación; esto es el efecto de un botón que has pulsado.
 */

const CLAVE = 'kairos_juegos_con_sonido';

let encendido = true;
try {
    encendido = localStorage.getItem(CLAVE) !== '0';
} catch { /* almacenamiento bloqueado: suena por defecto */ }

export const haySonidoJuegos = () => encendido;

export const cambiarSonidoJuegos = (valor) => {
    encendido = !!valor;
    try { localStorage.setItem(CLAVE, encendido ? '1' : '0'); } catch { /* da igual */ }
};

export const crearSintetizador = () => {
    let ctx = null;
    let ruidoBuffer = null;
    const continuos = new Set();   // fuentes en bucle, para apagarlas al parar

    const listo = () => {
        if (!encendido) return false;
        if (ctx) return ctx.state !== 'closed';
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            ctx = new AC();
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});

            // Un segundo de ruido blanco: la materia prima de todos los golpes.
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
     * Un golpe: ráfaga de ruido corta con un filtro de banda que le da el
     * "material", y caída rápida. Agudo y corto = bola contra metal fino;
     * grave y más largo = madera, un rodillo encajando, una carta en la mesa.
     */
    const golpe = ({ frecuencia = 2500, duracion = 0.05, volumen = 0.3, q = 8 } = {}) => {
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
        } catch { /* un golpe perdido no importa */ }
    };

    /**
     * Una nota: un oscilador con ataque instantáneo y caída. `tipo` 'sine' es
     * una campana limpia; 'triangle' tiene más cuerpo; 'square' suena a máquina
     * recreativa. `retraso` permite encadenar varias en una melodía.
     */
    const nota = ({ frecuencia = 880, duracion = 0.18, volumen = 0.18, tipo = 'sine', retraso = 0 } = {}) => {
        try {
            if (!listo()) return;
            const t = ctx.currentTime + retraso;
            const osc = ctx.createOscillator();
            osc.type = tipo;
            osc.frequency.value = frecuencia;
            const ganancia = ctx.createGain();
            ganancia.gain.setValueAtTime(0.0001, t);
            ganancia.gain.exponentialRampToValueAtTime(volumen, t + 0.008);
            ganancia.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
            osc.connect(ganancia).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + duracion + 0.02);
        } catch { /* silencio */ }
    };

    /**
     * Un sonido continuo cuyo volumen (y tono) sigue a un valor de 0 a 1:
     * el zumbido de una bola rodando, el ronroneo de unos rodillos. Devuelve
     * una función para actualizarlo en cada frame. A 0 se apaga solo.
     */
    const continuo = ({ frecuenciaBase = 300, frecuenciaExtra = 500, volumenMax = 0.16 } = {}) => {
        let nodo = null;
        return (valor) => {
            try {
                if (!listo()) return;
                if (!nodo) {
                    const fuente = ctx.createBufferSource();
                    fuente.buffer = ruidoBuffer;
                    fuente.loop = true;
                    const filtro = ctx.createBiquadFilter();
                    filtro.type = 'lowpass';
                    filtro.frequency.value = frecuenciaBase;
                    const ganancia = ctx.createGain();
                    ganancia.gain.value = 0;
                    fuente.connect(filtro).connect(ganancia).connect(ctx.destination);
                    fuente.start();
                    nodo = { fuente, filtro, ganancia };
                    continuos.add(nodo);
                }
                const v = Math.max(0, Math.min(valor, 1));
                nodo.filtro.frequency.setTargetAtTime(frecuenciaBase + frecuenciaExtra * v, ctx.currentTime, 0.05);
                nodo.ganancia.gain.setTargetAtTime(volumenMax * v, ctx.currentTime, 0.05);
            } catch { /* silencio */ }
        };
    };

    /** Apaga lo continuo y suelta el contexto. */
    const parar = () => {
        try {
            for (const n of continuos) {
                n.ganancia.gain.setTargetAtTime(0, ctx?.currentTime || 0, 0.08);
                setTimeout(() => { try { n.fuente.stop(); } catch { /* ya parado */ } }, 300);
            }
            continuos.clear();
            if (ctx) {
                const c = ctx;
                ctx = null;
                setTimeout(() => c.close().catch(() => {}), 600);
            }
        } catch { /* nada que hacer */ }
    };

    return { golpe, nota, continuo, parar };
};

/**
 * MELODÍAS DE PREMIO, para no repetirlas en cada juego.
 *
 * `ganar`: cuatro notas que suben, arcade de toda la vida.
 * `granPremio`: más largo y más alto: una máquina pagando.
 * `perder`: dos notas que bajan, cortas, sin dramatizar.
 */
export const melodias = {
    ganar: (s) => {
        [523, 659, 784, 1047].forEach((f, i) => s.nota({ frecuencia: f, retraso: i * 0.09, duracion: 0.22, tipo: 'triangle' }));
    },
    granPremio: (s) => {
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
            s.nota({ frecuencia: f, retraso: i * 0.08, duracion: 0.35, volumen: 0.2, tipo: 'triangle' }));
        [1047, 1319, 1568].forEach((f, i) =>
            s.nota({ frecuencia: f, retraso: 0.55 + i * 0.12, duracion: 0.5, volumen: 0.16 }));
    },
    perder: (s) => {
        s.nota({ frecuencia: 330, duracion: 0.16, volumen: 0.12, tipo: 'triangle' });
        s.nota({ frecuencia: 262, duracion: 0.28, volumen: 0.12, tipo: 'triangle', retraso: 0.14 });
    }
};
