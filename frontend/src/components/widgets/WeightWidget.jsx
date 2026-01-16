import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';

export default function WeightWidget({ initialWeight = 0, history = [], onUpdate }) {
    // --- LÓGICA INTERNA ---
    const [isOpen, setIsOpen] = useState(false);
    const [weight, setWeight] = useState(initialWeight);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        setWeight(initialWeight);
    }, [initialWeight]);

    const handleSave = () => {
        if (onUpdate && weight !== initialWeight) {
            onUpdate(parseFloat(weight));
        }
        setIsOpen(false);
        setHoveredIndex(null);
    };

    const handleClose = (e) => {
        e && e.stopPropagation();
        setIsOpen(false);
        setHoveredIndex(null);
    };

    // --- COLORES FLOW "EXOTIC" ---
    const gradientClasses = "from-[#FF61D2] to-[#FE9090]";
    const shadowColor = "rgba(255, 97, 210, 0.5)";
    const theme = { gradientStart: "#FF61D2", stroke: "#FF61D2" };

    // Preparación de datos (Gráfica)
    let chartData = history.length > 0
        ? history.map(h => ({ value: parseFloat(h.weight || h), label: h.date || '' }))
        : [{ value: parseFloat(weight) || 0, label: 'Hoy' }];

    const hasMultiplePoints = chartData.length > 1;
    const values = chartData.map(d => d.value);
    const paddingY = values.length === 1 ? 1 : 2;
    const maxVal = Math.max(...values) + paddingY;
    const minVal = Math.min(...values) - paddingY;
    const svgViewW = 1200;
    const svgViewH = 300;

    const points = chartData.map((d, i) => {
        const x = hasMultiplePoints ? (i / (chartData.length - 1)) * svgViewW : svgViewW / 2;
        const range = maxVal - minVal || 1;
        const y = svgViewH - ((d.value - minVal) / range) * svgViewH;
        return { x, y, value: d.value, label: d.label };
    });

    const pathData = points.map(p => `${p.x},${p.y}`).join(" ");

    return (
        <div ref={containerRef} className="h-full w-full relative z-0">

            {/* 1. WIDGET PEQUEÑO (PREVIEW) */}
            <div
                onClick={() => setIsOpen(true)}
                className={`
                    h-full w-full relative rounded-[32px] overflow-hidden
                    group cursor-pointer active:scale-[0.98] transition-all duration-200
                    p-[2px] 
                    bg-gradient-to-br ${gradientClasses}
                    shadow-[0_0_25px_${shadowColor}]
                    ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                `}
            >
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col justify-between relative overflow-hidden z-10">

                    {/* CABECERA */}
                    <div className="px-5 pt-5 flex justify-start z-10">
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-md pr-2">
                            PESO CORPORAL
                        </h2>
                    </div>

                    {/* CONTENIDO CENTRAL */}
                    <div className="flex-1 flex flex-col items-center justify-center z-10 pb-4">
                        <div className="flex items-baseline gap-1 animate-in zoom-in duration-300">
                            {/* Número Principal */}
                            <span className={`text-6xl font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} drop-shadow-md filter brightness-110 not-italic`}>
                                {weight}
                            </span>
                            {/* KG */}
                            <span className="text-2xl font-black uppercase text-white drop-shadow-sm not-italic tracking-tighter">
                                KG
                            </span>
                        </div>
                    </div>

                    {/* BARRA INFERIOR */}
                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div
                            className={`h-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_15px_${shadowColor}] transition-all duration-500 ease-out`}
                            style={{ width: '100%' }}
                        ></div>
                    </div>

                    {/* Luz Ambiental */}
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${gradientClasses} opacity-25`}></div>
                </div>
            </div>

            {/* 2. MODAL DESPLEGABLE */}
            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={handleClose}
                >
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true"></div>

                    <div
                        className="bg-[#09090b] border border-white/10 w-[95%] max-w-4xl rounded-[40px] p-6 shadow-2xl relative flex flex-col gap-5 animate-in zoom-in-95 duration-200 overflow-hidden z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decoración Fondo */}
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
                        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none bg-gradient-to-bl ${gradientClasses} opacity-10`}></div>

                        {/* HEADER MODAL */}
                        <div className="flex justify-between items-center shrink-0 relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase flex items-center gap-3 tracking-tighter not-italic">
                                CONTROL <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125`}>PESO</span>
                            </h2>
                            <button onClick={handleClose} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* CONTENEDOR GRÁFICA */}
                        <div
                            className="bg-zinc-900/30 rounded-[32px] p-6 border border-white/5 relative h-56 w-full flex items-center justify-center group/chart shrink-0 select-none overflow-hidden"
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            {/* Fondo gradiente sutil dentro de la gráfica */}
                            <div className={`absolute inset-0 bg-gradient-to-b ${gradientClasses} opacity-5`}></div>

                            <svg className="absolute inset-0 w-full h-full overflow-visible drop-shadow-xl z-0" preserveAspectRatio="none" viewBox={`0 0 ${svgViewW} ${svgViewH}`}>
                                <defs>
                                    <linearGradient id="gradientExoticSolid" x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="0%" stopColor={theme.gradientStart} stopOpacity="0.5" />
                                        <stop offset="100%" stopColor={theme.gradientStart} stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {hasMultiplePoints && (
                                    <>
                                        <path d={`M${points[0].x},${svgViewH} ${pathData} ${points[points.length - 1].x},${svgViewH}`} fill="url(#gradientExoticSolid)" />
                                        <polyline fill="none" stroke={theme.stroke} strokeWidth="4" points={pathData} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                                    </>
                                )}
                            </svg>

                            {/* Puntos interactivos */}
                            <div className="absolute inset-6 z-10">
                                {points.map((point, i) => {
                                    const xPercent = (point.x / svgViewW) * 100;
                                    const yPercent = (point.y / svgViewH) * 100;
                                    const isHovered = hoveredIndex === i;
                                    const isSinglePoint = !hasMultiplePoints;
                                    return (
                                        <React.Fragment key={i}>
                                            <div
                                                className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                                                style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                                                onMouseEnter={() => setHoveredIndex(i)}
                                                onTouchStart={() => setHoveredIndex(i)}
                                            ></div>

                                            <div
                                                className={`
                                                    absolute rounded-full bg-[#FF61D2] border-2 border-white shadow-md transition-all duration-200 pointer-events-none z-10
                                                    ${isHovered || isSinglePoint ? 'scale-125 ring-2 ring-[#FF61D2]/30' : ''} 
                                                    ${isSinglePoint ? 'w-4 h-4 -translate-x-2 -translate-y-2' : (isHovered ? 'w-4 h-4 -translate-x-2 -translate-y-2' : 'w-2.5 h-2.5 -translate-x-1.5 -translate-y-1.5')}
                                                `}
                                                style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                                            >
                                            </div>

                                            {(isHovered || isSinglePoint) && (
                                                <div
                                                    className={`absolute bg-[#FF61D2] text-white font-black px-3 py-1.5 rounded-lg shadow-xl pointer-events-none transition-all duration-300 -translate-x-1/2 -translate-y-full border border-white/10 z-30 ${isHovered ? 'scale-100 opacity-100' : (isSinglePoint ? 'scale-100 opacity-100' : 'scale-90 opacity-0')}`}
                                                    style={{ left: `${xPercent}%`, top: `${yPercent}%`, marginTop: '-20px' }}
                                                >
                                                    <span className="text-sm font-black not-italic">{point.value} KG</span>
                                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-[#FF61D2]"></div>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>

                        {/* CONTROLES INFERIORES */}
                        <div className="flex flex-col md:flex-row gap-4 items-end mt-auto relative z-10">
                            <div className="flex-1 w-full flex flex-col gap-2">
                                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest pl-2">
                                    MODIFICAR PESO
                                </label>
                                <div className="relative group">
                                    {/* 🔥 CAJA DE INPUT MÁS PEQUEÑA (py-3) Y NÚMERO MÁS GRANDE */}
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        className="w-full bg-black border-4 border-zinc-800 focus:border-[#FF61D2] rounded-2xl py-3 pl-6 pr-20 text-5xl font-black text-white outline-none transition-all duration-300 text-center shadow-inner not-italic"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 font-black text-2xl pointer-events-none not-italic">KG</span>
                                </div>
                            </div>

                            <button
                                onClick={handleSave}
                                className={`
                                    w-full md:w-auto px-8 py-3.5 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] 
                                    bg-gradient-to-r ${gradientClasses} text-white hover:brightness-110 flex items-center justify-center gap-2 h-auto shrink-0
                                `}
                            >
                                <Save size={20} /> GUARDAR
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}