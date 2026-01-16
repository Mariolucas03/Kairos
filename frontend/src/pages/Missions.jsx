import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import {
    Trash2, Plus, Check, X, Target, Users,
    Loader2, Repeat, Flag, Clock
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';

// ==========================================
// 1. HELPERS
// ==========================================
const COOP_COLORS = [
    'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-indigo-500'
];

const getUserColor = (userId) => {
    if (!userId) return 'bg-zinc-500';
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COOP_COLORS.length;
    return COOP_COLORS[index];
};

const getDeadlineText = (frequency) => {
    const now = new Date();
    const end = new Date(now);

    if (frequency === 'daily') {
        end.setHours(23, 59, 59, 999);
    } else if (frequency === 'weekly') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? 0 : 7);
        end.setDate(diff);
    } else if (frequency === 'monthly') {
        end.setMonth(now.getMonth() + 1, 0);
    } else if (frequency === 'yearly') {
        end.setMonth(11, 31);
    }
    return end.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

// ==========================================
// 2. ESTILOS (DISEÑO "WIDGET FLOW" CON PALETA SÓLIDA)
// ==========================================
const getGradientStyles = (diff, completed) => {
    const labels = { easy: 'Fácil', medium: 'Media', hard: 'Difícil', epic: 'Épica' };
    const label = labels[diff] || diff;

    // Estilo para completadas (Gris Metálico Apagado)
    if (completed) return {
        gradient: 'from-zinc-700 via-zinc-600 to-zinc-700',
        shadow: 'rgba(82, 82, 91, 0.3)',
        textGradient: 'from-zinc-400 to-zinc-600',
        badge: 'text-zinc-500 border-zinc-700 bg-zinc-800/50',
        iconColor: 'text-zinc-600',
        label
    };

    switch (diff) {
        case 'easy': return {
            // VERDE MONOCROMÁTICO (Estilo Nutrición)
            gradient: 'from-[#14532d] via-[#166534] to-[#22c55e]',
            shadow: 'rgba(22, 101, 52, 0.4)',
            textGradient: 'from-[#166534] to-[#22c55e]',
            badge: 'text-green-400 border-green-500/30 bg-green-900/20',
            iconColor: 'text-green-400',
            label
        };
        case 'medium': return {
            // AZUL
            gradient: 'from-blue-600 via-cyan-500 to-indigo-600',
            shadow: 'rgba(37, 99, 235, 0.4)',
            textGradient: 'from-blue-400 to-cyan-400',
            badge: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
            iconColor: 'text-blue-400',
            label
        };
        case 'hard': return {
            // ROJO
            gradient: 'from-red-600 via-orange-500 to-rose-600',
            shadow: 'rgba(220, 38, 38, 0.4)',
            textGradient: 'from-red-400 to-orange-400',
            badge: 'text-red-300 border-red-500/30 bg-red-500/10',
            iconColor: 'text-red-400',
            label
        };
        case 'epic': return {
            // MORADO
            gradient: 'from-purple-600 via-fuchsia-500 to-violet-600',
            shadow: 'rgba(147, 51, 234, 0.4)',
            textGradient: 'from-purple-400 to-fuchsia-400',
            badge: 'text-purple-300 border-purple-500/30 bg-purple-500/10',
            iconColor: 'text-purple-400',
            label
        };
        default: return {
            gradient: 'from-zinc-500 to-zinc-700',
            shadow: 'rgba(113, 113, 122, 0.2)',
            textGradient: 'from-zinc-400 to-zinc-600',
            badge: 'text-zinc-400 border-zinc-600',
            iconColor: 'text-zinc-400',
            label
        };
    }
};

// ==========================================
// COMPONENTE: TARJETA DE MISIÓN
// ==========================================
function MissionCard({ mission, onUpdateProgress, onDelete, currentUserId }) {
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [showInput, setShowInput] = useState(false);
    const startX = useRef(0);
    const THRESHOLD = 80;

    const styles = getGradientStyles(mission.difficulty, mission.completed);
    const isPending = mission.isCoop && mission.invitationStatus === 'pending';
    const amIOwner = mission.user === currentUserId;
    const isBinary = mission.target === 1;
    const canSwipe = !isPending && !mission.completed;

    const handleStart = (clientX) => { if (canSwipe) { setIsDragging(true); startX.current = clientX; } };
    const handleMove = (clientX) => {
        if (!isDragging) return;
        const diff = clientX - startX.current;
        if (mission.completed && diff > 0) return;
        setDragX(diff);
    };

    const handleEnd = () => {
        setIsDragging(false);
        if (isPending) { setDragX(0); return; }
        if (dragX > THRESHOLD) {
            if (!mission.completed) {
                const remaining = mission.target - mission.progress;
                onUpdateProgress(mission, Math.max(0, remaining));
            }
        } else if (dragX < -THRESHOLD) {
            if (window.confirm(mission.isCoop ? "⚠️ ¿Eliminar cooperativa?" : "¿Borrar misión?")) onDelete(mission._id);
        }
        setDragX(0);
    };

    const handleNumericSubmit = (e) => {
        e.preventDefault();
        if (!inputValue) return;
        onUpdateProgress(mission, parseFloat(inputValue));
        setInputValue('');
        setShowInput(false);
    };

    const cardStyle = {
        transform: `translate3d(${dragX}px, 0, 0)`,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        touchAction: 'pan-y'
    };

    let bgAction = 'bg-transparent';
    if (dragX > 0) bgAction = 'bg-emerald-900/50 border border-emerald-500/30 rounded-[24px]';
    else if (dragX < 0) bgAction = 'bg-red-900/50 border border-red-500/30 rounded-[24px]';

    const progressPercent = mission.target > 0 ? Math.min((mission.progress / mission.target) * 100, 100) : 0;

    const renderProgressBar = () => {
        if (isBinary && !mission.isCoop) return null;

        return (
            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex mt-4 border border-zinc-800/50 relative shadow-inner">
                {mission.isCoop ? (
                    mission.participants.map((p) => {
                        const contrib = (mission.contributions && mission.contributions[p._id]) || 0;
                        const w = (contrib / mission.target) * 100;
                        const colorClass = getUserColor(p._id);
                        return <div key={p._id} className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${w}%` }} />;
                    })
                ) : (
                    <div className={`h-full transition-all duration-500 relative bg-gradient-to-r ${styles.gradient}`} style={{ width: `${progressPercent}%` }} />
                )}
            </div>
        );
    };

    return (
        <div className="relative w-full mb-5 select-none group">
            {/* Fondo Swipe */}
            {canSwipe && (
                <div className={`absolute inset-0 flex items-center justify-between px-6 transition-colors z-0 ${bgAction}`}>
                    {dragX > 0 && <div className="flex items-center gap-2 text-emerald-400 font-black tracking-widest text-sm drop-shadow-md"><Check size={24} /> COMPLETAR</div>}
                    {dragX < 0 && <div className="flex items-center gap-2 text-red-400 font-black tracking-widest text-sm drop-shadow-md">ELIMINAR <Trash2 size={24} /></div>}
                </div>
            )}

            {/* Tarjeta Principal */}
            <div
                style={cardStyle}
                className={`
                    relative rounded-[24px] overflow-hidden z-10 will-change-transform
                    p-[2px] bg-gradient-to-br ${styles.gradient}
                    shadow-[0_0_25px_${styles.shadow}]
                    ${isPending ? 'opacity-70 grayscale-[0.5]' : ''}
                `}
                onTouchStart={(e) => handleStart(e.targetTouches[0].clientX)}
                onTouchMove={(e) => handleMove(e.targetTouches[0].clientX)}
                onTouchEnd={handleEnd}
                onMouseDown={(e) => handleStart(e.clientX)}
                onMouseMove={(e) => handleMove(e.clientX)}
                onMouseUp={handleEnd}
                onMouseLeave={() => { if (isDragging) handleEnd() }}
            >
                {/* CONTENEDOR INTERNO */}
                {/* 🔥 CAMBIO: Fondo "Crema" (#2e2924) para Coop, Negro para el resto */}
                <div className={`${mission.isCoop ? 'bg-[#2E2E2E]' : 'bg-zinc-950'} rounded-[22px] p-5 relative overflow-hidden h-full flex flex-col justify-between`}>
                    {/* Brillo ambiental */}
                    <div className={`absolute -right-12 -top-12 w-40 h-40 rounded-full blur-[30px] pointer-events-none bg-gradient-to-tr ${styles.gradient} opacity-15`}></div>

                    <div className="relative z-10">
                        {/* HEADER */}
                        <div className="flex justify-between items-start gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1 relative">
                                    <div className="pr-16">
                                        <div className="flex items-center gap-2">
                                            {mission.isCoop && <Users size={16} className={styles.iconColor} />}
                                            <h3 className={`text-lg font-black leading-snug uppercase tracking-tighter break-words ${mission.completed ? 'text-zinc-500 line-through' : 'text-white'}`}>
                                                {mission.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="absolute -top-1 -right-1 flex flex-col items-end gap-1.5">
                                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${styles.badge}`}>
                                            {styles.label}
                                        </div>
                                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                            {mission.type === 'habit' ? <><Repeat size={10} /> Hábito</> : <><Flag size={10} /> Puntual</>}
                                        </div>
                                    </div>
                                </div>

                                {/* PROGRESO GRANDE (Texto Metálico) */}
                                <div className="flex items-center gap-3 mt-3">
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${styles.textGradient} filter brightness-110 pr-2 pb-1`}>
                                            {mission.progress}
                                        </span>
                                        <span className="text-base font-black text-white uppercase tracking-tighter">
                                            / {mission.target} {mission.unit || 'Vez'}
                                        </span>
                                    </div>

                                    {!isBinary && !mission.completed && !isPending && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowInput(!showInput); }}
                                            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-all shadow-md active:scale-95 ml-auto"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {mission.completed && <div className="p-1.5 bg-zinc-900 rounded-full border border-zinc-800 shrink-0 mt-0.5"><Check size={18} className={styles.iconColor} /></div>}
                        </div>

                        {showInput && !isBinary && (
                            <form onSubmit={handleNumericSubmit} className="mt-4 flex gap-2 animate-in slide-in-from-top-2">
                                <input type="number" inputMode="numeric" pattern="[0-9]*" autoFocus placeholder="Cantidad..." className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white font-black text-lg text-center outline-none focus:border-zinc-600 transition-all" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                                <button type="submit" className={`px-4 rounded-xl font-black text-black bg-gradient-to-r ${styles.gradient} shadow-lg shadow-${styles.shadow.split(' ')[0]}`}><Check size={20} /></button>
                            </form>
                        )}

                        {renderProgressBar()}
                    </div>

                    {/* FOOTER REWARDS */}
                    <div className="flex items-center gap-5 mt-5 pt-3 border-t border-zinc-900/80 flex-wrap">
                        <div className="flex items-center gap-2" title="Experiencia">
                            <span className={`text-sm font-black ${mission.completed ? 'text-zinc-600' : 'text-blue-400'}`}>+{mission.xpReward}</span>
                            <img src="/assets/icons/xp.png" alt="XP" className="w-5 h-5 object-contain rendering-pixelated" />
                        </div>
                        <div className="flex items-center gap-2" title="Monedas">
                            <span className={`text-sm font-black ${mission.completed ? 'text-zinc-600' : 'text-yellow-400'}`}>+{mission.coinReward}</span>
                            <img src="/assets/icons/moneda.png" alt="Monedas" className="w-5 h-5 object-contain rendering-pixelated" />
                        </div>
                        <div className="flex items-center gap-2" title="Fichas">
                            <span className={`text-sm font-black ${mission.completed ? 'text-zinc-600' : 'text-purple-400'}`}>+{mission.gameCoinReward || mission.coinReward * 2}</span>
                            <img src="/assets/icons/ficha.png" alt="Fichas" className="w-5 h-5 object-contain rendering-pixelated" />
                        </div>

                        {/* Vida */}
                        {!mission.completed && (
                            <div className="ml-auto flex items-center gap-1.5" title="Riesgo de Vida">
                                <span className="text-sm font-black text-red-500">-5</span>
                                <img src="/assets/icons/corazon.png" alt="HP" className="w-5 h-5 object-contain rendering-pixelated" />
                            </div>
                        )}
                    </div>

                    {isPending && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-[22px] z-30">
                            <Loader2 className="animate-spin text-zinc-500 mb-2" />
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Esperando compañero...</span>
                            {amIOwner && <button onClick={() => onDelete(mission._id)} className="text-[10px] text-red-500 mt-2 hover:underline">Cancelar Invitación</button>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================
export default function Missions() {
    const { user, setUser } = useOutletContext();
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('daily');
    const [showCreator, setShowCreator] = useState(false);
    const [toast, setToast] = useState(null);
    const [friends, setFriends] = useState([]);

    const DEFAULTS = {
        title: '', frequency: 'daily', type: 'habit', difficulty: 'easy', target: 1, unit: '', isCoop: false, friendId: ''
    };

    const [newMission, setNewMission] = useState(DEFAULTS);
    const [selectedDays, setSelectedDays] = useState([]);

    useEffect(() => {
        if (!showCreator) {
            setNewMission(prev => ({ ...prev, frequency: activeTab === 'all' ? 'daily' : activeTab }));
        }
        fetchMissions();
        fetchFriends();
    }, [activeTab, showCreator]);

    const fetchMissions = async () => {
        try { const res = await api.get('/missions'); setMissions(res.data); } catch (e) { setMissions([]); } finally { setLoading(false); }
    };
    const fetchFriends = async () => { try { const res = await api.get('/social/friends'); setFriends(res.data.friends); } catch (e) { } };
    const showToast = (message, type = 'success') => setToast({ message, type });

    const daysOptions = [{ label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'X', value: 3 }, { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 }, { label: 'D', value: 0 }];
    const toggleDay = (dayValue) => setSelectedDays(prev => prev.includes(dayValue) ? prev.filter(d => d !== dayValue) : [...prev, dayValue]);

    const getRewardValues = (freq, diff) => {
        const baseXP = 10; const baseCoins = 5;
        const diffMult = { easy: 1, medium: 2, hard: 3, epic: 5 };
        const freqMult = { daily: 1, weekly: 5, monthly: 15, yearly: 100 };
        const m1 = diffMult[diff] || 1; const m2 = freqMult[freq] || 1;
        let mult = m1 * m2;
        if (newMission.isCoop) mult *= 1.5;

        const xp = Math.round(baseXP * mult);
        const coins = Math.round(baseCoins * mult);
        const gameCoins = coins * 2;

        return { xp, coins, gameCoins };
    };

    const getFilteredMissions = () => {
        const today = new Date().getDay();
        return missions.filter(m => {
            if (activeTab !== 'all' && m.frequency !== activeTab) return false;
            if (m.isCoop && m.invitationStatus === 'pending' && m.user !== user._id) return false;
            if (m.frequency === 'daily' && m.specificDays && m.specificDays.length > 0) return m.specificDays.includes(today);
            return true;
        });
    };

    const filteredMissions = getFilteredMissions();
    const completedCount = filteredMissions.filter(m => m.completed).length;
    const totalCount = filteredMissions.length;
    const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    const handleOpenCreator = () => {
        setNewMission({ ...DEFAULTS, frequency: activeTab === 'all' ? 'daily' : activeTab });
        setSelectedDays([]);
        setShowCreator(true);
    };

    const handleCloseCreator = () => setShowCreator(false);

    const handleCreate = async () => {
        if (!newMission.title?.trim()) return showToast("Escribe un título", "error");
        if (newMission.isCoop && !newMission.friendId) return showToast("Selecciona un amigo", "error");

        const safeUnit = newMission.unit ? newMission.unit.trim() : undefined;
        const finalFreq = newMission.frequency || 'daily';
        const rewards = getRewardValues(finalFreq, newMission.difficulty);
        const finalType = newMission.type || 'habit';

        const payload = {
            title: newMission.title.trim(),
            frequency: finalFreq,
            type: finalType,
            difficulty: newMission.difficulty || 'easy',
            target: parseInt(newMission.target) || 1,
            unit: safeUnit,
            isCoop: !!newMission.isCoop,
            xpReward: rewards.xp,
            coinReward: rewards.coins,
            gameCoinReward: rewards.gameCoins,
            specificDays: finalFreq === 'daily' ? selectedDays : []
        };

        if (payload.isCoop) payload.friendId = newMission.friendId;
        else delete payload.friendId;

        try {
            await api.post('/missions', payload);
            handleCloseCreator();
            fetchMissions();
            showToast("¡Misión creada!", "success");
        } catch (error) {
            showToast(error.response?.data?.message || "Error al crear misión.", "error");
        }
    };

    const handleUpdateProgress = async (mission, amount) => {
        try {
            const res = await api.put(`/missions/${mission._id}/progress`, { amount });
            if (res.data.progressOnly) {
                setMissions(prev => prev.map(m => m._id === mission._id ? res.data.mission : m));
                showToast(`+${amount} ${mission.unit || 'progreso'}`, "info");
                return;
            }
            if (res.data.user) { setUser(res.data.user); localStorage.setItem('user', JSON.stringify(res.data.user)); }
            setMissions(prev => prev.map(m => m._id === mission._id ? res.data.mission : m));
            if (res.data.rewards) showToast(`¡Completada! +${res.data.rewards.xp} XP`, "success");
        } catch (e) { showToast("Error al actualizar", "error"); }
    };

    const handleDelete = async (id) => {
        try { await api.delete(`/missions/${id}`); setMissions(prev => prev.filter(m => m._id !== id)); showToast("Misión eliminada", "info"); } catch (e) { }
    };

    const previewRewards = getRewardValues(newMission.frequency, newMission.difficulty);

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500" size={32} /></div>;

    return (
        <div className="min-h-screen bg-black text-white pb-24 animate-in fade-in relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER STICKY */}
            <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-zinc-800 pt-6 pb-2 px-4 shadow-xl">
                <div className="flex justify-between items-center mb-3">
                    <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                        Misiones <span className="text-yellow-500 capitalize">{activeTab === 'all' ? 'Todas' : activeTab === 'daily' ? 'DIARIAS' : activeTab === 'weekly' ? 'SEMANALES' : activeTab === 'monthly' ? 'MENSUALES' : 'ANUALES'}</span>
                    </h1>
                    <button onClick={handleOpenCreator} className="bg-yellow-500 text-black p-2 rounded-xl shadow-lg active:scale-95 transition-transform"><Plus size={20} strokeWidth={3} /></button>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                    {['daily', 'weekly', 'monthly', 'yearly'].map(freq => (
                        <button key={freq} onClick={() => setActiveTab(freq)} className={`py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === freq ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            {freq === 'daily' ? 'DIARIA' : freq === 'weekly' ? 'SEMANAL' : freq === 'monthly' ? 'MENSUAL' : 'ANUAL'}
                        </button>
                    ))}
                </div>
                <div className="mt-2 h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-800">
                    <div className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)] transition-all duration-500" style={{ width: `${completionRate}%` }} />
                </div>
            </div>

            {/* LISTA */}
            <div className="px-4 mt-4 space-y-4">
                {filteredMissions.length === 0 ? (
                    <div className="py-20 text-center opacity-60">
                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800"><Target className="text-zinc-600" size={32} /></div>
                        <p className="text-zinc-500 font-bold text-sm uppercase tracking-wide">Sin misiones activas</p>
                    </div>
                ) : (
                    <>
                        {filteredMissions.map(m => <MissionCard key={m._id} mission={m} onUpdateProgress={handleUpdateProgress} onDelete={handleDelete} currentUserId={user._id} />)}

                        <div className="text-center mt-8 mb-4">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800 flex items-center justify-center gap-2 mx-auto w-fit">
                                <Clock size={12} /> DISPONIBLE HASTA: <span className="text-zinc-300">{getDeadlineText(activeTab === 'all' ? 'daily' : activeTab)}</span>
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* MODAL CREAR (PORTAL) */}
            {showCreator && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#09090b] w-full max-w-sm rounded-[32px] border border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col h-full sm:h-auto max-h-[85vh]">
                        <div className="flex justify-between items-center p-5 border-b border-zinc-800/50 bg-[#09090b] shrink-0 z-10">
                            <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2"><Plus size={18} className="text-yellow-500" /> Nueva Misión</h2>
                            <button onClick={handleCloseCreator} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-zinc-800 transition-colors"><X size={18} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-black/20">

                            {/* TÍTULO */}
                            <div className="mt-2">
                                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Título</label>
                                <input type="text" placeholder="Ej: Leer 10 páginas" autoFocus value={newMission.title} onChange={e => setNewMission({ ...newMission, title: e.target.value })} className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-white placeholder-zinc-700 outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all font-bold text-sm" />
                            </div>

                            {/* TIPO */}
                            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                                <button onClick={() => setNewMission({ ...newMission, type: 'habit' })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newMission.type === 'habit' ? 'bg-white text-black shadow' : 'text-zinc-500'}`}>Hábito (Recurrente)</button>
                                <button onClick={() => setNewMission({ ...newMission, type: 'quest' })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newMission.type === 'quest' ? 'bg-white text-black shadow' : 'text-zinc-500'}`}>Misión Puntual</button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Objetivo</label>
                                    <input type="number" inputMode="numeric" pattern="[0-9]*" min="1" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center text-white font-mono font-bold text-sm outline-none focus:border-blue-500/50 transition-all" value={newMission.target} onChange={e => setNewMission({ ...newMission, target: e.target.value === '' ? '' : parseInt(e.target.value) })} />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Unidad</label>
                                    <input
                                        type="text"
                                        placeholder="km, pags, min..."
                                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center text-white font-medium text-sm outline-none focus:border-blue-500/50 transition-all placeholder-zinc-700"
                                        value={newMission.unit}
                                        onChange={e => setNewMission({ ...newMission, unit: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Frecuencia</label>
                                    <select className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-2.5 text-white text-xs font-bold outline-none" value={newMission.frequency} onChange={e => setNewMission({ ...newMission, frequency: e.target.value })}>
                                        <option value="daily">Diaria</option>
                                        <option value="weekly">Semanal</option>
                                        <option value="monthly">Mensual</option>
                                        <option value="yearly">Anual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Dificultad</label>
                                    <select className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-2.5 text-white text-xs font-bold outline-none" value={newMission.difficulty} onChange={e => setNewMission({ ...newMission, difficulty: e.target.value })}>
                                        <option value="easy">Fácil</option>
                                        <option value="medium">Media</option>
                                        <option value="hard">Difícil</option>
                                        <option value="epic">Épica</option>
                                    </select>
                                </div>
                            </div>

                            {newMission.frequency === 'daily' && (
                                <div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-xl">
                                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Días Específicos</label>
                                    <div className="flex justify-between">
                                        {daysOptions.map(d => (
                                            <button key={d.value} onClick={() => toggleDay(d.value)} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all border ${selectedDays.includes(d.value) ? 'bg-white text-black border-white scale-110' : 'bg-black text-zinc-600 border-zinc-800'}`}>{d.label}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className={`p-3 rounded-xl border transition-all ${newMission.isCoop ? 'bg-purple-900/10 border-purple-500/30' : 'bg-zinc-900/30 border-zinc-800'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${newMission.isCoop ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}><Users size={14} /></div>
                                        <span className="text-xs font-bold uppercase text-zinc-400">Cooperativo</span>
                                    </div>
                                    <div onClick={() => setNewMission({ ...newMission, isCoop: !newMission.isCoop })} className={`w-8 h-5 rounded-full relative cursor-pointer transition-colors ${newMission.isCoop ? 'bg-purple-500' : 'bg-zinc-700'}`}>
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${newMission.isCoop ? 'left-4' : 'left-1'}`}></div>
                                    </div>
                                </div>
                                {newMission.isCoop && (
                                    <select className="w-full bg-black border border-purple-500/30 rounded-xl p-2 text-white text-xs font-bold outline-none mt-2" value={newMission.friendId} onChange={e => setNewMission({ ...newMission, friendId: e.target.value })}>
                                        <option value="">Invitar a...</option>
                                        {friends.map(f => <option key={f._id} value={f._id}>{f.username}</option>)}
                                    </select>
                                )}
                            </div>

                            <div className="flex justify-center gap-3 pt-1 opacity-70 flex-wrap">
                                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400">+{previewRewards.xp} <img src="/assets/icons/xp.png" alt="XP" className="w-5 h-5 object-contain rendering-pixelated mt-[1px]" /></span>
                                <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-400">+{previewRewards.coins} <img src="/assets/icons/moneda.png" alt="Monedas" className="w-5 h-5 object-contain rendering-pixelated mt-[2px]" /></span>
                                <span className="flex items-center gap-1 text-[10px] font-bold text-purple-400">+{previewRewards.gameCoins} <img src="/assets/icons/ficha.png" alt="Fichas" className="w-5 h-5 object-contain rendering-pixelated mt-[2px]" /></span>
                            </div>
                        </div>

                        <div className="p-5 border-t border-zinc-800 bg-[#09090b] shrink-0 z-10">
                            <button onClick={handleCreate} className="w-full bg-yellow-500 text-black py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-yellow-400 active:scale-95 transition-all shadow-lg">Crear Misión</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}