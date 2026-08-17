import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useSmoothMount } from '../hooks/useSmoothMount';
import useSWR from 'swr';
import {
    Trash2, Plus, Check, X, Target, Users, Loader2, Repeat, Flag, Clock, Eye, EyeOff, Edit, Save
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingScreen from '../components/common/LoadingScreen';

const fetcher = url => api.get(url).then(res => res.data);

const ICON_XP = "/assets/icons/xp.png";
const ICON_COIN = "/assets/icons/moneda.png";
const ICON_CHIP = "/assets/icons/ficha.png";
const ICON_HEART = "/assets/icons/corazon.png";

// Acento de la pantalla (el amarillo de `yellow-500` que ya usan el icono de
// editar, los bordes de foco y el modal). Se usaba en el botón de nueva misión
// pero no estaba declarado: la pantalla entera reventaba con
// "ACENTO is not defined" nada más entrar en Misiones.
const ACENTO = '#eab308';

// Inicial de cada día, indexada por el número que devuelve getDay() (0 = domingo).
// La usa la fila de días de las misiones diarias, y tampoco estaba declarada:
// era el segundo "is not defined" esperando detrás del anterior.
const DAY_LABELS = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };

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

// ⚠️ Estos valores tienen que ser EXACTAMENTE los del servidor
// (backend/utils/scheduler.js → DAMAGE_RULES). Estaban al revés: la tarjeta de
// una misión épica decía "-0 HP" cuando en realidad te quita 50.
const getPotentialDamage = (diff) => {
    const rules = { easy: 5, medium: 10, hard: 20, epic: 50 };
    return rules[diff] !== undefined ? rules[diff] : 5;
};

/**
 * Estilo por dificultad, con el mismo sistema visual que el Home.
 *
 * Antes cada tarjeta era un degradado saturado de tres colores con un borde de
 * 2px encendido y un halo fuerte: cuatro dificultades gritando a la vez y
 * ninguna destacando sobre las demás. Ahora el color es UN tono por dificultad,
 * reducido a una línea de acento de 2px arriba, y la jerarquía la marca el
 * contenido, no el ruido.
 */
const DIFFICULTY = {
    easy: { accent: '#4ade80', label: 'Fácil' },
    medium: { accent: '#22d3ee', label: 'Media' },
    hard: { accent: '#fb923c', label: 'Difícil' },
    epic: { accent: '#a855f7', label: 'Épica' }
};

/**
 * Se llamaba `getGradientStyles` pero MissionCard la invoca como `estiloMision`:
 * un renombrado a medias que dejaba la pantalla entera con
 * "estiloMision is not defined".
 *
 * Devuelve el color con DOS nombres, `accent` y `color`, porque la tarjeta usa
 * los dos: la línea de acento y el halo leen `accent`, y el chip de dificultad
 * y el botón de incremento leen `color`. Sin el alias, esos tres pintaban
 * "undefined1f" como color y se quedaban transparentes.
 */
const estiloMision = (diff, completed) => {
    const base = DIFFICULTY[diff] || { accent: '#71717a', label: diff };
    const salida = completed
        ? { accent: '#3f3f46', label: 'Hecho', completed: true }
        : { ...base, completed: false };
    return { ...salida, color: salida.accent };
};

function MissionCard({ mission, onUpdateProgress, onRequestDelete, currentUserId, onEdit, viewAllMode }) {
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [showInput, setShowInput] = useState(false);
    const startX = useRef(0);
    const THRESHOLD = 80;

    const styles = estiloMision(mission.difficulty, mission.completed);
    const isPending = mission.isCoop && mission.invitationStatus === 'pending';
    const amIOwner = mission.user === currentUserId;
    const isBinary = mission.target === 1;
    const damage = getPotentialDamage(mission.difficulty);

    const canSwipe = !isPending && !viewAllMode;

    const handleStart = (clientX) => { if (canSwipe) { setIsDragging(true); startX.current = clientX; } };

    const handleMove = (clientX) => {
        if (!isDragging) return;
        const diff = clientX - startX.current;

        if (mission.completed && diff > 0) return;
        if (mission.completed && diff < 0 && !viewAllMode) return;

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
            if (!mission.completed || viewAllMode) {
                // Confirmación con el modal de la app en vez del window.confirm nativo
                onRequestDelete(mission);
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
            <div className="h-[6px] w-full bg-[#18181b] rounded-full overflow-hidden flex mt-3">
                {mission.isCoop ? (
                    // En los retos sociales cada participante pinta su tramo
                    mission.participants.map((p) => {
                        const contrib = (mission.contributions && mission.contributions[p._id]) || 0;
                        const w = (contrib / mission.target) * 100;
                        const colorClass = getUserColor(p._id);
                        return <div key={p._id} className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${w}%` }} />;
                    })
                ) : (
                    <div className="h-full transition-all duration-500 relative" style={{ width: `${progressPercent}%`, backgroundColor: styles.accent }} />
                )}
            </div>
        );
    };

    return (
        <div className="relative w-full mb-4 select-none group" onClick={() => viewAllMode && onEdit(mission)}>
            {canSwipe && (
                <div className={`absolute inset-0 flex items-center justify-between px-6 transition-colors z-0 rounded-[24px] border ${bgAction}`}>
                    {dragX > 0 && <div className="flex items-center gap-2 text-emerald-400 font-black text-sm"><Check size={24} /> COMPLETAR</div>}
                    {dragX < 0 && <div className="flex items-center gap-2 text-red-400 font-black text-sm">ELIMINAR <Trash2 size={24} /></div>}
                </div>
            )}

            <div
                style={cardStyle}
                className={`relative rounded-[24px] overflow-hidden z-10 will-change-transform bg-[#0a0a0c] border border-white/[0.07] ${isPending ? 'opacity-70' : ''} ${viewAllMode ? 'cursor-pointer active:scale-[0.985]' : ''} ${mission.completed ? 'opacity-60' : 'opacity-100'}`}
                onTouchStart={(e) => handleStart(e.targetTouches[0].clientX)}
                onTouchMove={(e) => handleMove(e.targetTouches[0].clientX)}
                onTouchEnd={handleEnd}
                onMouseDown={(e) => handleStart(e.clientX)}
                onMouseMove={(e) => handleMove(e.clientX)}
                onMouseUp={handleEnd}
                onMouseLeave={() => { if (isDragging) handleEnd() }}
            >
                {/* Línea de acento de 2px arriba: el color de la dificultad se
                    reduce a esto, igual que las tarjetas del Home */}
                <div className="absolute inset-x-0 top-0 h-0.5 z-20 pointer-events-none" style={{ background: `linear-gradient(90deg, ${styles.accent}, transparent)` }} />

                <div className="p-4 relative overflow-hidden h-full flex flex-col justify-between">
                    {/* Halo suave del color, muy tenue */}
                    {!mission.completed && <div className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] pointer-events-none opacity-[0.11]" style={{ backgroundColor: styles.accent }} />}
                    <div className="relative z-10">
                        <div className="flex justify-between items-start gap-3 mb-1">
                            <div className="flex-1 min-w-0 relative">
                                <div className="pr-20 mb-1">
                                    <div className="flex items-center gap-2">
                                        {mission.isCoop && <Users size={16} style={{ color: styles.accent }} />}
                                        {viewAllMode && <Edit size={14} className="text-yellow-500 shrink-0" />}
                                        <h3 className={`text-base font-black leading-tight uppercase tracking-tighter break-words ${mission.completed ? 'text-zinc-500 line-through decoration-2' : 'text-white'}`}>{mission.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex items-baseline gap-1">
                                            {/* Número principal en blanco y la unidad con el color
                                                del widget, la regla del sistema visual */}
                                            <span className="text-[30px] leading-none font-black tracking-[-0.05em] text-white not-italic">{mission.progress}</span>
                                            <span className="text-[13px] font-black not-italic" style={{ color: styles.accent }}>/{mission.target}</span>
                                            {mission.unit && <span className="text-[10px] font-bold text-zinc-500 uppercase">{mission.unit}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute -top-1 -right-1 flex items-center gap-2">
                                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                        {mission.type === 'habit' ? <><Repeat size={10} /> Hábito</> : <><Flag size={10} /> Puntual</>}
                                    </div>
                                    <div
                                        className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border"
                                        style={{ color: styles.accent, borderColor: styles.accent + '55', backgroundColor: styles.accent + '15' }}
                                    >{styles.label}</div>
                                </div>

                                {/* Días en los que toca: antes no había forma de saberlo
                                    sin abrir el modo gestión y editar la misión. */}
                                {mission.frequency === 'daily' && mission.specificDays?.length > 0 && (
                                    <div className="flex items-center gap-1 mt-2.5">
                                        {[1, 2, 3, 4, 5, 6, 0].map(d => (
                                            <span
                                                key={d}
                                                className={`w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8px] font-black not-italic ${mission.specificDays.includes(d) ? 'bg-zinc-700 text-white' : 'bg-[#18181b] text-zinc-700'}`}
                                            >
                                                {DAY_LABELS[d]}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Chip de dificultad + botón de incremento */}
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <span
                                    className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-1 rounded-[8px] border not-italic"
                                    style={{
                                        color: styles.color,
                                        background: `${styles.color}1f`,
                                        borderColor: `${styles.color}4d`
                                    }}
                                >
                                    {styles.label}
                                </span>
                                {!isBinary && !mission.completed && !isPending && !viewAllMode && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowInput(!showInput); }}
                                        aria-label="Añadir progreso"
                                        className="w-8 h-8 rounded-[11px] flex items-center justify-center active:scale-90 transition-transform"
                                        style={{ background: `${styles.color}1f`, color: styles.color }}
                                    >
                                        <Plus size={16} strokeWidth={2.6} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {renderProgressBar()}

                        {/* Leyenda de los retos sociales */}
                        {mission.isCoop && mission.participants?.length > 1 && (
                            <div className="flex items-center gap-3 mt-2">
                                {mission.participants.map(p => (
                                    <div key={p._id} className="flex items-center gap-1.5">
                                        <span className={`w-[7px] h-[7px] rounded-full ${getUserColor(p._id)}`} />
                                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.08em] truncate max-w-[80px] not-italic">
                                            {p.username}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pie: recompensas y castigo */}
                        <div className="flex gap-4 mt-3 pt-3 border-t border-white/[0.05] relative z-10 items-center">
                            <div className="flex items-center gap-3">
                                {mission.xpReward > 0 && (
                                    <div className="flex items-center gap-1"><span className={`text-[12px] font-black not-italic ${mission.completed ? 'text-zinc-600' : 'text-zinc-300'}`}>+{mission.xpReward}</span><img src={ICON_XP} className={`w-5 h-5 object-contain ${mission.completed ? 'grayscale opacity-50' : ''}`} alt="XP" /></div>
                                )}
                                {(mission.coinReward > 0) && (
                                    <div className="flex items-center gap-1"><span className={`text-[12px] font-black not-italic ${mission.completed ? 'text-zinc-600' : 'text-zinc-300'}`}>+{mission.coinReward}</span><img src={ICON_COIN} className={`w-5 h-5 object-contain ${mission.completed ? 'grayscale opacity-50' : ''}`} alt="Monedas" /></div>
                                )}
                                {(mission.gameCoinReward > 0) && (
                                    <div className="flex items-center gap-1"><span className={`text-[12px] font-black not-italic ${mission.completed ? 'text-zinc-600' : 'text-zinc-300'}`}>+{mission.gameCoinReward}</span><img src={ICON_CHIP} className={`w-5 h-5 object-contain ${mission.completed ? 'grayscale opacity-50' : ''}`} alt="Fichas" /></div>
                                )}
                            </div>
                            {/* Las épicas no quitan vida (daño 0). Pintarlo igual
                                dejaba un "-0 ❤" que no informa de nada. */}
                            {!mission.completed && damage > 0 && (
                                <div className="ml-auto flex items-center gap-1.5 opacity-90"><span className="text-sm font-black text-red-400">-{damage}</span><img src={ICON_HEART} className="w-5 h-5 object-contain opacity-80" alt="HP" /></div>
                            )}
                        </div>

                        {showInput && !isBinary && (
                            <form onSubmit={handleNumericSubmit} className="mt-3 flex gap-2 animate-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                                <input type="number" inputMode="numeric" pattern="[0-9]*" autoFocus placeholder="Cantidad..." className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white font-black text-sm text-center outline-none focus:border-zinc-600 transition-all" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                                <button type="submit" style={{ backgroundColor: styles.accent }} className="px-4 rounded-xl font-black text-black active:scale-95 transition-transform"><Check size={18} /></button>
                            </form>
                        )}
                    </div>

                    {isPending && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm rounded-[22px] z-30">
                            <Loader2 className="animate-spin text-zinc-500 mb-2" /><span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Esperando compañero...</span>
                            {/* Llamaba a `onDelete`, que NO es una prop de este
                                componente: pulsarlo reventaba con ReferenceError.
                                Va por el mismo camino que el resto de borrados,
                                con su diálogo de confirmación. */}
                            {amIOwner && <button onClick={(e) => { e.stopPropagation(); onRequestDelete(mission); }} className="text-[10px] text-red-500 mt-2 hover:underline">Cancelar Invitación</button>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Missions() {
    const isSmoothMounted = useSmoothMount();
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);

    // 🔥 SWR INYECTADO PARA CACHÉ INSTANTÁNEA
    const { data: missionsData, mutate: mutateMissions, isLoading } = useSWR('/missions', fetcher);
    const { data: friendsData } = useSWR('/social/friends', fetcher);

    const missions = missionsData || [];
    const friends = friendsData?.friends || [];

    const [activeTab, setActiveTab] = useState('daily');
    const [showCreator, setShowCreator] = useState(false);
    const [toast, setToast] = useState(null);
    const [missionToDelete, setMissionToDelete] = useState(null);
    const [viewAllMode, setViewAllMode] = useState(false);

    const [showEditModal, setShowEditModal] = useState(false);
    const [missionToEdit, setMissionToEdit] = useState(null);
    const [editSelectedDays, setEditSelectedDays] = useState([]);

    const DEFAULTS = { title: '', frequency: 'daily', type: 'habit', difficulty: 'easy', target: 1, unit: '', isCoop: false, friendId: '' };
    const [newMission, setNewMission] = useState(DEFAULTS);
    const [selectedDays, setSelectedDays] = useState([]);
    const daysOptions = [{ label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'X', value: 3 }, { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 }, { label: 'D', value: 0 }];

    useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [activeTab]);
    useEffect(() => { if (!showCreator) setNewMission(prev => ({ ...prev, frequency: activeTab === 'all' ? 'daily' : activeTab })); }, [activeTab, showCreator]);

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
    // Vida que perderías esta noche si dejas así las misiones pendientes
    const pendingDamage = filteredMissions
        .filter(m => !m.completed && !(m.isCoop && m.invitationStatus === 'pending'))
        .reduce((acc, m) => acc + getPotentialDamage(m.difficulty), 0);

    const handleOpenCreator = () => { setNewMission({ ...DEFAULTS, frequency: activeTab === 'all' ? 'daily' : activeTab }); setSelectedDays([]); setShowCreator(true); };
    const handleCloseCreator = () => setShowCreator(false);

    const handleCreate = async () => {
        if (!newMission.title?.trim()) return showToast("Falta título", "error");
        if (newMission.isCoop && !newMission.friendId) return showToast("Falta amigo", "error");
        const payload = { title: newMission.title.trim(), frequency: newMission.frequency || 'daily', type: newMission.type || 'habit', difficulty: newMission.difficulty || 'easy', target: parseInt(newMission.target) || 1, unit: newMission.unit ? newMission.unit.trim() : undefined, isCoop: !!newMission.isCoop, specificDays: newMission.frequency === 'daily' ? selectedDays : [] };
        if (payload.isCoop) payload.friendId = newMission.friendId;
        try { await api.post('/missions', payload); handleCloseCreator(); mutateMissions(); showToast("Creada", "success"); } catch (error) { showToast("Error", "error"); }
    };

    // 🔥 OPTIMISTIC UI CON SWR
    const handleUpdateProgress = async (mission, amount) => {
        const newProgress = mission.progress + amount;
        const isCompletedNow = newProgress >= mission.target;

        mutateMissions(prev => prev.map(m => {
            if (m._id === mission._id) {
                return {
                    ...m,
                    progress: newProgress > m.target ? m.target : newProgress,
                    completed: isCompletedNow || m.completed
                };
            }
            return m;
        }), false);

        if (isCompletedNow && !mission.completed) {
            setUser({
                ...user,
                currentXP: (user.currentXP || 0) + (mission.xpReward || 0),
                coins: (user.coins || 0) + (mission.coinReward || 0),
                gameCoins: (user.gameCoins || 0) + (mission.gameCoinReward || 0)
            });
            showToast(`+${mission.xpReward} XP`, "success");
        }

        try {
            const res = await api.put(`/missions/${mission._id}/progress`, { amount });
            if (res.data.progressOnly) { mutateMissions(); return; }
            if (res.data.user) setUser(res.data.user);
            mutateMissions();
        } catch (e) {
            mutateMissions(); // Rollback
            showToast("Error de red. Acción revertida.", "error");
        }
    };

    // Misión pendiente de confirmar borrado (se muestra con ConfirmDialog)
    const handleDelete = async (id) => {
        mutateMissions(prev => prev.filter(m => m._id !== id), false);
        try { await api.delete(`/missions/${id}`); showToast("Eliminada", "info"); mutateMissions(); } catch (e) { mutateMissions(); }
    };

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
            setShowEditModal(false); mutateMissions(); showToast("Actualizada");
        } catch (e) { showToast("Error", "error"); }
    };

    // 🔥 PANTALLA DE CARGA REESCRITA
    if (!isSmoothMounted || (!missionsData && isLoading)) return <LoadingScreen message="Cargando misiones..." />;

    return (
        <div className="min-h-screen bg-black text-white pb-24 animate-in fade-in relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {missionToDelete && (
                <ConfirmDialog
                    message={missionToDelete.isCoop
                        ? `"${missionToDelete.title}" es cooperativa: se eliminará también para tu compañero.`
                        : `¿Borrar "${missionToDelete.title}" permanentemente?`}
                    confirmLabel="Borrar"
                    onCancel={() => setMissionToDelete(null)}
                    onConfirm={() => { handleDelete(missionToDelete._id); setMissionToDelete(null); }}
                />
            )}

            <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md pt-[18px] pb-3 px-4">
                {/* CABECERA DE PÁGINA */}
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none not-italic">
                            {viewAllMode ? 'Modo gestión' : `Hasta ${getDeadlineText(activeTab === 'all' ? 'daily' : activeTab)}`}
                        </p>
                        <h1 className="mt-[9px] text-[26px] font-black text-white uppercase tracking-[-0.045em] leading-none not-italic">
                            Misiones
                        </h1>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 mt-1">
                        <button
                            onClick={() => setViewAllMode(!viewAllMode)}
                            aria-label={viewAllMode ? 'Salir del modo gestión' : 'Modo gestión'}
                            className={`transition-colors ${viewAllMode ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-200'}`}
                        >
                            {viewAllMode ? <Eye size={21} /> : <EyeOff size={21} />}
                        </button>
                        <button onClick={handleOpenCreator} aria-label="Nueva misión" className="transition-transform active:scale-90" style={{ color: ACENTO }}>
                            <Plus size={22} strokeWidth={3} />
                        </button>
                    </div>
                </div>

                {!viewAllMode && (
                    <>
                        <div className="grid grid-cols-4 gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                            {/* py-2.5: antes eran 27px de alto, por debajo de lo que se
                                acierta con el pulgar sin fallar */}
                            {['daily', 'weekly', 'monthly', 'yearly'].map(freq => (
                                <button key={freq} onClick={() => setActiveTab(freq)} className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === freq ? 'bg-white text-black shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>{freq === 'daily' ? 'DIARIA' : freq === 'weekly' ? 'SEMANA' : freq === 'monthly' ? 'MES' : 'AÑO'}</button>
                            ))}
                        </div>
                    </>
                )}

                {viewAllMode && (
                    <div className="bg-blue-950/20 border border-blue-500/30 p-3 rounded-[18px] text-center mt-[18px]">
                        <p className="text-[10px] text-blue-300 font-black uppercase tracking-[0.1em] not-italic">Toca una misión para editarla</p>
                    </div>
                )}
            </div>

            <div className="px-4 mt-3 space-y-3">
                {filteredMissions.length === 0 ? (
                    <div className="py-20 text-center">
                        <div className="w-16 h-16 bg-[#0a0a0c] border border-white/[0.07] rounded-full flex items-center justify-center mx-auto mb-4">
                            <Target className="text-zinc-700" size={30} />
                        </div>
                        <p className="text-zinc-500 font-black text-[11px] uppercase tracking-[0.1em] not-italic">Sin misiones activas</p>
                    </div>
                ) : (
                    <>
                        {filteredMissions.map(m => <MissionCard key={m._id} mission={m} onUpdateProgress={handleUpdateProgress} onRequestDelete={setMissionToDelete} currentUserId={user._id} onEdit={openEditModal} viewAllMode={viewAllMode} />)}
                        {!viewAllMode && (
                            <div className="text-center mt-6 mb-4">
                                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.08em] flex items-center justify-center gap-1.5 not-italic">
                                    <Clock size={11} /> Hasta {getDeadlineText(activeTab === 'all' ? 'daily' : activeTab)}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

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