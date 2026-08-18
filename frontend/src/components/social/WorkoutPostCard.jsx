import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BodyMap from '../body/BodyMap';
import ZoomableImage from './ZoomableImage';
import { Heart, MessageCircle, Dumbbell, Activity, MapPin, Timer, Flame, Send, Loader2, Trophy } from 'lucide-react';
import api from '../../services/api';
import { getLevelStyle } from '../../utils/socialHelpers';

// --- HELPER: TIEMPO RELATIVO ---
// Hasta una semana se cuenta en relativo ("hace 3 h"); a partir de ahí se pone
// la fecha, como en Instagram, porque "hace 43 d" no le dice nada a nadie.
const timeAgo = (dateStr) => {
    const fecha = new Date(dateStr);
    const mins = Math.floor((Date.now() - fecha.getTime()) / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins} min`;
    const horas = Math.floor(mins / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias < 7) return `hace ${dias} d`;

    const mismoAño = fecha.getFullYear() === new Date().getFullYear();
    return fecha.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        ...(mismoAño ? {} : { year: 'numeric' })
    });
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
    const records = post.records || [];

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

    // Diapositivas del carrusel: solo las que tienen contenido.
    // Si no hay foto, el cuerpo se enseña igual aunque no haya músculos guardados:
    // así la publicación nunca se queda sin nada que mirar.
    const slides = [
        post.photo ? 'photo' : null,
        ((post.musclesWorked || []).length > 0 || !post.photo) ? 'body' : null,
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
        // Publicación a sangre, sin marco ni esquinas: ocupa todo el ancho de la
        // pantalla. Entre una y otra queda una banda oscura rematada por una
        // línea clara, para que se vea de un vistazo dónde acaba cada una.
        <article className="-mx-4 pb-4 mb-4 border-b-4 border-white/20">
            {/* CABECERA */}
            <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={openProfile} disabled={!linkProfile} className="relative flex-shrink-0 active:scale-95 transition-transform disabled:cursor-default">
                    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-xs font-black text-zinc-600 border border-white/10 overflow-hidden">
                        {author.avatar ? <img src={author.avatar} className="w-full h-full object-cover" alt="av" /> : author.username?.charAt(0)}
                    </div>
                    {author.frame && <img src={author.frame} className="absolute -top-1.5 -left-1.5 w-[52px] h-[52px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                </button>

                <div className="flex-1 min-w-0">
                    <button onClick={openProfile} disabled={!linkProfile} className="text-white font-black text-sm uppercase tracking-tight truncate block disabled:cursor-default">
                        {author.username}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${levelClass}`}>Lvl {author.level}</span>
                        <span className="text-[9px] text-zinc-500 font-bold">{timeAgo(post.date)}</span>
                    </div>
                </div>

                <div className={`p-2 rounded-xl ${isGym ? 'bg-yellow-500/10 text-yellow-500' : 'bg-lime-500/10 text-lime-400'} border border-white/5`}>
                    {isGym ? <Dumbbell size={16} /> : <Activity size={16} />}
                </div>
            </div>

            {/* TITULAR DEL ENTRENO: va ENCIMA de la imagen porque no es un pie de
                foto, es de qué va la publicación; así se sabe qué estás mirando
                antes de mirarlo. */}
            <div className="px-4 pb-3">
                <h4 className="text-white font-black text-lg not-italic uppercase tracking-tighter leading-tight">{post.routineName}</h4>
                <div className="flex items-center gap-4 text-zinc-400 mt-1">
                    <span className="flex items-center gap-1 text-xs font-bold"><Timer size={12} className="text-blue-400" /> {durationMin} min</span>
                    <span className="flex items-center gap-1 text-xs font-bold"><Flame size={12} className="text-orange-500" /> {Math.round(post.caloriesBurned || 0)} kcal</span>
                    {isGym
                        ? <span className="flex items-center gap-1 text-xs font-bold"><Dumbbell size={12} className="text-yellow-500" /> {post.exercises?.length || 0} ejerc.</span>
                        : post.distance > 0 && <span className="flex items-center gap-1 text-xs font-bold"><MapPin size={12} className="text-cyan-400" /> {post.distance} km</span>
                    }
                </div>
            </div>

            {/* --- CARRUSEL (foto · cuerpo · ejercicios) --- */}
            {slides.length > 0 && (
                <div className="relative">
                    <div
                        ref={carruselRef}
                        onScroll={handleCarouselScroll}
                        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
                    >
                        {slides.map((slide, i) => (
                            // Formato cuadrado y a pantalla completa, como una publicación de IG
                            <div key={i} className="min-w-full aspect-square snap-center relative">
                                {slide === 'photo' && (
                                    <ZoomableImage src={post.photo} alt="Foto del entreno" />
                                )}

                                {slide === 'body' && (
                                    // Fija: ni scroll ni giro, se ven las dos caras a la vez
                                    <div className="w-full h-full bg-black flex flex-col items-center justify-center px-2 overflow-hidden">
                                        <BodyMap
                                            highlight={post.musclesWorked}
                                            secondary={post.secondaryMuscles}
                                            showToggle={false}
                                            dual
                                            className="flex-1 min-h-0 py-2"
                                        />
                                        {/* pb-8: deja libre la franja de abajo, donde van
                                            los puntitos del carrusel (se pisaban) */}
                                        <div className="flex flex-wrap gap-1 justify-center px-4 pb-8">
                                            {(post.musclesWorked || []).map(m => (
                                                <span key={m} className="text-[9px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded uppercase">{m}</span>
                                            ))}
                                            {(post.secondaryMuscles || []).map(m => (
                                                <span key={m} className="text-[9px] font-bold bg-white/5 text-zinc-500 border border-white/10 px-2 py-0.5 rounded uppercase">{m}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {slide === 'exercises' && (
                                    // La única diapositiva que se desplaza en vertical
                                    <div className="w-full h-full bg-black px-4 py-3 overflow-y-auto custom-scrollbar">
                                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Ejercicios</p>
                                        <div className="space-y-1.5">
                                            {(post.exercises || []).map((ex, idx) => {
                                                const record = records.find(r => r.name === ex.name);
                                                return (
                                                    // El ejercicio con récord va en ORO y se nota: borde dorado,
                                                    // fondo cálido y halo alrededor del recuadro.
                                                    <div
                                                        key={idx}
                                                        className={`rounded-xl px-3 py-2 ${record
                                                            ? 'border-2 border-yellow-500 bg-yellow-500/[0.08]'
                                                            : 'border border-white/5 bg-zinc-900/60'}`}
                                                    >
                                                        <div className="flex items-center justify-between mb-1 gap-2">
                                                            <span className={`text-[11px] font-black uppercase truncate ${record ? 'text-yellow-400' : 'text-white'}`}>{ex.name}</span>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {record && (
                                                                    <span className="flex items-center gap-0.5 text-[8px] font-black text-black bg-yellow-500 px-1.5 py-0.5 rounded uppercase">
                                                                        <Trophy size={8} /> PR
                                                                    </span>
                                                                )}
                                                                <span className="text-[9px] font-bold text-zinc-500">{(ex.sets || []).length} {(ex.sets || []).length === 1 ? 'serie' : 'series'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {(ex.sets || []).map((s, j) => (
                                                                <span key={j} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${s.type === 'D' ? 'text-purple-300 bg-purple-500/10 border-purple-500/30' : 'text-zinc-400 bg-black border-white/5'}`}>
                                                                    {s.weight > 0 ? `${s.weight}kg × ${s.reps}` : `${s.reps} reps`}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {record && (
                                                            <p className="text-[9px] font-bold text-yellow-500 mt-1.5">
                                                                Récord personal: {record.weight} kg
                                                                {record.previous > 0 && <span className="text-zinc-500"> (antes {record.previous} kg, +{Math.round((record.weight - record.previous) * 10) / 10})</span>}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* 🏆 Cinta de récord, encima de la diapositiva */}
                    {records.length > 0 && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-yellow-500 text-black px-2.5 py-1 rounded-full shadow-lg pointer-events-none">
                            <Trophy size={11} />
                            <span className="text-[9px] font-black uppercase tracking-widest">
                                {records.length === 1 ? 'Récord personal' : `${records.length} récords`}
                            </span>
                        </div>
                    )}

                    {/* Puntitos de posición */}
                    {slides.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm pointer-events-none">
                            {slides.map((_, i) => (
                                <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === slideIndex ? 'bg-white w-3' : 'bg-white/40'}`} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ACCIONES */}
            <div className="flex items-center gap-5 px-4 pt-3">
                <button onClick={handleLike} className="flex items-center gap-1.5 active:scale-90 transition-transform">
                    <Heart size={24} className={liked ? 'text-red-500 fill-red-500' : 'text-white'} />
                    <span className={`text-xs font-black ${liked ? 'text-red-500' : 'text-zinc-400'}`}>{likesCount}</span>
                </button>
                <button onClick={() => setShowComments(s => !s)} className="flex items-center gap-1.5 active:scale-90 transition-transform">
                    <MessageCircle size={24} className={showComments ? 'text-blue-400' : 'text-white'} />
                    <span className={`text-xs font-black ${showComments ? 'text-blue-400' : 'text-zinc-400'}`}>{comments.length}</span>
                </button>
            </div>

            {/* COMENTARIOS (DESPLEGABLE) */}
            {showComments && (
                <div className="px-4 pt-3 space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                    {comments.length === 0 && <p className="text-[10px] text-zinc-600 not-italic">Sé el primero en comentar.</p>}
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
        </article>
    );
}
