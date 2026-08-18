import { Crown, ChevronDown, Trash2, Shield } from 'lucide-react';
import { getLevelStyle, RANK_CONFIG } from '../../utils/socialHelpers';

/**
 * Tarjeta de miembro del clan.
 *
 * Rediseñada para hablar el mismo idioma visual que el ranking: posición
 * destacada, avatar con marco, galón de rango y barra de contribución semanal.
 * Antes era una fila plana donde no se distinguía quién aporta y quién no.
 */
export default function ClanMemberCard({
    member,
    myRank,
    onUpdateRank,
    onKick,
    currentUserId,
    onViewProfile,
    position,
    maxContribution = 0,
    unit = ''
}) {
    if (!member) return null;

    const rankData = RANK_CONFIG[member.clanRank || 'esclavo'];
    const myRankValue = RANK_CONFIG[myRank || 'esclavo'].value;

    // El backend solo permite cambiar rangos al líder ('dios'), así que la UI
    // refleja exactamente esa regla (antes un 'rey' veía el selector y recibía 403)
    const isLeader = myRankValue === 4;
    const isMe = member._id === currentUserId;
    const canManage = isLeader && !isMe;
    const availableOptions = ['esclavo', 'recluta', 'guerrero', 'rey'];

    const contribution = member.weeklyContribution || 0;
    const percent = maxContribution > 0 ? Math.min((contribution / maxContribution) * 100, 100) : 0;

    // Los tres primeros del clan se destacan, igual que en el ranking
    const podio = position === 1
        ? { color: 'text-yellow-400', ring: 'border-yellow-500/40 bg-[#0a0a0c]' }
        : position === 2
            ? { color: 'text-zinc-300', ring: 'border-zinc-500/30 bg-[#0a0a0c]' }
            : position === 3
                ? { color: 'text-orange-400', ring: 'border-orange-600/30 bg-[#0a0a0c]' }
                : { color: 'text-zinc-600', ring: 'border-white/5 bg-zinc-950' };

    return (
        <div className={`rounded-[20px] border p-3 mb-2 relative overflow-hidden transition-all ${podio.ring} ${isMe ? 'ring-1 ring-white/15' : ''}`}>
            <div className="flex items-center gap-3">
                {/* Posición */}
                <div className={`w-6 shrink-0 text-center font-black text-sm ${podio.color}`}>
                    {position === 1 ? <Crown size={18} className="mx-auto fill-current" /> : `#${position}`}
                </div>

                {/* Avatar + identidad */}
                <button
                    onClick={() => onViewProfile?.(member._id)}
                    disabled={!onViewProfile}
                    className={`flex items-center gap-3 flex-1 min-w-0 text-left ${onViewProfile ? 'active:scale-[0.98] transition-transform' : 'cursor-default'}`}
                >
                    <div className="relative shrink-0">
                        <div className="w-11 h-11 bg-black rounded-2xl flex items-center justify-center text-xs font-black text-zinc-600 border border-white/10 overflow-hidden">
                            {member.avatar
                                ? <img src={member.avatar} className="w-full h-full object-cover" alt="av" />
                                : member.username?.charAt(0)}
                        </div>
                        {member.frame && <img src={member.frame} className="absolute -top-1.5 -left-1.5 w-[56px] h-[56px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-sm font-black truncate uppercase tracking-tight ${member.clanRank === 'dios' ? 'text-yellow-400' : 'text-white'}`}>
                                {member.username}
                            </span>
                            {isMe && <span className="text-[7px] bg-white/20 text-white px-1 py-0.5 rounded font-bold shrink-0">TÚ</span>}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${getLevelStyle(member.level || 1)}`}>
                                Lvl {member.level}
                            </span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider flex items-center gap-0.5 ${rankData.color}`}>
                                {member.clanRank === 'dios' ? <Crown size={8} strokeWidth={3} /> : <Shield size={8} />}
                                {rankData.label}
                            </span>
                        </div>
                    </div>
                </button>

                {/* Contribución de la semana */}
                <div className="flex flex-col items-end shrink-0 w-[68px]">
                    <span className="text-sm font-black text-white leading-none">
                        {contribution >= 1000 ? `${(contribution / 1000).toFixed(1)}k` : contribution.toLocaleString()}
                    </span>
                    <span className="text-[7px] font-bold text-zinc-600 uppercase tracking-wider mt-0.5">{unit || 'aporte'}</span>
                    <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-white/10 mt-1.5">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${position === 1 ? 'bg-yellow-500' : 'bg-zinc-500'}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Controles del líder */}
            {canManage && (
                <div className="flex items-center justify-end gap-2 mt-2.5 pt-2.5 border-t border-white/5">
                    <div className="relative">
                        <select
                            className="bg-zinc-900 text-[9px] text-zinc-300 font-bold py-1 pl-2 pr-5 rounded-lg border border-zinc-700 outline-none appearance-none"
                            value={member.clanRank || 'esclavo'}
                            onChange={(e) => onUpdateRank(member._id, e.target.value)}
                        >
                            {availableOptions.map(opt => (
                                <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                            ))}
                        </select>
                        <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    </div>
                    <button
                        onClick={() => onKick(member)}
                        className="bg-red-900/20 p-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        title="Expulsar"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}
