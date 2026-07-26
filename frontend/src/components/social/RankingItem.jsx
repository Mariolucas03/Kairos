import { Crown, Medal } from 'lucide-react';
import { getLevelStyle } from '../../utils/socialHelpers';

export default function RankingItem({ player, index, isMe, isViewable, onViewProfile, metricLabel = 'XP' }) {
    let rankIcon = <span className="font-bold text-sm text-zinc-500">#{index + 1}</span>;
    let rankStyles = "border-white/5 bg-zinc-950";
    let textStyle = "text-white";

    if (index === 0) {
        rankIcon = <Crown size={24} className="text-yellow-400 fill-yellow-400 animate-pulse" />;
        rankStyles = "border-yellow-500/50 bg-gradient-to-r from-yellow-900/20 to-black shadow-[0_0_15px_rgba(234,179,8,0.2)]";
        textStyle = "text-yellow-400";
    } else if (index === 1) {
        rankIcon = <Medal size={24} className="text-zinc-300 fill-zinc-300" />;
        rankStyles = "border-zinc-400/30 bg-gradient-to-r from-zinc-800/40 to-black";
        textStyle = "text-zinc-200";
    } else if (index === 2) {
        rankIcon = <Medal size={24} className="text-orange-600 fill-orange-600" />;
        rankStyles = "border-orange-600/30 bg-gradient-to-r from-orange-900/20 to-black";
        textStyle = "text-orange-200";
    }

    const levelClass = getLevelStyle(player.level || 1);
    // Solo se puede abrir el perfil de un amigo (el backend también lo verifica)
    const clickable = isViewable && !isMe;

    return (
        <div className={`flex items-center justify-between p-4 rounded-[24px] border mb-2 relative overflow-hidden group ${rankStyles} ${isMe ? 'ring-1 ring-white/20' : ''}`}>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors"></div>
            <button
                onClick={() => clickable && onViewProfile?.(player._id)}
                disabled={!clickable}
                className={`flex items-center gap-4 flex-1 min-w-0 relative z-10 text-left ${clickable ? 'active:scale-[0.98] transition-transform' : 'cursor-default'}`}
            >
                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">{rankIcon}</div>
                <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-xs font-black text-zinc-600 border border-white/10 overflow-hidden">
                        {player.avatar ? <img src={player.avatar} className="w-full h-full object-cover" alt="avatar" /> : player.username?.charAt(0)}
                    </div>
                    {player.frame && <img src={player.frame} className="absolute -top-1.5 -left-1.5 w-[60px] h-[60px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                </div>
                <div className="flex flex-col min-w-0 pr-2">
                    <span className={`text-base font-black truncate uppercase tracking-tight ${textStyle}`}>
                        {player.username}
                        {isMe && <span className="text-[8px] bg-white/20 text-white px-1.5 py-0.5 rounded ml-2 align-middle font-bold">YO</span>}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase truncate tracking-wider">{player.title || 'Novato'}</span>
                </div>
            </button>

            <div className="flex flex-col items-end relative z-10 pl-2">
                <div className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide mb-1 ${levelClass}`}>
                    LVL {player.level || 1}
                </div>
                <span className="text-[9px] text-zinc-600 font-mono tracking-tight">
                    {(player.xp || player.currentXP || 0).toLocaleString()} {metricLabel}
                </span>
            </div>
        </div>
    );
}
