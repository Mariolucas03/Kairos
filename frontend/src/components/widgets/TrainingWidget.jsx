import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, Clock, Flame, Dumbbell } from 'lucide-react';
import WidgetCard, { WIDGET_ACCENTS } from '../common/WidgetCard';

/**
 * RUTINA GYM + VOLUMEN SEMANAL fusionados.
 *  - Tocar la tarjeta abre el detalle del entreno de hoy (igual que antes).
 *  - El bloque de volumen (derecha) es solo informativo: el histórico completo
 *    vive ahora en Gym > Cuerpo, así que aquí no abre nada.
 */
export default function TrainingWidget({ workouts = [], weeklyVolume = 0, weeklyPercentage = 0 }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const accent = WIDGET_ACCENTS.training;

    const hasWorkout = workouts && workouts.length > 0;
    const selectedRoutine = hasWorkout ? workouts[activeTabIndex] : null;
    const cardRoutine = hasWorkout ? workouts[0] : null;

    const cardName = cardRoutine?.name || 'SIN REGISTRAR';

    const modalName = selectedRoutine?.name || '';
    const modalDuration = selectedRoutine ? Math.floor(selectedRoutine.duration / 60) : 0;
    const modalKcal = selectedRoutine?.caloriesBurned || 0;

    const totalVolume = selectedRoutine?.exercises?.reduce((acc, ex) => {
        return acc + ex.sets.reduce((setAcc, s) => setAcc + (s.weight * s.reps), 0);
    }, 0) || 0;

    useEffect(() => {
        if (workouts.length > 0) setActiveTabIndex(0);
    }, [workouts, isOpen]);

    const f = (n) => Number(n || 0).toLocaleString('es-ES');
    const pctColor = weeklyPercentage > 0 ? '#4ade80' : weeklyPercentage < 0 ? '#f87171' : '#a1a1aa';

    return (
        <>
            <WidgetCard accent={accent} padding="p-[18px]" className="h-full">
                <div className="relative z-10 flex items-center gap-4">

                    <div
                        onClick={() => setIsOpen(true)}
                        className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 cursor-pointer"
                        style={{ background: 'rgba(234,179,8,0.12)', color: accent }}
                    >
                        <Dumbbell size={22} />
                    </div>

                    <div onClick={() => setIsOpen(true)} className="flex-1 min-w-0 cursor-pointer">
                        <span className="block text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] leading-none not-italic">
                            RUTINA DE HOY
                        </span>
                        <div className="mt-2 text-xl font-black text-white uppercase tracking-[-0.035em] leading-none truncate not-italic">
                            {cardName}
                        </div>
                        {workouts.length > 1 && (
                            <span className="mt-2 block text-[9px] font-black text-zinc-500 uppercase tracking-[0.1em] not-italic">
                                +{workouts.length - 1} SESIÓN EXTRA
                            </span>
                        )}
                    </div>

                    {/* VOLUMEN SEMANAL (solo lectura: el histórico vive en Gym > Cuerpo) */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="text-right shrink-0"
                    >
                        <div className="text-lg font-black text-white tracking-[-0.03em] leading-none not-italic">
                            {f(weeklyVolume)}<span className="text-[11px] not-italic" style={{ color: accent }}> KG</span>
                        </div>
                        <div className="mt-[7px] text-[9px] font-black uppercase tracking-[0.08em] leading-none not-italic" style={{ color: pctColor }}>
                            {weeklyPercentage > 0 ? '+' : ''}{weeklyPercentage}% SEMANAL
                        </div>
                    </div>
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />

                    <div
                        className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 overflow-hidden max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 not-italic">
                                DETALLE <span style={{ color: accent }}>GYM</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {workouts.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10 shrink-0 z-10 no-scrollbar">
                                {workouts.map((w, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveTabIndex(idx)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border uppercase ${
                                            activeTabIndex === idx
                                                ? 'text-black border-transparent'
                                                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white hover:bg-zinc-800'
                                        }`}
                                        style={activeTabIndex === idx ? { background: accent } : undefined}
                                    >
                                        {w.name || w.routineName || `RUTINA ${idx + 1}`}
                                    </button>
                                ))}
                            </div>
                        )}

                        {hasWorkout ? (
                            <div className="flex flex-col gap-4 relative z-10 overflow-y-auto custom-scrollbar pr-1 flex-1">
                                <div className="bg-zinc-900/50 p-6 rounded-[24px] border border-white/5 text-center relative overflow-hidden shrink-0">
                                    <h3 className="text-2xl font-black text-white uppercase leading-none mb-1 not-italic">{modalName}</h3>

                                    <div className="flex justify-center gap-2 mt-4">
                                        <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5 flex flex-col min-w-[70px]">
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1"><Clock size={10} /> Tiempo</span>
                                            <span className="text-lg font-black text-white">{modalDuration}m</span>
                                        </div>
                                        <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5 flex flex-col min-w-[70px]">
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1"><Flame size={10} /> Kcal</span>
                                            <span className="text-lg font-black" style={{ color: accent }}>{modalKcal}</span>
                                        </div>
                                        <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5 flex flex-col min-w-[70px]">
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1"><Activity size={10} /> Vol.</span>
                                            <span className="text-lg font-black text-white">{f(totalVolume)}KG</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 pb-4">
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase ml-2 tracking-widest">Ejercicios realizados</h4>
                                    {selectedRoutine.exercises.map((ex, idx) => (
                                        <div key={idx} className="bg-black p-4 rounded-2xl border border-zinc-800 flex justify-between items-center">
                                            <div className="max-w-[40%]">
                                                <p className="text-sm font-bold text-white uppercase truncate">{ex.name}</p>
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase">{ex.sets.length} Series</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                {ex.sets.map((s, sIdx) => (
                                                    <div key={sIdx} className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                                        <span className="text-sm font-mono text-zinc-300">
                                                            <span className="font-black" style={{ color: accent }}>{s.weight}KG</span> x {s.reps}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center relative z-10 flex-1">
                                <Activity size={48} className="text-zinc-700 mb-4" />
                                <p className="text-zinc-500 text-sm font-bold uppercase">No has entrenado hoy.</p>
                                <p className="text-zinc-600 text-xs mt-1">¡Ve al gimnasio y registra tu sesión!</p>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
