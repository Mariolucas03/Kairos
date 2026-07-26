import { Crown, ChevronDown, Trash2 } from 'lucide-react';
import { getLevelStyle, cardBaseStyle, RANK_CONFIG } from '../../utils/socialHelpers';

export default function ClanMemberCard({ member, myRank, onUpdateRank, onKick, currentUserId, onViewProfile }) {
    if (!member) return null;

    const currentRankData = RANK_CONFIG[member.clanRank || 'esclavo'];
    const myRankValue = RANK_CONFIG[myRank || 'esclavo'].value;
    const targetRankValue = RANK_CONFIG[member.clanRank || 'esclavo'].value;

    // El backend solo permite cambiar rangos al líder ('dios'), así que la UI
    // debe reflejar exactamente esa regla o el selector fallaría con 403.
    const isLeader = myRankValue === 4;
    const canManage = isLeader && member._id !== currentUserId;

    // 'dios' se reserva a la sucesión de liderazgo (el backend lo rechaza aquí)
    const availableOptions = ['esclavo', 'recluta', 'guerrero', 'rey'];

    const nameColor = member.clanRank === 'dios' ? 'text-yellow-400' : 'text-white';
    const levelClass = getLevelStyle(member.level || 1);

    return (
        <div className={cardBaseStyle}>
            <div
                onClick={() => onViewProfile?.(member._id)}
                className={`flex items-center gap-3 flex-1 min-w-0 overflow-hidden ${onViewProfile ? 'cursor-pointer active:opacity-70 transition-opacity' : ''}`}
            >
                <div className="relative flex-shrink-0 overflow-visible">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-xs font-black text-zinc-600 border border-white/5 overflow-hidden">
                        {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" alt="av" /> : member.username?.charAt(0)}
                    </div>
                    {member.frame && <img src={member.frame} className="absolute -top-1.5 -left-1.5 w-[52px] h-[52px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                </div>

                <div className="flex flex-col min-w-0 pr-2">
                    <span className={`text-sm font-black truncate ${nameColor}`}>{member.username}</span>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase truncate max-w-[80px]">{member.title || 'Novato'}</span>
                </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${levelClass}`}>
                        Lvl {member.level}
                    </span>
                    <div className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${currentRankData.color}`}>
                        {member.clanRank === 'dios' && <Crown size={10} strokeWidth={3} />}
                        <span className="text-[8px] font-black uppercase tracking-wider">{currentRankData.label}</span>
                    </div>
                </div>

                {canManage && (
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <select
                                className="bg-zinc-800 text-[9px] text-zinc-300 font-bold py-1 px-2 rounded border border-zinc-700 outline-none appearance-none pr-4"
                                value={member.clanRank || 'esclavo'}
                                onChange={(e) => onUpdateRank(member._id, e.target.value)}
                            >
                                {availableOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                                ))}
                            </select>
                            <ChevronDown size={10} className="absolute right-0.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                        </div>

                        <button
                            onClick={() => onKick(member)}
                            className="bg-red-900/20 p-1 rounded border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                            title="Expulsar"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
