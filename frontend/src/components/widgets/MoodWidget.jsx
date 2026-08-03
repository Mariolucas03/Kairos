import React from 'react';
import { Frown, Meh, Smile, Laugh, HeartCrack } from 'lucide-react';
import WidgetCard, { WIDGET_ACCENTS } from '../common/WidgetCard';

export default function MoodWidget({ mood = null, onUpdate }) {
    const accent = WIDGET_ACCENTS.mood;

    const MOODS = [
        { value: 1, label: 'TERRIBLE', icon: HeartCrack, color: 'text-red-500' },
        { value: 2, label: 'MAL', icon: Frown, color: 'text-orange-500' },
        { value: 3, label: 'NORMAL', icon: Meh, color: 'text-zinc-400' },
        { value: 4, label: 'BIEN', icon: Smile, color: 'text-blue-500' },
        { value: 5, label: 'INCREÍBLE', icon: Laugh, color: 'text-violet-400' },
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

    const activeLabel = MOODS.find((m) => m.value === moodValue)?.label;

    return (
        <WidgetCard accent={accent} padding="px-[18px] py-4" className="h-full">
            <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <span className="block text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] leading-none not-italic">
                        ÁNIMO
                    </span>
                    <span
                        className="mt-2 block text-[9px] font-black uppercase tracking-[0.1em] leading-none not-italic truncate"
                        style={{ color: activeLabel ? accent : '#52525b' }}
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
    );
}
