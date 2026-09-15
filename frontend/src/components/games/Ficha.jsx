import { memo } from 'react';

/**
 * UNA FICHA DE CASINO, DIBUJADA.
 *
 * La misma en todos los juegos: en el selector de apuesta, en la barra de la
 * ruleta y encima de la mesa. Antes cada sitio pintaba su circulo de color con
 * un numero dentro y no habia dos iguales.
 *
 * Es la ficha clasica: disco de color, seis bandas claras en el canto, un aro
 * interior y el valor grabado en el centro. El color lo decide el valor, como
 * en una mesa de verdad (rojo 5-10, azul 20-25, verde 50, negro 100, morado
 * 500, oro a partir de 1000).
 *
 * Dos formas: `Ficha` es un <svg> suelto para HTML, y `FichaG` es un <g> para
 * meterla dentro de otro SVG (la mesa de la ruleta). Las dos pintan lo mismo.
 */

export const colorDeFicha = (valor) => {
    if (valor >= 1000) return { base: '#b8860b', borde: '#f5d37a', tinta: '#1a1200' };
    if (valor >= 500) return { base: '#6d28d9', borde: '#c4b5fd', tinta: '#fff' };
    if (valor >= 100) return { base: '#18181b', borde: '#a1a1aa', tinta: '#fff' };
    if (valor >= 50) return { base: '#15803d', borde: '#86efac', tinta: '#fff' };
    if (valor >= 20) return { base: '#1d4ed8', borde: '#93c5fd', tinta: '#fff' };
    return { base: '#b91c1c', borde: '#fca5a5', tinta: '#fff' };
};

/** "1K", "2.5K" o el numero, para que quepa en el centro. */
export const etiquetaDeFicha = (valor) => {
    if (valor >= 1000) return `${Math.round(valor / 100) / 10}K`.replace('.0K', 'K');
    return String(valor);
};

const BANDAS = [0, 60, 120, 180, 240, 300];

/** El dibujo, en coordenadas de -50 a 50. */
const Dibujo = ({ valor, id }) => {
    const c = colorDeFicha(valor);
    const texto = etiquetaDeFicha(valor);
    const tam = texto.length >= 4 ? 22 : texto.length === 3 ? 27 : 32;
    return (
        <>
            <defs>
                <radialGradient id={`${id}-luz`} cx="35%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
                    <stop offset="55%" stopColor="#fff" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
                </radialGradient>
            </defs>
            {/* El canto: un poco mas oscuro, para el grosor */}
            <circle r="50" fill={c.base} stroke="#000" strokeOpacity="0.55" strokeWidth="2" />
            {/* Las bandas del borde */}
            {BANDAS.map(a => (
                <rect key={a} x="-9" y="-50" width="18" height="13" rx="2" fill={c.borde} transform={`rotate(${a})`} />
            ))}
            {/* El aro interior, grabado */}
            <circle r="34" fill="none" stroke={c.borde} strokeWidth="1.5" strokeDasharray="6 4" opacity="0.9" />
            <circle r="29" fill={c.base} stroke="#000" strokeOpacity="0.35" strokeWidth="1" />
            <text
                x="0" y="1"
                textAnchor="middle" dominantBaseline="middle"
                fill={c.tinta}
                style={{ font: `900 ${tam}px ui-sans-serif, system-ui, sans-serif`, letterSpacing: '-1px' }}
            >{texto}</text>
            {/* La luz de arriba a la izquierda */}
            <circle r="50" fill={`url(#${id}-luz)`} pointerEvents="none" />
        </>
    );
};

/** Ficha suelta para HTML. `tamano` en px. */
export const Ficha = memo(function Ficha({ valor, tamano = 44, className = '', style }) {
    const id = `f${valor}`;
    return (
        <svg
            viewBox="-52 -52 104 104"
            width={tamano} height={tamano}
            className={className}
            style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.6))', ...style }}
            aria-hidden="true"
        >
            <Dibujo valor={valor} id={id} />
        </svg>
    );
});

/** Ficha dentro de otro SVG: un <g> centrado en (x, y) de radio `r`. */
export const FichaG = memo(function FichaG({ valor, x = 0, y = 0, r = 12 }) {
    const id = `g${valor}`;
    return (
        <g transform={`translate(${x} ${y}) scale(${r / 50})`} style={{ filter: 'drop-shadow(0 1.5px 1px rgba(0,0,0,0.7))' }}>
            <Dibujo valor={valor} id={id} />
        </g>
    );
});

export default Ficha;
