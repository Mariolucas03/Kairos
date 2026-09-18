import React from 'react';
import { Frown, Meh, Smile, Laugh, HeartCrack } from 'lucide-react';
import WidgetCard, { WIDGET_ACCENTS } from '../common/WidgetCard';

export default function MoodWidget({ mood = null, onUpdate }) {
    const accent = WIDGET_ACCENTS.mood;

    const MOODS = [
        // Cada carita con su color, de siempre: se ve de un vistazo cual es cual
        { value: 1, label: 'TERRIBLE', icon: HeartCrack, color: '#ef4444' },
        { value: 2, label: 'MAL', icon: Frown, color: '#f97316' },
        { value: 3, label: 'NORMAL', icon: Meh, color: '#a1a1aa' },
        { value: 4, label: 'BIEN', icon: Smile, color: '#3b82f6' },
        { value: 5, label: 'INCREÍBLE', icon: Laugh, color: '#a78bfa' },
    ];

    // ⚠️ En la base de datos `mood` es String (DailyLog), así que llega como "5",
    // no como 5. Comparando con === contra el número, la carita elegida NUNCA se
    // quedaba marcada. Se normaliza a número una sola vez y se compara con eso.
    const moodValue = (mood === null || mood === undefined || mood === '') ? null : Number(mood);

    // Pulsar una carita solo la deja marcada: no se abre ningún modal.
    // Si vuelves a pulsar la que ya estaba marcada, se desmarca.
    const handleSelect = (val) => {
        if (!onUpdate) return;
        onUpdate(moodValue === val ? null : val);
    };

    const activa = MOODS.find((m) => m.value === moodValue);
    const activeLabel = activa?.label;

    return (
        <WidgetCard accent={accent} padding="px-[18px] py-4" className="h-full">
            <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <span className="block text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] leading-none not-italic">
                        ÁNIMO
                    </span>
                    <span
                        className="mt-2 block text-[9px] font-black uppercase tracking-[0.1em] leading-none not-italic truncate"
                        style={{ color: activa ? activa.color : '#52525b' }}
                    >
                        {activeLabel || 'SIN REGISTRAR'}
                    </span>
                </div>

                <div className="flex items-center gap-2.5">
                    {MOODS.map((m) => {
                        const active = moodValue === m.value;
                        return (
                            <button
                                key={m.value}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleSelect(m.value); }}
                                className="relative w-[34px] h-[34px] rounded-full flex items-center justify-center transition-colors active:scale-90"
                                style={{
                                    background: active ? m.color + '26' : '#111113',
                                    color: m.color,
                                    opacity: active || moodValue === null ? 1 : 0.45
                                }}
                            >
                                <m.icon size={19} />
                                {active && (
                                    <span
                                        className="absolute -inset-[3px] rounded-full border-2"
                                        style={{ borderColor: m.color }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </WidgetCard>
    );
}
