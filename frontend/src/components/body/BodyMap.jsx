import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { BODY_PARTS, MUSCLE_SHAPES, GROUPS_BY_VIEW } from './bodyPaths';

/**
 * MAPA DEL CUERPO
 *
 * Un único componente que se usa en tres sitios:
 *  1. Pestaña "Cuerpo" del perfil  → color según el RANGO de cada músculo
 *  2. Post del entreno en el feed   → resalta los músculos TRABAJADOS
 *  3. Resumen al terminar el entreno
 *
 * @param {Object}  levels     { Pecho: { rankColor, rankLabel, progress } , ... }
 * @param {Array}   highlight  grupos a resaltar (modo "músculos trabajados")
 * @param {Array}   secondary  grupos implicados de forma secundaria
 * @param {string}  accent     color de resaltado
 * @param {boolean} dual       pinta frente y espalda a la vez, sin botón de girar
 */

// Una sola figura (frente o espalda)
function Figura({ view, getFill, onSelectMuscle }) {
    const shapes = MUSCLE_SHAPES[view] || {};
    return (
        <svg
            viewBox="0 0 220 400"
            className="w-full h-full"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
        >
            {/* Silueta base, dibujada por partes */}
            {BODY_PARTS.map((part, i) => (
                part.type === 'ellipse'
                    ? <ellipse key={i} cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
                    : <path key={i} d={part.d} fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" strokeLinejoin="round" />
            ))}

            {/* Zonas musculares */}
            {Object.entries(shapes).map(([group, paths]) => {
                const { fill, opacity } = getFill(group);
                const clickable = !!onSelectMuscle;
                return (
                    <g
                        key={group}
                        onClick={() => onSelectMuscle?.(group)}
                        style={{ cursor: clickable ? 'pointer' : 'default' }}
                        className="transition-opacity duration-500"
                    >
                        {paths.map((d, i) => (
                            <path
                                key={i}
                                d={d}
                                fill={fill}
                                fillOpacity={opacity}
                                stroke={fill}
                                strokeOpacity={Math.min(1, opacity + 0.25)}
                                strokeWidth="1"
                                strokeLinejoin="round"
                            />
                        ))}
                        <title>{group}</title>
                    </g>
                );
            })}
        </svg>
    );
}

export default function BodyMap({
    levels = null,
    highlight = [],
    secondary = [],
    accent = '#eab308',
    showToggle = true,
    dual = false,
    onSelectMuscle = null,
    className = ''
}) {
    const [view, setView] = useState('front');

    const highlightSet = new Set(highlight);
    const secondarySet = new Set(secondary);

    // Color y opacidad de cada zona según el modo en el que se use
    const getFill = (group) => {
        if (highlight.length || secondary.length) {
            if (highlightSet.has(group)) return { fill: accent, opacity: 0.85 };
            if (secondarySet.has(group)) return { fill: accent, opacity: 0.35 };
            return { fill: '#3f3f46', opacity: 0.35 };
        }

        if (levels && levels[group]) {
            const info = levels[group];
            // Sin actividad todavía: gris apagado
            if (!info.points) return { fill: '#3f3f46', opacity: 0.35 };
            // La opacidad crece con el progreso dentro del rango, para que se
            // note el avance aunque no hayas cambiado de nivel todavía
            return { fill: info.rankColor || accent, opacity: 0.45 + (info.progress / 100) * 0.5 };
        }

        return { fill: '#3f3f46', opacity: 0.3 };
    };

    // --- MODO DOBLE: frente y espalda juntos, sin tener que girar nada ---
    if (dual) {
        return (
            <div className={`w-full flex items-stretch justify-center gap-2 ${className}`}>
                {['front', 'back'].map(v => (
                    <div key={v} className="flex-1 min-w-0 flex flex-col items-center">
                        <Figura view={v} getFill={getFill} onSelectMuscle={onSelectMuscle} />
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mt-0.5">
                            {v === 'front' ? 'Frente' : 'Espalda'}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    // ¿Hay algo destacado en la cara que NO se está viendo?
    const otherView = view === 'front' ? 'back' : 'front';
    const hayEnLaOtraCara = [...highlightSet].some(g => GROUPS_BY_VIEW[otherView].includes(g) && !GROUPS_BY_VIEW[view].includes(g));

    return (
        <div className={`relative w-full flex flex-col items-center ${className}`}>
            <div className="w-full max-h-[420px] flex justify-center">
                <Figura view={view} getFill={getFill} onSelectMuscle={onSelectMuscle} />
            </div>

            {/* Girar el cuerpo */}
            {showToggle && (
                <div className="flex items-center gap-2 mt-1">
                    <button
                        onClick={() => setView(v => (v === 'front' ? 'back' : 'front'))}
                        className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white active:scale-95 transition-all"
                    >
                        <RotateCcw size={12} />
                        {view === 'front' ? 'Ver espalda' : 'Ver frente'}
                    </button>
                    {hayEnLaOtraCara && (
                        <span className="text-[9px] font-bold text-yellow-500 animate-pulse">
                            ¡Hay músculos detrás!
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
