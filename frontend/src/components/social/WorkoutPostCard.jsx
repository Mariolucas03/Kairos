import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BodyMap from '../body/BodyMap';
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

export default function WorkoutPostCard({ post, linkProfile = true }) {
    const navigate = useNavigate();
    const [liked, setLiked] = useState(!!post.likedByMe);
    const [likesCount, setLikesCount] = useState(post.likesCount || 0);
    const [likeBusy, setLikeBusy] = useState(false);

    const [slideIndex, setSlideIndex] = useState(0);
    const carruselRef = useRef(null);

    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState(post.comments || []);
    const [commentText, setCommentText] = useState('');
    const [posting, setPosting] = useState(false);

    const author = post.user || {};
    const levelClass = getLevelStyle(author.level || 1);

    // Dentro del propio perfil no hace falta volver a navegar al mismo sitio
    const openProfile = () => {
        if (linkProfile && author._id) navigate(`/social/user/${author._id}`);
    };

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

    // Diapositivas del carrusel: solo las que tienen contenido
    const slides = [
        post.photo ? 'photo' : null,
        (post.musclesWorked || []).length > 0 ? 'body' : null,
        (post.exercises || []).length > 0 ? 'exercises' : null
    ].filter(Boolean);

    // El punto activo se calcula desde el scroll real, así funciona igual
    // arrastrando con el dedo que con la rueda del ratón.
    const handleCarouselScroll = () => {
        const el = carruselRef.current;
        if (!el) return;
        setSlideIndex(Math.round(el.scrollLeft / el.clientWidth));
    };

    return (
        <div className="bg-zinc-950 border border-white/5 rounded-[24px] mb-4 overflow-hidden shadow-sm">
            {/* CABECERA */}
            <div className="flex items-center gap-3 p-3">
                <button onClick={openProfile} disabled={!linkProfile} className="relative flex-shrink-0 active:scale-95 transition-transform disabled:cursor-default">
                    <div className="w-11 h-11 bg-black rounded-2xl flex items-center justify-center text-xs font-black text-zinc-600 border border-white/10 overflow-hidden">
                        {author.avatar ? <img src={author.avatar} className="w-full h-full object-cover" alt="av" /> : author.username?.charAt(0)}
                    </div>
                    {author.frame && <img src={author.frame} className="absolute -top-1.5 -left-1.5 w-[56px] h-[56px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                </button>

                <div className="flex-1 min-w-0">
                    <button onClick={openProfile} disabled={!linkProfile} className="text-white font-black text-sm uppercase tracking-tight truncate block disabled:cursor-default">
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

            {/* --- CARRUSEL DESLIZABLE (foto · cuerpo · ejercicios), como en IG --- */}
            {slides.length > 0 && (
                <div className="relative">
                    <div
                        ref={carruselRef}
                        onScroll={handleCarouselScroll}
                        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                    >
                        {slides.map((slide, i) => (
                            <div key={i} className="min-w-full snap-center">
                                {slide === 'photo' && (
                                    <img src={post.photo} alt="Foto del entreno" className="w-full h-72 object-cover" />
                                )}

                                {slide === 'body' && (
                                    <div className="h-72 bg-black/40 flex flex-col items-center justify-center py-2">
                                        <BodyMap
                                            highlight={post.musclesWorked}
                                            secondary={post.secondaryMuscles}
                                            showToggle={false}
                                        />
                                        <div className="flex flex-wrap gap-1 justify-center px-4 mt-1">
                                            {(post.musclesWorked || []).map(m => (
                                                <span key={m} className="text-[9px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded uppercase">{m}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {slide === 'exercises' && (
                                    <div className="h-72 bg-black/40 px-4 py-3 overflow-y-auto no-scrollbar">
                                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Ejercicios</p>
                                        <div className="space-y-1.5">
                                            {(post.exercises || []).map((ex, idx) => (
                                                <div key={idx} className="bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px] font-black text-white uppercase truncate pr-2">{ex.name}</span>
                                                        <span className="text-[9px] font-bold text-zinc-500 shrink-0">{(ex.sets || []).length} {(ex.sets || []).length === 1 ? 'serie' : 'series'}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(ex.sets || []).map((s, j) => (
                                                            <span key={j} className="text-[9px] font-bold text-zinc-400 bg-black px-1.5 py-0.5 rounded border border-white/5">
                                                                {s.weight > 0 ? `${s.weight}kg × ${s.reps}` : `${s.reps} reps`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Puntitos de posición */}
                    {slides.length > 1 && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm">
                            {slides.map((_, i) => (
                                <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === slideIndex ? 'bg-white w-3' : 'bg-white/40'}`} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* CUERPO */}
            <div className="px-4 py-3">
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
