import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { Target, X, CheckCircle, Star, Coins, Gamepad2, HeartCrack, ChevronRight } from 'lucide-react';
import WidgetCard, { WIDGET_ACCENTS } from '../common/WidgetCard';
import api from '../../services/api';

const fetcher = (url) => api.get(url).then(res => res.data);

// Un tono por dificultad, el mismo que usa la pantalla de Misiones
const COLOR_DIFICULTAD = {
    easy: '#4ade80', medium: '#22d3ee', hard: '#fb923c', epic: '#a855f7'
};

export default function MissionsWidget({
    completed = 0,
    total = 0,
    completedMissions = []
}) {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const accent = WIDGET_ACCENTS.missions;

    // Lo que queda POR HACER. El modal solo ensenaba el historial de lo ya
    // hecho, que es justo lo que no necesitas saber a media manana.
    // Layout ya precarga /missions, asi que esto sale de la cache de SWR y no
    // dispara una peticion extra.
    const { data: todas } = useSWR(isOpen ? '/missions' : null, fetcher);

    const pendientes = (Array.isArray(todas) ? todas : [])
        .filter(m => !m.completed && m.invitationStatus !== 'pending' && (m.frequency || 'daily') === 'daily');

    const safeCompleted = Math.max(0, completed);
    const safeTotal = Math.max(0, total);

    // Segmentos: uno por misión (máx. 8 para que no se apelmacen)
    const segments = Math.min(Math.max(safeTotal, 1), 8);

    return (
        <>
            <WidgetCard
                accent={accent}
                onClick={() => setIsOpen(true)}
                className="h-full flex flex-col justify-between"
                label="MISIONES"
            >
                <div className="relative z-10 mt-auto pt-3">
                    <div className="flex items-baseline gap-1">
                        <span className="text-[40px] font-black text-white tracking-[-0.05em] leading-none not-italic">{safeCompleted}</span>
                        <span className="text-base font-black tracking-[-0.03em] leading-none not-italic" style={{ color: accent }}>/{safeTotal}</span>
                    </div>
                    <div className="mt-2.5 flex gap-[5px]">
                        {Array.from({ length: segments }).map((_, i) => (
                            <span
                                key={i}
                                className="flex-1 h-1 rounded-full"
                                style={{ background: i < safeCompleted ? accent : '#27272a' }}
                            />
                        ))}
                    </div>
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }} className="fixed left-0 right-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />

                    <div
                        className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 overflow-hidden max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase tracking-[-0.045em] flex items-center gap-2 pr-2 not-italic">
                                MIS <span style={{ color: accent }}>MISIONES</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 relative z-10 overflow-y-auto custom-scrollbar pr-1 flex-1">

                            {/* --- LO QUE QUEDA POR HACER --- */}
                            {pendientes.length > 0 && (
                                <>
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] not-italic">
                                        Te quedan {pendientes.length}
                                    </p>
                                    {pendientes.map(m => {
                                        const tono = COLOR_DIFICULTAD[m.difficulty] || '#71717a';
                                        const objetivo = Math.max(1, m.target || 1);
                                        const pct = Math.min(100, Math.round(((m.progress || 0) / objetivo) * 100));
                                        return (
                                            <div
                                                key={m._id}
                                                onClick={() => { setIsOpen(false); navigate('/missions'); }}
                                                className="relative overflow-hidden bg-[#0a0a0c] border border-white/[0.07] rounded-[20px] p-3.5 cursor-pointer active:scale-[0.985] transition-transform"
                                            >
                                                <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${tono}, transparent)` }} />
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[13px] font-bold text-white leading-tight line-clamp-1 not-italic">{m.title}</span>
                                                    <span className="text-[11px] font-black shrink-0 not-italic" style={{ color: tono }}>
                                                        {m.progress || 0}<span className="text-zinc-600">/{objetivo}</span>
                                                    </span>
                                                </div>
                                                <div className="mt-2 h-1 w-full bg-[#18181b] rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tono }} />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <button
                                        onClick={() => { setIsOpen(false); navigate('/missions'); }}
                                        className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-300 py-1 not-italic"
                                    >
                                        Ir a misiones <ChevronRight size={13} />
                                    </button>

                                    {completedMissions.length > 0 && (
                                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-2 not-italic">Ya hechas</p>
                                    )}
                                </>
                            )}

                            {completedMissions.length > 0 ? (
                                completedMissions.map((m, idx) => (
                                    <div key={idx} className={`p-4 rounded-2xl border flex flex-col gap-2 relative overflow-hidden ${m.failed ? 'bg-red-950/20 border-red-900/30' : 'bg-black border-zinc-800'}`}>
                                        <div className="flex justify-between items-start relative z-10">
                                            <span className={`text-sm font-bold block line-clamp-2 ${m.failed ? 'text-red-400 line-through' : 'text-white'}`}>
                                                {m.title}
                                            </span>
                                            {m.failed
                                                ? <span className="text-[9px] font-black bg-red-900/30 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 uppercase">FAIL</span>
                                                : <CheckCircle size={16} className="text-green-500" />
                                            }
                                        </div>

                                        <div className={`flex gap-3 mt-1 pt-3 border-t relative z-10 ${m.failed ? 'border-red-900/20' : 'border-zinc-900'}`}>
                                            {m.failed ? (
                                                <div className="flex items-center gap-2 w-full justify-center text-red-500 bg-red-950/20 py-1 rounded">
                                                    <HeartCrack size={12} /> <span className="text-xs font-black">-{m.hpLoss} HP</span>
                                                </div>
                                            ) : (
                                                <div className="flex w-full gap-2">
                                                    {m.xpReward > 0 && (
                                                        <span className="flex-1 text-center bg-zinc-900/50 border border-white/5 rounded py-1 text-[10px] font-bold text-zinc-300 flex items-center justify-center gap-1">
                                                            <Star size={10} className="text-blue-400" /> +{m.xpReward} XP
                                                        </span>
                                                    )}
                                                    {m.coinReward > 0 && (
                                                        <span className="flex-1 text-center bg-yellow-900/10 border border-yellow-500/20 rounded py-1 text-[10px] font-bold text-yellow-400 flex items-center justify-center gap-1">
                                                            <Coins size={10} /> +{m.coinReward}
                                                        </span>
                                                    )}
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
                                pendientes.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-10 text-center relative z-10 flex-1">
                                        <Target size={48} className="text-zinc-800 mb-4" />
                                        <p className="text-zinc-600 text-sm font-bold uppercase not-italic">
                                            {todas ? 'Nada pendiente hoy.' : 'Cargando...'}
                                        </p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
