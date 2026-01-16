import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Activity, Clock, Flame, Dumbbell } from 'lucide-react';

export default function TrainingWidget({ workouts = [] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    // --- LÓGICA ---
    const hasWorkout = workouts && workouts.length > 0;

    // Rutina seleccionada para el MODAL
    const selectedRoutine = hasWorkout ? workouts[activeTabIndex] : null;

    // Rutina para la TARJETA
    const cardRoutine = hasWorkout ? workouts[0] : null;

    // Datos para la TARJETA
    const cardName = cardRoutine?.name || "";

    // Datos para el MODAL
    const modalName = selectedRoutine?.name || "";
    const modalDuration = selectedRoutine ? Math.floor(selectedRoutine.duration / 60) : 0;
    const modalKcal = selectedRoutine?.caloriesBurned || 0;

    // 🔥 CÁLCULO VOLUMEN TOTAL
    const totalVolume = selectedRoutine?.exercises?.reduce((acc, ex) => {
        return acc + ex.sets.reduce((setAcc, s) => setAcc + (s.weight * s.reps), 0);
    }, 0) || 0;

    useEffect(() => {
        if (workouts.length > 0) setActiveTabIndex(0);
    }, [workouts, isOpen]);

    // --- COLORES FLOW "ULTRA GOLD" ---
    const gradientClasses = "from-[#FDE68A] via-[#F59E0B] to-[#78350F]";
    const shadowColor = "rgba(251, 191, 36, 0.4)";

    return (
        <>
            {/* 1. WIDGET PEQUEÑO */}
            <div
                onClick={() => setIsOpen(true)}
                className={`
                    h-full w-full relative rounded-[32px] overflow-hidden
                    group cursor-pointer active:scale-[0.98] transition-all duration-200
                    p-[2px] 
                    bg-gradient-to-br ${gradientClasses}
                    shadow-[0_0_25px_${shadowColor}]
                `}
            >
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col relative overflow-hidden z-10">

                    {/* CABECERA */}
                    <div className="px-5 pt-5 flex justify-start z-10 shrink-0">
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-md pr-1">
                            RUTINA GYM
                        </h2>
                    </div>

                    {/* CONTENIDO CENTRAL */}
                    <div className="flex-1 px-4 flex flex-col items-center justify-center z-10 pb-4 text-center">
                        {hasWorkout ? (
                            <div className="w-full animate-in fade-in zoom-in duration-300">
                                <h3 className={`text-3xl md:text-4xl font-black uppercase tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-b ${gradientClasses} drop-shadow-lg filter brightness-125 break-words line-clamp-3 not-italic`}>
                                    {cardName}
                                </h3>
                                {workouts.length > 1 && (
                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-2 block">
                                        +{workouts.length - 1} SESIÓN EXTRA
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center leading-tight gap-0 animate-in fade-in duration-300">
                                <span className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} uppercase tracking-tighter drop-shadow-md not-italic`}>
                                    SIN REGISTRAR
                                </span>
                                <span className="text-4xl font-black text-white uppercase tracking-tighter not-italic">
                                    AÚN
                                </span>
                            </div>
                        )}
                    </div>

                    {/* BARRA INFERIOR */}
                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div className={`h-full w-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_20px_${shadowColor}]`}></div>
                    </div>

                    {/* Luz ambiental */}
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${gradientClasses} opacity-20`}></div>
                </div>
            </div>

            {/* 2. MODAL DESPLEGABLE */}
            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                >
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true"></div>

                    <div
                        className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 overflow-hidden max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decoración Fondo */}
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
                        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none bg-gradient-to-bl ${gradientClasses} opacity-10`}></div>

                        {/* Header Modal */}
                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                                DETALLE <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125`}>GYM</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* PESTAÑAS */}
                        {workouts.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10 shrink-0 z-10 no-scrollbar">
                                {workouts.map((w, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveTabIndex(idx)}
                                        className={`
                                            px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border uppercase
                                            ${activeTabIndex === idx
                                                ? 'bg-yellow-500 text-black border-yellow-400 shadow-lg shadow-yellow-500/20'
                                                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white hover:bg-zinc-800'
                                            }
                                        `}
                                    >
                                        {w.name || w.routineName || `RUTINA ${idx + 1}`}
                                    </button>
                                ))}
                            </div>
                        )}

                        {hasWorkout ? (
                            <div className="flex flex-col gap-4 relative z-10 overflow-y-auto custom-scrollbar pr-1 flex-1">

                                {/* Tarjeta Principal (Resumen) */}
                                <div className="bg-zinc-900/50 p-6 rounded-[24px] border border-yellow-500/20 text-center relative overflow-hidden shrink-0">
                                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientClasses} opacity-5`}></div>
                                    <h3 className="text-2xl font-black text-white uppercase leading-none mb-1">{modalName}</h3>

                                    <div className="flex justify-center gap-2 mt-4">
                                        {/* TIEMPO */}
                                        <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5 flex flex-col min-w-[70px]">
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1"><Clock size={10} /> Tiempo</span>
                                            <span className="text-lg font-black text-white">{modalDuration}m</span>
                                        </div>
                                        {/* KCAL */}
                                        <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5 flex flex-col min-w-[70px]">
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1"><Flame size={10} /> Kcal</span>
                                            <span className="text-lg font-black text-yellow-500">{modalKcal}</span>
                                        </div>
                                        {/* 🔥 VOLUMEN TOTAL (NUEVO) */}
                                        <div className="bg-black/40 px-3 py-2 rounded-xl border border-white/5 flex flex-col min-w-[70px]">
                                            <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center justify-center gap-1"><Activity size={10} /> Vol.</span>
                                            <span className="text-lg font-black text-white">{totalVolume.toLocaleString()}KG</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Lista Ejercicios */}
                                <div className="space-y-3 pb-4">
                                    <h4 className="text-xs font-bold text-zinc-500 uppercase ml-2 tracking-widest">Ejercicios Realizados</h4>
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
                                                            <span className="text-yellow-500 font-black">{s.weight}KG</span> x {s.reps}
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