import { memo } from 'react';
import { FichaG } from './Ficha';

/**
 * EL TAPETE DE LA RULETA.
 *
 * Antes era una rejilla HTML de 600px encogida con `scale`, con botones grises
 * y un circulo con un numero por ficha. Esto es un SVG con el paño verde, las
 * lineas doradas, el cero en su sitio y las fichas de verdad apiladas encima
 * de cada apuesta. Como es un SVG con viewBox, se estira al ancho que haya y
 * no se corta nada: ni el cero por la izquierda ni el 2:1 por la derecha.
 *
 * Geometria (viewBox 0 0 400 216):
 *     x   6-38    el cero (tres filas de alto)
 *     x  40-364   los 36 numeros, 12 columnas de 27 y filas de 46
 *     x 366-394   las columnas 2:1
 *     y   6-144   las tres filas de numeros
 *     debajo, las docenas y las apuestas de fuera (1-18, par, rojo, negro, impar, 19-36)
 *
 * A CABALLO Y ESQUINA, como en la mesa de verdad: entre dos casillas que se
 * tocan hay una zona invisible que apuesta a las dos (paga x18), y en cada
 * cruce de cuatro, otra que apuesta a las cuatro (x9). Se pintan ENCIMA de
 * los numeros, asi que tocar justo la raya coge la raya y tocar el centro
 * coge el numero. En modo pintar no existen: pintar es de numeros.
 *
 * Las apuestas se hacen con `onApostar(type, value, numbers, multiplier)`,
 * los mismos cuatro datos de siempre: el servidor no cambia.
 *
 * Modo pintar: los numeros llevan `data-number`, y el juego busca por
 * `elementFromPoint` la casilla bajo el dedo. Por eso los textos y las fichas
 * no reciben eventos: si no, el dedo "tocaba" la ficha y no la casilla.
 */

const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const FILAS = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
];
const X0 = 40, ANCHO = 27, Y0 = 6, ALTO = 46;
// Donde empiezan las docenas y las de fuera, debajo de las tres filas
const Y_DOCENAS = Y0 + ALTO * 3 + 3;
const Y_FUERA = Y_DOCENAS + 30;
const ALTO_TOTAL = Y_FUERA + 33;
const ORO = '#d9b24c';

const colorDe = (n) => (n === 0 ? 'url(#mr-verde)' : ROJOS.has(n) ? 'url(#mr-rojo)' : 'url(#mr-negro)');

/** Las fichas apiladas sobre una apuesta: hasta cinco, y el total encima. */
const Pila = ({ apuestas, x, y, r = 9 }) => {
    if (apuestas.length === 0) return null;
    const total = apuestas.reduce((a, b) => a + b.amount, 0);
    const visibles = apuestas.slice(-5);
    return (
        <g pointerEvents="none">
            {visibles.map((b, i) => (
                <FichaG key={b.id ?? i} valor={total} x={x} y={y - i * 1.6} r={r} />
            ))}
        </g>
    );
};

const Casilla = ({ x, y, w, h, fill, etiqueta, tam = 13, vertical = false, apuestas, onApostar, extra = {}, ganadora = false }) => (
    <g>
        <rect
            x={x} y={y} width={w} height={h}
            fill={fill} stroke={ORO} strokeWidth="1.2"
            onPointerDown={onApostar}
            className="cursor-pointer"
            style={{ touchAction: 'none' }}
            {...extra}
        />
        {ganadora && (
            <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill="none" stroke="#fde047" strokeWidth="2.5" pointerEvents="none" className="animate-pulse" />
        )}
        <text
            x={x + w / 2} y={y + h / 2 + 0.5}
            textAnchor="middle" dominantBaseline="middle"
            fill="#fff"
            pointerEvents="none"
            transform={vertical ? `rotate(-90 ${x + w / 2} ${y + h / 2})` : undefined}
            style={{ font: `800 ${tam}px ui-sans-serif, system-ui, sans-serif` }}
        >{etiqueta}</text>
        <Pila apuestas={apuestas} x={x + w / 2} y={y + h / 2} r={Math.min(9, h / 2 - 3)} />
    </g>
);

const MesaRuleta = ({ bets, onApostar, modoPintar = false, onInicioPintar, ganador = null, deshabilitada = false }) => {
    const de = (fn) => bets.filter(fn);
    const numeroDown = (n) => (e) => {
        if (deshabilitada) return;
        e.preventDefault();
        if (modoPintar) onInicioPintar?.(n);
        else onApostar('number', n, [n], 36);
    };
    const simple = (type, value, numbers, mult) => (e) => {
        if (deshabilitada) return;
        e.preventDefault();
        onApostar(type, value, numbers, mult);
    };

    const docena = (d) => Array.from({ length: 12 }, (_, i) => i + 1 + (d - 1) * 12);
    const todos = Array.from({ length: 36 }, (_, i) => i + 1);

    return (
        <svg viewBox={`0 0 400 ${ALTO_TOTAL}`} className="w-full h-auto select-none" style={{ display: 'block', touchAction: 'none' }}>
            <defs>
                <radialGradient id="mr-pano" cx="50%" cy="40%" r="80%">
                    <stop offset="0%" stopColor="#1a6b3a" />
                    <stop offset="60%" stopColor="#0f4a27" />
                    <stop offset="100%" stopColor="#083118" />
                </radialGradient>
                <radialGradient id="mr-rojo" cx="50%" cy="35%" r="75%">
                    <stop offset="0%" stopColor="#dc2626" />
                    <stop offset="100%" stopColor="#7f1d1d" />
                </radialGradient>
                <radialGradient id="mr-negro" cx="50%" cy="35%" r="75%">
                    <stop offset="0%" stopColor="#27272a" />
                    <stop offset="100%" stopColor="#09090b" />
                </radialGradient>
                <radialGradient id="mr-verde" cx="50%" cy="35%" r="75%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#14532d" />
                </radialGradient>
                <pattern id="mr-tejido" width="4" height="4" patternUnits="userSpaceOnUse">
                    <rect width="4" height="4" fill="transparent" />
                    <circle cx="1" cy="1" r="0.5" fill="#000" opacity="0.18" />
                    <circle cx="3" cy="3" r="0.5" fill="#fff" opacity="0.05" />
                </pattern>
            </defs>

            {/* El paño */}
            <rect x="0" y="0" width="400" height={ALTO_TOTAL} rx="10" fill="url(#mr-pano)" />
            <rect x="0" y="0" width="400" height={ALTO_TOTAL} rx="10" fill="url(#mr-tejido)" pointerEvents="none" />

            {/* EL CERO */}
            <g>
                <path
                    d={`M 38 ${Y0} L 38 ${Y0 + ALTO * 3} L 14 ${Y0 + ALTO * 3} Q 6 ${Y0 + ALTO * 3} 6 ${Y0 + ALTO * 3 - 8} L 6 ${Y0 + 8} Q 6 ${Y0} 14 ${Y0} Z`}
                    fill="url(#mr-verde)" stroke={ORO} strokeWidth="1.2"
                    data-number="0"
                    onPointerDown={numeroDown(0)}
                    className="cursor-pointer"
                    style={{ touchAction: 'none' }}
                />
                {ganador === 0 && <rect x="8" y={Y0 + 2} width="28" height={ALTO * 3 - 4} rx="6" fill="none" stroke="#fde047" strokeWidth="2.5" pointerEvents="none" className="animate-pulse" />}
                <text x="22" y={Y0 + ALTO * 1.5} textAnchor="middle" dominantBaseline="middle" fill="#fff" pointerEvents="none"
                    style={{ font: '800 18px ui-sans-serif, system-ui, sans-serif' }}>0</text>
                <Pila apuestas={de(b => b.type === 'number' && b.value === 0)} x={22} y={Y0 + ALTO * 1.5} />
            </g>

            {/* LOS 36 */}
            {FILAS.map((fila, f) => fila.map((n, c) => (
                <Casilla
                    key={n}
                    x={X0 + c * ANCHO} y={Y0 + f * ALTO} w={ANCHO} h={ALTO}
                    fill={colorDe(n)} etiqueta={n} tam={14}
                    apuestas={de(b => b.type === 'number' && b.value === n)}
                    onApostar={numeroDown(n)}
                    extra={{ 'data-number': n }}
                    ganadora={ganador === n}
                />
            )))}

            {/* LAS COLUMNAS 2:1 */}
            {[3, 2, 1].map((col, i) => (
                <Casilla
                    key={`col${col}`}
                    x={366} y={Y0 + i * ALTO} w={28} h={ALTO}
                    fill="rgba(0,0,0,0.25)" etiqueta="2:1" tam={11} vertical
                    apuestas={de(b => b.type === 'column' && b.value === col)}
                    onApostar={simple('column', col, FILAS[i], 3)}
                />
            ))}

            {/* LAS DOCENAS */}
            {[1, 2, 3].map((d, i) => (
                <Casilla
                    key={`doc${d}`}
                    x={X0 + i * ANCHO * 4} y={Y_DOCENAS} w={ANCHO * 4} h={27}
                    fill="rgba(0,0,0,0.25)" etiqueta={['1ª 12', '2ª 12', '3ª 12'][i]} tam={12}
                    apuestas={de(b => b.type === 'dozen' && b.value === d)}
                    onApostar={simple('dozen', d, docena(d), 3)}
                />
            ))}

            {/* LAS DE FUERA */}
            {[
                { k: 'low', v: 'low', t: '1-18', nums: todos.slice(0, 18), fill: 'rgba(0,0,0,0.25)' },
                { k: 'even', v: 'even', t: 'PAR', nums: todos.filter(n => n % 2 === 0), fill: 'rgba(0,0,0,0.25)' },
                { k: 'color', v: 'red', t: 'ROJO', nums: todos.filter(n => ROJOS.has(n)), fill: 'url(#mr-rojo)' },
                { k: 'color', v: 'black', t: 'NEGRO', nums: todos.filter(n => !ROJOS.has(n)), fill: 'url(#mr-negro)' },
                { k: 'odd', v: 'odd', t: 'IMPAR', nums: todos.filter(n => n % 2 === 1), fill: 'rgba(0,0,0,0.25)' },
                { k: 'high', v: 'high', t: '19-36', nums: todos.slice(18), fill: 'rgba(0,0,0,0.25)' }
            ].map((a, i) => (
                <Casilla
                    key={a.t}
                    x={X0 + i * ANCHO * 2} y={Y_FUERA} w={ANCHO * 2} h={30}
                    fill={a.fill} etiqueta={a.t} tam={11}
                    apuestas={de(b => b.type === a.k && b.value === a.v)}
                    onApostar={simple(a.k, a.v, a.nums, 2)}
                />
            ))}

            {/* A CABALLO (dos que se tocan) y ESQUINA (cuatro): zonas
                invisibles sobre las rayas, con la ficha centrada en la raya. */}
            {!modoPintar && FILAS.map((fila, f) => fila.map((n, c) => {
                const zonas = [];
                const cx = X0 + c * ANCHO, cy = Y0 + f * ALTO;
                // de lado: con el de la columna siguiente
                if (c < 11) {
                    const otro = FILAS[f][c + 1];
                    const clave = [n, otro].sort((a, b) => a - b).join('-');
                    zonas.push({ tipo: 'split', clave, nums: [n, otro], x: cx + ANCHO, y: cy + ALTO / 2, w: 10, h: ALTO - 12 });
                }
                // arriba-abajo: con el de la fila siguiente (misma columna)
                if (f < 2) {
                    const otro = FILAS[f + 1][c];
                    const clave = [n, otro].sort((a, b) => a - b).join('-');
                    zonas.push({ tipo: 'split', clave, nums: [n, otro], x: cx + ANCHO / 2, y: cy + ALTO, w: ANCHO - 12, h: 10 });
                }
                // esquina: los cuatro del cruce de abajo a la derecha
                if (c < 11 && f < 2) {
                    const nums = [n, FILAS[f][c + 1], FILAS[f + 1][c], FILAS[f + 1][c + 1]].sort((a, b) => a - b);
                    zonas.push({ tipo: 'corner', clave: nums.join('-'), nums, x: cx + ANCHO, y: cy + ALTO, w: 12, h: 12 });
                }
                return zonas.map(z => (
                    <g key={`${z.tipo}-${z.clave}`}>
                        <rect
                            x={z.x - z.w / 2} y={z.y - z.h / 2} width={z.w} height={z.h}
                            fill="transparent"
                            onPointerDown={simple(z.tipo, z.clave, z.nums, z.tipo === 'split' ? 18 : 9)}
                            className="cursor-pointer"
                            style={{ touchAction: 'none' }}
                        />
                        <Pila apuestas={de(b => b.type === z.tipo && b.value === z.clave)} x={z.x} y={z.y} r={8} />
                    </g>
                ));
            }))}
        </svg>
    );
};

export default memo(MesaRuleta);
