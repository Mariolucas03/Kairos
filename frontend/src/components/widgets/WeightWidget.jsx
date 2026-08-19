import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';
import WidgetCard, { WidgetStat, WIDGET_ACCENTS } from '../common/WidgetCard';

export default function WeightWidget({ initialWeight = 0, history = [], onUpdate }) {
    // Igual que en sueño y pasos: el peso llega como null mientras no lo apuntes
    const pesoSeguro = Number(initialWeight) || 0;
    const [isOpen, setIsOpen] = useState(false);
    const [weight, setWeight] = useState(pesoSeguro);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const containerRef = useRef(null);
    const accent = WIDGET_ACCENTS.weight;

    useEffect(() => { setWeight(pesoSeguro); }, [pesoSeguro]);

    const handleSave = () => {
        if (onUpdate && weight !== initialWeight) onUpdate(parseFloat(weight));
        setIsOpen(false);
        setHoveredIndex(null);
    };

    const handleClose = (e) => {
        e && e.stopPropagation();
        setIsOpen(false);
        setHoveredIndex(null);
    };

    // Tendencia: diferencia con el registro más antiguo disponible
    let trend = null;
    if (history.length > 1) {
        const first = parseFloat(history[0].weight ?? history[0]);
        const diff = parseFloat(weight) - first;
        if (!Number.isNaN(diff)) trend = diff;
    }

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

    const pathData = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <div ref={containerRef} className="h-full w-full relative z-0">

            <WidgetCard
                accent={accent}
                onClick={() => setIsOpen(true)}
                className={`h-full flex flex-col justify-between ${isOpen ? 'opacity-0 pointer-events-none' : ''}`}
                label="PESO"
            >
                <div className="relative z-10 mt-auto pt-3">
                    <WidgetStat value={weight} unit="KG" accent={accent} />
                    <div className="mt-2.5 text-[9px] font-black uppercase tracking-[0.08em] not-italic"
                        style={{ color: trend === null ? '#71717a' : trend < 0 ? '#4ade80' : trend > 0 ? '#f87171' : '#a1a1aa' }}>
                        {trend === null
                            ? 'SIN HISTÓRICO'
                            : `${trend > 0 ? '+' : ''}${trend.toFixed(1)} DESDE EL INICIO`}
                    </div>
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }} className="fixed left-0 right-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200" onClick={handleClose}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />

                    <div
                        className="bg-[#09090b] border border-white/10 w-[95%] max-w-4xl rounded-[40px] p-6 shadow-2xl relative flex flex-col gap-5 animate-in zoom-in-95 duration-200 overflow-hidden z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center shrink-0 relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase flex items-center gap-3 tracking-tighter not-italic">
                                CONTROL <span style={{ color: accent }}>PESO</span>
                            </h2>
                            <button onClick={handleClose} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div
                            className="bg-zinc-900/30 rounded-[32px] p-6 border border-white/5 relative h-56 w-full flex items-center justify-center shrink-0 select-none overflow-hidden"
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <svg className="absolute inset-0 w-full h-full overflow-visible z-0" preserveAspectRatio="none" viewBox={`0 0 ${svgViewW} ${svgViewH}`}>
                                <defs>
                                    <linearGradient id="gradientWeightArea" x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
                                        <stop offset="100%" stopColor={accent} stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {hasMultiplePoints && (
                                    <>
                                        <path d={`M${points[0].x},${svgViewH} ${pathData} ${points[points.length - 1].x},${svgViewH}`} fill="url(#gradientWeightArea)" />
                                        <polyline fill="none" stroke={accent} strokeWidth="4" points={pathData} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                                    </>
                                )}
                            </svg>

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
                                            />
                                            <div
                                                className={`absolute rounded-full border-2 border-white shadow-md transition-all duration-200 pointer-events-none z-10 ${
                                                    isHovered || isSinglePoint ? 'w-4 h-4 -translate-x-2 -translate-y-2 scale-125' : 'w-2.5 h-2.5 -translate-x-1.5 -translate-y-1.5'
                                                }`}
                                                style={{ left: `${xPercent}%`, top: `${yPercent}%`, background: accent }}
                                            />
                                            {(isHovered || isSinglePoint) && (
                                                <div
                                                    className="absolute text-white font-black px-3 py-1.5 rounded-lg shadow-xl pointer-events-none -translate-x-1/2 -translate-y-full border border-white/10 z-30"
                                                    style={{ left: `${xPercent}%`, top: `${yPercent}%`, marginTop: '-20px', background: accent }}
                                                >
                                                    <span className="text-sm font-black not-italic">{point.value} KG</span>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-end mt-auto relative z-10">
                            <div className="flex-1 w-full flex flex-col gap-2">
                                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest pl-2">MODIFICAR PESO</label>
                                <div className="relative">
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
                                className="w-full md:w-auto px-8 py-3.5 rounded-2xl font-black text-lg uppercase tracking-widest text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 shrink-0"
                                style={{ background: accent }}
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
