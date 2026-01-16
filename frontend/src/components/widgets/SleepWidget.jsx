import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function SleepWidget({ hours = 0, onUpdate }) {
    const [isOpen, setIsOpen] = useState(false);
    const [tempHours, setTempHours] = useState(hours);

    useEffect(() => { setTempHours(hours); }, [hours]);

    const handleSave = () => {
        if (onUpdate) onUpdate(tempHours);
        setIsOpen(false);
    };

    // --- COLORES FLOW "SHINY ETERNAL" ---
    const gradientClasses = "from-slate-300 via-[#537895] to-[#09203F]";
    const shadowColor = "rgba(83, 120, 149, 0.8)";

    const progress = Math.min((tempHours / 8) * 100, 100);

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
                    shadow-[0_0_30px_${shadowColor}]
                `}
            >
                {/* CONTENEDOR INTERNO */}
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col justify-between relative overflow-hidden z-10">

                    {/* CABECERA (CORREGIDO CORTE DE LETRA 'O' y 'Ñ') */}
                    <div className="px-5 pt-5 flex justify-start z-10 shrink-0">
                        {/* Añadido 'pr-2' (padding-right) para dar espacio a la itálica */}
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-md pr-2">
                            SUEÑO
                        </h2>
                    </div>

                    {/* CONTENIDO CENTRAL: NÚMERO + H (RECTO Y CENTRADO) */}
                    <div className="flex-1 flex items-center justify-center z-10 -mt-1">
                        <div className="flex items-baseline gap-1 animate-in zoom-in duration-300">
                            {/* NÚMERO GIGANTE */}
                            <span className={`text-7xl font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125 drop-shadow-[0_0_12px_rgba(83,120,149,0.5)] not-italic`}>
                                {Math.round(tempHours)}
                            </span>
                            {/* UNIDAD H EN BLANCO */}
                            <span className="text-3xl font-black text-white italic uppercase tracking-tighter opacity-90 not-italic">
                                H
                            </span>
                        </div>
                    </div>

                    {/* ESPACIADOR INFERIOR (Para equilibrar el diseño) */}
                    <div className="h-8 w-full shrink-0"></div>

                    {/* BARRA INFERIOR FIJA */}
                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div
                            className={`h-full w-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_25px_${shadowColor}]`}
                        ></div>
                    </div>

                    {/* Luz Ambiental */}
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${gradientClasses} opacity-30`}></div>
                </div>
            </div>

            {/* 2. MODAL DE SELECCIÓN */}
            {isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={handleSave}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

                    <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden" onClick={(e) => e.stopPropagation()}>

                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
                        <div className={`absolute -top-20 -left-20 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-br ${gradientClasses} opacity-20`}></div>

                        <div className="flex justify-between items-center relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                                REGISTRAR <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125 pb-2 pr-2`}>SUEÑO</span>
                            </h2>
                            <button onClick={handleSave} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-8 py-4 relative z-10">
                            <div className="flex justify-center items-baseline gap-2">
                                <span className={`text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} tracking-tighter filter brightness-125 drop-shadow-[0_0_15px_rgba(83,120,149,0.5)] not-italic`}>
                                    {tempHours}
                                </span>
                                <span className="text-2xl font-black text-zinc-500 uppercase not-italic">H</span>
                            </div>

                            <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-white/5 relative">
                                <div
                                    className={`h-full absolute top-0 left-0 bg-gradient-to-r ${gradientClasses} transition-all duration-300`}
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className={`absolute right-0 top-0 h-full w-4 bg-gradient-to-r ${gradientClasses} blur-sm brightness-150`}></div>
                                </div>
                            </div>

                            <div className="relative pt-6">
                                <input
                                    type="range"
                                    min="0"
                                    max="12"
                                    step="0.5"
                                    value={tempHours}
                                    onChange={(e) => setTempHours(Number(e.target.value))}
                                    className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-[#537895]"
                                />
                                <div className="flex justify-between text-xs font-bold text-zinc-600 uppercase mt-3 px-1 not-italic">
                                    <span>0H</span>
                                    <span>4H</span>
                                    <span>8H</span>
                                    <span>12H</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}