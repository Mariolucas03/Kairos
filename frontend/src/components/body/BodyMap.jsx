import { useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { BODY_IMAGE, BODY_IMAGE_SIZE, VIEW_BOX, MUSCLE_SHAPES, GROUPS_BY_VIEW, GROUP_OF_MUSCLE, MUSCLES_OF_GROUP } from './bodyPaths';

/**
 * Expande una lista que puede venir con grupos grandes ('Pierna') o con
 * músculos concretos ('Isquiotibiales') a la lista de zonas que hay que pintar.
 * Así el mapa entiende los dos idiomas: los entrenos que ya están guardados
 * hablan de grupos, y los que vengan con detalle encenderán solo su músculo.
 */
const expandirZonas = (lista = []) => {
    const zonas = new Set();
    for (const nombre of lista) {
        if (!nombre) continue;
        if (GROUP_OF_MUSCLE[nombre]) { zonas.add(nombre); continue; }   // ya es un músculo del mapa
        (MUSCLES_OF_GROUP[nombre] || []).forEach(m => zonas.add(m));     // es un grupo: se encienden todos
    }
    return zonas;
};

/**
 * Igual para los niveles: si sólo hay dato del grupo, cada músculo suyo hereda
 * ese nivel; si hay dato del músculo concreto, ese manda.
 */
const expandirNiveles = (levels) => {
    if (!levels) return null;
    const salida = {};
    for (const [nombre, info] of Object.entries(levels)) {
        if (GROUP_OF_MUSCLE[nombre]) { salida[nombre] = info; continue; }
        (MUSCLES_OF_GROUP[nombre] || []).forEach(m => { if (!salida[m]) salida[m] = info; });
    }
    return salida;
};

/**
 * MAPA DEL CUERPO
 *
 * Se usa en cuatro sitios, siempre el mismo componente:
 *  1. Pestaña "Cuerpo" del perfil  → color según el RANGO de cada músculo
 *  2. Post del entreno en el feed   → resalta los músculos TRABAJADOS
 *  3. Resumen al terminar el entreno
 *  4. Widget del mapa muscular en el perfil
 *
 * @param {Object}  levels     { Pecho: { rankColor, rankLabel, progress } , ... }
 * @param {Array}   highlight  grupos a resaltar (modo "músculos trabajados")
 * @param {Array}   secondary  grupos implicados de forma secundaria
 * @param {string}  accent     color de resaltado
 * @param {boolean} dual       pinta frente y espalda a la vez, sin botón de girar
 */

// Una figura: la lámina recortada + las zonas de color encima
function Figura({ view, getFill, onSelectMuscle }) {
    const shapes = MUSCLE_SHAPES[view] || {};
    const idBase = useId();
    const recorte = `recorte-${view}-${idBase}`;
    const [vx, vy, vw, vh] = VIEW_BOX[view].split(' ').map(Number);

    return (
        <svg viewBox={VIEW_BOX[view]} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            {/* ⚠️ Un SVG NO recorta por el viewBox: si el hueco es más ancho que
                el recorte (pasa siempre, porque la figura es muy alargada), en
                los laterales se sigue dibujando lo que hay fuera. Por eso asomaba
                la mano de la otra figura. Con este recorte explícito, fuera del
                viewBox no se pinta nada. */}
            <defs>
                <clipPath id={recorte}>
                    <rect x={vx} y={vy} width={vw} height={vh} />
                </clipPath>
            </defs>

            <g clipPath={`url(#${recorte})`}>
                {/* La lámina completa; el viewBox enseña solo esta cara.
                    El contraste aplasta a negro el gris del fondo del dibujo,
                    que si no recortaba cada figura en un rectángulo más claro
                    que la pantalla. */}
                <image
                    href={BODY_IMAGE}
                    x="0"
                    y="0"
                    width={BODY_IMAGE_SIZE.width}
                    height={BODY_IMAGE_SIZE.height}
                    preserveAspectRatio="none"
                    style={{ filter: 'contrast(1.7)' }}
                />

                {/* Zonas musculares. Con mezcla "screen" el relleno tiñe el interior
                    oscuro del músculo pero deja intactas las líneas blancas del dibujo. */}
                <g style={{ mixBlendMode: 'screen' }}>
                    {Object.entries(shapes).map(([group, paths]) => {
                        const { fill, opacity } = getFill(group);
                        return (
                            <g
                                key={group}
                                onClick={() => onSelectMuscle?.(group)}
                                style={{ cursor: onSelectMuscle ? 'pointer' : 'default' }}
                                className="transition-opacity duration-500"
                            >
                                {paths.map((d, i) => (
                                    <path key={i} d={d} fill={fill} fillOpacity={opacity} />
                                ))}
                                <title>{group}</title>
                            </g>
                        );
                    })}
                </g>
            </g>
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
    labels = true,
    onSelectMuscle = null,
    className = ''
}) {
    const [view, setView] = useState('front');

    // Grupos ('Pierna') y músculos concretos ('Gemelos') se entienden por igual
    const highlightSet = expandirZonas(highlight);
    const secondarySet = expandirZonas(secondary);
    const nivelesPorMusculo = expandirNiveles(levels);

    // Color y opacidad de cada zona según el modo en el que se use.
    // Sin nada que destacar el relleno es transparente, así se ve la lámina tal cual.
    const getFill = (group) => {
        if (highlightSet.size || secondarySet.size) {
            if (highlightSet.has(group)) return { fill: accent, opacity: 0.9 };
            if (secondarySet.has(group)) return { fill: accent, opacity: 0.35 };
            return { fill: '#000000', opacity: 0 };
        }

        if (nivelesPorMusculo && nivelesPorMusculo[group]) {
            const info = nivelesPorMusculo[group];
            if (!info.points) return { fill: '#000000', opacity: 0 };
            // La intensidad crece con el progreso dentro del rango, para que se
            // note el avance aunque no hayas cambiado de nivel todavía
            return { fill: info.rankColor || accent, opacity: 0.4 + (info.progress / 100) * 0.55 };
        }

        return { fill: '#000000', opacity: 0 };
    };

    // --- MODO DOBLE: frente y espalda juntos, sin tener que girar nada ---
    if (dual) {
        return (
            <div className={`w-full flex items-stretch justify-center gap-1 ${className}`}>
                {['front', 'back'].map(v => (
                    <div key={v} className="flex-1 min-w-0 flex flex-col items-center">
                        <Figura view={v} getFill={getFill} onSelectMuscle={onSelectMuscle} />
                        {/* En miniatura (la rejilla del perfil) las etiquetas solo estorban */}
                        {labels && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mt-0.5">
                                {v === 'front' ? 'Frente' : 'Espalda'}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    // ¿Hay algo destacado en la cara que NO se está viendo?
    const otherView = view === 'front' ? 'back' : 'front';
    // ¿Hay algún músculo destacado que solo se vea por la otra cara?
    const zonasDeLaVista = (v) => Object.keys(MUSCLE_SHAPES[v] || {});
    const hayEnLaOtraCara = [...highlightSet].some(m => zonasDeLaVista(otherView).includes(m) && !zonasDeLaVista(view).includes(m));

    return (
        <div className={`relative w-full flex flex-col items-center ${className}`}>
            <div className="w-full flex-1 min-h-0 flex justify-center">
                <Figura view={view} getFill={getFill} onSelectMuscle={onSelectMuscle} />
            </div>

            {/* Girar el cuerpo */}
            {showToggle && (
                <div className="flex items-center gap-2 mt-1 shrink-0">
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
