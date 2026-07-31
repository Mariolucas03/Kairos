import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Gift, ChevronUp, ChevronDown, Check, Lock } from 'lucide-react';
import { cardBaseStyle, EVENT_CONFIG } from '../../utils/socialHelpers';

export default function WeeklyEventWidget({ clan, onClaim, isPreview = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [showRewards, setShowRewards] = useState(false);

    if (!clan || !clan.eventStats) return null;

    const { type, total, goal, myClaims, tiers } = clan.eventStats;
    const config = EVENT_CONFIG[type] || EVENT_CONFIG.volume;
    const EventIcon = config.icon;
    const percent = Math.min((total / goal) * 100, 100);

    // Los escalones y sus premios vienen del servidor: así lo que se ve aquí es
    // exactamente lo que se va a entregar al reclamar.
    const milestones = tiers || [];

    const sortedMembers = [...(clan.members || [])].sort((a, b) => (b.weeklyContribution || 0) - (a.weeklyContribution || 0));
    const claims = myClaims || [];

    const headerCard = (
        <>
            <div className="absolute top-0 right-0 p-12 opacity-5 bg-white blur-3xl rounded-full w-60 h-60 -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-center mb-3 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border border-white/10 ${config.color} bg-white/5`}><EventIcon size={24} /></div>
                    <div>
                        <h3 className={`font-black text-sm uppercase italic tracking-wide ${config.color}`}>{config.title}</h3>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">Evento Activo</p>
                    </div>
                </div>
                <span className="text-lg font-black text-white">{percent.toFixed(1)}%</span>
            </div>
            <div className="relative h-2.5 bg-black rounded-full overflow-hidden border border-white/10">
                <div className={`h-full bg-gradient-to-r ${config.bg} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
            </div>
            <p className="text-center text-[9px] text-zinc-500 font-bold mt-3 uppercase tracking-widest">
                {total.toLocaleString()} / {goal.toLocaleString()} {config.unit}
            </p>
        </>
    );

    if (isPreview) {
        return (
            <div className={`bg-zinc-900 border ${config.border} rounded-2xl p-4 mb-6 relative overflow-hidden shadow-lg z-10`}>
                {headerCard}
            </div>
        );
    }

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIsOpen(false)} />
            <div className="bg-zinc-950 w-full max-w-lg h-[80vh] rounded-[32px] border border-white/10 shadow-2xl flex flex-col relative overflow-hidden animate-in zoom-in-95 z-10">
                <div className="bg-zinc-950 p-5 border-b border-white/10 relative shrink-0 z-30">
                    <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white"><X size={20} /></button>
                    <div className="text-center mt-1">
                        <h2 className={`text-2xl font-black uppercase italic tracking-tighter flex items-center justify-center gap-2 ${config.color}`}><EventIcon size={24} /> {config.title}</h2>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Ranking Semanal</p>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between text-[10px] font-bold text-zinc-400 mb-1">
                            <span>Progreso Clan</span>
                            <span>{total.toLocaleString()} / {goal.toLocaleString()} {config.unit}</span>
                        </div>
                        <div className="h-3 bg-black rounded-full overflow-hidden border border-white/10 relative">
                            <div className={`h-full bg-gradient-to-r ${config.bg} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-black relative pb-20">
                    <div className="space-y-2">
                        {sortedMembers.map((member, index) => {
                            const rankColor = index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-orange-400' : 'text-zinc-600';
                            return (
                                <div key={member._id || index} className={cardBaseStyle}>
                                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 font-black text-lg opacity-30 ${rankColor}`}>#{index + 1}</div>
                                    <div className="flex items-center gap-3 flex-1 min-w-0 pl-8">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-xs font-black text-zinc-500 border border-white/5 overflow-hidden">
                                                {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" alt="av" /> : member.username?.charAt(0)}
                                            </div>
                                            {member.frame && <img src={member.frame} className="absolute -top-1.5 -left-1.5 w-[52px] h-[52px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                                        </div>
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className={`text-sm font-black truncate ${index === 0 ? 'text-yellow-200' : 'text-white'}`}>{member.username}</span>
                                            <span className="text-[9px] font-bold text-zinc-500 uppercase">{member.clanRank || 'Miembro'}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-black text-white">{(member.weeklyContribution || 0).toLocaleString()}</span>
                                        <span className={`text-[8px] font-bold uppercase ${config.color}`}>{config.unit}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div onClick={() => setShowRewards(!showRewards)} className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 p-4 cursor-pointer hover:bg-zinc-800 transition-colors z-40">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full bg-gradient-to-r ${config.bg} text-white shadow-lg`}><Gift size={20} /></div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-white uppercase">Premios</span>
                                <span className="text-[10px] text-zinc-500">Toca para abrir</span>
                            </div>
                        </div>
                        <ChevronUp className={`text-zinc-500 transition-transform ${showRewards ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                {showRewards && (
                    <div className="absolute inset-0 bg-zinc-950 z-50 animate-in slide-in-from-bottom flex flex-col">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900">
                            <h3 className="text-white font-black uppercase italic">Recompensas</h3>
                            <button onClick={() => setShowRewards(false)} className="bg-black p-2 rounded-full"><ChevronDown size={20} className="text-white" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {milestones.map((m) => {
                                const isReached = total >= m.target;
                                const isClaimed = claims.includes(m.tier);
                                return (
                                    <div key={m.tier} className={`p-4 rounded-2xl border flex items-center justify-between ${isReached ? 'bg-yellow-900/10 border-yellow-500/30' : 'bg-black border-zinc-800 opacity-50'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isReached ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-600'}`}>
                                                {isClaimed ? <Check size={24} /> : isReached ? <Gift size={24} /> : <Lock size={20} />}
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold uppercase">{m.label}</h4>
                                                <p className="text-xs text-zinc-500">{Math.round(m.target).toLocaleString()} {config.unit}</p>
                                                {/* Premio exacto que entrega el servidor */}
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">+{m.xp} XP</span>
                                                    <span className="text-[9px] font-black text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">+{m.coins} 🪙</span>
                                                    <span className="text-[9px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">+{m.chips} 🎰</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isClaimed
                                            ? <span className="text-xs text-green-500 font-bold uppercase">Reclamado</span>
                                            : isReached
                                                ? <button onClick={() => onClaim(m.tier)} className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold text-xs active:scale-95 transition-transform">RECLAMAR</button>
                                                : <span className="text-[10px] text-zinc-600 font-bold uppercase">Bloqueado</span>
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            <div onClick={() => setIsOpen(true)} className={`bg-zinc-900 border ${config.border} rounded-2xl p-4 relative overflow-hidden shadow-lg cursor-pointer group active:scale-[0.99] z-10`}>
                {headerCard}
                <p className="text-center text-[9px] text-zinc-500 font-bold mt-2 uppercase tracking-widest flex items-center justify-center gap-1">
                    Ver Ranking <ChevronDown size={12} />
                </p>
            </div>
            {isOpen && createPortal(modalContent, document.body)}
        </>
    );
}
