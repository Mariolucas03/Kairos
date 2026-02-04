import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import {
    Trash2, Plus, Check, X, Target, Users,
    Loader2, Repeat, Flag, Clock, Eye, EyeOff, Edit, Save
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';

// ==========================================
// 0. CONFIGURACIÓN DE ICONOS
// ==========================================
const ICON_XP = "/assets/icons/xp.png";
const ICON_COIN = "/assets/icons/moneda.png";
const ICON_CHIP = "/assets/icons/ficha.png";
const ICON_HEART = "/assets/icons/corazon.png"; // 🔥 CAMBIO 2: Usando tu imagen

// ==========================================
// 1. HELPERS VISUALES Y LÓGICOS
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

// DAÑO INVERTIDO (Fácil = 10, Épica = 0)
const getPotentialDamage = (diff) => {
    const rules = { easy: 10, medium: 5, hard: 2, epic: 0 };
    return rules[diff] !== undefined ? rules[diff] : 5;
};

const getGradientStyles = (diff, completed) => {
    const labels = { easy: 'Fácil', medium: 'Media', hard: 'Difícil', epic: 'Épica' };
    const label = labels[diff] || diff;

    // 🔥 CAMBIO 3: Estilo Completado "Bloqueado/Metal" (Gris muy oscuro y apagado)
    if (completed) return {
        gradient: 'from-[#18181b] to-[#09090b]', // Zinc-900 to Black
        shadow: 'rgba(0,0,0,0)', // Sin sombra de color
        textGradient: 'from-zinc-600 to-zinc-500', // Texto gris apagado
        badge: 'text-zinc-700 border-zinc-800 bg-zinc-900', // Badge invisible casi
        iconColor: 'text-zinc-700',
        label: 'HECHO'
    };

    switch (diff) {
        case 'easy': return {
            gradient: 'from-[#14532d] via-[#166534] to-[#22c55e]',
            shadow: 'rgba(22, 101, 52, 0.4)',
            textGradient: 'from-[#166534] to-[#22c55e]',
            badge: 'text-green-400 border-green-500/30 bg-green-900/20',
            iconColor: 'text-green-400',
            label
        };
        case 'medium': return {
            gradient: 'from-blue-600 via-cyan-500 to-indigo-600',
            shadow: 'rgba(37, 99, 235, 0.4)',
            textGradient: 'from-blue-400 to-cyan-400',
            badge: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
            iconColor: 'text-blue-400',
            label
        };
        case 'hard': return {
            gradient: 'from-red-600 via-orange-500 to-rose-600',
            shadow: 'rgba(220, 38, 38, 0.4)',
            textGradient: 'from-red-400 to-orange-400',
            badge: 'text-red-300 border-red-500/30 bg-red-500/10',
            iconColor: 'text-red-400',
            label
        };
        case 'epic': return {
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
function MissionCard({ mission, onUpdateProgress, onDelete, currentUserId, onEdit, viewAllMode }) {
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
    const damage = getPotentialDamage(mission.difficulty);

    // 🔥 CAMBIO 4: Si estamos en viewAllMode (OJO), NO se puede deslizar
    const canSwipe = !isPending && !viewAllMode;

    const handleStart = (clientX) => { if (canSwipe) { setIsDragging(true); startX.current = clientX; } };

    const handleMove = (clientX) => {
        if (!isDragging) return;
        const diff = clientX - startX.current;

        // Bloqueos de lógica:
        if (mission.completed && diff > 0) return; // No recompletar
        if (mission.completed && diff < 0 && !viewAllMode) return; // No borrar si está hecha (salvo modo ojo)

        setDragX(diff);
    };

    const handleEnd = () => {
        setIsDragging(false);
        if (isPending) { setDragX(0); return; }

        if (dragX > THRESHOLD) {
            // Completar (Derecha)
            if (!mission.completed) {
                const remaining = mission.target - mission.progress;
                onUpdateProgress(mission, Math.max(0, remaining));
            }
        } else if (dragX < -THRESHOLD) {
            // Borrar (Izquierda)
            if (!mission.completed || viewAllMode) {
                if (window.confirm(mission.isCoop ? "⚠️ ¿Eliminar misión cooperativa?" : "¿Borrar misión permanentemente?")) {
                    onDelete(mission._id);
                }
            }
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
            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex mt-2 border border-zinc-800/50 relative shadow-inner">
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

    const handleCardClick = () => {
        if (viewAllMode) {
            onEdit(mission);
        }
    };

    return (
        <div className="relative w-full mb-4 select-none group" onClick={handleCardClick}>
            {/* Fondo Swipe */}
            {canSwipe && (
                <div className={`absolute inset-0 flex items-center justify-between px-6 transition-colors z-0 rounded-[24px] border ${bgAction}`}>
                    {dragX > 0 && <div className="flex items-center gap-2 text-emerald-400 font-black text-sm"><Check size={24} /> COMPLETAR</div>}
                    {dragX < 0 && <div className="flex items-center gap-2 text-red-400 font-black text-sm">ELIMINAR <Trash2 size={24} /></div>}
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
                    ${viewAllMode ? 'cursor-pointer active:scale-[0.98] hover:brightness-110' : ''}
                    ${mission.completed ? 'opacity-80 grayscale-[0.3]' : 'opacity-100'} 
                `}
                onTouchStart={(e) => handleStart(e.targetTouches[0].clientX)}
                onTouchMove={(e) => handleMove(e.targetTouches[0].clientX)}
                onTouchEnd={handleEnd}
                onMouseDown={(e) => handleStart(e.clientX)}
                onMouseMove={(e) => handleMove(e.clientX)}
                onMouseUp={handleEnd}
                onMouseLeave={() => { if (isDragging) handleEnd() }}
            >
                <div className={`${mission.isCoop ? 'bg-[#2E2E2E]' : 'bg-zinc-950'} rounded-[22px] p-4 relative overflow-hidden h-full flex flex-col justify-between`}>

                    {/* Brillo ambiental (Apagado si está completada) */}
                    {!mission.completed && (
                        <div className={`absolute -right-12 -top-12 w-40 h-40 rounded-full blur-[30px] pointer-events-none bg-gradient-to-tr ${styles.gradient} opacity-15`}></div>
                    )}

                    <div className="relative z-10">
                        {/* HEADER */}
                        <div className="flex justify-between items-start gap-3 mb-1">
                            <div className="flex-1 min-w-0 relative">
                                <div className="pr-20 mb-1">
                                    <div className="flex items-center gap-2">
                                        {mission.isCoop && <Users size={16} className={styles.iconColor} />}
                                        {viewAllMode && <Edit size={14} className="text-yellow-500 shrink-0" />}
                                        <h3 className={`text-base font-black leading-tight uppercase tracking-tighter break-words ${mission.completed ? 'text-zinc-500 line-through decoration-2' : 'text-white'}`}>
                                            {mission.title}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-2 mt-1">
                                        {/* 🔥 CAMBIO 1: Eliminado Frecuencia visual */}
                                        {/* 🔥 CAMBIO 5: Contador Gigante */}
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${styles.textGradient} filter brightness-110`}>
                                                {mission.progress}/{mission.target}
                                            </span>
                                            {mission.unit && <span className="text-[10px] font-bold text-zinc-500 uppercase">{mission.unit}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute -top-1 -right-1 flex items-center gap-2">
                                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                        {mission.type === 'habit' ? <><Repeat size={10} /> Hábito</> : <><Flag size={10} /> Puntual</>}
                                    </div>
                                    <div className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${styles.badge}`}>{styles.label}</div>
                                </div>
                            </div>

                            {/* 🔥 CAMBIO 6: Botón Check eliminado completamente. Solo queda "+" si es necesario */}
                            <div className="flex flex-col items-center gap-2">
                                {!isBinary && !mission.completed && !isPending && !viewAllMode && (
                                    <button onClick={(e) => { e.stopPropagation(); setShowInput(!showInput); }} className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 active:scale-95 ml-auto">
                                        <Plus size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {renderProgressBar()}

                        {/* RECOMPENSAS / RIESGOS */}
                        <div className={`flex gap-4 mt-3 pt-2 border-t relative z-10 border-zinc-800/30 items-center`}>
                            <div className="flex items-center gap-4">
                                {/* XP */}
                                {mission.xpReward > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-sm font-black ${mission.completed ? 'text-zinc-600' : 'text-blue-200'}`}>+{mission.xpReward}</span>
                                        <img src={ICON_XP} className={`w-6 h-6 object-contain ${mission.completed ? 'grayscale opacity-50' : ''}`} alt="XP" />
                                    </div>
                                )}

                                {/* Monedas */}
                                {(mission.coinReward > 0) && (
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-sm font-black ${mission.completed ? 'text-zinc-600' : 'text-yellow-200'}`}>+{mission.coinReward}</span>
                                        <img src={ICON_COIN} className={`w-6 h-6 object-contain ${mission.completed ? 'grayscale opacity-50' : ''}`} alt="Coins" />
                                    </div>
                                )}

                                {/* Fichas */}
                                {(mission.gameCoinReward > 0) && (
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-sm font-black ${mission.completed ? 'text-zinc-600' : 'text-purple-200'}`}>+{mission.gameCoinReward}</span>
                                        <img src={ICON_CHIP} className={`w-6 h-6 object-contain ${mission.completed ? 'grayscale opacity-50' : ''}`} alt="Chips" />
                                    </div>
                                )}
                            </div>

                            {/* 🔥 CAMBIO 2: Icono Corazón Imagen */}
                            {!mission.completed && (
                                <div className="ml-auto flex items-center gap-1.5 opacity-90">
                                    <span className="text-sm font-black text-red-400">-{damage}</span>
                                    <img src={ICON_HEART} className="w-5 h-5 object-contain opacity-80" alt="HP" />
                                </div>
                            )}
                        </div>

                        {showInput && !isBinary && (
                            <form onSubmit={handleNumericSubmit} className="mt-3 flex gap-2 animate-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                                <input type="number" inputMode="numeric" pattern="[0-9]*" autoFocus placeholder="Cantidad..." className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white font-black text-sm text-center outline-none focus:border-zinc-600 transition-all" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                                <button type="submit" className={`px-3 rounded-xl font-black text-black bg-gradient-to-r ${styles.gradient} shadow-lg shadow-${styles.shadow.split(' ')[0]}`}><Check size={18} /></button>
                            </form>
                        )}
                    </div>

                    {isPending && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-[22px] z-30">
                            <Loader2 className="animate-spin text-zinc-500 mb-2" />
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Esperando compañero...</span>
                            {amIOwner && <button onClick={(e) => { e.stopPropagation(); onDelete(mission._id); }} className="text-[10px] text-red-500 mt-2 hover:underline">Cancelar Invitación</button>}
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
    const [viewAllMode, setViewAllMode] = useState(false);

    // Estados Edición
    const [showEditModal, setShowEditModal] = useState(false);
    const [missionToEdit, setMissionToEdit] = useState(null);
    const [editSelectedDays, setEditSelectedDays] = useState([]);

    const DEFAULTS = { title: '', frequency: 'daily', type: 'habit', difficulty: 'easy', target: 1, unit: '', isCoop: false, friendId: '' };
    const [newMission, setNewMission] = useState(DEFAULTS);
    const [selectedDays, setSelectedDays] = useState([]);
    const daysOptions = [{ label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'X', value: 3 }, { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 }, { label: 'D', value: 0 }];

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [activeTab]);

    useEffect(() => {
        if (!showCreator) setNewMission(prev => ({ ...prev, frequency: activeTab === 'all' ? 'daily' : activeTab }));
        fetchMissions(); fetchFriends();
    }, [activeTab, showCreator]);

    const fetchMissions = async () => { try { const res = await api.get('/missions'); setMissions(res.data); } catch (e) { setMissions([]); } finally { setLoading(false); } };
    const fetchFriends = async () => { try { const res = await api.get('/social/friends'); setFriends(res.data.friends); } catch (e) { } };
    const showToast = (message, type = 'success') => setToast({ message, type });

    const toggleDay = (dayValue) => setSelectedDays(prev => prev.includes(dayValue) ? prev.filter(d => d !== dayValue) : [...prev, dayValue]);
    const toggleEditDay = (dayValue) => setEditSelectedDays(prev => prev.includes(dayValue) ? prev.filter(d => d !== dayValue) : [...prev, dayValue]);

    const getFilteredMissions = () => {
        if (viewAllMode) return missions;
        const today = new Date().getDay();
        return missions.filter(m => {
            if (activeTab !== 'all' && m.frequency !== activeTab) return false;
            if (m.isCoop && m.invitationStatus === 'pending' && m.user !== user._id) return false;
            if (m.frequency === 'daily' && m.specificDays && m.specificDays.length > 0) {
                if (!m.specificDays.includes(today)) return false;
            }
            return true;
        });
    };

    const filteredMissions = getFilteredMissions();
    const completedCount = filteredMissions.filter(m => m.completed).length;
    const totalCount = filteredMissions.length;
    const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    const handleOpenCreator = () => { setNewMission({ ...DEFAULTS, frequency: activeTab === 'all' ? 'daily' : activeTab }); setSelectedDays([]); setShowCreator(true); };
    const handleCloseCreator = () => setShowCreator(false);

    const handleCreate = async () => {
        if (!newMission.title?.trim()) return showToast("Falta título", "error");
        if (newMission.isCoop && !newMission.friendId) return showToast("Falta amigo", "error");
        const payload = { title: newMission.title.trim(), frequency: newMission.frequency || 'daily', type: newMission.type || 'habit', difficulty: newMission.difficulty || 'easy', target: parseInt(newMission.target) || 1, unit: newMission.unit ? newMission.unit.trim() : undefined, isCoop: !!newMission.isCoop, specificDays: newMission.frequency === 'daily' ? selectedDays : [] };
        if (payload.isCoop) payload.friendId = newMission.friendId;
        try { await api.post('/missions', payload); handleCloseCreator(); fetchMissions(); showToast("Creada", "success"); } catch (error) { showToast("Error", "error"); }
    };

    const handleUpdateProgress = async (mission, amount) => {
        try {
            const res = await api.put(`/missions/${mission._id}/progress`, { amount });
            if (res.data.progressOnly) { setMissions(prev => prev.map(m => m._id === mission._id ? res.data.mission : m)); return; }
            if (res.data.user) { setUser(res.data.user); localStorage.setItem('user', JSON.stringify(res.data.user)); }
            setMissions(prev => prev.map(m => m._id === mission._id ? res.data.mission : m));
            if (res.data.rewards) showToast(`+${res.data.rewards.xp} XP`, "success");
        } catch (e) { showToast("Error", "error"); }
    };

    const handleDelete = async (id) => { try { await api.delete(`/missions/${id}`); setMissions(prev => prev.filter(m => m._id !== id)); showToast("Eliminada", "info"); } catch (e) { } };

    const openEditModal = (mission) => {
        setMissionToEdit(mission);
        setEditSelectedDays(mission.specificDays || []);
        setShowEditModal(true);
    };

    const handleEditMission = async () => {
        if (!missionToEdit || !missionToEdit.title.trim()) return;
        try {
            await api.put(`/missions/${missionToEdit._id}/progress`, {
                editMode: true,
                title: missionToEdit.title, target: missionToEdit.target, frequency: missionToEdit.frequency, difficulty: missionToEdit.difficulty, unit: missionToEdit.unit,
                specificDays: missionToEdit.frequency === 'daily' ? editSelectedDays : []
            });
            setShowEditModal(false); fetchMissions(); showToast("Actualizada");
        } catch (e) { showToast("Error", "error"); }
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500" size={32} /></div>;

    return (
        <div className="min-h-screen bg-black text-white pb-24 animate-in fade-in relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER STICKY */}
            <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-zinc-800 pt-6 pb-2 px-4 shadow-xl">
                <div className="flex justify-between items-center mb-3">
                    <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                        Misiones <span className="text-yellow-500 capitalize">{viewAllMode ? 'GESTIÓN' : (activeTab === 'all' ? 'Todas' : activeTab === 'daily' ? 'DIARIAS' : activeTab === 'weekly' ? 'SEMANALES' : activeTab === 'monthly' ? 'MENSUALES' : 'ANUALES')}</span>
                    </h1>
                    <div className="flex gap-2">
                        <button onClick={() => setViewAllMode(!viewAllMode)} className={`p-2 rounded-xl shadow-lg active:scale-95 transition-transform border ${viewAllMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'}`}>{viewAllMode ? <Eye size={20} strokeWidth={3} /> : <EyeOff size={20} strokeWidth={3} />}</button>
                        <button onClick={handleOpenCreator} className="bg-yellow-500 text-black p-2 rounded-xl shadow-lg active:scale-95 transition-transform"><Plus size={20} strokeWidth={3} /></button>
                    </div>
                </div>
                {!viewAllMode && (
                    <>
                        <div className="grid grid-cols-4 gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                            {['daily', 'weekly', 'monthly', 'yearly'].map(freq => (
                                <button key={freq} onClick={() => setActiveTab(freq)} className={`py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === freq ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>{freq === 'daily' ? 'DIARIA' : freq === 'weekly' ? 'SEMANA' : freq === 'monthly' ? 'MES' : 'AÑO'}</button>
                            ))}
                        </div>
                        <div className="mt-2 h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-800"><div className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)] transition-all duration-500" style={{ width: `${completionRate}%` }} /></div>
                    </>
                )}
                {viewAllMode && <div className="bg-blue-900/20 border border-blue-500/30 p-2 rounded-xl text-center mb-2"><p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Modo Gestión: Toca una misión para editarla</p></div>}
            </div>

            {/* LISTA */}
            <div className="px-4 mt-4 space-y-4">
                {filteredMissions.length === 0 ? (
                    <div className="py-20 text-center opacity-60"><div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800"><Target className="text-zinc-600" size={32} /></div><p className="text-zinc-500 font-bold text-sm uppercase tracking-wide">Sin misiones activas</p></div>
                ) : (
                    <>
                        {filteredMissions.map(m => <MissionCard key={m._id} mission={m} onUpdateProgress={handleUpdateProgress} onDelete={handleDelete} currentUserId={user._id} onEdit={openEditModal} viewAllMode={viewAllMode} />)}
                        {!viewAllMode && <div className="text-center mt-8 mb-4"><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800 flex items-center justify-center gap-2 mx-auto w-fit"><Clock size={12} /> HASTA: <span className="text-zinc-300">{getDeadlineText(activeTab === 'all' ? 'daily' : activeTab)}</span></span></div>}
                    </>
                )}
            </div>

            {/* MODAL EDITAR */}
            {showEditModal && missionToEdit && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in">
                    <div className="bg-[#09090b] w-full max-w-sm rounded-[32px] border border-zinc-800 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2"><Edit size={18} className="text-yellow-500" /> Editar</h2><button onClick={() => setShowEditModal(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-zinc-800"><X size={18} /></button></div>
                        <div className="space-y-4">
                            <div><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Título</label><input type="text" value={missionToEdit.title} onChange={e => setMissionToEdit({ ...missionToEdit, title: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white font-bold text-sm outline-none focus:border-yellow-500/50" /></div>
                            <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Objetivo</label><input type="number" value={missionToEdit.target} onChange={e => setMissionToEdit({ ...missionToEdit, target: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white font-bold text-sm outline-none focus:border-yellow-500/50" /></div><div><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Unidad</label><input type="text" value={missionToEdit.unit || ''} onChange={e => setMissionToEdit({ ...missionToEdit, unit: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white font-bold text-sm outline-none focus:border-yellow-500/50" placeholder="Págs, Km..." /></div></div>
                            <div><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Frecuencia</label><select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white text-xs font-bold outline-none" value={missionToEdit.frequency} onChange={e => setMissionToEdit({ ...missionToEdit, frequency: e.target.value })}><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></div>
                            {missionToEdit.frequency === 'daily' && (<div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-xl"><label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Días Específicos</label><div className="flex justify-between">{daysOptions.map(d => (<button key={d.value} onClick={() => toggleEditDay(d.value)} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all border ${editSelectedDays.includes(d.value) ? 'bg-white text-black border-white scale-110' : 'bg-black text-zinc-600 border-zinc-800'}`}>{d.label}</button>))}</div></div>)}
                            <div><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Dificultad</label><select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white text-xs font-bold outline-none" value={missionToEdit.difficulty} onChange={e => setMissionToEdit({ ...missionToEdit, difficulty: e.target.value })}><option value="easy">Fácil</option><option value="medium">Media</option><option value="hard">Difícil</option><option value="epic">Épica</option></select></div>
                            <div className="pt-4 flex gap-2"><button onClick={() => setShowEditModal(false)} className="flex-1 bg-zinc-800 text-zinc-300 py-3 rounded-xl font-bold text-xs uppercase">Cancelar</button><button onClick={handleEditMission} className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2"><Save size={16} /> Guardar</button></div>
                        </div>
                    </div>
                </div>, document.body
            )}

            {/* MODAL CREAR */}
            {showCreator && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#09090b] w-full max-w-sm rounded-[32px] border border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col h-full sm:h-auto max-h-[85vh]">
                        <div className="flex justify-between items-center p-5 border-b border-zinc-800/50 bg-[#09090b] shrink-0 z-10"><h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2"><Plus size={18} className="text-yellow-500" /> Nueva Misión</h2><button onClick={handleCloseCreator} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-zinc-800 transition-colors"><X size={18} /></button></div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-black/20">
                            <div className="mt-2"><label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Título</label><input type="text" placeholder="Ej: Leer 10 páginas" autoFocus value={newMission.title} onChange={e => setNewMission({ ...newMission, title: e.target.value })} className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-white placeholder-zinc-700 outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 transition-all font-bold text-sm" /></div>
                            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-zinc-800"><button onClick={() => setNewMission({ ...newMission, type: 'habit' })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newMission.type === 'habit' ? 'bg-white text-black shadow' : 'text-zinc-500'}`}>Hábito</button><button onClick={() => setNewMission({ ...newMission, type: 'quest' })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${newMission.type === 'quest' ? 'bg-white text-black shadow' : 'text-zinc-500'}`}>Puntual</button></div>
                            <div className="grid grid-cols-2 gap-3"><div><label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Objetivo</label><input type="number" inputMode="numeric" min="1" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center text-white font-mono font-bold text-sm outline-none focus:border-blue-500/50 transition-all" value={newMission.target} onChange={e => setNewMission({ ...newMission, target: e.target.value === '' ? '' : parseInt(e.target.value) })} /></div><div><label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Unidad</label><input type="text" placeholder="km, pags..." className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center text-white font-medium text-sm outline-none focus:border-blue-500/50 transition-all placeholder-zinc-700" value={newMission.unit} onChange={e => setNewMission({ ...newMission, unit: e.target.value })} /></div></div>
                            <div className="grid grid-cols-2 gap-3"><div><label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Frecuencia</label><select className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-2.5 text-white text-xs font-bold outline-none" value={newMission.frequency} onChange={e => setNewMission({ ...newMission, frequency: e.target.value })}><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></div><div><label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Dificultad</label><select className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-2.5 text-white text-xs font-bold outline-none" value={newMission.difficulty} onChange={e => setNewMission({ ...newMission, difficulty: e.target.value })}><option value="easy">Fácil</option><option value="medium">Media</option><option value="hard">Difícil</option><option value="epic">Épica</option></select></div></div>
                            {newMission.frequency === 'daily' && (<div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-xl"><label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Días Específicos</label><div className="flex justify-between">{daysOptions.map(d => (<button key={d.value} onClick={() => toggleDay(d.value)} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all border ${selectedDays.includes(d.value) ? 'bg-white text-black border-white scale-110' : 'bg-black text-zinc-600 border-zinc-800'}`}>{d.label}</button>))}</div></div>)}
                            <div className={`p-3 rounded-xl border transition-all ${newMission.isCoop ? 'bg-purple-900/10 border-purple-500/30' : 'bg-zinc-900/30 border-zinc-800'}`}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className={`p-1.5 rounded-lg ${newMission.isCoop ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}><Users size={14} /></div><span className="text-xs font-bold uppercase text-zinc-400">Cooperativo</span></div><div onClick={() => setNewMission({ ...newMission, isCoop: !newMission.isCoop })} className={`w-8 h-5 rounded-full relative cursor-pointer transition-colors ${newMission.isCoop ? 'bg-purple-500' : 'bg-zinc-700'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${newMission.isCoop ? 'left-4' : 'left-1'}`}></div></div></div>{newMission.isCoop && (<select className="w-full bg-black border border-purple-500/30 rounded-xl p-2 text-white text-xs font-bold outline-none mt-2" value={newMission.friendId} onChange={e => setNewMission({ ...newMission, friendId: e.target.value })}><option value="">Invitar a...</option>{friends.map(f => <option key={f._id} value={f._id}>{f.username}</option>)}</select>)}</div>
                        </div>
                        <div className="p-5 border-t border-zinc-800 bg-[#09090b] shrink-0 z-10"><button onClick={handleCreate} className="w-full bg-yellow-500 text-black py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-yellow-400 active:scale-95 transition-all shadow-lg">Crear Misión</button></div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
}