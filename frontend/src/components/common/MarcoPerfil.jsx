/**
 * EL MARCO QUE RODEA UN AVATAR.
 *
 * ⚠️ UN MARCO NO SIEMPRE ES UNA IMAGEN.
 *
 * La tienda vende ocho marcos y solo dos tienen dibujo (`/frames/rayos.png` y
 * `/frames/marco_oro.png`). Los otros seis son un emoji: 🌩️, 🟨, 🧊, 😈, 🌌…
 *
 * Y al equiparlos se guardaba ese emoji en `user.frame`, que las nueve pantallas
 * que pintan un avatar metían tal cual en un `<img src>`. Un emoji no es una
 * URL: el navegador intentaba descargar un fichero llamado "🌩️", no existía, y
 * lo que salía alrededor de la cara era el icono de imagen rota. Comprar un
 * marco te dejaba el perfil peor que antes, en todas las pantallas a la vez.
 *
 * Aquí se decide por el propio valor: si parece una ruta o una URL, es una
 * imagen; si no, es un emoji y se pinta como texto. Así funcionan los ocho, los
 * dos con dibujo siguen usándolo, y no hace falta dibujar seis marcos nuevos
 * para que la tienda deje de estar rota.
 *
 * Iba copiado y pegado en nueve sitios con nueve tamaños distintos. Ahora es uno.
 */

/** ¿Esto es una imagen, o un emoji? */
const esImagen = (marco) => {
    const v = String(marco || '').trim();
    return v.startsWith('/') || v.startsWith('http') || v.startsWith('data:');
};

/**
 * @param {string} marco     lo que hay en `user.frame`: una ruta o un emoji
 * @param {number} tamano    lado del cuadro, en píxeles
 * @param {number} desborde  cuánto sobresale por arriba y por la izquierda
 */
export default function MarcoPerfil({ marco, tamano = 52, desborde = 6, className = '' }) {
    if (!marco) return null;

    const comun = {
        position: 'absolute',
        top: -desborde,
        left: -desborde,
        width: tamano,
        height: tamano,
        maxWidth: 'none',
        pointerEvents: 'none',
        zIndex: 20
    };

    if (esImagen(marco)) {
        return <img src={marco} alt="" style={comun} className={`drop-shadow-md ${className}`} />;
    }

    // Emoji: se pinta centrado y a un tamaño que rodea la cara sin taparla. El
    // avatar ocupa el hueco de dentro, así que el emoji va detrás (z por debajo
    // del contenido) y con algo de sombra para que se despegue del fondo.
    return (
        <span
            style={{ ...comun, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: tamano * 0.95, lineHeight: 1 }}
            className={`drop-shadow-md select-none ${className}`}
            aria-hidden="true"
        >
            {marco}
        </span>
    );
}

export { esImagen };
