import React from 'react';
import { Flame, Gift } from 'lucide-react';
import WidgetCard, { WIDGET_ACCENTS } from '../common/WidgetCard';

/**
 * RACHA + COFRE DIARIO.
 * El cofre vive aquí dentro (antes era un botón suelto en la cabecera).
 * Sigue llamando exactamente a la misma función `openCalendar` del hook
 * useDailyRewards, y `claimed` pinta el estado ya reclamado.
 */
export default function StreakWidget({ streak = 0, onOpenChest, claimed = false }) {
    const accent = WIDGET_ACCENTS.streak;
    const isSingular = streak === 1;

    return (
        <WidgetCard accent={accent} padding="px-[18px] py-4" className="h-full">
            <div className="relative z-10 flex items-center gap-4">

                <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(249,115,22,0.12)', color: accent }}
                >
                    <Flame size={22} />
                </div>

                <div className="flex-1 min-w-0">
                    <span className="block text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] leading-none not-italic">
                        RACHA
                    </span>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-white tracking-[-0.045em] leading-none not-italic">
                            {streak}
                        </span>
                        <span
                            className="text-[11px] font-black tracking-[0.1em] leading-none not-italic"
                            style={{ color: accent }}
                        >
                            {isSingular ? 'DÍA SEGUIDO' : 'DÍAS SEGUIDOS'}
                        </span>
                    </div>
                </div>

                {/* COFRE DIARIO */}
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenChest && onOpenChest(); }}
                    className={`
                        shrink-0 flex items-center gap-2.5 rounded-2xl px-3.5 py-[11px] border transition-all active:scale-95
                        ${claimed
                            ? 'bg-white/[0.03] border-white/[0.07] text-zinc-600'
                            : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/[0.18]'
                        }
                    `}
                >
                    <Gift size={19} className={claimed ? '' : 'animate-pulse'} />
                    <span className="text-[10px] font-black tracking-[0.1em] not-italic">COFRE</span>
                </button>
            </div>
        </WidgetCard>
    );
}
