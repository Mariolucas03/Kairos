import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    ChevronLeft, Dumbbell, Utensils, ScrollText, Loader2, ChevronDown,
    Flame, Shield, Lock
} from 'lucide-react';
import api from '../../services/api';
import WorkoutPostCard from '../../components/social/WorkoutPostCard';
import { getLevelStyle, customAnimationsStyle } from '../../utils/socialHelpers';

const fetcher = (url) => api.get(url).then(res => res.data);

const TABS = [
    { key: 'workouts', label: 'Entrenos', icon: Dumbbell },
    { key: 'food', label: 'Comida', icon: Utensils },
    { key: 'missions', label: 'Misiones', icon: ScrollText }
];

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

export default function UserProfilePage() {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [tab, setTab] = useState('workouts');

    const { data: profileData, error: profileError, isLoading: loadingProfile } =
        useSWR(userId ? `/social/profile/${userId}` : null, fetcher);

    const { data: itemsData, isLoading: loadingItems } =
        useSWR(userId ? `/social/profile/${userId}/items?tab=${tab}&page=1` : null, fetcher);

    // Paginación local por pestaña
    const [extraItems, setExtraItems] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

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
                <button onClick={() => navigate(-1)} className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-2xl text-zinc-400 mb-8"><ChevronLeft size={20} /></button>
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
                <button onClick={() => navigate(-1)} className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-2xl text-zinc-400 hover:text-white active:scale-95 transition-all shrink-0">
                    <ChevronLeft size={20} />
                </button>
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
                {profile.streak?.current > 0 && (
                    <p className="text-[10px] text-orange-400 font-bold flex items-center gap-1 mb-2">
                        <Flame size={11} /> {profile.streak.current} días de racha
                    </p>
                )}

                <div className="relative w-full h-2 bg-zinc-900 rounded-full border border-zinc-800 overflow-hidden mt-2">
                    <div className="h-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all duration-500" style={{ width: `${xpPercent}%` }} />
                </div>
                <p className="text-[9px] text-zinc-600 font-bold mt-1 text-right">{profile.currentXP || 0}/{profile.nextLevelXP || 100} XP</p>
            </div>

            {/* --- PESTAÑAS ESTILO IG --- */}
            <div className="flex border-t border-white/10 -mx-4 mb-4 sticky top-0 bg-black/95 backdrop-blur-md z-20">
                {TABS.map(({ key, label, icon: Icon }) => {
                    const active = tab === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`flex-1 py-3.5 flex flex-col items-center gap-1 relative transition-colors ${active ? 'text-yellow-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                            <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
                            {active && <div className="absolute top-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                        </button>
                    );
                })}
            </div>

            {/* --- CONTENIDO DE LA PESTAÑA --- */}
            {loadingItems && !itemsData ? (
                <div className="text-center py-16 text-zinc-500 animate-pulse uppercase text-xs font-bold">Cargando...</div>
            ) : items.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
                    {tab === 'workouts' && <><Dumbbell className="mx-auto mb-3 opacity-50" size={32} /><p className="text-xs">Sin entrenos publicados.</p></>}
                    {tab === 'food' && <><Utensils className="mx-auto mb-3 opacity-50" size={32} /><p className="text-xs">Sin comidas registradas.</p></>}
                    {tab === 'missions' && <><ScrollText className="mx-auto mb-3 opacity-50" size={32} /><p className="text-xs">Sin misiones completadas.</p></>}
                </div>
            ) : (
                <>
                    {tab === 'workouts' && items.map(item => (
                        <WorkoutPostCard key={item._id} post={item} linkProfile={false} />
                    ))}
                    {tab === 'food' && items.map(item => <FoodDayCard key={item._id} item={item} />)}
                    {tab === 'missions' && items.map(item => <MissionDayCard key={item._id} item={item} />)}

                    {hasMore && (
                        <button onClick={loadMore} disabled={loadingMore} className="w-full py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                            Cargar más
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
