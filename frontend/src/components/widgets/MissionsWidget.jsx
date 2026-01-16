import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Target, X, CheckCircle, Star, Coins, Gamepad2, HeartCrack } from 'lucide-react';

export default function MissionsWidget({
    completed = 0,
    total = 0,
    completedMissions = []
}) {
    const [isOpen, setIsOpen] = useState(false);

    // --- LÓGICA ---
    const safeCompleted = Math.max(0, completed);
    const safeTotal = Math.max(0, total);

    // Cálculo de la barra
    const calcTotal = safeTotal === 0 ? 1 : safeTotal;
    const percentageWidth = Math.min((safeCompleted / calcTotal) * 100, 100);

    // --- COLORES FLOW "DARK CHERRY" (INVERTIDO: NEGRO -> ROJO) ---
    const gradientClasses = "from-[#100C08] to-[#95122C]";
    const shadowColor = "rgba(149, 18, 44, 0.6)";

    return (
        <>
            {/* 1. WIDGET PEQUEÑO (Tarjeta Home) */}
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
                {/* 2. CONTENEDOR INTERNO (Fondo Negro Puro) */}
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col justify-between relative overflow-hidden z-10">

                    {/* --- CABECERA --- */}
                    <div className="px-5 pt-5 flex justify-start z-10 shrink-0">
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-md pb-2 pr-2">
                            MISIONES
                        </h2>
                    </div>

                    {/* --- CONTENIDO CENTRAL: BARRA --- */}
                    <div className="flex-1 flex flex-col justify-center px-5 z-10 pt-1">

                        {/* ENVOLTORIO DEL BORDE */}
                        <div className={`
                            w-full rounded-full 
                            p-[2px] 
                            bg-gradient-to-r ${gradientClasses} 
                            shadow-[0_0_15px_${shadowColor}]
                        `}>
                            {/* RIEL INTERNO */}
                            <div className="w-full h-8 bg-black/90 rounded-full overflow-hidden relative">
                                {/* RELLENO LÍQUIDO */}
                                <div
                                    className={`h-full absolute top-0 left-0 bg-gradient-to-r ${gradientClasses} transition-all duration-1000 ease-out`}
                                    style={{ width: `${percentageWidth}%` }}
                                >
                                    {/* Reflejo metálico superior */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-40"></div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* --- INFO INFERIOR (CONTADOR RECTO) --- */}
                    <div className="px-6 pb-8 z-10 flex justify-end items-end w-full">
                        <div className="flex items-baseline gap-0">
                            {/* NÚMERO COMPLETADO (Gradiente Invertido) */}
                            <span className={`text-5xl font-black uppercase tracking-tight leading-none drop-shadow-xl text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-150 pr-2 pb-1 not-italic`}>
                                {safeCompleted}
                            </span>

                            {/* TOTAL (Blanco, Recto) */}
                            <span className="text-2xl font-black text-white uppercase tracking-tight leading-none opacity-90 not-italic">
                                / {safeTotal}
                            </span>
                        </div>
                    </div>

                    {/* --- BARRA INFERIOR FIJA --- */}
                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div
                            className={`h-full w-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_20px_${shadowColor}]`}
                        ></div>
                    </div>

                    {/* Luz ambiental Roja */}
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${gradientClasses} opacity-40`}></div>
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

                        {/* Header Modal (SIN EMOJI, SIN CURSIVAS) */}
                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 pr-2">
                                HISTORIAL <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-150`}>MISIONES</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* LISTA DE MISIONES */}
                        <div className="flex flex-col gap-3 relative z-10 overflow-y-auto custom-scrollbar pr-1 flex-1">
                            {completedMissions.length > 0 ? (
                                completedMissions.map((m, idx) => (
                                    <div key={idx} className={`p-4 rounded-2xl border flex flex-col gap-2 relative overflow-hidden group transition-colors ${m.failed ? 'bg-red-950/20 border-red-900/30' : 'bg-black border-zinc-800'}`}>

                                        {/* TÍTULO Y ESTADO */}
                                        <div className="flex justify-between items-start relative z-10">
                                            <span className={`text-sm font-bold block line-clamp-2 ${m.failed ? 'text-red-400 line-through' : 'text-white'}`}>
                                                {m.title}
                                            </span>
                                            {m.failed ? (
                                                <span className="text-[9px] font-black bg-red-900/30 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 uppercase">FAIL</span>
                                            ) : (
                                                <CheckCircle size={16} className="text-green-500" />
                                            )}
                                        </div>

                                        {/* RECOMPENSAS / CASTIGO */}
                                        <div className={`flex gap-3 mt-1 pt-3 border-t relative z-10 ${m.failed ? 'border-red-900/20' : 'border-zinc-900'}`}>
                                            {m.failed ? (
                                                <div className="flex items-center gap-2 w-full justify-center text-red-500 bg-red-950/20 py-1 rounded">
                                                    <HeartCrack size={12} /> <span className="text-xs font-black">-{m.hpLoss} HP</span>
                                                </div>
                                            ) : (
                                                <div className="flex w-full gap-2">
                                                    {/* XP */}
                                                    {m.xpReward > 0 && (
                                                        <span className="flex-1 text-center bg-zinc-900/50 border border-white/5 rounded py-1 text-[10px] font-bold text-zinc-300 flex items-center justify-center gap-1">
                                                            <Star size={10} className="text-blue-400" /> +{m.xpReward} XP
                                                        </span>
                                                    )}
                                                    {/* MONEDAS */}
                                                    {m.coinReward > 0 && (
                                                        <span className="flex-1 text-center bg-gold-900/10 border border-gold-500/20 rounded py-1 text-[10px] font-bold text-gold-400 flex items-center justify-center gap-1">
                                                            <Coins size={10} /> +{m.coinReward}
                                                        </span>
                                                    )}
                                                    {/* FICHAS */}
                                                    {m.gameCoinReward > 0 && (
                                                        <span className="flex-1 text-center bg-purple-900/10 border border-purple-500/20 rounded py-1 text-[10px] font-bold text-purple-400 flex items-center justify-center gap-1">
                                                            <Gamepad2 size={10} /> +{m.gameCoinReward}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-center relative z-10 flex-1">
                                    <Target size={48} className="text-zinc-800 mb-4" />
                                    <p className="text-zinc-600 text-sm font-bold uppercase">Sin historial hoy.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}