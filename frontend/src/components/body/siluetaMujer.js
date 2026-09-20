/**
 * LA SILUETA DE MUJER: EL MISMO DIBUJO, CON OTRAS PROPORCIONES.
 *
 * La lámina muscular es una sola (public/body/muscles.jpg) y sus zonas están
 * trazadas al píxel sobre ella. Dibujar una lámina de mujer aparte
 * significaría volver a trazar cincuenta polígonos a mano, y que los dos
 * cuerpos se separaran con el tiempo.
 *
 * En vez de eso, el cuerpo de mujer es el MISMO dibujo deformado fila a fila:
 * hombros más estrechos, cintura marcada, caderas más anchas. La deformación
 * es una función `anchura(y)` que dice cuánto se ensancha o se estrecha cada
 * fila alrededor del eje de la figura. Se aplica dos veces con la misma
 * función: a la imagen (scripts/generar-silueta-mujer.py genera
 * muscles-mujer.jpg) y a las coordenadas de los polígonos aquí, al pintar.
 * Así las zonas siguen encajando al píxel sin volver a trazarlas.
 *
 * Coordenadas en píxeles de la lámina (1170x1150). El eje de la figura
 * frontal está en x=314 y el de la espalda en x=857.
 */

export const EJE = { front: 314, back: 857 };

// Puntos de control (y, factor de anchura). Entre dos puntos se interpola.
//   200-320  hombros y pecho       0,86  (más estrechos)
//   400-440  cintura               0,84
//   500-580  caderas y glúteo      1,08  (más anchas)
//   700+     piernas               0,97
const CONTROL = [
    [0, 1.0], [130, 1.0], [200, 0.88], [320, 0.87], [400, 0.84], [440, 0.86],
    [500, 1.06], [560, 1.08], [640, 1.03], [720, 0.98], [900, 0.97], [1150, 0.97]
];

/** Cuánto se ensancha (>1) o se estrecha (<1) la fila `y`. */
export const anchura = (y) => {
    if (y <= CONTROL[0][0]) return CONTROL[0][1];
    for (let i = 1; i < CONTROL.length; i++) {
        const [y1, f1] = CONTROL[i];
        if (y <= y1) {
            const [y0, f0] = CONTROL[i - 1];
            const t = (y - y0) / (y1 - y0);
            // Suave (coseno) para que no se noten los codos de la tabla
            const s = (1 - Math.cos(t * Math.PI)) / 2;
            return f0 + (f1 - f0) * s;
        }
    }
    return CONTROL[CONTROL.length - 1][1];
};

/** Un punto de la lámina, deformado. `vista` es 'front' o 'back'. */
export const deformar = (x, y, vista) => {
    const eje = EJE[vista] ?? EJE.front;
    return [eje + (x - eje) * anchura(y), y];
};

/**
 * Un path SVG ("M207,228L236,228...Z") con todos sus puntos deformados. Los
 * paths de la lámina solo usan M, L y Z con pares x,y: es lo único que hay
 * que entender.
 */
export const deformarPath = (d, vista) =>
    d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => {
        const [nx, ny] = deformar(Number(x), Number(y), vista);
        return `${nx.toFixed(1)},${ny}`;
    });

export const IMAGEN_MUJER = '/body/muscles-mujer.png?v=4';
