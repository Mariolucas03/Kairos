import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    Dumbbell, Utensils, ScrollText, Loader2, ChevronDown,
    Flame, Shield, Lock, Pencil, Check, UserPlus, PersonStanding, X
} from 'lucide-react';
import api from '../../services/api';
import BackButton from '../../components/common/BackButton';
import WorkoutPostCard from '../../components/social/WorkoutPostCard';
import BodyMap from '../../components/body/BodyMap';
import { getLevelStyle, customAnimationsStyle } from '../../utils/socialHelpers';

const fetcher = (url) => api.get(url).then(res => res.data);

const TABS = [
    { key: 'workouts', label: 'Entrenos', icon: Dumbbell },
    { key: 'food', label: 'Comida', icon: Utensils },
    { key: 'missions', label: 'Misiones', icon: ScrollText },
    { key: 'body', label: 'Cuerpo', icon: PersonStanding }
];

// --- PESTAÑA CUERPO: mapa + nivel de cada grupo muscular ---
function BodyTab({ ranks }) {
    if (!ranks) return null;

    // De mayor a menor nivel, para que se vea arriba lo más entrenado
    const ordenados = Object.entries(ranks).sort((a, b) => b[1].points - a[1].points);
    const conActividad = ordenados.filter(([, r]) => r.points > 0);

    return (
        <div className="pb-4">
            {/* Frente y espalda a la vez, sin tener que girar nada */}
            <div className="bg-zinc-950 border border-white/5 rounded-[24px] p-4 mb-4">
                <BodyMap levels={ranks} dual />
            </div>

            {conActividad.length === 0 && (
                <div className="text-center py-8 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl mb-4">
                    <p className="text-xs">Todavía no hay entrenos registrados.</p>
                    <p className="text-[10px] mt-1">Los músculos suben de rango con los kilos acumulados.</p>
                </div>
            )}

            <div className="space-y-2">
                {ordenados.map(([grupo, r]) => (
                    <div key={grupo} className="bg-zinc-950 border border-white/5 rounded-2xl p-3">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.points ? r.rankColor : '#3f3f46' }} />
                                <span className="text-xs font-black text-white uppercase truncate">{grupo}</span>
                            </div>
                            <span
                                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border shrink-0"
                                style={{ color: r.rankColor, borderColor: `${r.rankColor}55`, backgroundColor: `${r.rankColor}15` }}
                            >
                                {r.rankLabel}
                            </span>
                        </div>

                        <div className="h-1.5 bg-black rounded-full overflow-hidden border border-white/10">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${r.progress}%`, backgroundColor: r.rankColor }}
                            />
                        </div>

                        <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[9px] text-zinc-600 font-bold">
                                {r.volume >= 1000 ? `${Math.round(r.volume / 1000)}k` : r.volume} kg·rep · {r.weeks} {r.weeks === 1 ? 'semana' : 'semanas'}
                            </span>
                            <span className="text-[9px] text-zinc-600 font-bold">
                                {r.nextRankLabel ? `${r.progress}% → ${r.nextRankLabel}` : 'Máximo'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const formatDate = (dateStr) =>
    new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

// --- TARJETA DE DÍA DE COMIDA ---
function FoodDayCard({ item }) {
    return (
        <div className="bg-zinc-950 border border-white/5 rounded-[24px] p-4 mb-3">
            <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{formatDate(item.date)}</span>
                <div className="flex items-center gap-1.5">
                    <Flame size={14} className="text-orange-500" />
                    <span className="text-lg font-black text-white leading-none">{item.totalCalories.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase">kcal</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                    { label: 'Prot', value: item.totalProtein, color: 'text-red-400' },
                    { label: 'Carbs', value: item.totalCarbs, color: 'text-blue-400' },
                    { label: 'Grasa', value: item.totalFat, color: 'text-yellow-400' }
                ].map(m => (
                    <div key={m.label} className="bg-black/50 rounded-xl py-2 text-center border border-white/5">
                        <div className={`text-sm font-black ${m.color}`}>{m.value}g</div>
                        <div className="text-[8px] font-bold text-zinc-600 uppercase">{m.label}</div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
                {item.meals.map((meal, i) => (
                    <span key={i} className="text-[9px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-1 rounded-lg uppercase">
                        {meal.name} · {meal.calories} kcal
                    </span>
                ))}
            </div>
        </div>
    );
}

// --- TARJETA DE DÍA DE MISIONES ---
function MissionDayCard({ item }) {
    return (
        <div className="bg-zinc-950 border border-white/5 rounded-[24px] p-4 mb-3">
            <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{formatDate(item.date)}</span>
                <span className="text-xs font-black text-green-400">
                    {item.completed}<span className="text-zinc-600"> / {Math.max(item.total, item.completed)}</span>
                </span>
            </div>
            <div className="space-y-1.5">
                {item.list.length === 0 && <p className="text-[10px] text-zinc-600 italic">Sin detalle guardado.</p>}
                {item.list.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-black/50 rounded-xl px-3 py-2 border border-white/5">
                        <span className="text-[11px] font-bold text-zinc-300 truncate pr-2">{m.title}</span>
                        <span className="text-[9px] font-black text-purple-400 shrink-0">+{m.xpReward || 0} XP</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ==========================================
// CUADRÍCULA ESTILO INSTAGRAM
// Cuadros pequeños con lo justo para reconocer cada cosa de un vistazo;
// el detalle completo se abre al tocarlos. Antes cada entrada era una tarjeta
// enorme y había que hacer scroll eterno para ver tres entrenos.
// ==========================================
function CuadroEntreno({ item, onOpen }) {
    const musculos = item.musclesWorked || [];
    return (
        <button onClick={onOpen} className="relative aspect-square bg-black border border-white/5 overflow-hidden active:opacity-70 transition-opacity">
            {item.photo ? (
                <img src={item.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : musculos.length > 0 ? (
                <div className="absolute inset-0 p-1 pb-4">
                    <BodyMap highlight={musculos} secondary={item.secondaryMuscles} showToggle={false} dual labels={false} className="h-full" />
                </div>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Dumbbell size={26} className="text-zinc-800" />
                </div>
            )}

            {/* Nombre de la rutina siempre legible, sobre un degradado */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-1.5 pt-4 pb-1.5">
                <p className="text-[9px] font-black text-white uppercase leading-tight line-clamp-2 text-left">{item.routineName}</p>
            </div>

            {(item.records || []).length > 0 && (
                <span className="absolute top-1 right-1 bg-yellow-500 text-black text-[7px] font-black px-1 py-0.5 rounded uppercase">PR</span>
            )}
        </button>
    );
}

function CuadroComida({ item, onOpen }) {
    return (
        <button onClick={onOpen} className="relative aspect-square bg-zinc-950 border border-white/5 flex flex-col items-center justify-center active:opacity-70 transition-opacity px-1">
            <Flame size={16} className="text-orange-500 mb-1" />
            <span className="text-xl font-black text-white leading-none">{(item.totalCalories || 0).toLocaleString('es-ES')}</span>
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">kcal</span>
            <span className="absolute bottom-1.5 text-[8px] font-bold text-zinc-600 uppercase">{formatDate(item.date)}</span>
        </button>
    );
}

function CuadroMisiones({ item, onOpen }) {
    const total = Math.max(item.total || 0, item.completed || 0, 1);
    const pct = Math.round(((item.completed || 0) / total) * 100);
    return (
        <button onClick={onOpen} className="relative aspect-square bg-zinc-950 border border-white/5 flex flex-col items-center justify-center active:opacity-70 transition-opacity px-2">
            <span className="text-xl font-black text-white leading-none">
                {item.completed}<span className="text-zinc-600 text-sm">/{total}</span>
            </span>
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">misiones</span>
            <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-white/5 mt-2">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="absolute bottom-1.5 text-[8px] font-bold text-zinc-600 uppercase">{formatDate(item.date)}</span>
        </button>
    );
}

// Detalle a pantalla completa al tocar un cuadro
function DetalleModal({ children, onClose }) {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-150">
            <div className="flex justify-end p-3 shrink-0 safe-top">
                <button onClick={onClose} className="bg-zinc-900 border border-white/10 p-2.5 rounded-full text-zinc-300 active:scale-90 transition-transform">
                    <X size={20} />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-10 custom-scrollbar">
                {children}
            </div>
        </div>
    );
}

export default function UserProfilePage() {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [tab, setTab] = useState('workouts');
    // Cuadro abierto a pantalla completa (null = solo la rejilla)
    const [detalle, setDetalle] = useState(null);

    const { data: profileData, error: profileError, isLoading: loadingProfile } =
        useSWR(userId ? `/social/profile/${userId}` : null, fetcher);

    // Solo pedimos el contenido si tenemos permiso: en una cuenta privada ajena
    // esta petición daría 403 y llenaría la consola de errores.
    const puedeVer = profileData ? profileData.canViewContent !== false : false;
    const { data: itemsData, isLoading: loadingItems } =
        useSWR(userId && puedeVer ? `/social/profile/${userId}/items?tab=${tab}&page=1` : null, fetcher);

    // Paginación local por pestaña
    const [extraItems, setExtraItems] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [sendingRequest, setSendingRequest] = useState(false);
    const [requestFeedback, setRequestFeedback] = useState(null);

    // Al cambiar de pestaña (o de usuario) reiniciamos la paginación acumulada
    useEffect(() => {
        setExtraItems([]);
        setPage(1);
        setHasMore(false);
    }, [tab, userId]);

    useEffect(() => { if (itemsData) setHasMore(itemsData.hasMore); }, [itemsData]);

    const items = [...(itemsData?.items || []), ...extraItems];

    const loadMore = async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const res = await api.get(`/social/profile/${userId}/items?tab=${tab}&page=${nextPage}`);
            setExtraItems(prev => [...prev, ...res.data.items]);
            setHasMore(res.data.hasMore);
            setPage(nextPage);
        } catch (e) { } finally { setLoadingMore(false); }
    };

    // --- ESTADOS DE CARGA / ERROR ---
    if (profileError) {
        const denied = profileError.response?.status === 403;
        return (
            <div className="min-h-screen bg-black pt-6 px-4 pb-24">
                <div className="mb-8"><BackButton /></div>
                <div className="text-center py-20 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
                    <Lock className="mx-auto mb-3 opacity-50" size={32} />
                    <p className="text-xs px-6">
                        {denied ? 'Solo puedes ver el perfil de tus amigos.' : 'No se pudo cargar este perfil.'}
                    </p>
                </div>
            </div>
        );
    }

    if (!profileData && loadingProfile) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-yellow-500" size={32} />
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Cargando perfil...</p>
            </div>
        );
    }

    const profile = profileData?.profile || {};
    const counts = profileData?.counts || { workouts: 0, followers: 0, following: 0 };
    const level = profile.level || 1;
    const xpPercent = Math.min(((profile.currentXP || 0) / (profile.nextLevelXP || 100)) * 100, 100);

    const isMe = !!profileData?.isMe;
    const isFriend = !!profileData?.isFriend;
    const requestSent = !!profileData?.requestSent;
    // Si la cuenta es privada y no somos amigos, la cabecera se ve pero el
    // contenido no (el backend además lo bloquea con 403).
    const canViewContent = profileData ? profileData.canViewContent !== false : true;

    const handleSendRequest = async () => {
        if (sendingRequest) return;
        setSendingRequest(true);
        try {
            await api.post('/social/request', { targetId: userId });
            setRequestFeedback('sent');
        } catch (e) {
            setRequestFeedback(e.response?.data?.message || 'No se pudo enviar');
        } finally {
            setSendingRequest(false);
        }
    };

    const STATS = [
        { label: 'Entrenos', value: counts.workouts },
        { label: 'Seguidores', value: counts.followers },
        { label: 'Seguidos', value: counts.following }
    ];

    return (
        <div className="min-h-screen bg-black pb-24 pt-6 px-4 animate-in fade-in select-none">
            <style>{customAnimationsStyle}</style>

            {/* --- BARRA SUPERIOR --- */}
            <div className="flex items-center gap-3 mb-6">
                <BackButton />
                <h1 className="text-lg font-black text-white uppercase tracking-tight truncate">{profile.username}</h1>
            </div>

            {/* --- CABECERA ESTILO IG: avatar a la izquierda, contadores a la derecha --- */}
            <div className="flex items-center gap-5 mb-5">
                <div className="relative shrink-0">
                    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-2xl font-black text-zinc-500 border-2 border-zinc-800 overflow-hidden">
                        {profile.avatar
                            ? <img src={profile.avatar} className="w-full h-full object-cover" alt="avatar" />
                            : profile.username?.charAt(0).toUpperCase()}
                    </div>
                    {profile.frame && <img src={profile.frame} className="absolute -top-3 -left-3 w-[104px] h-[104px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                    {profile.pet && <img src={profile.pet} className="absolute -bottom-1 -right-1 w-7 h-7 object-contain z-30 drop-shadow-md" />}
                </div>

                <div className="flex-1 grid grid-cols-3 gap-1">
                    {STATS.map(s => (
                        <div key={s.label} className="text-center">
                            <div className="text-lg font-black text-white leading-none">{s.value.toLocaleString()}</div>
                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- INFO / NIVEL / XP --- */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-black text-white uppercase">{profile.username}</span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${getLevelStyle(level)}`}>Lvl {level}</span>
                    {profile.clan && (
                        <span className="text-[9px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <Shield size={9} /> {profile.clan.icon} {profile.clan.name}
                        </span>
                    )}
                </div>
                <p className="text-[10px] text-yellow-500/80 italic font-bold tracking-wider uppercase mb-1">{profile.title || 'Novato'}</p>

                {/* Descripción del perfil */}
                {profile.bio && (
                    <p className="text-xs text-zinc-300 leading-snug whitespace-pre-line mb-2">{profile.bio}</p>
                )}
                {profile.streak?.current > 0 && (
                    <p className="text-[10px] text-orange-400 font-bold flex items-center gap-1 mb-2">
                        <Flame size={11} /> {profile.streak.current} {profile.streak.current === 1 ? 'día' : 'días'} de racha
                    </p>
                )}

                <div className="relative w-full h-2 bg-zinc-900 rounded-full border border-zinc-800 overflow-hidden mt-2">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all duration-500" style={{ width: `${xpPercent}%` }} />
                </div>
                <p className="text-[9px] text-zinc-600 font-bold mt-1 text-right">{profile.currentXP || 0}/{profile.nextLevelXP || 100} XP</p>

                {/* --- ACCIÓN PRINCIPAL (como el botón Seguir/Editar de IG) --- */}
                <div className="mt-4">
                    {isMe ? (
                        <button
                            onClick={() => navigate('/settings')}
                            className="w-full py-2.5 bg-zinc-900 border border-zinc-700 text-white font-black text-xs uppercase tracking-widest rounded-xl active:scale-95 transition-transform hover:bg-zinc-800 flex items-center justify-center gap-2"
                        >
                            <Pencil size={14} /> Editar perfil
                        </button>
                    ) : isFriend ? (
                        <div className="w-full py-2.5 bg-green-900/20 border border-green-500/30 text-green-500 font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2">
                            <Check size={14} /> Sois amigos
                        </div>
                    ) : (requestSent || requestFeedback === 'sent') ? (
                        <div className="w-full py-2.5 bg-zinc-900 border border-zinc-700 text-zinc-400 font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2">
                            <Check size={14} /> Solicitud enviada
                        </div>
                    ) : (
                        <button
                            onClick={handleSendRequest}
                            disabled={sendingRequest}
                            className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-widest rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {sendingRequest ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                            Enviar solicitud
                        </button>
                    )}
                    {requestFeedback && requestFeedback !== 'sent' && (
                        <p className="text-[10px] text-red-400 font-bold text-center mt-2">{requestFeedback}</p>
                    )}
                </div>
            </div>

            {/* --- PESTAÑAS ESTILO IG ---
                Solo salen las secciones que esta persona ha decidido enseñar
                (en Ajustes). Si tiene la comida apagada, esa pestaña no existe. */}
            <div className="flex border-t border-white/10 -mx-4 mb-4 sticky top-0 bg-black/95 backdrop-blur-md z-20">
                {TABS.filter(t => profile.visibility ? profile.visibility[t.key] !== false : true)
                    .map(({ key, label, icon: Icon }) => {
                        const active = tab === key;
                        return (
                            <button
                                key={key}
                                onClick={() => { if (canViewContent) { setTab(key); setDetalle(null); } }}
                                disabled={!canViewContent}
                                className={`flex-1 py-3.5 flex flex-col items-center gap-1 relative transition-colors ${!canViewContent ? 'text-zinc-800 cursor-default' : active ? 'text-yellow-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                                <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
                                {active && canViewContent && <div className="absolute top-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                            </button>
                        );
                    })}
            </div>

            {/* --- CUENTA PRIVADA: se ve quién es, pero no su contenido --- */}
            {!canViewContent ? (
                <div className="text-center py-14 px-6 border-2 border-dashed border-zinc-900 rounded-3xl">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                        <Lock className="text-zinc-500" size={26} />
                    </div>
                    <h3 className="text-white font-black uppercase text-sm mb-2">Esta cuenta es privada</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed max-w-[240px] mx-auto">
                        Hazte amigo de <span className="text-zinc-300 font-bold">{profile.username}</span> para ver sus entrenos, comidas y misiones.
                    </p>
                </div>
            ) : loadingItems && !itemsData ? (
                <div className="text-center py-16 text-zinc-500 animate-pulse uppercase text-xs font-bold">Cargando...</div>
            ) : tab === 'body' ? (
                <BodyTab ranks={itemsData?.ranks} />
            ) : items.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
                    {tab === 'workouts' && <><Dumbbell className="mx-auto mb-3 opacity-50" size={32} /><p className="text-xs">Sin entrenos publicados.</p></>}
                    {tab === 'food' && <><Utensils className="mx-auto mb-3 opacity-50" size={32} /><p className="text-xs">Sin comidas registradas.</p></>}
                    {tab === 'missions' && <><ScrollText className="mx-auto mb-3 opacity-50" size={32} /><p className="text-xs">Sin misiones completadas.</p></>}
                </div>
            ) : (
                <>
                    {/* Rejilla de 3 columnas a sangre, como el perfil de Instagram */}
                    <div className="grid grid-cols-3 gap-[2px] -mx-4">
                        {items.map(item => (
                            tab === 'workouts' ? <CuadroEntreno key={item._id} item={item} onOpen={() => setDetalle(item)} />
                                : tab === 'food' ? <CuadroComida key={item._id} item={item} onOpen={() => setDetalle(item)} />
                                    : <CuadroMisiones key={item._id} item={item} onOpen={() => setDetalle(item)} />
                        ))}
                    </div>

                    {hasMore && (
                        <button onClick={loadMore} disabled={loadingMore} className="w-full mt-3 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                            Cargar más
                        </button>
                    )}
                </>
            )}

            {/* Detalle completo del cuadro que hayas tocado */}
            {detalle && (
                <DetalleModal onClose={() => setDetalle(null)}>
                    {tab === 'workouts' && <WorkoutPostCard post={detalle} linkProfile={false} />}
                    {tab === 'food' && <FoodDayCard item={detalle} />}
                    {tab === 'missions' && <MissionDayCard item={detalle} />}
                </DetalleModal>
            )}
        </div>
    );
}
