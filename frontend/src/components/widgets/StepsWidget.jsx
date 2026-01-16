import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Footprints, X, Save } from 'lucide-react';

export default function StepsWidget({ steps = 0, goal = 10000, onUpdate }) {
    const [isOpen, setIsOpen] = useState(false);
    const [tempSteps, setTempSteps] = useState(steps);

    useEffect(() => { setTempSteps(steps); }, [steps]);

    const handleSave = () => {
        if (onUpdate) onUpdate(parseInt(tempSteps) || 0);
        setIsOpen(false);
    };

    const f = (n) => n.toLocaleString('es-ES');

    // 🔥 FIX TAMAÑO DINÁMICO (AJUSTADO)
    // Reducimos la fuente antes para que 10.000 quepa perfecto
    const getFontSize = (n) => {
        const str = n.toString();
        const len = str.length;

        if (len >= 6) return 'text-3xl'; // 100.000+ (Muy pequeño)
        if (len >= 5) return 'text-5xl'; // 10.000 - 99.999 (Mediano para que quepa)
        if (len >= 4) return 'text-6xl'; // 1.000 - 9.999
        return 'text-7xl';               // 0 - 999 (Gigante)
    };

    // --- COLORES "AGED BRONZE" ---
    const gradientClasses = "from-[#E3C598] via-[#8B5E34] to-[#3E2712]";
    const shadowColor = "rgba(139, 94, 52, 0.5)";

    return (
        <>
            {/* 1. WIDGET PEQUEÑO (Preview) */}
            <div
                onClick={() => setIsOpen(true)}
                className={`
                    h-full w-full relative rounded-[32px] overflow-hidden
                    group cursor-pointer active:scale-[0.98] transition-all duration-200
                    p-[2px] bg-gradient-to-br ${gradientClasses}
                    shadow-[0_0_25px_${shadowColor}]
                `}
            >
                {/* CONTENEDOR INTERNO */}
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col justify-between relative overflow-hidden z-10">

                    {/* CABECERA */}
                    <div className="px-5 pt-5 flex justify-between items-start z-10 shrink-0">
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-md pr-2">
                            PASOS
                        </h2>
                        <Footprints size={24} className={`text-transparent bg-clip-text bg-gradient-to-br ${gradientClasses} drop-shadow-sm filter brightness-125`} />
                    </div>

                    {/* NÚMERO CENTRAL */}
                    <div className="flex-1 flex items-center justify-center z-10 -mt-0 w-full px-1">
                        {/* 🔥 FIX CORTE Y ALINEACIÓN: 
                           - 'pr-3 pl-1': Añade espacio a la derecha para que el último número no se corte.
                           - 'leading-tight': Ajusta la altura de línea.
                           - 'pb-2': Espacio inferior para el degradado.
                        */}
                        <span className={`${getFontSize(tempSteps)} font-black tracking-tighter leading-tight text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} drop-shadow-md filter brightness-125 animate-in zoom-in duration-300 not-italic pb-2 pr-3 pl-1`}>
                            {f(tempSteps)}
                        </span>
                    </div>

                    {/* ESPACIADOR INFERIOR */}
                    <div className="h-10 w-full shrink-0"></div>

                    {/* BARRA INFERIOR FIJA */}
                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div className={`h-full w-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_15px_${shadowColor}]`}></div>
                    </div>

                    {/* Luz ambiental Bronce */}
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${gradientClasses} opacity-30`}></div>
                </div>
            </div>

            {/* 2. MODAL DE EDICIÓN */}
            {isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                    <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden">

                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
                        <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-br ${gradientClasses} opacity-20`}></div>

                        <div className="flex justify-between items-center relative z-10">
                            {/* TÍTULO SIN CURSIVA (italic removido) */}
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter not-italic">
                                REGISTRAR <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125 pb-2 pr-2`}>PASOS</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-6 py-2 relative z-10">

                            {/* Input Gigante */}
                            <div className="relative group">
                                <input
                                    type="number"
                                    value={tempSteps}
                                    onChange={(e) => setTempSteps(Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-full bg-black border-4 border-zinc-800 focus:border-[#8B5E34] rounded-3xl py-6 pl-8 pr-4 text-5xl font-black text-white outline-none transition-all duration-300 text-center shadow-inner not-italic"
                                />
                            </div>

                            {/* Barra de Progreso hacia la Meta */}
                            <div>
                                <div className="flex justify-between text-xs font-bold text-zinc-500 uppercase mb-2">
                                    <span>Progreso Diario</span>
                                    <span>Meta: {f(goal)}</span>
                                </div>
                                <div className="h-4 bg-zinc-900 rounded-full overflow-hidden border border-white/10">
                                    <div
                                        className={`h-full bg-gradient-to-r ${gradientClasses} transition-all duration-500 relative`}
                                        style={{ width: `${Math.min((tempSteps / goal) * 100, 100)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Botón Guardar */}
                            <button onClick={handleSave} className={`w-full py-4 rounded-2xl font-black text-xl uppercase tracking-widest shadow-lg transition-all active:scale-95 border-b-4 bg-gradient-to-r ${gradientClasses} text-white border-[#3E2712] hover:brightness-110 flex items-center justify-center gap-2`}>
                                <Save size={24} /> GUARDAR
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}