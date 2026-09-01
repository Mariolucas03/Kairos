import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    Mail, Shield, Users, Search, Trophy, X, Loader2, ChevronDown, Rss, Dumbbell, UserPlus,
    WifiOff, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';
import LoadingScreen from '../components/common/LoadingScreen';
import { useAuthStore } from '../store/useAuthStore';
import WorkoutPostCard from '../components/social/WorkoutPostCard';
import InboxModal from '../components/social/InboxModal';
import useSocialBadge from '../hooks/useSocialBadge';
import { customAnimationsStyle } from '../utils/socialHelpers';

const fetcher = (url) => api.get(url).then(res => res.data);

// ==========================================
// FEED SOCIAL — pantalla principal de la sección
// Ranking / Amigos / Clanes viven en sus propias páginas
// ==========================================
export default function Social() {
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const navigate = useNavigate();

    const { data: feedData, error: feedError, mutate: mutateFeed, isLoading: loadingFeed } = useSWR('/social/feed?page=1', fetcher);
    const { data: friendsData, error: friendsError, mutate: mutateFriends, isLoading: loadingFriends } = useSWR('/social/friends', fetcher);
    // Avisos de me gusta / comentarios. Se refrescan solos cada minuto para que
    // el contador del buzón no se quede obsoleto mientras navegas.
    const { data: notifData, mutate: mutateNotifs } = useSWR('/social/notifications', fetcher, { refreshInterval: 60000 });

    const friends = friendsData?.friends || [];
    const requests = friendsData?.requests || [];
    const missionInvites = user?.missionRequests || [];

    // Retos a Carta Alta pendientes de contestar. Se piden aparte porque no
    // viven en el usuario: son partidas.
    const { data: retosCartas, mutate: recargarRetos } = useSWR('/carta-alta/invitaciones', fetcher);

    const handleRespondReto = async (partidaId, respuesta) => {
        try {
            await api.post(`/carta-alta/${partidaId}/responder`, { respuesta });
            recargarRetos();
            if (respuesta === 'aceptar') navigate('/games/carta-alta');
        } catch (e) {
            console.error('No se pudo responder al reto', e);
        }
    };
    const notifications = notifData?.items || [];
    const unreadNotifs = notifData?.unread || 0;

    // Mismo contador que el punto rojo del footer, para que no se contradigan
    const { total: totalNotifications, refreshBadge } = useSocialBadge();

    // Al abrir el buzón damos por leídas las notificaciones de actividad
    const openInbox = async () => {
        setShowInbox(true);
        if (unreadNotifs > 0) {
            try {
                await api.post('/social/notifications/read');
                mutateNotifs();
                refreshBadge();
            } catch (e) { /* si falla, se reintenta al siguiente refresco */ }
        }
    };

    const [toast, setToast] = useState(null);
    const [showInbox, setShowInbox] = useState(false);

    // --- BÚSQUEDA EXPANDIBLE (la lupa se "estira" en un campo de texto) ---
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef(null);

    useEffect(() => {
        if (searchOpen) searchInputRef.current?.focus();
    }, [searchOpen]);

    useEffect(() => {
        const t = setTimeout(async () => {
            if (searchText.trim().length > 0) {
                setIsSearching(true);
                try {
                    const res = await api.get(`/social/search?q=${encodeURIComponent(searchText)}`);
                    setSearchResults(res.data);
                } catch (e) { } finally { setIsSearching(false); }
            } else {
                setSearchResults([]);
            }
        }, 400);
        return () => clearTimeout(t);
    }, [searchText]);

    const closeSearch = () => { setSearchOpen(false); setSearchText(''); setSearchResults([]); };

    // --- FEED PAGINADO (página 1 vía SWR, siguientes acumuladas en local) ---
    const [feedExtra, setFeedExtra] = useState([]);
    const [feedPage, setFeedPage] = useState(1);
    const [feedHasMore, setFeedHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => { if (feedData) setFeedHasMore(feedData.hasMore); }, [feedData]);

    const feedItems = [...(feedData?.items || []), ...feedExtra];

    const loadMoreFeed = async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        try {
            const nextPage = feedPage + 1;
            const res = await api.get(`/social/feed?page=${nextPage}`);
            setFeedExtra(prev => [...prev, ...res.data.items]);
            setFeedHasMore(res.data.hasMore);
            setFeedPage(nextPage);
        } catch (e) { } finally { setLoadingMore(false); }
    };

    const handleSendRequest = async (targetId) => {
        try {
            await api.post('/social/request', { targetId });
            setToast({ message: 'Solicitud enviada', type: 'success' });
            setSearchResults(prev => prev.filter(u => u._id !== targetId));
        } catch (e) {
            setToast({ message: e.response?.data?.message || 'No se pudo enviar', type: 'error' });
        }
    };

    const handleRespondFriend = async (rid, action) => {
        mutateFriends(prev => ({ ...prev, requests: (prev?.requests || []).filter(r => r._id !== rid) }), false);
        try {
            await api.post('/social/respond', { requesterId: rid, action });
            mutateFriends();
            refreshBadge();
            if (action === 'accept') mutateFeed();
        } catch (e) {
            mutateFriends();
            setToast({ message: 'No se pudo procesar la solicitud', type: 'error' });
        }
    };

    const handleRespondMission = async (mid, action) => {
        try {
            await api.post('/missions/respond', { missionId: mid, action });
            setUser({ ...user, missionRequests: (user.missionRequests || []).filter(m => m._id !== mid) });
            refreshBadge();
            setToast({ message: 'Hecho', type: 'success' });
        } catch (e) {
            setToast({ message: 'No se pudo procesar la invitación', type: 'error' });
        }
    };

    // Orden por alcance, de lo más cercano a lo más amplio: buscas gente →
    // tus amigos → tu clan → el ranking global. El buzón queda el último,
    // separado, porque es el único que lleva el punto rojo (como en IG).
    const ACTIONS = [
        { key: 'search', icon: Search, label: 'Buscar', onClick: () => setSearchOpen(true) },
        { key: 'friends', icon: Users, label: 'Amigos', onClick: () => navigate('/social/friends') },
        { key: 'clan', icon: Shield, label: 'Clan', onClick: () => navigate('/social/clans') },
        { key: 'ranking', icon: Trophy, label: 'Ranking', onClick: () => navigate('/social/ranking') },
        { key: 'inbox', icon: Mail, label: 'Buzón', onClick: openInbox, badge: totalNotifications }
    ];

    // ⚠️ Antes esto solo miraba el feed. La lista de amigos viene de OTRA petición
    // y su carga no se comprobaba: mientras estaba en camino, `friends` era [] y la
    // pantalla soltaba un "añade amigos" a alguien que tiene amigos de sobra.
    // Y si cualquiera de las dos fallaba, no había estado de error: se caía en el
    // "no hay entrenos". Con el servidor despertando (tarda hasta 50 s) era justo
    // lo que se veía. Ahora se distingue: cargando ≠ vacío ≠ ha fallado.
    const isFirstLoad = (!feedData && loadingFeed) || (!friendsData && loadingFriends);
    const huboError = (!feedData && feedError) || (!friendsData && friendsError);

    const reintentar = () => { mutateFeed(); mutateFriends(); };

    return (
        <div className="pb-24 pt-6 px-4 min-h-screen animate-in fade-in select-none bg-black relative">
            <style>{customAnimationsStyle}</style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* --- CABECERA ---
                Título arriba y los 5 botones en su propia fila. Antes iban todos
                en la misma línea, y en un móvil el subtítulo se quedaba sin sitio
                y se partía en dos renglones contra los botones. */}
            <div className="mb-5">
                {!searchOpen && (
                    <div className="flex items-baseline gap-2 mb-3">
                        <h1 className="text-3xl font-black text-white uppercase not-italic tracking-tighter flex items-center gap-2 shrink-0">
                            <Rss size={22} className="text-yellow-500" /> FEED
                        </h1>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">Entrenos de tus amigos</p>
                    </div>
                )}

                {searchOpen ? (
                    /* La lupa se convierte en un campo a lo ancho */
                    <div className="relative animate-in slide-in-from-right-4 fade-in duration-200">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500" size={18} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Buscar jugadores..."
                            className="w-full bg-zinc-950 border border-yellow-500/50 rounded-2xl py-3.5 pl-12 pr-12 text-white outline-none font-bold text-sm placeholder:text-zinc-600"
                        />
                        <button onClick={closeSearch} className="absolute right-3 top-1/2 -translate-y-1/2 bg-zinc-800 p-1.5 rounded-full text-zinc-400 hover:text-white">
                            {isSearching ? <Loader2 size={14} className="animate-spin text-yellow-500" /> : <X size={14} />}
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between gap-1.5">
                        {ACTIONS.map(({ key, icon: Icon, label, onClick, badge }) => (
                            <button
                                key={key}
                                onClick={onClick}
                                title={label}
                                aria-label={label}
                                className="flex-1 bg-zinc-900 border border-zinc-800 py-2.5 rounded-2xl text-zinc-300 hover:text-white hover:border-yellow-500/50 active:scale-95 transition-all relative flex items-center justify-center"
                            >
                                <Icon size={18} />
                                {badge > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center border border-black animate-bounce">
                                        {badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* --- RESULTADOS DE BÚSQUEDA --- */}
            {searchOpen && searchText.length > 0 && (
                <div className="space-y-2 mb-6 animate-in fade-in">
                    <h3 className="text-[10px] font-black text-yellow-500 uppercase ml-2 tracking-widest">Resultados</h3>
                    {searchResults.length === 0 && !isSearching && (
                        <p className="text-center py-6 text-zinc-600 text-xs not-italic">Nadie con ese nombre.</p>
                    )}
                    {searchResults.map(u => (
                        <div key={u._id} className="bg-zinc-950 border border-zinc-800 p-3 rounded-2xl flex justify-between items-center">
                            <div className="flex items-center gap-3 relative min-w-0">
                                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-zinc-500 border border-zinc-800 overflow-hidden relative z-10 shrink-0">
                                    {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" alt="av" /> : u.username.charAt(0)}
                                </div>
                                {u.frame && <img src={u.frame} className="absolute -top-1.5 -left-1.5 w-[52px] h-[52px] max-w-none pointer-events-none z-20 drop-shadow-md" />}
                                <span className="text-white font-bold text-sm ml-2 truncate">{u.username}</span>
                            </div>
                            <button onClick={() => handleSendRequest(u._id)} className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-xs font-black hover:bg-yellow-400 shrink-0 active:scale-95 transition-transform">
                                AGREGAR
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* --- FEED --- */}
            {isFirstLoad ? (
                <LoadingScreen message="Cargando feed..." full={false} />
            ) : huboError ? (
                <div className="text-center py-16 px-6 text-zinc-500 border-2 border-dashed border-zinc-900 rounded-3xl">
                    <WifiOff className="mx-auto mb-3 opacity-50" size={32} />
                    <p className="text-xs mb-1 text-zinc-400 font-bold">No se ha podido cargar el feed</p>
                    <p className="text-[11px] leading-relaxed mb-4 max-w-[260px] mx-auto">
                        El servidor puede estar despertando. Espera unos segundos y vuelve a intentarlo.
                    </p>
                    <button onClick={reintentar} className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-yellow-400 transition-colors inline-flex items-center gap-2">
                        <RefreshCw size={14} /> Reintentar
                    </button>
                </div>
            ) : friends.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
                    <Users className="mx-auto mb-3 opacity-50" size={32} />
                    <p className="text-xs mb-4">Añade amigos para ver aquí sus entrenos.</p>
                    <button onClick={() => setSearchOpen(true)} className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-yellow-400 transition-colors inline-flex items-center gap-2">
                        <UserPlus size={14} /> Buscar Amigos
                    </button>
                </div>
            ) : feedItems.length === 0 ? (
                <div className="text-center py-16 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-3xl">
                    <Dumbbell className="mx-auto mb-3 opacity-50" size={32} />
                    <p className="text-xs">Tus amigos aún no han publicado entrenos.</p>
                </div>
            ) : (
                <>
                    {feedItems.map(post => <WorkoutPostCard key={post._id} post={post} />)}
                    {feedHasMore && (
                        <button onClick={loadMoreFeed} disabled={loadingMore} className="w-full py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                            Cargar más
                        </button>
                    )}
                </>
            )}

            {showInbox && (
                <InboxModal
                    requests={requests}
                    missionInvites={missionInvites}
                    retosCartas={retosCartas || []}
                    onRespondReto={handleRespondReto}
                    notifications={notifications}
                    onClose={() => setShowInbox(false)}
                    onRespondFriend={handleRespondFriend}
                    onRespondMission={handleRespondMission}
                />
            )}
        </div>
    );
}
