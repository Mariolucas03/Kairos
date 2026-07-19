import { useState } from 'react';
import { Heart, MessageCircle, Dumbbell, Activity, MapPin, Timer, Flame, Send, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { getLevelStyle } from '../../utils/socialHelpers';

// --- HELPER: TIEMPO RELATIVO ---
const timeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `hace ${days}d`;
    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export default function WorkoutPostCard({ post, onOpenProfile }) {
    const [liked, setLiked] = useState(!!post.likedByMe);
    const [likesCount, setLikesCount] = useState(post.likesCount || 0);
    const [likeBusy, setLikeBusy] = useState(false);

    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState(post.comments || []);
    const [commentText, setCommentText] = useState('');
    const [posting, setPosting] = useState(false);

    const author = post.user || {};
    const levelClass = getLevelStyle(author.level || 1);

    const handleLike = async () => {
        if (likeBusy) return;
        setLikeBusy(true);
        const nextLiked = !liked;
        setLiked(nextLiked);
        setLikesCount(c => c + (nextLiked ? 1 : -1));
        try {
            const res = await api.post(`/social/feed/${post._id}/like`);
            setLiked(res.data.likedByMe);
            setLikesCount(res.data.likesCount);
        } catch (e) {
            // Rollback
            setLiked(!nextLiked);
            setLikesCount(c => c + (nextLiked ? -1 : 1));
        } finally {
            setLikeBusy(false);
        }
    };

    const handleAddComment = async () => {
        const text = commentText.trim();
        if (!text || posting) return;
        setPosting(true);
        try {
            const res = await api.post(`/social/feed/${post._id}/comment`, { text });
            setComments(prev => [...prev, res.data.comment]);
            setCommentText('');
        } catch (e) { } finally {
            setPosting(false);
        }
    };

    const durationMin = Math.round((post.duration || 0) / 60);
    const isGym = post.type === 'gym';

    return (
        <div className="bg-zinc-950 border border-white/5 rounded-[24px] mb-4 overflow-hidden shadow-sm">
            {/* CABECERA */}
            <div className="flex items-center gap-3 p-3">
                <button onClick={() => onOpenProfile(author._id)} className="relative flex-shrink-0 active:scale-95 transition-transform">
                    <div className="w-11 h-11 bg-black rounded-2xl flex items-center justify-center text-xs font-black text-zinc-600 border border-white/10 overflow-hidden">
                        {author.avatar ? <img src={author.avatar} className="w-full h-full object-cover" alt="av" /> : author.username?.charAt(0)}
                    </div>
                    {author.frame && <img src={author.frame} className="absolute -top-1.5 -left-1.5 w-[56px] h-[56px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                </button>

                <div className="flex-1 min-w-0">
                    <button onClick={() => onOpenProfile(author._id)} className="text-white font-black text-sm uppercase tracking-tight truncate block">
                        {author.username}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${levelClass}`}>Lvl {author.level}</span>
                        <span className="text-[9px] text-zinc-600 font-bold">{timeAgo(post.date)}</span>
                    </div>
                </div>

                <div className={`p-2 rounded-xl ${isGym ? 'bg-yellow-500/10 text-yellow-500' : 'bg-lime-500/10 text-lime-400'} border border-white/5`}>
                    {isGym ? <Dumbbell size={16} /> : <Activity size={16} />}
                </div>
            </div>

            {/* CUERPO */}
            <div className="px-4 pb-3">
                <h4 className="text-white font-black text-lg italic uppercase tracking-tighter mb-2">{post.routineName}</h4>
                <div className="flex items-center gap-4 text-zinc-400">
                    <span className="flex items-center gap-1 text-xs font-bold"><Timer size={12} className="text-blue-400" /> {durationMin} min</span>
                    <span className="flex items-center gap-1 text-xs font-bold"><Flame size={12} className="text-orange-500" /> {Math.round(post.caloriesBurned || 0)} kcal</span>
                    {isGym
                        ? <span className="flex items-center gap-1 text-xs font-bold"><Dumbbell size={12} className="text-yellow-500" /> {post.exercises?.length || 0} ejerc.</span>
                        : post.distance > 0 && <span className="flex items-center gap-1 text-xs font-bold"><MapPin size={12} className="text-cyan-400" /> {post.distance} km</span>
                    }
                </div>
            </div>

            {/* PIE: LIKE / COMENTARIOS */}
            <div className="flex items-center gap-4 px-4 py-3 border-t border-white/5">
                <button onClick={handleLike} className="flex items-center gap-1.5 active:scale-90 transition-transform">
                    <Heart size={20} className={liked ? 'text-red-500 fill-red-500' : 'text-zinc-500'} />
                    <span className={`text-xs font-black ${liked ? 'text-red-500' : 'text-zinc-500'}`}>{likesCount}</span>
                </button>
                <button onClick={() => setShowComments(s => !s)} className="flex items-center gap-1.5 active:scale-90 transition-transform">
                    <MessageCircle size={20} className={showComments ? 'text-blue-400' : 'text-zinc-500'} />
                    <span className={`text-xs font-black ${showComments ? 'text-blue-400' : 'text-zinc-500'}`}>{comments.length}</span>
                </button>
            </div>

            {/* COMENTARIOS (DESPLEGABLE) */}
            {showComments && (
                <div className="bg-black/40 border-t border-white/5 p-4 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                    {comments.length === 0 && <p className="text-[10px] text-zinc-600 italic text-center">Sé el primero en comentar.</p>}
                    {comments.map((c, i) => (
                        <div key={c._id || i} className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-black text-zinc-500 border border-white/10 shrink-0 overflow-hidden">
                                {c.user?.avatar ? <img src={c.user.avatar} className="w-full h-full object-cover" /> : c.user?.username?.charAt(0)}
                            </div>
                            <div className="bg-zinc-900 rounded-2xl px-3 py-2 flex-1 min-w-0">
                                <span className="text-[11px] font-black text-white mr-1">{c.user?.username}</span>
                                <span className="text-[11px] text-zinc-300 break-words">{c.text}</span>
                            </div>
                        </div>
                    ))}

                    <div className="flex items-center gap-2 pt-1">
                        <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                            placeholder="Escribe un comentario..."
                            maxLength={300}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-xs text-white outline-none focus:border-blue-500/50 placeholder:text-zinc-600"
                        />
                        <button onClick={handleAddComment} disabled={posting || !commentText.trim()} className="bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed p-2.5 rounded-full text-white active:scale-90 transition-transform">
                            {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
