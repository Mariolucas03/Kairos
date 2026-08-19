import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, X, ToggleLeft, ToggleRight, Move, Lock, Unlock, CalendarDays, RotateCcw } from 'lucide-react';
import api from '../services/api';
import { getMadridDateString } from '../utils/dateHelpers';
import DayCalendarModal from '../components/common/DayCalendarModal';
import { useDailyLog } from '../hooks/useDailyLog';
import { useDailyRewards } from '../hooks/useDailyRewards';
import { registerPush, probarPush } from '../utils/pushNotifications';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import SortableWidget from '../components/common/SortableWidget';
import { useSmoothMount } from '../hooks/useSmoothMount';
import Toast from '../components/common/Toast';
import LoadingScreen from '../components/common/LoadingScreen';

import DailyRewardModal from '../components/widgets/DailyRewardModal';
import MoodWidget from '../components/widgets/MoodWidget';
import WeightWidget from '../components/widgets/WeightWidget';
import FoodWidget from '../components/widgets/FoodWidget';
import StreakWidget from '../components/widgets/StreakWidget';
import TrainingWidget from '../components/widgets/TrainingWidget';
import SleepWidget from '../components/widgets/SleepWidget';
import StepsWidget from '../components/widgets/StepsWidget';
import MissionsWidget from '../components/widgets/MissionsWidget';
import SportWidget from '../components/widgets/SportWidget';
import KcalBalanceWidget from '../components/widgets/KcalBalanceWidget';
import { useWeeklyStats } from '../components/widgets/WeeklyWidget';

import { useAuthStore } from '../store/useAuthStore';

// ==========================================
// WRAPPER INTELIGENTE V4 (FIX CLICS) — SIN CAMBIOS
// ==========================================
const SmartWidgetWrapper = ({ children, onClick, className, isDragEnabled }) => {
    const startX = useRef(0);
    const startY = useRef(0);
    const isScrolling = useRef(false);

    if (isDragEnabled) {
        return <div className={className}>{children}</div>;
    }

    const handleTouchStart = (e) => {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
        isScrolling.current = false;
    };

    const handleTouchMove = (e) => {
        const moveX = Math.abs(e.touches[0].clientX - startX.current);
        const moveY = Math.abs(e.touches[0].clientY - startY.current);
        if (moveX > 10 || moveY > 10) isScrolling.current = true;
    };

    const handleTouchEnd = (e) => {
        if (!isScrolling.current && onClick) {
            if (e.cancelable) e.preventDefault();
            onClick();
        }
    };

    return (
        <div className={className} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            {children}
        </div>
    );
};

// Rejilla de 4 columnas: cada widget declara cuánto ocupa y su alto mínimo.
const WIDGET_LAYOUT = {
    streak: 'col-span-4',
    food: 'col-span-4',
    missions: 'col-span-2 min-h-[124px]',
    sport: 'col-span-2 min-h-[124px]',
    training: 'col-span-4',
    steps: 'col-span-2 min-h-[116px]',
    sleep: 'col-span-2 min-h-[116px]',
    weight: 'col-span-2 min-h-[116px]',
    kcalBalance: 'col-span-2 min-h-[116px]',
    mood: 'col-span-4'
};

export default function Home() {
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const navigate = useNavigate();

    const isSmoothMounted = useSmoothMount();

    const { dailyData: logData, loading: logLoading, updateWidget, calculations } = useDailyLog(user);
    const { showRewardModal, rewardData, closeModal, claimReward, openCalendar, hasClaimedToday, claiming, toast, clearToast } = useDailyRewards(user, setUser);
    const [showSettings, setShowSettings] = useState(false);
    // Aviso propio de la app para el alta de notificaciones (antes era un alert() del navegador)
    const [pushMsg, setPushMsg] = useState(null);

    // ── VIAJE EN EL TIEMPO ────────────────────────────────────────────────
    // Con el botón de calendario puedes ver el home de cualquier día pasado.
    // En modo historial los widgets son solo lectura (no se puede reescribir ayer).
    const today = getMadridDateString();
    const [showCalendar, setShowCalendar] = useState(false);
    const [viewDate, setViewDate] = useState(today);
    const [historyData, setHistoryData] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const isHistory = viewDate !== today;

    useEffect(() => {
        if (!isHistory) { setHistoryData(null); return; }
        let cancelled = false;
        setHistoryLoading(true);
        api.get(`/daily/specific?date=${viewDate}`)
            .then(res => { if (!cancelled) setHistoryData(res.data || {}); })
            .catch(() => { if (!cancelled) setHistoryData({}); })
            .finally(() => { if (!cancelled) setHistoryLoading(false); });
        return () => { cancelled = true; };
    }, [viewDate, isHistory]);

    const handlePickDate = (date) => {
        setViewDate(date);
        setShowCalendar(false);
    };

    // Volumen semanal: ahora se pinta dentro de RUTINA GYM
    const { stats: weeklyStats } = useWeeklyStats();

    const DEFAULTS_ORDER = ['streak', 'food', 'missions', 'sport', 'training', 'steps', 'sleep', 'weight', 'kcalBalance', 'mood'];
    const DEFAULTS_CONFIG = { streak: true, food: true, missions: true, sport: true, training: true, steps: true, sleep: true, weight: true, kcalBalance: true, mood: true };

    const [widgetOrder, setWidgetOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('home_widgets_order'));
            if (saved && Array.isArray(saved)) {
                // 'gains' y 'weekly' ya no existen: weekly vive dentro de training
                const merged = saved.filter(key => key !== 'gains' && key !== 'weekly');
                DEFAULTS_ORDER.forEach(k => { if (!merged.includes(k)) merged.push(k); });
                return merged;
            }
            return DEFAULTS_ORDER;
        } catch { return DEFAULTS_ORDER; }
    });

    const [visibleWidgets, setVisibleWidgets] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('home_widgets_config'));
            if (saved) {
                const { gains, weekly, ...rest } = saved;
                return { ...DEFAULTS_CONFIG, ...rest };
            }
            return DEFAULTS_CONFIG;
        } catch { return DEFAULTS_CONFIG; }
    });

    const [isDragEnabled, setIsDragEnabled] = useState(() => localStorage.getItem('home_drag_enabled') === 'true');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const toggleDragMode = () => {
        const newState = !isDragEnabled;
        setIsDragEnabled(newState);
        localStorage.setItem('home_drag_enabled', newState.toString());
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setWidgetOrder((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                localStorage.setItem('home_widgets_order', JSON.stringify(newOrder));
                return newOrder;
            });
        }
    };

    const toggleWidget = (key) => {
        const newState = { ...visibleWidgets, [key]: !visibleWidgets[key] };
        setVisibleWidgets(newState);
        localStorage.setItem('home_widgets_config', JSON.stringify(newState));
    };

    const widgetNames = {
        streak: 'Racha y cofre',
        food: 'Nutrición',
        missions: 'Misiones',
        sport: 'Deporte',
        training: 'Rutina gym y volumen',
        steps: 'Pasos',
        sleep: 'Sueño',
        weight: 'Peso corporal',
        kcalBalance: 'Balance kcal',
        mood: 'Estado de ánimo'
    };

    const getWidgetContent = (key) => {
        // En modo historial pintamos el log de ese día; si no, el de hoy.
        const data = isHistory ? (historyData || {}) : logData;
        if (!data) return null;

        const wrapperClass = 'h-full w-full relative';
        // Los widgets editables se congelan al mirar un día pasado.
        const readOnlyClass = isHistory ? 'h-full pointer-events-none' : 'h-full';
        const save = (type, value) => { if (!isHistory) updateWidget(type, value); };
        const intake = isHistory
            ? (data.nutrition?.totalKcal || data.totalKcal || 0)
            : calculations.intake;

        switch (key) {
            case 'streak':
                return (
                    <div className={readOnlyClass}>
                        <StreakWidget
                            streak={user?.streak?.current}
                            onOpenChest={openCalendar}
                            claimed={hasClaimedToday()}
                        />
                    </div>
                );
            case 'missions': return (<SmartWidgetWrapper isDragEnabled={isDragEnabled} className={wrapperClass}><MissionsWidget completed={data.missionStats?.completed} total={data.missionStats?.total} completedMissions={data.missionStats?.listCompleted} /></SmartWidgetWrapper>);
            case 'sport': return (<SmartWidgetWrapper isDragEnabled={isDragEnabled} className={wrapperClass}><SportWidget workouts={data.sportWorkouts} /></SmartWidgetWrapper>);
            case 'training': return (
                <SmartWidgetWrapper isDragEnabled={isDragEnabled} className={wrapperClass}>
                    <TrainingWidget
                        workouts={data.gymWorkouts || []}
                        weeklyVolume={isHistory ? 0 : weeklyStats.currentVolume}
                        weeklyPercentage={isHistory ? 0 : weeklyStats.percentage}
                    />
                </SmartWidgetWrapper>
            );
            case 'food': {
                const rawMeals = data.nutrition?.meals || [];
                const structuredMeals = {
                    breakfast: rawMeals.find(m => m.name === 'DESAYUNO')?.foods || [],
                    lunch: rawMeals.find(m => m.name === 'COMIDA')?.foods || [],
                    merienda: rawMeals.find(m => m.name === 'MERIENDA')?.foods || [],
                    dinner: rawMeals.find(m => m.name === 'CENA')?.foods || [],
                    snacks: rawMeals.find(m => m.name === 'SNACK')?.foods || []
                };
                return (<SmartWidgetWrapper isDragEnabled={isDragEnabled} className={wrapperClass}><FoodWidget currentKcal={intake} limitKcal={user?.macros?.calories} meals={structuredMeals} /></SmartWidgetWrapper>);
            }
            case 'sleep': return <div className={readOnlyClass}><SleepWidget hours={data.sleepHours} onUpdate={(v) => save('sleepHours', v)} /></div>;
            case 'steps': return <div className={readOnlyClass}><StepsWidget steps={data.steps} onUpdate={(v) => save('steps', v)} /></div>;
            case 'mood': return <div className={readOnlyClass}><MoodWidget mood={data.mood} onUpdate={(v) => save('mood', v)} /></div>;
            case 'weight': return <div className={`${readOnlyClass} flex flex-col cursor-pointer`}><WeightWidget initialWeight={data.weight} history={[]} onUpdate={(v) => save('weight', v)} /></div>;
            case 'kcalBalance': {
                const burned = (data.sportWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0) + (data.gymWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0);
                return (<div className={wrapperClass}><KcalBalanceWidget intake={intake} burned={burned} weight={data.weight} /></div>);
            }
            default: return null;
        }
    };

    if (!isSmoothMounted || (logLoading && !logData) || !user) {
        return <LoadingScreen />;
    }

    const shownDate = new Date(`${viewDate}T12:00:00`);
    const weekday = shownDate.toLocaleDateString('es-ES', { weekday: 'long' });
    const dayMonth = shownDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

    return (
        <div className="pb-6 animate-in fade-in select-none bg-black min-h-screen">
            {showRewardModal && <DailyRewardModal data={rewardData} onClose={closeModal} onClaim={claimReward} claiming={claiming} />}
            {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
            {pushMsg && <Toast message={pushMsg.message} type={pushMsg.type} onClose={() => setPushMsg(null)} />}

            {/* CABECERA DE PÁGINA — la cabecera de perfil (avatar, XP, vida,
                monedas) sigue viviendo en Header.jsx / Layout.jsx, sin tocar. */}
            <div className="flex items-end justify-between gap-3 px-4 pt-[18px]">
                <div className="min-w-0">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none not-italic">
                        {weekday}
                    </p>
                    <p className="mt-[9px] text-[19px] font-black text-white uppercase tracking-[-0.04em] leading-none not-italic">
                        {dayMonth}
                    </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <button
                        onClick={() => setShowCalendar(true)}
                        aria-label="Ver otro día"
                        className={`transition-colors ${isHistory ? 'text-yellow-500' : 'text-zinc-500 hover:text-zinc-200'}`}
                    >
                        <CalendarDays size={21} />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        aria-label="Ajustes del home"
                        className="text-zinc-500 hover:text-zinc-200 transition-colors"
                    >
                        <Settings size={21} />
                    </button>
                </div>
            </div>

            {/* AVISO MODO HISTORIAL */}
            {isHistory && (
                <div className="mx-4 mt-4 bg-yellow-500/[0.12] border border-yellow-500/30 rounded-2xl p-3 flex justify-between items-center animate-in slide-in-from-top-2">
                    <span className="text-yellow-500 font-black text-[11px] uppercase tracking-[0.1em] flex items-center gap-2">
                        <CalendarDays size={16} /> VIENDO {viewDate.split('-').reverse().join('/')}
                    </span>
                    <button
                        onClick={() => setViewDate(today)}
                        className="bg-yellow-500 text-black px-3 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 active:scale-95"
                    >
                        <RotateCcw size={12} /> Hoy
                    </button>
                </div>
            )}

            {/* AVISO MODO EDICIÓN */}
            {isDragEnabled && (
                <div className="mx-4 mt-4 bg-yellow-500/[0.12] border border-yellow-500/30 rounded-2xl p-3 flex justify-between items-center animate-in slide-in-from-top-2">
                    <span className="text-yellow-500 font-black text-[11px] uppercase tracking-[0.1em] flex items-center gap-2"><Move size={16} /> MODO ORGANIZAR</span>
                    <button onClick={toggleDragMode} className="bg-yellow-500 text-black px-3 py-1 rounded-lg text-[10px] font-black uppercase">Terminar</button>
                </div>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
                    <div className={`grid grid-cols-4 gap-3 grid-flow-dense pb-24 px-4 pt-[18px] transition-opacity duration-200 ${historyLoading ? 'opacity-40' : 'opacity-100'}`}>
                        {widgetOrder.map((key) => {
                            if (!visibleWidgets[key]) return null;
                            const content = getWidgetContent(key);
                            if (!content) return null;
                            return (
                                <SortableWidget
                                    key={key}
                                    id={key}
                                    isDragEnabled={isDragEnabled}
                                    className={`${WIDGET_LAYOUT[key] || 'col-span-2'}`}
                                >
                                    {content}
                                </SortableWidget>
                            );
                        })}
                    </div>
                </SortableContext>
            </DndContext>

            {showCalendar && (
                <DayCalendarModal
                    selectedDate={viewDate}
                    onSelect={handlePickDate}
                    onClose={() => setShowCalendar(false)}
                />
            )}

            {showSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowSettings(false)}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />
                    <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] shadow-2xl flex flex-col h-auto max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-700 to-transparent" />
                        <div className="flex justify-between items-center p-6 border-b border-white/5 shrink-0 relative z-10">
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Ajustes</h2>
                            <button onClick={() => setShowSettings(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white transition-colors border border-white/10 active:scale-95"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 relative z-10">
                            <div className="p-4 border border-blue-500/20 rounded-3xl bg-blue-900/10 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-white text-sm font-bold flex items-center gap-2"><Move size={16} className="text-blue-400" /> Organizar</span>
                                    <span className="text-[10px] text-blue-300/70 mt-0.5">{isDragEnabled ? 'Activado (Arrastra)' : 'Modo Scroll'}</span>
                                </div>
                                <button onClick={toggleDragMode} className={`p-2.5 rounded-xl transition-all border ${isDragEnabled ? 'bg-blue-600 text-white border-blue-500' : 'bg-black text-zinc-500 border-zinc-800'}`}>
                                    {isDragEnabled ? <Unlock size={18} /> : <Lock size={18} />}
                                </button>
                            </div>
                            <div className="p-4 border border-white/5 rounded-3xl bg-zinc-900/50 flex justify-between items-center">
                                <div className="flex flex-col"><span className="text-white text-sm font-bold flex items-center gap-2">🔔 Alertas</span><span className="text-[10px] text-zinc-500 mt-0.5">Aviso castigo (20:00)</span></div>
                                <div className="flex gap-2 shrink-0">
                                    {/* ⚠️ registerPush ya no devuelve true/false sino el MOTIVO:
                                        antes, cuando no iba, el aviso decia siempre "revisa los
                                        permisos" aunque el problema fuera otro (iPhone sin
                                        instalar, servidor sin claves...). */}
                                    <button
                                        onClick={async () => {
                                            const r = await registerPush();
                                            setPushMsg({ message: r.mensaje, type: r.ok ? 'success' : 'error' });
                                        }}
                                        className="text-[10px] bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl font-black uppercase tracking-wider active:scale-95 transition-transform"
                                    >
                                        ACTIVAR
                                    </button>
                                    {/* Sin esto, la unica forma de comprobar si llegan era
                                        esperar a que otra persona te diera un me gusta. */}
                                    <button
                                        onClick={async () => {
                                            const r = await probarPush();
                                            setPushMsg({ message: r.mensaje, type: r.ok ? 'success' : 'error' });
                                            if (r.detalle) console.log('Diagnostico push:', r.detalle);
                                        }}
                                        className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-xl font-black uppercase tracking-wider border border-white/10 active:scale-95 transition-transform"
                                    >
                                        PROBAR
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-3 pl-1">Visibilidad</h3>
                                <div className="space-y-2">
                                    {Object.keys(DEFAULTS_CONFIG).map(key => (
                                        <div key={key} onClick={() => toggleWidget(key)} className={`p-3.5 rounded-2xl border flex justify-between items-center cursor-pointer transition-all active:scale-[0.98] ${visibleWidgets[key] ? 'bg-zinc-900 border-yellow-500/30' : 'bg-black border-white/5 opacity-60'}`}>
                                            <span className={`text-xs font-bold ${visibleWidgets[key] ? 'text-white' : 'text-zinc-600'}`}>{widgetNames[key] || key}</span>
                                            {visibleWidgets[key] ? <ToggleRight className="text-yellow-500" size={22} /> : <ToggleLeft className="text-zinc-700" size={22} />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
