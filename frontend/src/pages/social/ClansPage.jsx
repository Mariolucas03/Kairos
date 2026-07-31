import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    Shield, Crown, Users, Zap, Edit, LogOut, Globe, Search, ChevronUp, ChevronDown,
    Eye, Lock, X
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import SocialSubHeader from '../../components/social/SocialSubHeader';
import ClanMemberCard from '../../components/social/ClanMemberCard';
import WeeklyEventWidget from '../../components/social/WeeklyEventWidget';
import ClanPreviewModal from '../../components/social/ClanPreviewModal';
import { useAuthStore } from '../../store/useAuthStore';
import { customAnimationsStyle, RANK_CONFIG, EVENT_CONFIG } from '../../utils/socialHelpers';

const fetcher = (url) => api.get(url).then(res => res.data);

export default function ClansPage() {
    const navigate = useNavigate();
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const currentUserId = user?._id;

    const { data: myClan, mutate: mutateMyClan } = useSWR('/clans/me', fetcher);
    const { data: clansList, mutate: mutateClansList } = useSWR('/clans', fetcher);

    const [toast, setToast] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const [showCreateClan, setShowCreateClan] = useState(false);
    const [showEditClan, setShowEditClan] = useState(false);
    const [newClanData, setNewClanData] = useState({ name: '', description: '', icon: '🛡️', minLevel: 1 });
    const [clanSearchText, setClanSearchText] = useState('');
    const [showOtherClans, setShowOtherClans] = useState(false);
    const [viewingClanId, setViewingClanId] = useState(null);

    // El rango se lee del propio clan (fuente de verdad), con el perfil como respaldo
    const myRank = myClan?.members?.find(m => m._id === currentUserId)?.clanRank || user?.clanRank || 'esclavo';
    const isLeader = RANK_CONFIG[myRank || 'esclavo'].value === 4;

    const refreshData = () => { mutateMyClan(); mutateClansList(); };

    const handleJoinClan = async (clanId) => {
        try {
            await api.post(`/clans/${clanId}/join`);
            setToast({ message: '¡Bienvenido al clan!', type: 'success' });
            setViewingClanId(null);
            refreshData();
        } catch (error) {
            setToast({ message: error.response?.data?.message || 'Error al unirse', type: 'error' });
        }
    };

    const handleCreateClan = async () => {
        if (!newClanData.name.trim()) return setToast({ message: 'Falta el nombre del clan', type: 'error' });
        if (!newClanData.icon.trim() || [...newClanData.icon].length > 4) return setToast({ message: 'Elige un estandarte (1 emoji)', type: 'error' });
        try {
            const res = await api.post('/clans', newClanData);
            mutateMyClan(res.data, false);
            setShowCreateClan(false);
            refreshData();
            setToast({ message: '¡Clan creado!', type: 'success' });
        } catch (e) {
            setToast({ message: e.response?.data?.message || 'No se pudo crear el clan', type: 'error' });
        }
    };

    const handleUpdateClan = async () => {
        try {
            const res = await api.put('/clans', {
                description: newClanData.description,
                icon: newClanData.icon,
                minLevel: newClanData.minLevel
            });
            mutateMyClan(prev => ({ ...prev, ...res.data.clan }), false);
            setShowEditClan(false);
            refreshData();
            setToast({ message: 'Clan actualizado', type: 'success' });
        } catch (e) {
            setToast({ message: e.response?.data?.message || 'No se pudo actualizar el clan', type: 'error' });
        }
    };

    const handleLeaveClan = async () => {
        try {
            await api.post('/clans/leave');
            mutateMyClan(null, false);
            refreshData();
            setToast({ message: 'Has abandonado el clan', type: 'info' });
        } catch (e) {
            setToast({ message: 'No se pudo salir del clan', type: 'error' });
        }
    };

    const handleUpdateRank = async (mid, rank) => {
        try {
            await api.put('/clans/rank', { memberId: mid, newRank: rank });
            refreshData();
            setToast({ message: 'Rango actualizado', type: 'success' });
        } catch (e) {
            setToast({ message: e.response?.data?.message || 'No se pudo cambiar el rango', type: 'error' });
        }
    };

    const handleKickMember = async (mid) => {
        try {
            await api.post('/clans/kick', { memberId: mid });
            refreshData();
            setToast({ message: 'Miembro expulsado', type: 'info' });
        } catch (e) {
            setToast({ message: e.response?.data?.message || 'No se pudo expulsar', type: 'error' });
        }
    };

    const handleClaimReward = async (tier) => {
        try {
            const res = await api.post('/clans/event/claim', { tier });
            setToast({ message: res.data?.message || 'Recompensa reclamada', type: 'success' });
            if (res.data.user) {
                setUser(res.data.user);
                localStorage.setItem('user', JSON.stringify(res.data.user));
            }
            mutateMyClan();
        } catch (e) {
            setToast({ message: e.response?.data?.message || 'No se pudo reclamar', type: 'error' });
        }
    };

    const openEditClan = () => {
        if (!myClan) return;
        setNewClanData({ name: myClan.name, description: myClan.description, icon: myClan.icon, minLevel: myClan.minLevel });
        setShowEditClan(true);
    };

    const filteredClans = (clansList || []).filter(c =>
        c.name.toLowerCase().includes(clanSearchText.toLowerCase()) && c._id !== myClan?._id
    );

    return (
        <div className="pb-24 pt-6 px-4 min-h-screen animate-in fade-in select-none bg-black">
            <style>{customAnimationsStyle}</style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <SocialSubHeader
                title="Clanes"
                subtitle={myClan ? `Tu alianza · ${RANK_CONFIG[myRank].label}` : 'Sin alianza'}
                icon={Shield}
            />

            {myClan ? (
                <div className="bg-zinc-900 border border-white/10 rounded-[32px] p-6 relative overflow-hidden shadow-2xl mb-8">
                    <div className="absolute top-0 right-0 p-10 opacity-10 bg-purple-500 blur-3xl rounded-full w-40 h-40 -mr-10 -mt-10"></div>

                    {/* CABECERA: estandarte + nombre alineados, acciones ancladas
                        arriba a la derecha de la tarjeta. Antes los botones iban
                        dentro de la misma columna que el nombre, así que dejaban
                        un hueco vacío al lado del emoji y todo bailaba. */}
                    <div className="relative z-10 mb-5">
                        <div className="absolute top-0 right-0 flex gap-2">
                            {isLeader && (
                                <button onClick={openEditClan} aria-label="Editar clan" className="bg-zinc-800 p-2 rounded-xl text-zinc-400 border border-white/5 hover:text-white hover:bg-zinc-700 transition-colors">
                                    <Edit size={16} />
                                </button>
                            )}
                            <button
                                onClick={() => setConfirmAction({ message: '¿Seguro que quieres salir del clan?', onConfirm: handleLeaveClan })}
                                aria-label="Salir del clan"
                                className="bg-red-900/20 p-2 rounded-xl text-red-500 border border-red-500/30 hover:bg-red-900/40 transition-colors"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>

                        <div className="flex items-center gap-4 pr-24">
                            <div className="text-4xl bg-black w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner border border-zinc-800 shrink-0">
                                {myClan.icon}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-2xl font-black text-white uppercase italic break-words leading-none">{myClan.name}</h2>
                                <span className="inline-block mt-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 bg-black border border-white/10 px-2 py-0.5 rounded">
                                    {RANK_CONFIG[myRank].label}
                                </span>
                            </div>
                        </div>

                        {myClan.description && (
                            <p className="text-[11px] text-zinc-400 italic mt-3 leading-snug">"{myClan.description}"</p>
                        )}

                        {/* Cifras del clan en celdas iguales, para que no se descuadren
                            aunque el poder pase de 3 a 6 dígitos */}
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <div className="bg-black/60 border border-white/10 rounded-2xl py-2.5 px-2 text-center">
                                <div className="flex items-center justify-center gap-1 text-purple-300">
                                    <Zap size={12} fill="currentColor" />
                                    <span className="text-sm font-black leading-none">{myClan.totalPower}</span>
                                </div>
                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Poder</span>
                            </div>
                            <div className="bg-black/60 border border-white/10 rounded-2xl py-2.5 px-2 text-center">
                                <div className="flex items-center justify-center gap-1 text-zinc-200">
                                    <Users size={12} />
                                    <span className="text-sm font-black leading-none">{myClan.members.length}/10</span>
                                </div>
                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Miembros</span>
                            </div>
                            <div className="bg-black/60 border border-white/10 rounded-2xl py-2.5 px-2 text-center">
                                <div className="flex items-center justify-center gap-1 text-yellow-500 min-w-0">
                                    <Crown size={12} className="shrink-0" />
                                    <span className="text-sm font-black leading-none truncate">
                                        {myClan.members.find(m => String(m._id) === String(myClan.leader))?.username || '—'}
                                    </span>
                                </div>
                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Líder</span>
                            </div>
                        </div>
                    </div>

                    {myClan.eventStats && (
                        <div className="mb-6 relative z-10">
                            <WeeklyEventWidget clan={myClan} onClaim={handleClaimReward} />
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase">Miembros</h3>
                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Por aporte semanal</span>
                        </div>
                        <div className="space-y-0 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                            {(() => {
                                // Ordenamos por contribución de la semana (como un ranking interno).
                                // El backend ya devuelve `weeklyContribution` en cada miembro.
                                const ordenados = [...myClan.members].filter(Boolean)
                                    .sort((a, b) => (b.weeklyContribution || 0) - (a.weeklyContribution || 0));
                                const tope = ordenados[0]?.weeklyContribution || 0;
                                const unidad = myClan.eventStats?.type
                                    ? EVENT_CONFIG[myClan.eventStats.type]?.unit
                                    : '';

                                return ordenados.map((member, index) => (
                                    <ClanMemberCard
                                        key={member._id || index}
                                        member={member}
                                        position={index + 1}
                                        maxContribution={tope}
                                        unit={unidad}
                                        myRank={myRank}
                                        currentUserId={currentUserId}
                                        onUpdateRank={handleUpdateRank}
                                        onViewProfile={member._id !== currentUserId ? (id) => navigate(`/social/user/${id}`) : undefined}
                                        onKick={(m) => setConfirmAction({ message: `¿Expulsar a ${m.username}?`, onConfirm: () => handleKickMember(m._id) })}
                                    />
                                ));
                            })()}
                        </div>
                        {isLeader && (
                            <p className="text-[9px] text-zinc-600 mt-3 text-center uppercase tracking-wide">
                                Como líder puedes cambiar rangos y expulsar miembros
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[32px] flex items-center justify-between shadow-xl relative overflow-hidden mb-8">
                    <div className="relative z-10">
                        <h3 className="text-white font-black text-lg uppercase flex items-center gap-2"><Crown size={20} className="text-yellow-500" /> Crea tu Clan</h3>
                        <p className="text-xs text-zinc-400 mt-1">Lidera y conquista.</p>
                    </div>
                    <button
                        onClick={() => { setNewClanData({ name: '', description: '', icon: '🛡️', minLevel: 1 }); setShowCreateClan(true); }}
                        className="bg-white text-black px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-transform relative z-10 hover:bg-zinc-200"
                    >
                        CREAR
                    </button>
                </div>
            )}

            {/* EXPLORADOR DE CLANES */}
            <div>
                <button
                    onClick={() => setShowOtherClans(!showOtherClans)}
                    className="w-full py-4 bg-yellow-500 border border-yellow-600 rounded-2xl flex items-center justify-center gap-2 text-black hover:brightness-110 transition-all text-xs font-black uppercase tracking-widest active:scale-[0.98] shadow-lg"
                >
                    <Globe size={18} /> {showOtherClans ? 'Ocultar Explorador' : 'Explorar Otros Clanes'}
                    {showOtherClans ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {showOtherClans && (
                    <div className="mt-4 animate-in slide-in-from-top-2 fade-in">
                        <div className="relative group mb-4">
                            <Search className="absolute left-4 top-4 text-zinc-500 group-focus-within:text-yellow-500 transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar alianza..."
                                value={clanSearchText}
                                onChange={(e) => setClanSearchText(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-[24px] p-4 pl-12 text-white focus:border-yellow-500/50 outline-none transition-all placeholder:text-zinc-700 font-bold text-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="text-[10px] font-black text-zinc-600 uppercase ml-2 mb-1">
                                {clanSearchText ? 'Resultados' : 'Destacados'}
                            </div>

                            {filteredClans.slice(0, clanSearchText ? undefined : 5).map((clan) => (
                                <div key={clan._id} onClick={() => setViewingClanId(clan._id)} className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex items-center justify-between cursor-pointer hover:border-zinc-700 transition-colors active:scale-[0.98] h-16">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="text-xl filter drop-shadow-md w-8 text-center shrink-0">{clan.icon}</div>
                                        <div className="min-w-0">
                                            <h3 className="text-zinc-300 font-bold text-xs uppercase truncate">{clan.name}</h3>
                                            <span className="text-[9px] text-zinc-600">{clan.memberCount} Miembros</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pr-2 shrink-0">
                                        <span className="text-[10px] font-black text-purple-500/70">{clan.totalPower}</span>
                                        <Eye size={14} className="text-zinc-700" />
                                    </div>
                                </div>
                            ))}

                            {filteredClans.length === 0 && (
                                <div className="text-center py-4 text-zinc-700 text-[10px] italic">No se encontraron clanes.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL CREAR / EDITAR CLAN */}
            {(showCreateClan || showEditClan) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => { setShowCreateClan(false); setShowEditClan(false); }} />
                    <div className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl relative z-10 animate-in zoom-in-95">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-zinc-950">
                            <h3 className="text-xl font-black text-white flex items-center gap-2 uppercase italic">
                                {showEditClan ? <><Edit className="text-blue-500" /> Editar Clan</> : <><Crown className="text-yellow-500" /> Fundar Clan</>}
                            </h3>
                            <button onClick={() => { setShowCreateClan(false); setShowEditClan(false); }} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white transition-colors border border-white/5"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar bg-black/20">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Nombre del Clan</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Los Espartanos"
                                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white font-bold focus:border-yellow-500 outline-none transition-colors disabled:opacity-50"
                                    value={newClanData.name}
                                    onChange={e => setNewClanData({ ...newClanData, name: e.target.value })}
                                    disabled={showEditClan}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Lema / Descripción</label>
                                <textarea rows="2" placeholder="Honor y Gloria..." className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white text-xs font-medium focus:border-yellow-500 outline-none transition-colors resize-none" value={newClanData.description} onChange={e => setNewClanData({ ...newClanData, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-1">Nivel Mínimo</label>
                                <div className="flex items-center gap-3">
                                    <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl"><Lock size={20} className="text-zinc-600" /></div>
                                    <input type="number" min="1" max="100" className="flex-1 bg-black border border-zinc-800 rounded-xl p-3 text-white font-bold focus:border-yellow-500 outline-none transition-colors text-center" value={newClanData.minLevel} onChange={e => setNewClanData({ ...newClanData, minLevel: parseInt(e.target.value) || 1 })} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1 block mb-2">Estandarte (Emoji)</label>
                                <div className="flex justify-center">
                                    <input
                                        type="text"
                                        value={newClanData.icon}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const isNotLetterOrNumber = !/^[a-zA-Z0-9]*$/.test(val);
                                            if (val === '' || (isNotLetterOrNumber && [...val].length <= 4)) {
                                                setNewClanData({ ...newClanData, icon: val });
                                            }
                                        }}
                                        className="w-24 h-24 bg-black border-2 border-zinc-800 rounded-3xl text-center text-6xl focus:border-yellow-500 outline-none transition-all shadow-inner"
                                        placeholder="🛡️"
                                    />
                                </div>
                                <p className="text-[9px] text-zinc-600 text-center mt-2">Usa el teclado de emojis de tu móvil</p>
                            </div>
                        </div>
                        <div className="p-5 bg-zinc-950 border-t border-white/10">
                            <button
                                onClick={showEditClan ? handleUpdateClan : handleCreateClan}
                                className={`w-full font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 border-b-4 uppercase tracking-widest ${showEditClan ? 'bg-blue-600 hover:bg-blue-500 border-blue-800 text-white' : 'bg-yellow-500 hover:bg-yellow-400 border-yellow-600 text-black'}`}
                            >
                                {showEditClan ? <><Edit size={18} /> GUARDAR CAMBIOS</> : <><Shield size={18} /> CREAR CLAN</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmAction && (
                <ConfirmDialog
                    message={confirmAction.message}
                    onCancel={() => setConfirmAction(null)}
                    onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
                />
            )}

            {viewingClanId && (
                <ClanPreviewModal
                    clanId={viewingClanId}
                    currentUserId={currentUserId}
                    userClanId={myClan?._id}
                    onClose={() => setViewingClanId(null)}
                    onJoin={handleJoinClan}
                />
            )}
        </div>
    );
}
