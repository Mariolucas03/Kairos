import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Frown, Meh, Smile, Laugh, X, HeartCrack } from 'lucide-react';

export default function MoodWidget({ mood = null, onUpdate }) {
    const [isOpen, setIsOpen] = useState(false);

    // --- CONFIGURACIÓN DE ESTADOS ---
    const MOODS = [
        { value: 1, label: 'TERRIBLE', icon: HeartCrack, color: 'text-red-500' },
        { value: 2, label: 'MAL', icon: Frown, color: 'text-orange-500' },
        { value: 3, label: 'NORMAL', icon: Meh, color: 'text-zinc-400' },
        { value: 4, label: 'BIEN', icon: Smile, color: 'text-blue-500' },
        { value: 5, label: 'INCREÍBLE', icon: Laugh, color: 'text-violet-400' },
    ];

    const currentMood = MOODS.find(m => m.value === mood);

    const handleSelect = (val) => {
        if (onUpdate) onUpdate(val);
        setIsOpen(false);
    };

    // --- COLORES FLOW "CACTUS DREAM" ---
    const gradientClasses = "from-[#C6EA8D] to-[#FE90AF]";
    const shadowColor = "rgba(254, 144, 175, 0.5)";

    return (
        <>
            {/* --- WIDGET PEQUEÑO --- */}
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
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col justify-between relative overflow-hidden z-10">

                    {/* CABECERA (CURSIVA) */}
                    <div className="px-5 pt-5 flex justify-start z-10 shrink-0">
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-md">
                            ESTADO DE ÁNIMO
                        </h2>
                    </div>

                    {/* CONTENIDO CENTRAL */}
                    <div className="flex-1 flex flex-col items-center justify-center z-10 pb-4">
                        {currentMood ? (
                            // --- ESTADO SELECCIONADO (SOLO ICONO) ---
                            <div className="flex flex-col items-center animate-in zoom-in duration-300">
                                {/* ICONO GRANDE CON COLOR Y BRILLO */}
                                <currentMood.icon
                                    size={60}
                                    strokeWidth={1.5}
                                    className={`${currentMood.color} drop-shadow-[0_0_20px_rgba(255,255,255,0.25)] filter`}
                                />
                            </div>
                        ) : (
                            // --- ESTADO VACÍO (TEXTO GRADIENTE) ---
                            <div className="flex flex-col items-center justify-center gap-0 opacity-80">
                                <span className={`text-3xl font-black uppercase tracking-tighter text-center leading-none text-transparent bg-clip-text bg-gradient-to-br ${gradientClasses} filter brightness-110 drop-shadow-sm`}>
                                    ¿CÓMO<br />ESTÁS?
                                </span>
                            </div>
                        )}
                    </div>

                    {/* BARRA INFERIOR */}
                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div
                            className={`h-full w-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_20px_${shadowColor}]`}
                        ></div>
                    </div>

                    {/* Luz Ambiental */}
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${gradientClasses} opacity-20`}></div>
                </div>
            </div>

            {/* --- MODAL DE SELECCIÓN --- */}
            {isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                    <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden">

                        {/* Decoración Fondo */}
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
                        <div className={`absolute -top-20 -left-20 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-br ${gradientClasses} opacity-20`}></div>

                        <div className="flex justify-between items-center relative z-10">
                            {/* TÍTULO MODAL LIMPIO */}
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter not-italic">
                                REGISTRAR <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125`}>ÁNIMO</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 relative z-10">
                            {MOODS.map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => handleSelect(m.value)}
                                    className={`
                                        group relative overflow-hidden rounded-2xl p-4 border transition-all duration-200
                                        flex items-center gap-5
                                        ${mood === m.value
                                            ? `bg-white/5 border-[#FE90AF] shadow-[0_0_15px_rgba(254,144,175,0.2)]`
                                            : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                                        }
                                    `}
                                >
                                    <div className={`
                                        p-3 rounded-xl bg-black/40 border border-white/5 transition-transform group-hover:scale-110
                                        ${m.color}
                                    `}>
                                        <m.icon size={32} strokeWidth={2.5} />
                                    </div>

                                    <span className={`text-xl font-black uppercase tracking-wide not-italic ${mood === m.value ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                                        {m.label}
                                    </span>

                                    {mood === m.value && (
                                        <div className="absolute right-4 w-3 h-3 bg-[#FE90AF] rounded-full shadow-[0_0_10px_#FE90AF]"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}