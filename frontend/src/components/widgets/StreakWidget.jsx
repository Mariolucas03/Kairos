import { Flame, Gift, Check } from 'lucide-react';
import WidgetCard, { WIDGET_ACCENTS } from '../common/WidgetCard';

/**
 * RACHA + LO QUE DA HOY.
 *
 * La racha son los dias seguidos que entras y recoges. El boton abre el
 * camino (DailyRewardModal), desde donde se recoge; si la de hoy esta
 * pendiente, el boton la anuncia con lo que da.
 */
export default function StreakWidget({ streak = 0, hoy = null, dia = null, onOpenChest, claimed = false }) {
    const accent = WIDGET_ACCENTS.streak;
    const n = streak || 0;

    return (
        <WidgetCard accent={accent} padding="px-[18px] py-4" className="h-full">
            <div className="relative z-10 flex items-center gap-4">

                <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(249,115,22,0.12)', color: accent }}
                >
                    <Flame size={22} fill={n > 0 ? accent : 'none'} />
                </div>

                <div className="flex-1 min-w-0">
                    <span className="block text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] leading-none not-italic">
                        RACHA
                    </span>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-white tracking-[-0.045em] leading-none not-italic tabular-nums">
                            {n}
                        </span>
                        <span className="text-[11px] font-black tracking-[0.1em] leading-none not-italic" style={{ color: accent }}>
                            {n === 1 ? 'DÍA SEGUIDO' : 'DÍAS SEGUIDOS'}
                        </span>
                    </div>
                </div>

                {/* LA DE HOY: pendiente con su premio, o ya recogida */}
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenChest && onOpenChest(); }}
                    aria-label={claimed ? 'Ver el camino de la racha' : 'Recoger la recompensa de hoy'}
                    className={`
                        shrink-0 flex flex-col items-center justify-center rounded-2xl px-3.5 py-2 border transition-all active:scale-95 min-w-[86px]
                        ${claimed
                            ? 'bg-white/[0.03] border-white/[0.07] text-zinc-500'
                            : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                        }
                    `}
                >
                    <span className="flex items-center gap-1.5">
                        {claimed ? <Check size={15} /> : <Gift size={17} className="animate-pulse" />}
                        <span className="text-[10px] font-black tracking-[0.1em] not-italic">{claimed ? 'HECHO' : `DÍA ${dia || 1}`}</span>
                    </span>
                    {!claimed && hoy && (
                        <span className="text-[9px] font-bold text-zinc-400 mt-0.5 not-italic truncate max-w-[84px]">{hoy.etiqueta}</span>
                    )}
                </button>
            </div>
        </WidgetCard>
    );
}
