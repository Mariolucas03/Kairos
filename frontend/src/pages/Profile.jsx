import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
    Trophy, Coins, Activity, Dumbbell, Utensils,
    X, CheckCircle, Clock, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Zap,
    LogOut, Gamepad2, Star, MapPin, Lock,
    Sunrise, Sun, Moon, Coffee, Flame, HeartCrack, ArrowRightLeft
} from 'lucide-react';
import api from '../services/api';

// --- DND KIT (Solo para visualización correcta del Grid) ---
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import SortableWidget from '../components/common/SortableWidget';

// --- WIDGETS ---
import MoodWidget from '../components/widgets/MoodWidget';
import WeightWidget from '../components/widgets/WeightWidget';
import FoodWidget from '../components/widgets/FoodWidget';
import StreakWidget from '../components/widgets/StreakWidget';
import TrainingWidget from '../components/widgets/TrainingWidget';
import SleepWidget from '../components/widgets/SleepWidget';
import StepsWidget from '../components/widgets/StepsWidget';
import MissionsWidget from '../components/widgets/MissionsWidget';
import SportWidget from '../components/widgets/SportWidget';
import WeeklyWidget from '../components/widgets/WeeklyWidget';
import KcalBalanceWidget from '../components/widgets/KcalBalanceWidget';

// --- COMPONENTES EXCLUSIVOS DE PERFIL ---
import RPGBody from '../components/profile/RPGBody';
import ProfileStats from '../components/profile/ProfileStats';

// ==========================================
// 1. MODALES DE DETALLE (SOLO LECTURA)
// ==========================================

// Detalle Deporte
function SportDetailsModal({ workouts, onClose }) {
    const [activeTab, setActiveTab] = useState(0);
    if (!workouts || workouts.length === 0) return null;
    const current = workouts[activeTab];

    return (
        <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="text-green-500" /> Historial Deporte</h2>
                    <button onClick={onClose} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
                {workouts.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto mb-4 pb-2 border-b border-gray-800">
                        {workouts.map((w, idx) => (
                            <button key={idx} onClick={() => setActiveTab(idx)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeTab === idx ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{w.routineName || `Actividad ${idx + 1}`}</button>
                        ))}
                    </div>
                )}
                <div className="space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="text-center">
                        <h3 className="text-2xl font-black text-white uppercase mb-1">{current.routineName}</h3>
                        <div className="flex justify-center gap-2">
                            <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 font-mono">{new Date(current.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-xs bg-green-900/30 text-green-400 border border-green-500/30 px-2 py-1 rounded font-bold capitalize">{current.intensity}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 text-center"><span className="text-blue-500 text-[10px] font-bold uppercase block mb-1 flex justify-center gap-1"><MapPin size={10} /> DISTANCIA</span><span className="text-white font-bold text-xl">{current.distance || 0} km</span></div>
                        <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 text-center"><span className="text-orange-500 text-[10px] font-bold uppercase block mb-1 flex justify-center gap-1"><Clock size={10} /> TIEMPO</span><span className="text-white font-bold text-xl">{current.duration} min</span></div>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-xl text-center"><span className="text-gray-500 text-xs">Calorías Quemadas</span><p className="text-2xl font-black text-white">{current.caloriesBurned} kcal</p></div>
                </div>
            </div>
        </div>
    );
}

// Detalle Gym
function GymDetailsModal({ workouts, onClose }) {
    const [activeTab, setActiveTab] = useState(0);
    if (!workouts || workouts.length === 0) return null;
    const current = workouts[activeTab];
    const totalVolume = current.exercises?.reduce((t, e) => t + e.sets.reduce((s, st) => s + (st.weight * st.reps), 0), 0);

    const durationMin = Math.max(1, Math.floor((current.duration || 0) / 60));
    let intensityFactor = 5;
    if (current.intensity === 'Baja') intensityFactor = 3.5;
    if (current.intensity === 'Alta') intensityFactor = 7.5;
    const estimatedKcal = Math.round(durationMin * intensityFactor);
    const finalKcal = current.caloriesBurned > 0 ? current.caloriesBurned : estimatedKcal;

    return (
        <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Dumbbell className="text-blue-500" /> Historial Gym</h2>
                    <button onClick={onClose} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
                {workouts.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto mb-4 pb-2 border-b border-gray-800 shrink-0 custom-scrollbar">
                        {workouts.map((w, idx) => (
                            <button key={idx} onClick={() => setActiveTab(idx)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeTab === idx ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{w.name || `Rutina ${idx + 1}`}</button>
                        ))}
                    </div>
                )}
                <div className="flex-1 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-4 fade-in duration-300 key={activeTab}">
                    <div className="flex justify-between items-end mb-4 px-1">
                        <div><h3 className="font-bold text-white text-xl">{current.name}</h3><span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /> {Math.floor(current.duration / 60)} min</span></div>
                        <span className="bg-blue-900/30 text-blue-400 text-xs font-bold px-2 py-1 rounded border border-blue-500/30">{current.exercises?.length || 0} Ejercicios</span>
                    </div>
                    <div className="space-y-3">
                        {current.exercises?.map((ex, i) => (
                            <div key={i} className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                                <div className="flex justify-between mb-2"><span className="text-gray-200 font-bold text-sm">{ex.name}</span><span className="text-gray-500 text-xs font-mono">{ex.sets.length} Sets</span></div>
                                <div className="flex flex-wrap gap-2">{ex.sets.map((s, j) => (<div key={j} className="bg-gray-900 px-2 py-1 rounded text-xs text-zinc-400 border border-gray-800"><span className="text-white font-bold">{s.weight}kg</span> x {s.reps}</div>))}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4">
                        <div className="text-center"><p className="text-xs text-gray-500 uppercase font-bold">Volumen Total</p><p className="text-xl font-black text-white">{totalVolume.toLocaleString()} <span className="text-sm font-normal text-gray-500">kg</span></p></div>
                        <div className="text-center border-l border-gray-800"><p className="text-xs text-orange-500 uppercase font-bold flex items-center justify-center gap-1"><Flame size={12} /> Kcal Aprox</p><p className="text-xl font-black text-orange-400">{finalKcal}</p></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Detalle Balance
function BalanceDetailsModal({ data, onClose }) {
    const intake = data.nutrition?.totalKcal || data.totalKcal || 0;
    const sportBurn = data.sportWorkouts?.reduce((acc, curr) => acc + (curr.caloriesBurned || 0), 0) || 0;
    const gymBurn = data.gymWorkouts?.reduce((acc, curr) => acc + (curr.caloriesBurned || 0), 0) || 0;
    const totalBurned = sportBurn + gymBurn;
    const net = intake - totalBurned;

    return (
        <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <button onClick={onClose} className="absolute top-4 right-4 bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white z-20"><X size={20} /></button>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><ArrowRightLeft className="text-purple-500" /> Balance del Día</h2>
                <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-gray-800 mb-6">
                    <div className="text-center"><span className="text-xs text-gray-500 font-bold uppercase block mb-1">Neto</span><span className={`text-3xl font-black ${net > 0 ? 'text-white' : 'text-green-400'}`}>{net > 0 ? '+' : ''}{Math.round(net)}</span></div>
                    <div className="h-10 w-[1px] bg-gray-700"></div>
                    <div className="text-center"><span className="text-xs text-gray-500 font-bold uppercase block mb-1">Estado</span><span className="text-sm font-bold text-gray-300">{net > 500 ? 'Superávit' : net < -500 ? 'Déficit' : 'Mant.'}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-950/50 p-4 rounded-2xl border border-blue-900/30">
                        <div className="flex items-center gap-2 mb-3 text-blue-400 border-b border-blue-900/30 pb-2"><Utensils size={16} /> <span className="text-xs font-black uppercase">Ingesta</span></div>
                        <span className="text-lg font-black text-blue-400">+{Math.round(intake)}</span>
                    </div>
                    <div className="bg-gray-950/50 p-4 rounded-2xl border border-orange-900/30">
                        <div className="flex items-center gap-2 mb-3 text-orange-500 border-b border-orange-900/30 pb-2"><Flame size={16} /> <span className="text-xs font-black uppercase">Actividad</span></div>
                        <span className="text-lg font-black text-orange-500">-{Math.round(totalBurned)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Detalle Misiones
function MissionsHistoryModal({ stats, onClose }) {
    return (
        <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative flex flex-col max-h-[80vh]">
                <button onClick={onClose} className="absolute top-4 right-4 bg-gray-800/50 p-2 rounded-full text-silver-500 hover:text-white border border-white/10"><X size={20} /></button>
                <div className="flex items-center gap-2 text-gold-500 font-black text-xs tracking-widest uppercase mb-1"><Trophy size={14} /> Historial</div>
                <h2 className="text-2xl font-black text-white mb-4">Misiones</h2>
                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1 flex-1">
                    {stats.listCompleted && stats.listCompleted.length > 0 ? (
                        stats.listCompleted.map((m, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border flex flex-col gap-2 relative overflow-hidden group ${m.failed ? 'bg-red-950/30 border-red-500/30' : 'bg-gray-950 border-gray-800/50'}`}>
                                <div className="flex justify-between items-start relative z-10">
                                    <span className={`text-sm font-bold block line-clamp-2 ${m.failed ? 'text-red-200 line-through' : 'text-white'}`}>{m.title}</span>
                                    {m.failed ? <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">FAIL</span> : <CheckCircle size={16} className="text-green-500" />}
                                </div>
                                <div className={`flex gap-3 mt-1 pt-2 border-t relative z-10 ${m.failed ? 'border-red-500/20' : 'border-gray-800'}`}>
                                    {m.failed ? (
                                        <div className="flex items-center gap-1 w-full justify-center"><HeartCrack size={12} className="text-red-500 fill-red-500" /><span className="text-xs font-bold text-red-400">{m.hpLoss ? `-${m.hpLoss} HP` : 'Sin castigo'}</span></div>
                                    ) : (
                                        <>
                                            {(m.xpReward > 0) && <div className="flex items-center gap-1"><Star size={10} className="text-blue-400" /><span className="text-[10px] font-bold text-blue-200">+{m.xpReward} XP</span></div>}
                                            {(m.coinReward > 0) && <div className="flex items-center gap-1"><Coins size={10} className="text-yellow-400" /><span className="text-[10px] font-bold text-yellow-200">+{m.coinReward}</span></div>}
                                            {(m.gameCoinReward > 0) && <div className="flex items-center gap-1"><Gamepad2 size={10} className="text-purple-400" /><span className="text-[10px] font-bold text-purple-200">+{m.gameCoinReward}</span></div>}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 bg-gray-950 rounded-xl border border-gray-800 text-gray-500 text-sm"><p>Sin actividad registrada.</p></div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ==========================================
// COMPONENTE PRINCIPAL PERFIL
// ==========================================

export default function Profile() {
    const { user, setUser } = useOutletContext();
    const navigate = useNavigate();

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [calendarViewDate, setCalendarViewDate] = useState(new Date());
    const [dailyData, setDailyData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Modales Interactivos
    const [openStrength, setOpenStrength] = useState(false);
    const [selectedSportList, setSelectedSportList] = useState(null);
    const [selectedTrainingList, setSelectedTrainingList] = useState(null);
    const [selectedFood, setSelectedFood] = useState(null);
    const [selectedMissions, setSelectedMissions] = useState(null);
    const [showBalanceDetails, setShowBalanceDetails] = useState(false);

    // --- ORDEN Y CONFIGURACIÓN (SINCRONIZADO CON HOME) ---
    // Usamos los mismos defaults que Home por si el LocalStorage está vacío
    const DEFAULTS_ORDER = [
        'missions', 'sport', 'food', 'sleep', 'steps',
        'mood', 'weight', 'training', 'streak',
        'weekly', 'kcalBalance'
    ];
    const DEFAULTS_CONFIG = {
        missions: true, sport: true, food: true, sleep: true, steps: true,
        mood: true, weight: true, training: true, streak: true,
        weekly: true, kcalBalance: true
    };

    const [widgetOrder, setWidgetOrder] = useState(DEFAULTS_ORDER);
    const [visibleWidgets, setVisibleWidgets] = useState(DEFAULTS_CONFIG);

    // Sensores DnD (solo para renderizar el grid correctamente, no permitiremos mover aquí para que sea "espejo")
    // Opcional: Si quieres permitir mover en perfil, activa los sensores.
    // Si quieres que sea ESTRICTAMENTE espejo de Home y solo editable en Home, podemos deshabilitar el drag aquí.
    // El usuario dijo "refleje el home", pero antes pidió Drag and Drop.
    // Para cumplir "refleje el home tal cual", deshabilitamos el drag visual aquí, solo renderizamos el orden.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 999999, tolerance: 5 } }), // Drag desactivado en Perfil
        useSensor(TouchSensor, { activationConstraint: { delay: 999999, tolerance: 5 } })
    );

    useEffect(() => {
        try {
            // Cargar SIEMPRE del LocalStorage del Home
            const savedOrder = JSON.parse(localStorage.getItem('home_widgets_order'));
            if (savedOrder && Array.isArray(savedOrder)) {
                // Filtramos 'gains'
                const mergedOrder = savedOrder.filter(key => key !== 'gains');
                if (!mergedOrder.includes('weekly')) mergedOrder.push('weekly');
                if (!mergedOrder.includes('kcalBalance')) mergedOrder.push('kcalBalance');
                setWidgetOrder(mergedOrder);
            }

            const savedConfig = JSON.parse(localStorage.getItem('home_widgets_config'));
            if (savedConfig) {
                const { gains, ...rest } = savedConfig;
                setVisibleWidgets({ ...DEFAULTS_CONFIG, ...rest });
            }
        } catch (e) { console.error("Error config", e); }
    }, []);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/daily/specific?date=${selectedDate}`);
                setDailyData(res.data);
            } catch (error) { setDailyData(null); }
            finally { setLoading(false); }
        };
        fetchHistory();
    }, [selectedDate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (setUser) setUser(null);
        navigate('/login');
    };

    // 🔥 RENDERIZADO DE WIDGETS
    const renderWidgetByKey = (key) => {
        // Usamos safeData para evitar fallos, pero mostramos 0/vacio si no hay datos
        const safeData = dailyData || {};
        const noOp = () => { }; // Función vacía para bloquear updates

        // Clase base: sin interacción de puntero para widgets simples
        const wrapperClass = "h-full w-full pointer-events-none";
        // Clase interactiva: para widgets con modal de detalle
        const interactiveClass = "h-full w-full cursor-pointer touch-manipulation active:opacity-80 transition-opacity duration-75";

        switch (key) {
            case 'missions':
                return (
                    <div onClick={() => setSelectedMissions(safeData.missionStats)} className={interactiveClass}>
                        <MissionsWidget completed={safeData.missionStats?.completed} total={safeData.missionStats?.total} completedMissions={safeData.missionStats?.listCompleted} />
                    </div>
                );
            case 'sport':
                return (
                    <div onClick={() => safeData.sportWorkouts?.length && setSelectedSportList(safeData.sportWorkouts)} className={interactiveClass}>
                        <SportWidget workouts={safeData.sportWorkouts || []} />
                    </div>
                );
            case 'training':
                return (
                    <div onClick={() => safeData.gymWorkouts?.length && setSelectedTrainingList(safeData.gymWorkouts)} className={interactiveClass}>
                        <TrainingWidget workouts={safeData.gymWorkouts || []} />
                    </div>
                );
            case 'food':
                const intake = safeData.nutrition?.totalKcal || safeData.totalKcal || 0;
                return (
                    <div onClick={() => setSelectedFood({ totalKcal: intake, meals: safeData.nutrition?.meals || {} })} className={interactiveClass}>
                        <FoodWidget currentKcal={intake} limitKcal={user?.macros?.calories} meals={safeData.nutrition?.meals} />
                    </div>
                );
            case 'sleep':
                return <div className={wrapperClass}><SleepWidget hours={safeData.sleepHours || 0} onUpdate={noOp} /></div>;
            case 'steps':
                return <div className={wrapperClass}><StepsWidget steps={safeData.steps || 0} onUpdate={noOp} /></div>;
            case 'mood':
                return <div className={wrapperClass}><MoodWidget mood={safeData.mood} onUpdate={noOp} /></div>;
            case 'weight':
                return <div className="h-full flex flex-col pointer-events-none"><WeightWidget initialWeight={safeData.weight || 0} onUpdate={noOp} /></div>;
            case 'streak':
                // Racha actual del usuario (siempre visible)
                return <div className={wrapperClass}><StreakWidget streak={user?.streak?.current || 0} /></div>;
            case 'weekly': return <div className="h-full pointer-events-none"><WeeklyWidget /></div>;
            case 'kcalBalance':
                const intake2 = safeData.nutrition?.totalKcal || safeData.totalKcal || 0;
                const burned = (safeData.sportWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0) + (safeData.gymWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0);
                return (
                    <div onClick={() => setShowBalanceDetails(true)} className={interactiveClass}>
                        <KcalBalanceWidget intake={intake2} burned={burned} />
                    </div>
                );
            default: return null;
        }
    };

    // --- CALENDARIO ---
    const renderCalendar = () => {
        const getDaysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const getFirstDay = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), 1).getDay(); return x === 0 ? 6 : x - 1; };
        const daysInMonth = getDaysInMonth(calendarViewDate);
        const firstDay = getFirstDay(calendarViewDate);
        const days = [];
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} className="h-8 w-8"></div>);
        for (let i = 1; i <= daysInMonth; i++) {
            const dStr = `${calendarViewDate.getFullYear()}-${String(calendarViewDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isSelected = selectedDate === dStr;
            const isToday = new Date().toISOString().split('T')[0] === dStr;
            const isFuture = new Date(dStr) > new Date();

            days.push(
                <button key={i} onClick={() => !isFuture && setSelectedDate(dStr)} disabled={isFuture}
                    className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all relative
                    ${isSelected
                            ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30 scale-110 z-10 border border-yellow-400'
                            : isFuture
                                ? 'text-zinc-700 cursor-not-allowed'
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        }`}>
                    {i}
                    {isToday && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 bg-white rounded-full"></div>}
                </button>
            );
        }

        return (
            <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-[32px] mb-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 bg-yellow-500 blur-3xl rounded-full w-40 h-40 -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex justify-between items-center mb-4 relative z-10">
                    <button onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-zinc-800"><ChevronLeft size={16} /></button>
                    <span className="text-white font-black uppercase tracking-wider text-sm">{monthNames[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}</span>
                    <button onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-zinc-800"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <span key={d} className="text-[10px] font-bold text-zinc-600">{d}</span>)}</div>
                <div className="grid grid-cols-7 gap-1 place-items-center relative z-10">{days}</div>
                <div className="mt-4 pt-4 border-t border-zinc-800 text-center relative z-10">
                    <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest bg-yellow-900/10 px-3 py-1 rounded-full border border-yellow-500/20">Viendo: {selectedDate}</span>
                </div>
            </div>
        );
    };

    if (loading && !dailyData && !user) return <div className="min-h-screen bg-black flex items-center justify-center"><Activity className="animate-spin text-zinc-500" /></div>;

    return (
        <div className="pb-24 pt-4 px-4 min-h-screen animate-in fade-in select-none bg-black">

            {/* STATS IMPORTANTES (FULL WIDTH) */}
            <div className="flex flex-col gap-4 mb-8">
                {/* 1. FUERZA 1RM (Abre Modal Grande) */}
                <ProfileStats mini={true} onClick={() => setOpenStrength(true)} />

                {/* 2. CUERPO (BLOQUEADO) */}
                <div className="relative w-full h-[160px] rounded-[32px] overflow-hidden border border-zinc-800 group bg-zinc-900">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                        <Lock className="text-zinc-500 mb-2" size={32} />
                        <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                            <MapPin size={14} /> MAPA MUSCULAR (PRÓXIMAMENTE)
                        </span>
                    </div>
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <RPGBody mini={true} />
                    </div>
                </div>
            </div>

            {/* CALENDARIO */}
            {renderCalendar()}

            {/* HISTORIAL (GRID PERFIL) */}
            <div className="mb-8">
                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 pl-2">Registro del Día</h3>

                {/* Grid que refleja la configuración del HOME */}
                <DndContext sensors={sensors} collisionDetection={closestCenter}>
                    <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-2 gap-4 auto-rows-[160px] grid-flow-dense px-1">
                            {widgetOrder.map((key) => {
                                // 1. Respetar visibilidad
                                if (!visibleWidgets[key]) return null;
                                // 2. Ocultar gains siempre
                                if (key === 'gains') return null;

                                const isFullWidth = ['training', 'missions', 'sport'].includes(key);
                                const content = renderWidgetByKey(key);

                                // 3. Si por alguna razón técnica es null (no debería), no renderizar
                                if (!content) return null;

                                return (
                                    <SortableWidget key={key} id={key} className={`${isFullWidth ? 'col-span-2' : 'col-span-1'} h-full`}>
                                        {content}
                                    </SortableWidget>
                                );
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            {/* LOGOUT */}
            <div className="border-t border-zinc-800 pt-6">
                <button onClick={handleLogout} className="w-full bg-red-950/20 border border-red-900/30 text-red-500 p-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm hover:bg-red-900/40 transition-all active:scale-95">
                    <LogOut size={18} /> CERRAR SESIÓN
                </button>
                <p className="text-center text-[10px] text-zinc-700 mt-4 font-mono">ID: {user?._id}</p>
            </div>

            {/* MODAL 1RM GRANDE (ESTILO PREMIUM) */}
            {openStrength && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="w-full max-w-2xl relative z-10">
                        <ProfileStats onCloseExternal={() => setOpenStrength(false)} />
                    </div>
                </div>
            )}

            {/* Modales Detalle de Historial */}
            {selectedSportList && <SportDetailsModal workouts={selectedSportList} onClose={() => setSelectedSportList(null)} />}
            {selectedTrainingList && <GymDetailsModal workouts={selectedTrainingList} onClose={() => setSelectedTrainingList(null)} />}
            {showBalanceDetails && dailyData && <BalanceDetailsModal data={dailyData} onClose={() => setShowBalanceDetails(false)} />}
            {selectedMissions && <MissionsHistoryModal stats={selectedMissions} onClose={() => setSelectedMissions(null)} />}

            {/* Modal Comida */}
            {selectedFood && (
                <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col">
                        <button onClick={() => setSelectedFood(null)} className="absolute top-4 right-4 bg-gray-800/50 p-2 rounded-full text-gray-400 hover:text-white"><X size={20} /></button>
                        <div className="flex items-center gap-2 text-orange-500 font-bold text-sm tracking-wider uppercase mb-1"><Utensils size={18} /> HISTORIAL</div>
                        <h2 className="text-3xl font-black text-white mb-4">{selectedFood.totalKcal} <span className="text-lg text-gray-500 font-bold">kcal</span></h2>
                        <div className="space-y-3">
                            {[
                                { label: 'Desayuno', key: 'breakfast', icon: <Sunrise size={18} className="text-yellow-400" /> },
                                { label: 'Comida', key: 'lunch', icon: <Sun size={18} className="text-orange-500" /> },
                                { label: 'Merienda', key: 'merienda', icon: <Coffee size={18} className="text-amber-700" /> },
                                { label: 'Cena', key: 'dinner', icon: <Moon size={18} className="text-indigo-400" /> },
                                { label: 'Snacks', key: 'snacks', icon: <Zap size={18} className="text-purple-400" /> },
                            ].map((meal) => {
                                const kcal = selectedFood.meals?.[meal.key] || 0;
                                const percent = selectedFood.totalKcal > 0 ? (kcal / selectedFood.totalKcal) * 100 : 0;
                                return (
                                    <div key={meal.key} className="bg-gray-950 p-3 rounded-xl border border-gray-800 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-gray-900 p-2 rounded-lg">{meal.icon}</div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-200">{meal.label}</span>
                                                <div className="w-16 h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${percent}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="font-mono text-white font-bold">{Math.round(kcal)} <span className="text-xs text-gray-500">kcal</span></span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}