import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sunrise, Sun, Moon, Coffee, Zap } from 'lucide-react';
import WidgetCard, { WIDGET_ACCENTS } from '../common/WidgetCard';

export default function FoodWidget({ currentKcal = 0, limitKcal = 2100, meals = {} }) {
    const [isOpen, setIsOpen] = useState(false);

    const safeCurrent = Math.round(Number(currentKcal) || 0);
    const safeLimit = Math.round(Number(limitKcal) || 2100);
    const percentage = Math.min((safeCurrent / safeLimit) * 100, 100);
    const isOverLimit = safeCurrent > safeLimit;
    const remaining = safeLimit - safeCurrent;

    const accent = isOverLimit ? '#ef4444' : WIDGET_ACCENTS.food;

    const f = (n) => Number(n || 0).toLocaleString('es-ES');

    const MEAL_SECTIONS = [
        { key: 'breakfast', label: 'DESAY.', modalLabel: 'DESAYUNO', icon: <Sunrise size={18} className="text-yellow-400" />, bar: '#65a30d' },
        { key: 'lunch', label: 'COMIDA', modalLabel: 'COMIDA', icon: <Sun size={18} className="text-orange-500" />, bar: '#84cc16' },
        { key: 'merienda', label: 'MERIEN.', modalLabel: 'MERIENDA', icon: <Coffee size={18} className="text-amber-700" />, bar: '#a3e635' },
        { key: 'dinner', label: 'CENA', modalLabel: 'CENA', icon: <Moon size={18} className="text-indigo-400" />, bar: '#bef264' },
        { key: 'snacks', label: 'SNACKS', modalLabel: 'SNACKS', icon: <Zap size={18} className="text-purple-400" />, bar: '#d9f99d' },
    ];

    const kcalOf = (key) => {
        const mealData = meals[key];
        if (typeof mealData === 'number') return mealData;
        if (Array.isArray(mealData)) return mealData.reduce((acc, item) => acc + (item.calories || 0), 0);
        if (mealData && mealData.foods) return mealData.foods.reduce((acc, item) => acc + (item.calories || 0), 0);
        return 0;
    };

    // Solo se listan las comidas que ya tienen algo registrado: la tarjeta se
    // va rellenando sola según añades desayuno, comida, merienda...
    const loggedMeals = MEAL_SECTIONS.filter((meal) => Math.round(kcalOf(meal.key)) > 0);

    // Anillo
    const R = 48;
    const C = 2 * Math.PI * R;
    const offset = C - (percentage / 100) * C;

    return (
        <>
            <WidgetCard
                accent={accent}
                onClick={() => setIsOpen(true)}
                padding="p-5"
                className="h-full"
            >
                <div className="relative z-10 flex items-center gap-[18px]">

                    {/* ANILLO */}
                    <div className="relative w-28 h-28 shrink-0">
                        <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
                            <circle cx="56" cy="56" r={R} fill="none" stroke="#1b1b1e" strokeWidth="9" />
                            <circle
                                cx="56" cy="56" r={R}
                                fill="none"
                                stroke={accent}
                                strokeWidth="9"
                                strokeLinecap="round"
                                strokeDasharray={C}
                                strokeDashoffset={offset}
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[27px] font-black text-white tracking-[-0.05em] leading-none not-italic">
                                {f(safeCurrent)}
                            </span>
                            <span className="mt-1 text-[10px] font-black tracking-[0.16em] leading-none not-italic" style={{ color: accent }}>
                                KCAL
                            </span>
                        </div>
                    </div>

                    {/* DESGLOSE */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] leading-none not-italic">
                                NUTRICIÓN
                            </span>
                            <span className="text-[10px] font-black leading-none not-italic" style={{ color: accent }}>
                                {isOverLimit ? `+${f(Math.abs(remaining))}` : `RESTAN ${f(remaining)}`}
                            </span>
                        </div>

                        <div className="mt-3.5 flex flex-col gap-[9px]">
                            {loggedMeals.length === 0 ? (
                                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.1em] leading-relaxed not-italic">
                                    SIN COMIDAS<br />REGISTRADAS HOY
                                </span>
                            ) : (
                                loggedMeals.slice(0, 4).map((meal) => {
                                    const kcal = Math.round(kcalOf(meal.key));
                                    const pct = safeLimit > 0 ? Math.min((kcal / safeLimit) * 100, 100) : 0;
                                    return (
                                        <div key={meal.key} className="flex items-center gap-2">
                                            <span className="w-[58px] text-[9px] font-black uppercase tracking-[0.1em] leading-none not-italic text-zinc-400">
                                                {meal.label}
                                            </span>
                                            <div className="flex-1 h-[5px] bg-[#18181b] rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: meal.bar }} />
                                            </div>
                                            <span className="w-[34px] text-right text-[9px] font-black leading-none not-italic text-zinc-400">
                                                {f(kcal)}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />

                    <div
                        className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2 tracking-tighter not-italic">
                                DETALLE <span style={{ color: accent }}>NUTRICIÓN</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center justify-center py-2 text-center shrink-0 relative z-10">
                            <span className="text-5xl font-black text-white tracking-tighter not-italic">{f(safeCurrent)}</span>
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">
                                DE {f(safeLimit)} KCAL
                            </span>
                        </div>

                        <div className="flex flex-col gap-3 relative z-10 overflow-y-auto custom-scrollbar pr-1 flex-1 pb-2">
                            {loggedMeals.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-zinc-500 text-sm font-bold uppercase">Nada registrado todavía</p>
                                    <p className="text-zinc-600 text-xs mt-1">Añade alimentos y aparecerán aquí.</p>
                                </div>
                            )}
                            {loggedMeals.map((meal) => {
                                const mealKcal = kcalOf(meal.key);
                                const mealPercent = safeCurrent > 0 ? Math.min((mealKcal / safeCurrent) * 100, 100) : 0;

                                return (
                                    <div key={meal.key} className="bg-zinc-900/50 p-3 rounded-2xl border border-white/5 flex flex-col gap-2 hover:bg-zinc-900/80 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-black p-2 rounded-xl border border-white/5 shadow-inner">
                                                    {meal.icon}
                                                </div>
                                                <span className="text-xs font-black text-white uppercase tracking-wide">
                                                    {meal.modalLabel}
                                                </span>
                                            </div>
                                            <span className="text-sm font-black text-zinc-300">
                                                {f(Math.round(mealKcal))} <span className="text-[9px] text-zinc-600 font-bold uppercase">KCAL</span>
                                            </span>
                                        </div>

                                        <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${mealPercent}%`, background: meal.bar }}
                                            />
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
