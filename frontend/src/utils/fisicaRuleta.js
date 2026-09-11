/**
 * CÓMO SE MUEVEN LA RUEDA Y LA BOLA.
 *
 * ⚠️ ANTES LA BOLA NO SE COMPORTABA COMO UNA BOLA.
 *
 * Giraba en el MISMO sentido que la rueda, con una sola curva de CSS, bajaba
 * en línea recta desde la pista hasta la casilla y se paraba. Eso no es una
 * ruleta: es un puntero. Lo que hace que una ruleta parezca de verdad es la
 * bola yendo en sentido contrario, más rápida que la rueda, perdiendo
 * velocidad, cayendo en espiral, golpeando los deflectores, rebotando de
 * casilla en casilla cada vez más despacio y quedándose por fin en una.
 *
 * Esto calcula todo eso en función del tiempo. Es matemática pura: dado un
 * instante, dice dónde está cada cosa. No sabe nada de React ni del DOM, y por
 * eso se puede probar sin navegador.
 *
 * ⚠️ EL RESULTADO LO DECIDE EL SERVIDOR, NO ESTO.
 *
 * El número ganador llega ya decidido y esto solo dibuja el camino hasta él.
 * La única regla que no se puede romper: al final, la bola tiene que estar en
 * la casilla que dijo el servidor. Todo el rebote y la espiral son adorno
 * alrededor de esa condición.
 *
 * CONVENCIÓN: los ángulos son grados "visuales" —lo que va dentro de un
 * `rotate()` de CSS— medidos desde las 12 en el sentido de las agujas. La rueda
 * gira hacia un lado (ángulo bajando) y la bola hacia el otro (subiendo).
 */

// Cuánto dura todo. Una ruleta real son 8-12 segundos; para un juego eso se
// hace largo, y por debajo de 5 la bola no tiene tiempo de "perder" velocidad
// de forma creíble.
export const DURACION = 6800;

// Fases, en tanto por uno del tiempo total.
const EMPIEZA_A_CAER = 0.52;    // la bola deja la pista y baja en espiral
const SE_ASIENTA = 0.90;        // se queda en la casilla y viaja con la rueda

// Radios en tanto por ciento del radio de la rueda. Tienen que coincidir con
// los del dibujo (RuedaRuleta.jsx).
export const RADIO_PISTA = 82;
export const RADIO_DEFLECTORES = 80;
export const RADIO_CASILLA = 56;

const VUELTAS_RUEDA = 4;
const VUELTAS_BOLA = 11;        // en sentido contrario; muchas más, que es lo que se ve

// La caída tiene dos partes: primero baja de la pista al suelo de las
// casillas, y DESPUÉS rebota sobre ese suelo. Antes iba todo mezclado y la
// bajada era tan pendiente que los rebotes no llegaban a vencerla: en pantalla
// era un solo bache. Una bola de verdad toca fondo y luego bota.
const PARTE_DE_BAJADA = 0.5;    // tanto por uno de la caída que es bajar; el resto, rebotar
const REBOTES = 4;
const ALTURA_REBOTE = 10;       // en % de radio, el primero; los demás van muriendo

/** Cúbica que frena: rápido al principio, se va parando. */
const frena = (t) => 1 - Math.pow(1 - t, 3);

/** Como `frena` pero más brusca: la bola pierde velocidad más deprisa que la rueda. */
const frenaFuerte = (t) => 1 - Math.pow(1 - t, 4);

const mod360 = (a) => ((a % 360) + 360) % 360;

/**
 * @param {Object} p
 * @param {number} p.ruedaAlEmpezar   ángulo visual de la rueda ahora mismo
 * @param {number} p.bolaAlEmpezar    ángulo visual de la bola ahora mismo
 * @param {number} p.anguloCasilla    dónde está la casilla ganadora en la rueda
 *                                    SIN girar (centro de la casilla)
 * @returns {{ duracion, rueda(t), bola(t), ruedaAlFinal }}
 *          `t` en milisegundos desde el arranque. `bola(t)` devuelve
 *          { angulo, radio, velocidad, relativo } con `relativo` = ángulo de la
 *          bola respecto a la rueda (para saber por qué casilla pasa).
 */
export const trayectoria = ({ ruedaAlEmpezar, bolaAlEmpezar, anguloCasilla }) => {
    // --- LA RUEDA ---
    //
    // Gira hacia el lado negativo (como antes: `rotate(-x)`), varias vueltas, y
    // termina con la casilla ganadora arriba. Para eso el ángulo final de la
    // rueda tiene que ser -anguloCasilla (módulo 360): así casilla + rueda = 0.
    const ruedaAhora = mod360(ruedaAlEmpezar);
    const ruedaFinal = ruedaAlEmpezar - (VUELTAS_RUEDA * 360) - mod360(ruedaAhora + anguloCasilla);
    const giroRueda = ruedaFinal - ruedaAlEmpezar;   // negativo

    const rueda = (ms) => {
        const t = Math.min(Math.max(ms / DURACION, 0), 1);
        return ruedaAlEmpezar + giroRueda * frena(t);
    };

    // Dónde está (visualmente) la casilla ganadora en cada instante.
    const casilla = (ms) => rueda(ms) + anguloCasilla;

    // --- LA BOLA, EN VUELO LIBRE ---
    //
    // Va hacia el lado positivo, o sea al revés que la rueda. Tiene que llegar
    // justo encima de la casilla ganadora en el instante en que se asienta, y
    // desde ahí viaja pegada a ella.
    const msAsiento = SE_ASIENTA * DURACION;
    const dondeSeAsienta = casilla(msAsiento);

    // Cuánto tiene que girar: hasta caer sobre la casilla, más las vueltas de
    // adorno. Positivo: es lo que la hace ir al contrario.
    const giroBola = mod360(dondeSeAsienta - bolaAlEmpezar) + VUELTAS_BOLA * 360;

    const anguloLibre = (ms) => {
        const t = Math.min(ms / msAsiento, 1);
        return bolaAlEmpezar + giroBola * frenaFuerte(t);
    };

    // --- EL RADIO: pista → espiral → rebotes → casilla ---
    const msCaida = EMPIEZA_A_CAER * DURACION;

    const radio = (ms) => {
        if (ms <= msCaida) return RADIO_PISTA;
        if (ms >= msAsiento) return RADIO_CASILLA;

        // u va de 0 (empieza a caer) a 1 (asentada)
        const u = (ms - msCaida) / (msAsiento - msCaida);

        // Primera parte: de la pista al suelo, en espiral que frena.
        if (u < PARTE_DE_BAJADA) {
            const b = u / PARTE_DE_BAJADA;
            return RADIO_PISTA - (RADIO_PISTA - RADIO_CASILLA) * frena(b);
        }

        // Segunda parte: rebota sobre el suelo. |sin| para que solo suba (nunca
        // se hunde por debajo de la casilla) y el exponencial para que cada
        // bote sea menor que el anterior. En v = 1 vale exactamente 0, que es
        // lo que garantiza que acaba en la casilla.
        const v = (u - PARTE_DE_BAJADA) / (1 - PARTE_DE_BAJADA);
        const rebote = ALTURA_REBOTE * Math.exp(-2.2 * v) * Math.abs(Math.sin(REBOTES * Math.PI * v)) * (1 - v);
        return RADIO_CASILLA + rebote;
    };

    // Un poco de temblor angular mientras rebota, que también muere a cero.
    const temblor = (ms) => {
        if (ms <= msCaida || ms >= msAsiento) return 0;
        const u = (ms - msCaida) / (msAsiento - msCaida);
        return 2.2 * Math.exp(-2.5 * u) * Math.sin(REBOTES * 2 * Math.PI * u) * (1 - u);
    };

    // Al asentarse, `anguloLibre` y `casilla` coinciden módulo 360 pero no en
    // absoluto (una lleva once vueltas de más). Se guarda ese desfase —que es
    // un múltiplo de 360— para que el ángulo sea continuo y no dé un salto de
    // varias vueltas en un solo frame.
    const desfase = anguloLibre(msAsiento) - casilla(msAsiento);

    const bola = (ms) => {
        const asentada = ms >= msAsiento;
        const angulo = asentada ? casilla(ms) + desfase : anguloLibre(ms) + temblor(ms);

        // Velocidad angular aproximada (grados/ms), para el volumen del zumbido.
        const paso = 16;
        const antes = asentada ? casilla(ms - paso) + desfase : anguloLibre(ms - paso);
        const velocidad = Math.abs(angulo - antes) / paso;

        return {
            angulo,
            radio: radio(ms),
            velocidad,
            asentada,
            // Ángulo de la bola RESPECTO a la rueda. Cuando cruza un múltiplo de
            // (360/37) es que ha pasado por encima de un separador.
            relativo: mod360(angulo - rueda(ms))
        };
    };

    return { duracion: DURACION, rueda, bola, ruedaAlFinal: ruedaFinal, msCaida, msAsiento };
};

/**
 * ¿HA CRUZADO UN SEPARADOR ENTRE DOS INSTANTES?
 *
 * Los separadores están cada `anguloSegmento` grados. Se compara en qué
 * casilla estaba antes y en cuál está ahora; si cambia, ha pasado por encima de
 * un separador y eso es un "clac". Devuelve cuántos ha cruzado (puede ser más
 * de uno si la bola va muy rápida y el frame fue largo).
 */
export const separadoresCruzados = (relativoAntes, relativoAhora, anguloSegmento) => {
    const antes = Math.floor(relativoAntes / anguloSegmento);
    const ahora = Math.floor(relativoAhora / anguloSegmento);
    let diff = Math.abs(ahora - antes);
    // Al pasar por 0/360 la diferencia sale enorme: es el camino corto.
    const total = Math.round(360 / anguloSegmento);
    if (diff > total / 2) diff = total - diff;
    return diff;
};
