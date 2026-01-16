import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Utensils, Flame, Sunrise, Sun, Moon, Coffee, Zap } from 'lucide-react';

export default function FoodWidget({ currentKcal = 0, limitKcal = 2100, meals = {} }) {
    const [isOpen, setIsOpen] = useState(false);

    // --- LÓGICA ---
    const safeCurrent = Math.round(Number(currentKcal) || 0);
    const safeLimit = Math.round(Number(limitKcal) || 2100);
    const percentage = Math.min((safeCurrent / safeLimit) * 100, 100);
    const isOverLimit = safeCurrent > safeLimit;

    // Configuración Círculo
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    // Formatear números
    const f = (n) => n.toLocaleString('es-ES');

    // Colores Flow vs Alerta
    const gradientClasses = isOverLimit
        ? "from-red-600 via-red-500 to-red-600"
        : "from-[#009245] to-[#FCEE21]";

    const shadowColor = isOverLimit ? "rgba(220, 38, 38, 0.4)" : "rgba(252, 238, 33, 0.4)";

    // Configuración de comidas para el modal
    const MEAL_SECTIONS = [
        { key: 'breakfast', label: 'DESAYUNO', icon: <Sunrise size={18} className="text-yellow-400" /> },
        { key: 'lunch', label: 'COMIDA', icon: <Sun size={18} className="text-orange-500" /> },
        { key: 'merienda', label: 'MERIENDA', icon: <Coffee size={18} className="text-amber-700" /> },
        { key: 'dinner', label: 'CENA', icon: <Moon size={18} className="text-indigo-400" /> },
        { key: 'snacks', label: 'SNACKS', icon: <Zap size={18} className="text-purple-400" /> },
    ];

    return (
        <>
            {/* 1. WIDGET PEQUEÑO (PREVIEW) */}
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
                {/* Contenedor Interior (Negro) */}
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col relative overflow-hidden z-10">

                    {/* --- CABECERA --- */}
                    <div className="px-5 pt-5 shrink-0 z-10">
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">
                            NUTRICIÓN
                        </h2>
                    </div>

                    {/* --- CUERPO: GRÁFICO CIRCULAR --- */}
                    <div className="flex-1 flex justify-center items-start relative z-20 pt-0 -mt-3.5">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="transform -rotate-90 w-full h-full overflow-visible">
                                <defs>
                                    <linearGradient id="foodFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        {isOverLimit ? (
                                            <>
                                                <stop offset="0%" stopColor="#dc2626" />
                                                <stop offset="100%" stopColor="#ef4444" />
                                            </>
                                        ) : (
                                            <>
                                                <stop offset="0%" stopColor="#009245" />
                                                <stop offset="100%" stopColor="#FCEE21" />
                                            </>
                                        )}
                                    </linearGradient>
                                </defs>

                                {/* Fondo círculo */}
                                <circle cx="50%" cy="50%" r={radius} stroke="#27272a" strokeWidth="6" fill="transparent" />

                                {/* Progreso círculo */}
                                <circle
                                    cx="50%" cy="50%" r={radius}
                                    stroke="url(#foodFlowGradient)"
                                    strokeWidth="6"
                                    fill="transparent"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out drop-shadow-md"
                                />
                            </svg>

                            {/* INFO CENTRAL */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                                <span className={`text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} uppercase not-italic`}>
                                    {f(safeCurrent)}
                                </span>
                                <span className="text-[11px] font-black text-white uppercase tracking-tighter mt-1 not-italic">
                                    KCAL
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* --- LÍMITE (ABAJO DERECHA) --- */}
                    <div className="absolute bottom-3 right-3 z-20">
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-tighter not-italic">
                            / {f(safeLimit)}
                        </span>
                    </div>

                    {/* --- BARRA INFERIOR FIJA --- */}
                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div className={`h-full w-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_15px_${shadowColor}]`}></div>
                    </div>

                    {/* Luz ambiental */}
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${isOverLimit ? 'from-red-600/20' : 'from-[#009245]/20 to-[#FCEE21]/20'} opacity-30`}></div>
                </div>
            </div>

            {/* 2. MODAL DESPLEGABLE (DETALLE COMIDAS) */}
            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                >
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true"></div>

                    <div
                        className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decoración Fondo */}
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
                        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none bg-gradient-to-bl ${isOverLimit ? 'from-red-600/10' : 'from-green-500/10'} opacity-10`}></div>

                        {/* Header Modal */}
                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2 tracking-tighter not-italic">
                                DETALLE <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125`}>NUTRICIÓN</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* RESUMEN GRANDE */}
                        <div className="flex flex-col items-center justify-center py-2 text-center shrink-0 relative z-10">
                            <span className={`text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} drop-shadow-lg filter brightness-125 pb-2 pr-2`}>
                                {f(safeCurrent)}
                            </span>
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">
                                DE {f(safeLimit)} KCAL
                            </span>
                        </div>

                        {/* LISTA DE COMIDAS */}
                        <div className="flex flex-col gap-3 relative z-10 overflow-y-auto custom-scrollbar pr-1 flex-1 pb-2">
                            {MEAL_SECTIONS.map((meal) => {
                                // Obtener kcal de cada comida (puede venir como número directo o como objeto meal con foods)
                                const mealData = meals[meal.key];
                                let mealKcal = 0;

                                if (typeof mealData === 'number') {
                                    mealKcal = mealData;
                                } else if (mealData && Array.isArray(mealData)) {
                                    // Si es un array de foods (estructura antigua o directa)
                                    mealKcal = mealData.reduce((acc, item) => acc + (item.calories || 0), 0);
                                } else if (mealData && mealData.foods) {
                                    // Si es un objeto meal (estructura nueva)
                                    mealKcal = mealData.foods.reduce((acc, item) => acc + (item.calories || 0), 0);
                                }

                                const mealPercent = safeCurrent > 0 ? Math.min((mealKcal / safeCurrent) * 100, 100) : 0;

                                return (
                                    <div key={meal.key} className="bg-zinc-900/50 p-3 rounded-2xl border border-white/5 flex flex-col gap-2 hover:bg-zinc-900/80 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-black p-2 rounded-xl border border-white/5 shadow-inner">
                                                    {meal.icon}
                                                </div>
                                                <span className="text-xs font-black text-white uppercase tracking-wide">
                                                    {meal.label}
                                                </span>
                                            </div>
                                            <span className="text-sm font-black text-zinc-300">
                                                {f(Math.round(mealKcal))} <span className="text-[9px] text-zinc-600 font-bold uppercase">KCAL</span>
                                            </span>
                                        </div>

                                        {/* Barra de progreso de la comida */}
                                        <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className={`h-full rounded-full ${isOverLimit ? 'bg-red-600' : 'bg-green-500'} opacity-80 shadow-[0_0_10px_currentColor] transition-all duration-500`}
                                                style={{ width: `${mealPercent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                </div>,
                document.body
            )}
        </>
    );
}