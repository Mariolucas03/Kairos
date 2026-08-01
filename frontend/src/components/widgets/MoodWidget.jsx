import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Frown, Meh, Smile, Laugh, X, HeartCrack } from 'lucide-react';
import WidgetCard, { WIDGET_ACCENTS } from '../common/WidgetCard';

export default function MoodWidget({ mood = null, onUpdate }) {
    const [isOpen, setIsOpen] = useState(false);
    const accent = WIDGET_ACCENTS.mood;

    const MOODS = [
        { value: 1, label: 'TERRIBLE', icon: HeartCrack, color: 'text-red-500' },
        { value: 2, label: 'MAL', icon: Frown, color: 'text-orange-500' },
        { value: 3, label: 'NORMAL', icon: Meh, color: 'text-zinc-400' },
        { value: 4, label: 'BIEN', icon: Smile, color: 'text-blue-500' },
        { value: 5, label: 'INCREÍBLE', icon: Laugh, color: 'text-violet-400' },
    ];

    const handleSelect = (val) => {
        if (onUpdate) onUpdate(val);
        setIsOpen(false);
    };

    // Selector en línea: se registra el ánimo desde la propia tarjeta,
    // sin abrir nada. El modal sigue disponible tocando la etiqueta.
    return (
        <>
            <WidgetCard accent={accent} padding="px-[18px] py-4" className="h-full">
                <div className="relative z-10 flex items-center justify-between gap-3">
                    <span
                        onClick={() => setIsOpen(true)}
                        className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] leading-none not-italic cursor-pointer"
                    >
                        ÁNIMO
                    </span>

                    <div className="flex items-center gap-2.5">
                        {MOODS.map((m) => {
                            const active = mood === m.value;
                            return (
                                <button
                                    key={m.value}
                                    onClick={(e) => { e.stopPropagation(); handleSelect(m.value); }}
                                    className="relative w-[34px] h-[34px] rounded-full flex items-center justify-center transition-colors"
                                    style={{
                                        background: active ? 'rgba(254,144,175,0.12)' : '#111113',
                                        color: active ? accent : '#3f3f46'
                                    }}
                                >
                                    <m.icon size={19} />
                                    {active && (
                                        <span
                                            className="absolute -inset-[3px] rounded-full border-2"
                                            style={{ borderColor: accent }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                    <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter not-italic">
                                REGISTRAR <span style={{ color: accent }}>ÁNIMO</span>
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
                                        group relative overflow-hidden rounded-2xl p-4 border transition-all duration-200 flex items-center gap-5
                                        ${mood === m.value
                                            ? 'bg-white/5 border-[#FE90AF]'
                                            : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                                        }
                                    `}
                                >
                                    <div className={`p-3 rounded-xl bg-black/40 border border-white/5 transition-transform group-hover:scale-110 ${m.color}`}>
                                        <m.icon size={32} strokeWidth={2.5} />
                                    </div>
                                    <span className={`text-xl font-black uppercase tracking-wide not-italic ${mood === m.value ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                                        {m.label}
                                    </span>
                                    {mood === m.value && (
                                        <div className="absolute right-4 w-3 h-3 rounded-full" style={{ background: accent }} />
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
