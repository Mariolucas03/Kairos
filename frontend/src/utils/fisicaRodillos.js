/**
 * CÓMO RUEDA UN RODILLO DE TRAGAPERRAS.
 *
 * ⚠️ ANTES LOS RODILLOS ERAN FALSOS.
 *
 * Cada 50 milisegundos se cambiaban los símbolos al azar, con un temblor de
 * CSS encima, y al "parar" se pegaba el resultado del servidor. No había nada
 * que rodara: era un parpadeo de iconos. Una tragaperras de verdad tiene tiras
 * físicas con los símbolos impresos que giran, frenan y ENCAJAN con un golpe,
 * una tras otra.
 *
 * Esto describe ese movimiento en función del tiempo, y nada más. Un rodillo
 * es una tira larga de símbolos; la "posición" es cuántos símbolos se han
 * desplazado. La tira acaba con los símbolos que dijo el servidor, y la
 * posición final los deja justo en la ventana.
 *
 * ⚠️ EL RESULTADO LO DECIDE EL SERVIDOR. Esto solo dibuja el camino.
 */

// Cuándo se para cada rodillo, en milisegundos. Escalonados y cada vez más
// separados: es lo que hace que el último dé tiempo a que el corazón se
// acelere, que es la mitad de la gracia de una tragaperras.
export const PARADAS = [1400, 2000, 2650, 3400];

// Símbolos de relleno que pasan antes de los definitivos. Más = más vueltas.
// Distinto por rodillo para que no giren sincronizados, que se nota falso.
export const RELLENO = [22, 30, 38, 48];

// El encaje: el rodillo llega a su sitio un poco ANTES del final, se pasa un
// poco, y vuelve. Es el "clonc" de una tragaperras mecánica, y sin él el
// rodillo parece que se congela en vez de pararse.
const LLEGA_EN = 0.86;          // tanto por uno de su duración
const SOBREPASA = 0.32;         // en símbolos: cuánto se pasa antes de volver

/** Cúbica que frena. */
const frena = (t) => 1 - Math.pow(1 - t, 3);

/**
 * @param {Object} p
 * @param {number} p.relleno    símbolos de relleno antes de los definitivos
 * @param {number} p.duracion   cuándo se para este rodillo, en ms
 * @returns {{ posicion(ms), velocidad(ms), fin, duracion }}
 *          `posicion` en símbolos: 0 al empezar, `fin` = relleno al terminar.
 */
export const trayectoriaRodillo = ({ relleno, duracion }) => {
    const fin = relleno;
    const msLlegada = LLEGA_EN * duracion;

    const posicion = (ms) => {
        if (ms <= 0) return 0;
        if (ms >= duracion) return fin;

        // Hasta la llegada: frena hasta el sitio exacto.
        if (ms <= msLlegada) return fin * frena(ms / msLlegada);

        // Después: se pasa y vuelve. Media onda de seno que muere: en s = 1
        // vale 0 exacto, y por eso acaba clavado en `fin`.
        const s = (ms - msLlegada) / (duracion - msLlegada);
        return fin + SOBREPASA * Math.sin(Math.PI * s) * (1 - s * 0.35);
    };

    /** Símbolos por milisegundo, para la estela y el volumen. */
    const velocidad = (ms) => {
        const paso = 16;
        return Math.abs(posicion(ms) - posicion(Math.max(ms - paso, 0))) / paso;
    };

    return { posicion, velocidad, fin, duracion, msLlegada };
};

/**
 * MONTA LA TIRA DE UN RODILLO.
 *
 * Relleno al azar y, al final, los símbolos definitivos. Los de relleno no
 * pueden ser los mismos que los definitivos pegados a ellos: si el rodillo
 * frena sobre tres cerezas seguidas justo antes de las de verdad, parece que
 * ha "fallado" por un pelo, y eso no es azar, es diseño de tragaperras
 * tramposa. Aquí no se engaña al ojo.
 */
export const montarTira = ({ relleno, definitivos, catalogo, azar = Math.random }) => {
    const tira = [];
    const primeroReal = definitivos[0];
    for (let i = 0; i < relleno; i++) {
        let s = catalogo[Math.floor(azar() * catalogo.length)];
        // El último de relleno no puede ser igual al primero real, ni dos
        // seguidos iguales entre sí: que parezca una tira de verdad.
        const anterior = tira[i - 1];
        let intentos = 0;
        while ((s === anterior || (i === relleno - 1 && s === primeroReal)) && intentos < 10) {
            s = catalogo[Math.floor(azar() * catalogo.length)];
            intentos++;
        }
        tira.push(s);
    }
    return tira.concat(definitivos);
};
