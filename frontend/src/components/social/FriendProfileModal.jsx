import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { X, Loader2, ChevronDown, Dumbbell } from 'lucide-react';
import api from '../../services/api';
import WorkoutPostCard from './WorkoutPostCard';
import { getLevelStyle } from '../../utils/socialHelpers';

const fetcher = (url) => api.get(url).then(res => res.data);
const noOp = () => { };

export default function FriendProfileModal({ userId, onClose }) {
    const { data, isLoading } = useSWR(userId ? `/social/profile/${userId}?page=1` : null, fetcher);

    const [extraItems, setExtraItems] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Reinicia la paginación local cada vez que se abre un perfil distinto
    useEffect(() => {
        setExtraItems([]);
        setPage(1);
        setHasMore(false);
    }, [userId]);

    useEffect(() => {
        if (data) setHasMore(data.hasMore);
    }, [data]);

    if (!userId) return null;

    const profile = data?.profile;
    const items = [...(data?.items || []), ...extraItems];
    const level = profile?.level || 1;
    const xpPercent = profile ? Math.min(((profile.currentXP || 0) / (profile.nextLevelXP || 100)) * 100, 100) : 0;

    const loadMore = async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const res = await api.get(`/social/profile/${userId}?page=${nextPage}`);
            setExtraItems(prev => [...prev, ...res.data.items]);
            setHasMore(res.data.hasMore);
            setPage(nextPage);
        } catch (e) { } finally {
            setLoadingMore(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
            <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl relative z-10 animate-in zoom-in-95 mt-10 sm:mt-0">
                <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-black/50 p-2 rounded-full text-zinc-400 hover:text-white border border-white/10"><X size={20} /></button>

                {!profile && isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="animate-spin text-yellow-500" size={32} />
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Cargando perfil...</p>
                    </div>
                ) : profile ? (
                    <>
                        <div className="relative bg-zinc-900 p-6 pb-6 border-b border-white/10 shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none"></div>
                            <div className="flex flex-col items-center relative z-10">
                                <div className="relative mb-3">
                                    <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center text-2xl font-black text-zinc-500 border border-white/10 overflow-hidden">
                                        {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" alt="av" /> : profile.username?.charAt(0)}
                                    </div>
                                    {profile.frame && <img src={profile.frame} className="absolute -top-3 -left-3 w-[104px] h-[104px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                                </div>

                                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter text-center leading-none mb-1">{profile.username}</h2>
                                <p className="text-[10px] text-yellow-500/80 italic font-bold tracking-wider uppercase mb-3">{profile.title || 'Novato'}</p>

                                <div className="w-full max-w-[220px]">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${getLevelStyle(level)}`}>Lvl {level}</span>
                                        <span className="text-[9px] text-zinc-500 font-bold">{profile.currentXP || 0}/{profile.nextLevelXP || 100} XP</span>
                                    </div>
                                    <div className="relative w-full h-2 bg-black rounded-full border border-zinc-800 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-blue-600 to-purple-500" style={{ width: `${xpPercent}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-black/40">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 pl-2 flex items-center gap-2">
                                <Dumbbell size={12} /> Entrenos Publicados
                            </h3>

                            {items.length === 0 ? (
                                <div className="text-center py-10 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
                                    <p className="text-xs">Aún no ha publicado entrenos.</p>
                                </div>
                            ) : (
                                <>
                                    {items.map(post => <WorkoutPostCard key={post._id} post={post} onOpenProfile={noOp} />)}
                                    {hasMore && (
                                        <button onClick={loadMore} disabled={loadingMore} className="w-full py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                                            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                                            Cargar más
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-64 text-red-500 font-bold uppercase text-xs px-6 text-center">No se pudo cargar el perfil</div>
                )}
            </div>
        </div>
    );
}
