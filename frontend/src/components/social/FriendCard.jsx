import { useState, useRef } from 'react';
import { Trash2, Target, Construction } from 'lucide-react';
import { getLevelStyle, cardBaseStyle } from '../../utils/socialHelpers';

export default function FriendCard({ friend, onRemoveRequest, onChallengeOrView, onViewProfile }) {
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const THRESHOLD = 80;

    const handleStart = (cx) => { setIsDragging(true); startX.current = cx; };
    const handleMove = (cx) => { if (!isDragging) return; const diff = cx - startX.current; setDragX(diff > 150 ? 150 : diff < -150 ? -150 : diff); };
    const handleEnd = () => {
        setIsDragging(false);
        if (dragX < -THRESHOLD) onRemoveRequest(friend);
        else if (dragX > THRESHOLD) onChallengeOrView(friend);
        setDragX(0);
    };

    const bgAction = dragX > 0 ? 'bg-zinc-800 text-yellow-500' : 'bg-red-900/20 text-red-500';
    const missions = friend.missionProgress || { completed: 0, total: 1 };
    const safeTotal = Math.max(missions.total || 1, missions.completed, 1);
    const percent = Math.min((missions.completed / safeTotal) * 100, 100);
    const levelClass = getLevelStyle(friend.level || 1);

    return (
        <div className="relative w-full h-[82px] mb-2 select-none isolate overflow-hidden rounded-[24px]">
            <div className={`absolute inset-0 flex items-center ${bgAction} -z-10 font-bold px-6 justify-between transition-colors`}>
                <span className={`flex items-center gap-2 text-xs font-black ${dragX > 0 ? 'opacity-100' : 'opacity-0'}`}><Construction size={18} /> DUELO</span>
                <span className={`flex items-center gap-2 text-xs font-black ${dragX < 0 ? 'opacity-100' : 'opacity-0'}`}>ELIMINAR <Trash2 size={18} /></span>
            </div>
            <div style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease' }}
                onTouchStart={e => handleStart(e.targetTouches[0].clientX)}
                onTouchMove={e => handleMove(e.targetTouches[0].clientX)}
                onTouchEnd={handleEnd}
                className={`${cardBaseStyle} h-full`}>
                <div onClick={() => onViewProfile?.(friend._id)} className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer active:opacity-70 transition-opacity">
                    <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-xs font-black text-zinc-600 border border-white/10 overflow-hidden">
                            {friend.avatar ? <img src={friend.avatar} className="w-full h-full object-cover" alt="av" /> : friend.username.charAt(0)}
                        </div>
                        {friend.frame && <img src={friend.frame} className="absolute -top-1.5 -left-1.5 w-[60px] h-[60px] max-w-none pointer-events-none z-20" />}
                        {/* 🟢 Indicador de conexión (ventana de 10 min en el backend) */}
                        <div
                            title={friend.online ? 'En línea' : 'Desconectado'}
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-[3px] border-zinc-950 rounded-full z-30 ${friend.online ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-zinc-700'}`}
                        ></div>
                    </div>
                    <div className="flex flex-col min-w-0 pr-2 items-start">
                        <span className="text-base font-black text-white truncate uppercase tracking-tight leading-none mb-1.5">{friend.username}</span>
                        <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${levelClass}`}>
                                LVL {friend.level}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-wider ${friend.online ? 'text-green-500' : 'text-zinc-600'}`}>
                                {friend.online ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 pl-4 border-l border-white/5 h-full justify-center">
                    <div className="flex items-center gap-1.5">
                        <Target size={14} className="text-blue-500" />
                        <span className="text-xs font-black text-zinc-300 tracking-wider">
                            {missions.completed} <span className="text-zinc-600">/</span> {safeTotal}
                        </span>
                    </div>
                    <div className="w-16 h-1.5 bg-black rounded-full overflow-hidden border border-white/10">
                        <div className="h-full bg-blue-600 rounded-full shadow-[0_0_8px_#2563eb]" style={{ width: `${percent}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
