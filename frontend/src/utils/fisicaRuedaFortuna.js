/**
 * CÓMO GIRA UNA RUEDA DE PREMIOS.
 *
 * ⚠️ ANTES ERA UN DISCO DE COLORES CON UNA TRANSICIÓN DE CSS.
 *
 * Un `conic-gradient`, un `rotate()` de cinco segundos y un triángulo blanco
 * fijo encima. Lo que hace que una rueda de feria sea una rueda de feria no es
 * el disco: es la LENGÜETA. La pestaña flexible de arriba que los pivotes del
 * borde van empujando al pasar y que salta hacia atrás con un "tic". Al
 * principio los tics son un zumbido; al final, uno... otro... y el último, que
 * es el que decide. Sin eso, el disco gira en silencio y se para, y no hay
 * momento.
 *
 * Esto calcula la rueda Y la lengüeta en función del tiempo. Matemática pura.
 *
 * ⚠️ EL PREMIO LO DECIDE EL SERVIDOR. Esto solo dibuja el camino hasta él.
 *
 * CONVENCIÓN: grados visuales, los que van dentro de un `rotate()`. La rueda
 * gira hacia positivo (sentido de las agujas, como antes). Los pivotes están en
 * las rayas entre premios, y la lengüeta apunta hacia abajo desde las 12.
 */

export const DURACION = 6200;

const VUELTAS = 5;

// El balanceo final: la lengüeta se engancha en el último pivote y la rueda
// cede un poco hacia atrás antes de quedarse. Se pasa `SOBREPASA` grados y
// vuelve. Tiene que ser menor que medio segmento, o cruzaría un pivote y el
// premio que se ve no sería el que se paga.
const LLEGA_EN = 0.90;
const SOBREPASA = 5;

// Cuánto se dobla la lengüeta al pasar un pivote (grados) y en qué fracción
// del segmento se recupera. Con la rueda rápida no llega a recuperarse entre
// pivote y pivote y se ve vibrando, que es exactamente lo que pasa de verdad.
const LENGUETA_MAX = 38;
const LENGUETA_RECUPERA = 0.45;

const mod360 = (a) => ((a % 360) + 360) % 360;

/**
 * ⚠️ CUADRÁTICA, NO CÚBICA, Y NO ES UN GUSTO.
 *
 * Una rueda frena por rozamiento, que es constante: la velocidad baja en línea
 * recta y el ángulo es una parábola. Eso es exactamente 1 - (1-t)². Con la
 * cúbica (la de la ruleta del casino, donde la bola pone el final) la rueda se
 * quedaba casi parada el último segundo y medio, y el último tic de la
 * lengüeta llegaba demasiado pronto: silencio, deriva, y se para. Con la
 * parábola el último tic cae unas décimas antes de quedarse, que es el momento.
 */
const frena = (t) => 1 - Math.pow(1 - t, 2);
const frenaCubica = (t) => 1 - Math.pow(1 - t, 3);

/**
 * @param {Object} p
 * @param {number} p.giroAlEmpezar   ángulo actual de la rueda
 * @param {number} p.indiceGanador   qué premio (0..segmentos-1) tiene que quedar arriba
 * @param {number} p.segmentos       cuántos premios tiene la rueda
 */
export const trayectoriaRueda = ({ giroAlEmpezar, indiceGanador, segmentos }) => {
    const seg = 360 / segmentos;
    // El centro del premio ganador, en la rueda sin girar.
    const anguloPremio = indiceGanador * seg + seg / 2;

    // Para que ese centro quede en las 12, la rueda tiene que acabar en
    // -anguloPremio (mod 360). Se le suman vueltas enteras hacia positivo.
    const ahora = mod360(giroAlEmpezar);
    const objetivo = mod360(-anguloPremio);
    const faltaHastaObjetivo = mod360(objetivo - ahora);
    const giroFinal = giroAlEmpezar + VUELTAS * 360 + faltaHastaObjetivo;
    const giroTotal = giroFinal - giroAlEmpezar;

    const msLlegada = LLEGA_EN * DURACION;

    const rueda = (ms) => {
        if (ms <= 0) return giroAlEmpezar;
        if (ms >= DURACION) return giroFinal;

        // Hasta la llegada: frena hasta el objetivo MÁS el sobrepaso.
        if (ms <= msLlegada) return giroAlEmpezar + (giroTotal + SOBREPASA) * frena(ms / msLlegada);

        // Después: cede hacia atrás hasta el objetivo. Media onda que muere.
        const s = (ms - msLlegada) / (DURACION - msLlegada);
        return giroFinal + SOBREPASA * (1 - s) * Math.cos(s * Math.PI / 2);
    };

    /**
     * Cuánto está doblada la lengüeta (grados). Justo después de que pase un
     * pivote está doblada del todo y se va enderezando hasta el siguiente.
     * Como el ángulo de la rueda ya frena, esto se espacia solo.
     */
    const lengueta = (ms) => {
        const pasadoDelPivote = mod360(rueda(ms)) % seg;   // 0 = acaba de pasar uno
        const fraccion = pasadoDelPivote / seg;
        if (fraccion >= LENGUETA_RECUPERA) return 0;
        // Se endereza con una curva que frena: al principio rápido.
        const u = fraccion / LENGUETA_RECUPERA;
        return LENGUETA_MAX * (1 - frenaCubica(u));
    };

    /** Velocidad angular aproximada, grados/ms, para el volumen. */
    const velocidad = (ms) => {
        const paso = 16;
        return Math.abs(rueda(ms) - rueda(Math.max(ms - paso, 0))) / paso;
    };

    /** Cuántos pivotes ha pasado entre dos instantes: cada uno es un tic. */
    const pivotesEntre = (msAntes, msAhora) => {
        const a = Math.floor(rueda(msAntes) / seg);
        const b = Math.floor(rueda(msAhora) / seg);
        return Math.abs(b - a);
    };

    return { rueda, lengueta, velocidad, pivotesEntre, giroFinal, duracion: DURACION, msLlegada, seg };
};

/** Qué premio queda arriba con un giro dado. La inversa, para las pruebas. */
export const premioArriba = (giro, segmentos) => {
    const seg = 360 / segmentos;
    // El punto de la rueda que está en las 12 es -giro (mod 360).
    return Math.floor(mod360(-giro) / seg);
};
