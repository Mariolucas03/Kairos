/**
 * LA RUEDA DE LA RULETA.
 *
 * Antes era un `conic-gradient` con los números encima y un círculo negro en
 * medio. Funcionaba —los colores estaban en su sitio— pero parecía un gráfico de
 * sectores, no una ruleta: plana, sin madera, sin separadores, sin pista para la
 * bola y sin la torreta del centro, que es la pieza que más se reconoce de una
 * ruleta y la que no estaba.
 *
 * Esto es un SVG porque hace falta geometría de verdad: cada casilla es una
 * cuña con su radio de dentro y de fuera, entre casilla y casilla van los
 * separadores metálicos, y la bola rueda por una pista hundida por fuera de
 * todo eso. Con divs y gradientes no se llega ahí.
 *
 * De fuera adentro, que es como se mira una ruleta:
 *
 *     200-178   la madera del cuenco
 *     178-172   el aro de latón
 *     172-150   la pista, hundida: por aquí rueda la bola
 *     150-146   el aro interior
 *     146-90    las 37 casillas, con sus separadores
 *      90-58    el cono
 *      58-0     la torreta, con sus cuatro brazos
 *
 * Los ángulos van en grados desde las 12 y en el sentido de las agujas, igual
 * que iba el `conic-gradient`, para no tener que tocar la lógica del giro.
 */

const ROJOS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// Radio del centro de la pista y de las casillas, en tanto por ciento del radio
// total. Los usa el juego para saber dónde poner la bola.
export const RADIO_PISTA = 82;
export const RADIO_CASILLA = 56;

const punto = (r, grados) => {
    const rad = (grados * Math.PI) / 180;
    return [r * Math.sin(rad), -r * Math.cos(rad)];
};

/** Una cuña entre dos radios y dos ángulos. */
const cuna = (rFuera, rDentro, a0, a1) => {
    const [x0, y0] = punto(rFuera, a0);
    const [x1, y1] = punto(rFuera, a1);
    const [x2, y2] = punto(rDentro, a1);
    const [x3, y3] = punto(rDentro, a0);
    return `M ${x0} ${y0} A ${rFuera} ${rFuera} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${rDentro} ${rDentro} 0 0 0 ${x3} ${y3} Z`;
};

export default function RuedaRuleta({ numeros, anguloSegmento, rotacion, girando, duracion }) {
    return (
        <svg viewBox="-200 -200 400 400" className="w-full h-full" style={{ overflow: 'visible' }}>
            <defs>
                {/* La madera: oscura arriba a la derecha, iluminada arriba a la
                    izquierda, como si la luz cayera de ahí. */}
                <radialGradient id="rr-madera" cx="35%" cy="28%" r="75%">
                    <stop offset="0%" stopColor="#7b4a24" />
                    <stop offset="45%" stopColor="#54301a" />
                    <stop offset="100%" stopColor="#2a1710" />
                </radialGradient>

                <linearGradient id="rr-laton" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#f4e2a8" />
                    <stop offset="35%" stopColor="#c9a33f" />
                    <stop offset="60%" stopColor="#8a6b1e" />
                    <stop offset="100%" stopColor="#e8d089" />
                </linearGradient>

                <radialGradient id="rr-pista" cx="40%" cy="30%" r="80%">
                    <stop offset="0%" stopColor="#2b2b31" />
                    <stop offset="70%" stopColor="#141418" />
                    <stop offset="100%" stopColor="#0a0a0c" />
                </radialGradient>

                <linearGradient id="rr-metal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#eef1f4" />
                    <stop offset="40%" stopColor="#9aa1a8" />
                    <stop offset="70%" stopColor="#5c6268" />
                    <stop offset="100%" stopColor="#c6ccd2" />
                </linearGradient>

                <radialGradient id="rr-cono" cx="38%" cy="26%" r="80%">
                    <stop offset="0%" stopColor="#dfe4e9" />
                    <stop offset="45%" stopColor="#878e96" />
                    <stop offset="100%" stopColor="#3b4046" />
                </radialGradient>

                {/* Sombra de dentro: es lo que hunde la pista y da profundidad.
                    Sin esto todo el conjunto vuelve a parecer una pegatina. */}
                <radialGradient id="rr-hueco" cx="50%" cy="50%" r="50%">
                    <stop offset="70%" stopColor="#000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.75" />
                </radialGradient>

                <radialGradient id="rr-brillo" cx="32%" cy="22%" r="55%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.20" />
                    <stop offset="60%" stopColor="#fff" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* ── LO QUE NO GIRA: el cuenco y la pista ────────────────────── */}
            <circle r="200" fill="url(#rr-madera)" />
            <circle r="200" fill="none" stroke="#1a0e08" strokeWidth="3" />
            <circle r="186" fill="none" stroke="#000" strokeWidth="1" opacity="0.35" />
            <circle r="175" fill="url(#rr-laton)" />
            <circle r="172" fill="url(#rr-pista)" />
            <circle r="172" fill="url(#rr-hueco)" />

            {/* Los deflectores: los rombos metálicos que hacen saltar la bola */}
            {[30, 90, 150, 210, 270, 330].map(a => {
                const [x, y] = punto(160, a);
                return (
                    <g key={a} transform={`translate(${x} ${y}) rotate(${a})`}>
                        <rect x="-4.5" y="-9" width="9" height="18" rx="2" fill="url(#rr-metal)" stroke="#3d4247" strokeWidth="0.6" />
                    </g>
                );
            })}

            {/* ── LO QUE GIRA: las casillas, los números y la torreta ─────── */}
            <g
                style={{
                    transform: `rotate(-${rotacion}deg)`,
                    // ⚠️ '0px 0px' y no 'center'.
                    //
                    // El viewBox va de -200 a 200, asi que el centro de la rueda
                    // ES el origen. Con 'center', el navegador resuelve el origen
                    // a 200px 200px —la mitad del ANCHO del viewBox, contada
                    // desde su esquina— y eso aqui cae en el cuadrante de abajo a
                    // la derecha. La rueda giraba alrededor de ese punto y se
                    // salia entera de la pantalla: tras el primer giro solo
                    // quedaban la madera y la pista, que no giran.
                    transformOrigin: '0px 0px',
                    transition: girando ? `transform ${duracion}ms cubic-bezier(0.25, 0.1, 0.25, 1)` : 'none'
                }}
            >
                <circle r="150" fill="url(#rr-laton)" />

                {numeros.map((n, i) => {
                    const a0 = i * anguloSegmento;
                    const a1 = (i + 1) * anguloSegmento;
                    const relleno = n === 0 ? '#0b6b32' : ROJOS.includes(n) ? '#b31018' : '#141418';
                    return (
                        <path key={`c${n}`} d={cuna(146, 90, a0, a1)} fill={relleno} stroke="#000" strokeWidth="0.4" />
                    );
                })}

                {/* Los separadores. Van DESPUÉS de las casillas para que se vean
                    por encima, y estrechan hacia el centro como los de verdad. */}
                {numeros.map((n, i) => {
                    const a = i * anguloSegmento;
                    const [xf, yf] = punto(147, a);
                    const [xd, yd] = punto(89, a);
                    return (
                        <g key={`s${n}`}>
                            <line x1={xf} y1={yf} x2={xd} y2={yd} stroke="url(#rr-metal)" strokeWidth="2.4" strokeLinecap="round" />
                            <circle cx={xf} cy={yf} r="2.6" fill="url(#rr-metal)" stroke="#4a4f55" strokeWidth="0.5" />
                        </g>
                    );
                })}

                {/* Los números, con la cabeza hacia fuera: así se leen desde el
                    sitio en el que estás, que es como están impresos de verdad. */}
                {numeros.map((n, i) => {
                    const a = i * anguloSegmento + anguloSegmento / 2;
                    return (
                        <g key={`n${n}`} transform={`rotate(${a})`}>
                            <text
                                x="0" y="-118"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#fff"
                                style={{ font: '700 15px ui-sans-serif, system-ui, sans-serif', letterSpacing: '-0.5px' }}
                            >{n}</text>
                        </g>
                    );
                })}

                {/* El cono y la torreta */}
                <circle r="90" fill="url(#rr-cono)" stroke="#2d3238" strokeWidth="1.5" />
                <circle r="90" fill="url(#rr-brillo)" />
                <circle r="58" fill="url(#rr-laton)" stroke="#6b5316" strokeWidth="1" />
                <circle r="46" fill="url(#rr-cono)" />

                {/* Los cuatro brazos de la torreta */}
                {[0, 90, 180, 270].map(a => (
                    <g key={`t${a}`} transform={`rotate(${a})`}>
                        <path d="M -6 -44 L 6 -44 L 3.5 -8 L -3.5 -8 Z" fill="url(#rr-laton)" stroke="#5c4712" strokeWidth="0.6" />
                    </g>
                ))}

                <circle r="16" fill="url(#rr-laton)" stroke="#5c4712" strokeWidth="1" />
                <circle r="7" fill="#3b4046" />
                <circle cx="-4" cy="-5" r="2.5" fill="#fff" opacity="0.5" />
            </g>

            {/* El brillo de toda la pieza va el último: es el cristal, y el
                cristal no gira con la rueda. */}
            <circle r="199" fill="url(#rr-brillo)" pointerEvents="none" />
        </svg>
    );
}
