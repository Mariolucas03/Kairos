import { useState } from 'react';

/**
 * ICONO DE UN RANGO MUSCULAR.
 *
 * Hasta ahora un rango era un punto de color y su nombre. Funciona, pero no
 * significa nada: un círculo gris y uno amarillo se distinguen, no se
 * RECONOCEN. Con un marco dibujado por rango, subir de Plata a Oro se ve.
 *
 * ⚠️ NO hace falta que existan todas las imágenes para que esto funcione.
 *
 * Busca `/rangos/<clave>.png` y, si no está, cae al punto de color de siempre.
 * Así se pueden ir metiendo de una en una sin que la app se llene de iconos
 * rotos por el camino, y si mañana falta una, esa fila se ve como antes en vez
 * de quedarse con un hueco.
 *
 * Los diez ficheros que busca, con estos nombres exactos:
 *
 *   /public/rangos/novato.png     /public/rangos/oro.png
 *   /public/rangos/madera.png     /public/rangos/platino.png
 *   /public/rangos/bronce.png     /public/rangos/diamante.png
 *   /public/rangos/hierro.png     /public/rangos/maestro.png
 *   /public/rangos/plata.png      /public/rangos/leyenda.png
 *
 * Tienen que ser PNG con transparencia de VERDAD: van sobre el fondo negro de
 * la app, y un fondo blanco pegado se ve como un cuadrado.
 */
export default function IconoRango({ rango, color = '#71717a', tamano = 18, className = '' }) {
    const [sinImagen, setSinImagen] = useState(false);

    if (!rango || sinImagen) {
        return (
            <span
                className={`rounded-full shrink-0 ${className}`}
                style={{ width: tamano * 0.55, height: tamano * 0.55, background: color }}
            />
        );
    }

    return (
        <img
            src={`/rangos/${rango}.png`}
            alt=""
            onError={() => setSinImagen(true)}
            className={`shrink-0 object-contain ${className}`}
            style={{ width: tamano, height: tamano }}
        />
    );
}
