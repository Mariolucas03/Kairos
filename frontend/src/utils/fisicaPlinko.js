/**
 * LA CAIDA DE UNA BOLA DE PLINKO, COMO FUNCION DEL TIEMPO.
 *
 * El servidor decide el camino (doce ceros y unos: izquierda o derecha en
 * cada fila de clavos). Aqui solo se dibuja: dado el camino, `posicion(ms)`
 * dice donde esta la bola en cada instante. Igual que en la ruleta y la rueda
 * de la fortuna, el juego la llama desde un requestAnimationFrame y escribe
 * la posicion en el DOM, sin pasar por React.
 *
 * GEOMETRIA (en unidades de dibujo, el SVG las escala):
 *     La fila r (0..filas-1) tiene r+3 clavos, separados `paso` en x y `alto`
 *     en y. La bola arranca encima del clavo central de la fila 0 y en cada
 *     fila cae a un clavo de la siguiente: medio paso a la izquierda o a la
 *     derecha. Como la fila de abajo siempre tiene un clavo mas, la bola
 *     siempre aterriza SOBRE un clavo, y por eso rebota en cada fila.
 *     Debajo de la ultima fila hay filas+1 casillas; la bola cae en la
 *     numero (cuantas derechas llevaba).
 *
 * EL BOTE: entre clavo y clavo la bola no baja en linea recta. Sale un poco
 * hacia arriba (rebote) y luego cae acelerando: y = -0.9u + 1.9u² sobre la
 * altura de la fila, con u de 0 a 1. En x se mueve con freno al final.
 */

export const FILAS = 12;
export const PASO = 24;          // entre clavos, en x
export const ALTO = 26;          // entre filas, en y
export const ARRIBA = 34;        // y de la fila 0
export const CENTRO_X = 170;     // x del clavo central (ancho 340)
export const MS_POR_FILA = 150;
export const MS_ARRANQUE = 220;  // la caida desde arriba hasta el primer clavo
export const MS_FINAL = 170;     // desde el ultimo clavo hasta la casilla

/** Centro del clavo i (0..r+2) de la fila r. */
export const clavo = (r, i) => ({
    x: CENTRO_X + (i - (r + 2) / 2) * PASO,
    y: ARRIBA + r * ALTO
});

/** Centro de la casilla k (0..filas) de abajo. */
export const casilla = (k, filas = FILAS) => ({
    x: CENTRO_X + (k - filas / 2) * PASO,
    y: ARRIBA + filas * ALTO + 8
});

const suave = (u) => 1 - (1 - u) * (1 - u);                // freno al final
const bote = (u) => -0.9 * u + 1.9 * u * u;                 // sube un poco y cae

export function trayectoriaPlinko({ camino, filas = FILAS }) {
    if (!Array.isArray(camino) || camino.length !== filas) throw new Error('El camino tiene que tener una decision por fila');

    // Donde esta la bola (en pasos desde el centro) DESPUES de rebotar en la
    // fila r: la suma de derechas menos izquierdas, a medias.
    const desplazamientos = [0];
    for (let r = 0; r < filas; r++) desplazamientos.push(desplazamientos[r] + (camino[r] ? 0.5 : -0.5));
    // El punto de apoyo en cada fila: un clavo. Encima de la fila r la bola
    // esta en x = centro + desplazamientos[r] * paso.
    const apoyo = (r) => ({ x: CENTRO_X + desplazamientos[r] * PASO, y: ARRIBA + r * ALTO });
    const derechas = camino.reduce((a, b) => a + b, 0);
    const destino = casilla(derechas, filas);

    const duracion = MS_ARRANQUE + filas * MS_POR_FILA + MS_FINAL;

    const posicion = (ms) => {
        const t = Math.max(0, Math.min(ms, duracion));
        // 1. El arranque: cae desde arriba hasta el clavo central, acelerando.
        if (t < MS_ARRANQUE) {
            const u = t / MS_ARRANQUE;
            const a = apoyo(0);
            return { x: a.x, y: a.y - 30 + 30 * u * u };
        }
        // 2. Fila a fila: de un clavo al siguiente, con bote.
        const desde = t - MS_ARRANQUE;
        const r = Math.floor(desde / MS_POR_FILA);
        if (r < filas) {
            const u = (desde - r * MS_POR_FILA) / MS_POR_FILA;
            const a = apoyo(r), b = apoyo(r + 1);
            const yB = r + 1 < filas ? b.y : ARRIBA + filas * ALTO;   // debajo de la ultima fila no hay clavo
            return { x: a.x + (b.x - a.x) * suave(u), y: a.y + (yB - a.y) * bote(u) };
        }
        // 3. La caida final a la casilla.
        const u = Math.min(1, (desde - filas * MS_POR_FILA) / MS_FINAL);
        const ultimo = apoyo(filas);
        return { x: ultimo.x, y: (ARRIBA + filas * ALTO) + (destino.y - (ARRIBA + filas * ALTO)) * u * u };
    };

    /** Cuantos clavos ha golpeado ya la bola en el instante `ms`. */
    const golpesHasta = (ms) => {
        if (ms < MS_ARRANQUE) return 0;
        return Math.min(filas, Math.floor((ms - MS_ARRANQUE) / MS_POR_FILA) + 1);
    };

    return { duracion, posicion, golpesHasta, casilla: derechas, destino };
}
