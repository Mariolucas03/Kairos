import useSWR from 'swr';
import { X, Loader2, Users, Zap, Lock, Check, DoorOpen } from 'lucide-react';
import api from '../../services/api';
import ClanMemberCard from './ClanMemberCard';
import WeeklyEventWidget from './WeeklyEventWidget';
import { RANK_CONFIG } from '../../utils/socialHelpers';

const fetcher = (url) => api.get(url).then(res => res.data);

export default function ClanPreviewModal({ clanId, currentUserId, userClanId, onClose, onJoin }) {
    const { data: clanData, isLoading } = useSWR(clanId ? `/clans/${clanId}` : null, fetcher);

    if (!clanId) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
            <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl relative z-10 animate-in zoom-in-95 mt-10 sm:mt-0">
                <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-black/50 p-2 rounded-full text-zinc-400 hover:text-white border border-white/10"><X size={20} /></button>

                {!clanData && isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="animate-spin text-yellow-500" size={32} />
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Espiando clan...</p>
                    </div>
                ) : clanData ? (
                    <>
                        <div className="relative bg-zinc-900 p-6 pb-8 border-b border-white/10 shrink-0">
                            
                            <div className="flex flex-col items-center relative z-10">
                                <div className="text-5xl mb-3 filter drop-shadow-lg">{clanData.icon}</div>
                                <h2 className="text-3xl font-black text-white uppercase not-italic tracking-tighter text-center leading-none mb-2">{clanData.name}</h2>
                                <p className="text-xs text-zinc-400 font-medium text-center max-w-[80%] not-italic">"{clanData.description}"</p>

                                <div className="flex items-center gap-4 mt-4">
                                    <span className="text-[10px] font-bold bg-zinc-950 border border-zinc-800 text-zinc-400 px-3 py-1 rounded-full flex items-center gap-1">
                                        <Users size={10} /> {clanData.members.length} Miembros
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#18181b] border border-white/[0.07] text-purple-400">
                                            <Zap size={14} fill="currentColor" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-purple-300 leading-none">{clanData.totalPower}</span>
                                            <span className="text-[8px] font-bold text-zinc-500 uppercase">Poder</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 bg-black/40">
                            {clanData.eventStats && <WeeklyEventWidget clan={clanData} onClaim={() => { }} isPreview={true} />}

                            <div>
                                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 pl-2 flex justify-between items-center">
                                    <span>Miembros</span>
                                    {clanData.minLevel > 1 && <span className="flex items-center gap-1 text-red-400"><Lock size={10} /> Min Lvl {clanData.minLevel}</span>}
                                </h3>
                                <div>
                                    {(() => {
                                        // Mismo criterio que en tu clan: ordenados por aporte semanal
                                        const ordenados = [...clanData.members]
                                            .sort((a, b) => (b.weeklyContribution || 0) - (a.weeklyContribution || 0));
                                        const tope = ordenados[0]?.weeklyContribution || 0;

                                        return ordenados.map((member, idx) => (
                                            <ClanMemberCard
                                                key={member._id || idx}
                                                member={member}
                                                position={idx + 1}
                                                maxContribution={tope}
                                                myRank={null}
                                                currentUserId={currentUserId}
                                                onUpdateRank={() => { }}
                                                onKick={() => { }}
                                            />
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-zinc-950">
                            {userClanId === clanData._id ? (
                                <div className="w-full py-3 bg-green-900/20 text-green-500 font-bold rounded-xl text-center text-xs uppercase tracking-widest cursor-default border border-green-500/30 flex items-center justify-center gap-2">
                                    <Check size={16} /> Ya perteneces a este clan
                                </div>
                            ) : userClanId ? (
                                <div className="w-full py-3 bg-zinc-900 text-zinc-500 font-bold rounded-xl text-center text-xs uppercase tracking-widest cursor-default border border-zinc-800 flex items-center justify-center gap-2">
                                    <Lock size={14} /> Abandona tu clan primero
                                </div>
                            ) : (
                                <button
                                    onClick={() => onJoin(clanData._id)}
                                    className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl text-sm uppercase tracking-widest shadow-lg shadow-yellow-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <DoorOpen size={18} /> UNIRSE AHORA
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-64 text-red-500 font-bold uppercase text-xs">Error cargando datos del clan</div>
                )}
            </div>
        </div>
    );
}
