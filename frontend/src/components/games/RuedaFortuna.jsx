import { forwardRef, memo, useImperativeHandle, useRef } from 'react';

/**
 * LA RUEDA DE PREMIOS, DE FERIA.
 *
 * Antes era un `conic-gradient` con las etiquetas encima y un triángulo blanco
 * fijo. Esto es un SVG con geometría: cuñas con borde, PIVOTES metálicos en
 * cada raya del borde, un aro con bombillas, y arriba la LENGÜETA, que es una
 * pieza aparte que pivota desde su tornillo y que los pivotes van doblando al
 * pasar (ver fisicaRuedaFortuna.js).
 *
 * ⚠️ EL GIRO NO LO HACE CSS. El juego escribe el transform del disco y el de
 * la lengüeta frame a frame por el `ref`. `rotacion` solo importa al montar y
 * entre tirada y tirada.
 *
 * Radios (viewBox de -200 a 200):
 *     200-186   el aro exterior con las bombillas
 *     186-180   el canto metálico donde van los pivotes
 *     180-40    las cuñas de premio
 *      40-0     el cubo central
 */

const punto = (r, grados) => {
    const rad = (grados * Math.PI) / 180;
    return [r * Math.sin(rad), -r * Math.cos(rad)];
};

const cuna = (rFuera, rDentro, a0, a1) => {
    const [x0, y0] = punto(rFuera, a0);
    const [x1, y1] = punto(rFuera, a1);
    const [x2, y2] = punto(rDentro, a1);
    const [x3, y3] = punto(rDentro, a0);
    return `M ${x0} ${y0} A ${rFuera} ${rFuera} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${rDentro} ${rDentro} 0 0 0 ${x3} ${y3} Z`;
};

const RuedaFortuna = forwardRef(function RuedaFortuna({ premios, rotacion = 0, iconoCentro = null }, ref) {
    const discoRef = useRef(null);
    const lenguetaRef = useRef(null);

    // El juego recibe los dos nodos que tiene que mover.
    useImperativeHandle(ref, () => ({ disco: discoRef.current, lengueta: lenguetaRef.current }), []);

    const n = premios.length;
    const seg = 360 / n;
    const bombillas = Array.from({ length: 24 }, (_, i) => i * 15);

    return (
        <svg viewBox="-200 -215 400 415" className="w-full h-full" style={{ overflow: 'visible' }}>
            <defs>
                <radialGradient id="rf-aro" cx="40%" cy="30%" r="80%">
                    <stop offset="0%" stopColor="#8b1a1a" />
                    <stop offset="60%" stopColor="#5a0f0f" />
                    <stop offset="100%" stopColor="#2a0606" />
                </radialGradient>
                <linearGradient id="rf-metal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f2f4f6" />
                    <stop offset="45%" stopColor="#9aa1a8" />
                    <stop offset="75%" stopColor="#5c6268" />
                    <stop offset="100%" stopColor="#d5dae0" />
                </linearGradient>
                <linearGradient id="rf-laton" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#f6e6b0" />
                    <stop offset="40%" stopColor="#c9a33f" />
                    <stop offset="70%" stopColor="#8a6b1e" />
                    <stop offset="100%" stopColor="#ead38f" />
                </linearGradient>
                <radialGradient id="rf-bombilla" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#fff9d6" />
                    <stop offset="55%" stopColor="#ffd54a" />
                    <stop offset="100%" stopColor="#b8860b" />
                </radialGradient>
                {/* La profundidad de las cuñas: sombra junto a los bordes */}
                <radialGradient id="rf-hondo" cx="50%" cy="50%" r="50%">
                    <stop offset="20%" stopColor="#000" stopOpacity="0.35" />
                    <stop offset="28%" stopColor="#000" stopOpacity="0" />
                    <stop offset="84%" stopColor="#000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
                </radialGradient>
                <radialGradient id="rf-brillo" cx="32%" cy="22%" r="60%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
                    <stop offset="60%" stopColor="#fff" stopOpacity="0.03" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <filter id="rf-sombra" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.7" />
                </filter>
            </defs>

            {/* ── LO QUE NO GIRA: el aro y las bombillas ─────────────────── */}
            <circle r="200" fill="url(#rf-aro)" stroke="#1a0404" strokeWidth="3" />
            {bombillas.map(a => {
                const [x, y] = punto(193, a);
                return (
                    <g key={a}>
                        <circle cx={x} cy={y} r="6.5" fill="#ffd54a" opacity="0.25" />
                        <circle cx={x} cy={y} r="4" fill="url(#rf-bombilla)" stroke="#6b4a00" strokeWidth="0.5" />
                    </g>
                );
            })}

            {/* ── LO QUE GIRA: el canto, las cuñas, los pivotes y el cubo ─── */}
            <g
                ref={discoRef}
                style={{ transform: `rotate(${rotacion}deg)`, transformOrigin: '0px 0px', willChange: 'transform' }}
            >
                <circle r="186" fill="url(#rf-metal)" />
                <circle r="181" fill="#111" />

                {premios.map((p, i) => (
                    <path key={`c${i}`} d={cuna(180, 40, i * seg, (i + 1) * seg)} fill={p.color} stroke="#000" strokeWidth="0.8" />
                ))}
                <circle r="180" fill="url(#rf-hondo)" pointerEvents="none" />

                {/* Las rayas entre premios, de latón */}
                {premios.map((_, i) => {
                    const [xf, yf] = punto(180, i * seg);
                    const [xd, yd] = punto(40, i * seg);
                    return <line key={`r${i}`} x1={xf} y1={yf} x2={xd} y2={yd} stroke="url(#rf-laton)" strokeWidth="2.5" />;
                })}

                {/* Las etiquetas, con la cabeza hacia fuera */}
                {premios.map((p, i) => {
                    const a = i * seg + seg / 2;
                    return (
                        <g key={`e${i}`} transform={`rotate(${a})`}>
                            <text
                                x="0" y="-128"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#fff"
                                filter="url(#rf-sombra)"
                                style={{ font: '900 30px ui-sans-serif, system-ui, sans-serif', letterSpacing: '-1px' }}
                            >{p.label}</text>
                            <image href="/assets/icons/ficha.png" x="-13" y="-104" width="26" height="26" filter="url(#rf-sombra)" />
                        </g>
                    );
                })}

                {/* LOS PIVOTES: los tornillos del borde que doblan la lengüeta */}
                {premios.map((_, i) => {
                    const [x, y] = punto(183.5, i * seg);
                    return (
                        <g key={`p${i}`}>
                            <circle cx={x} cy={y} r="5.5" fill="url(#rf-metal)" stroke="#3a3f45" strokeWidth="0.8" />
                            <circle cx={x - 1.5} cy={y - 1.8} r="1.6" fill="#fff" opacity="0.7" />
                        </g>
                    );
                })}

                {/* El cubo central */}
                <circle r="42" fill="url(#rf-laton)" stroke="#6b5316" strokeWidth="1.5" />
                <circle r="34" fill="#1a1a1e" />
                <circle r="34" fill="url(#rf-brillo)" />
                {iconoCentro && (
                    <foreignObject x="-16" y="-16" width="32" height="32">
                        <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a33f' }}>
                            {iconoCentro}
                        </div>
                    </foreignObject>
                )}
            </g>

            <circle r="199" fill="url(#rf-brillo)" pointerEvents="none" />

            {/* ── LA LENGÜETA: pivota desde su tornillo, encima de la rueda ── */}
            <g transform="translate(0 -206)">
                <g ref={lenguetaRef} style={{ transformOrigin: '0px 0px', willChange: 'transform' }}>
                    {/* La pestaña: de goma roja con canto claro, y apunta hacia abajo */}
                    <path d="M -9 0 L 9 0 L 3 40 L 0 46 L -3 40 Z" fill="#e11d48" stroke="#7f0d2a" strokeWidth="1.2" filter="url(#rf-sombra)" />
                    <path d="M -6 4 L -2 36" stroke="#fff" strokeWidth="1.2" opacity="0.35" strokeLinecap="round" />
                </g>
                {/* El tornillo */}
                <circle r="7" fill="url(#rf-metal)" stroke="#3a3f45" strokeWidth="1" />
                <circle cx="-2" cy="-2" r="2" fill="#fff" opacity="0.7" />
            </g>
        </svg>
    );
});

export default memo(RuedaFortuna);
