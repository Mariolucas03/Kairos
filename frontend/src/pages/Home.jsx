import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, X, ToggleLeft, ToggleRight, Calendar, Gift, Move, Lock, Unlock, Activity } from 'lucide-react';
import { useDailyLog } from '../hooks/useDailyLog';
import { useDailyRewards } from '../hooks/useDailyRewards';
import { registerPush } from '../utils/pushNotifications';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import SortableWidget from '../components/common/SortableWidget';
import { useSmoothMount } from '../hooks/useSmoothMount';

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
import WeeklyWidget from '../components/widgets/WeeklyWidget';
import KcalBalanceWidget from '../components/widgets/KcalBalanceWidget';

// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../store/useAuthStore';

// ==========================================
// WRAPPER INTELIGENTE V4 (FIX CLICS)
// ==========================================
const SmartWidgetWrapper = ({ children, onClick, className, isDragEnabled }) => {
    // 🔥 Si estamos organizando, desactivamos el OnClick para no abrir modales por accidente
    if (isDragEnabled) {
        return <div className={className}>{children}</div>;
    }

    const startX = useRef(0);
    const startY = useRef(0);
    const isScrolling = useRef(false);

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

export default function Home() {
    // 🔥 CONECTAMOS CON ZUSTAND
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const navigate = useNavigate();

    // 🔥 EL NUEVO AMORTIGUADOR DE CARGA
    const isSmoothMounted = useSmoothMount();

    const { dailyData: logData, loading: logLoading, updateWidget, calculations } = useDailyLog(user);
    const { showRewardModal, rewardData, closeModal, claimReward, openCalendar, hasClaimedToday } = useDailyRewards(user, setUser);
    const [showSettings, setShowSettings] = useState(false);

    const DEFAULTS_ORDER = ['missions', 'sport', 'food', 'sleep', 'steps', 'mood', 'weight', 'training', 'streak', 'weekly', 'kcalBalance'];
    const DEFAULTS_CONFIG = { missions: true, sport: true, food: true, sleep: true, steps: true, mood: true, weight: true, training: true, streak: true, weekly: true, kcalBalance: true };

    const [widgetOrder, setWidgetOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('home_widgets_order'));
            if (saved && Array.isArray(saved)) {
                const merged = saved.filter(key => key !== 'gains');
                if (!merged.includes('weekly')) merged.push('weekly');
                if (!merged.includes('kcalBalance')) merged.push('kcalBalance');
                return merged;
            }
            return DEFAULTS_ORDER;
        } catch { return DEFAULTS_ORDER; }
    });

    const [visibleWidgets, setVisibleWidgets] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('home_widgets_config'));
            if (saved) {
                const { gains, ...rest } = saved;
                return { ...DEFAULTS_CONFIG, ...rest };
            }
            return DEFAULTS_CONFIG;
        } catch { return DEFAULTS_CONFIG; }
    });

    // --- MODO ARRASTRE ---
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

    const widgetNames = { missions: 'Misiones', sport: 'Resumen Deporte', food: 'Nutrición', sleep: 'Sueño', steps: 'Pasos', mood: 'Estado de Ánimo', weight: 'Peso Corporal', training: 'Detalle Rutina', streak: 'Racha', weekly: 'Progreso Semanal', kcalBalance: 'Balance Kcal' };

    const getWidgetContent = (key) => {
        if (!logData) return null;
        const wrapperClass = "h-full w-full relative";

        switch (key) {
            case 'missions': return (<SmartWidgetWrapper isDragEnabled={isDragEnabled} className={wrapperClass}><MissionsWidget completed={logData.missionStats?.completed} total={logData.missionStats?.total} completedMissions={logData.missionStats?.listCompleted} /></SmartWidgetWrapper>);
            case 'sport': return (<SmartWidgetWrapper isDragEnabled={isDragEnabled} className={wrapperClass}><SportWidget workouts={logData.sportWorkouts} /></SmartWidgetWrapper>);
            case 'training': return (<SmartWidgetWrapper isDragEnabled={isDragEnabled} className={wrapperClass}><TrainingWidget workouts={logData.gymWorkouts || []} /></SmartWidgetWrapper>);
            case 'food':
                const rawMeals = logData.nutrition?.meals || [];
                const structuredMeals = { breakfast: rawMeals.find(m => m.name === 'DESAYUNO')?.foods || [], lunch: rawMeals.find(m => m.name === 'COMIDA')?.foods || [], merienda: rawMeals.find(m => m.name === 'MERIENDA')?.foods || [], dinner: rawMeals.find(m => m.name === 'CENA')?.foods || [], snacks: rawMeals.find(m => m.name === 'SNACK')?.foods || [] };
                return (<SmartWidgetWrapper isDragEnabled={isDragEnabled} className={wrapperClass}><FoodWidget currentKcal={calculations.intake} limitKcal={user?.macros?.calories} meals={structuredMeals} /></SmartWidgetWrapper>);
            case 'sleep': return <div className="h-full"><SleepWidget hours={logData.sleepHours} onUpdate={(v) => updateWidget('sleepHours', v)} /></div>;
            case 'steps': return <div className="h-full"><StepsWidget steps={logData.steps} onUpdate={(v) => updateWidget('steps', v)} /></div>;
            case 'mood': return <div className="h-full"><MoodWidget mood={logData.mood} onUpdate={(v) => updateWidget('mood', v)} /></div>;
            case 'weight': return <div className="h-full flex flex-col cursor-pointer"><WeightWidget initialWeight={logData.weight} history={[]} onUpdate={(v) => updateWidget('weight', v)} /></div>;
            case 'streak': return <div className="pointer-events-none h-full"><StreakWidget streak={user?.streak?.current} /></div>;
            case 'weekly': return <div className="h-full"><WeeklyWidget /></div>;
            case 'kcalBalance':
                const intake2 = logData.nutrition?.totalKcal || logData.totalKcal || 0;
                const burned = (logData.sportWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0) + (logData.gymWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0);
                return (<div className={wrapperClass}><KcalBalanceWidget intake={intake2} burned={burned} weight={logData.weight} /></div>);
            default: return null;
        }
    };

    // 🔥 LA CONDICIÓN MÁGICA QUE QUITA EL LAG
    if (!isSmoothMounted || (logLoading && !logData) || !user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center space-y-4 text-zinc-500 bg-black">
                <Activity size={48} className="text-yellow-500 animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Cargando...</p>
            </div>
        );
    }

    const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="space-y-8 pb-6 animate-in fade-in select-none bg-black min-h-screen">
            {showRewardModal && <DailyRewardModal data={rewardData} onClose={rewardData?.isViewOnly ? closeModal : claimReward} />}

            <div className="flex justify-between items-center px-4 pt-4">
                <div>
                    <h1 className="text-2xl font-black text-white italic">
                        Hola, <span className="text-yellow-500 capitalize">{user?.username || 'Guerrero'}</span>
                    </h1>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1 mt-1">
                        <Calendar size={12} /> {todayStr}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={openCalendar} className={`p-2.5 rounded-2xl border transition-all ${hasClaimedToday() ? 'bg-[#09090b] border-white/10 text-zinc-600' : 'bg-yellow-500 text-black border-yellow-400 shadow-lg shadow-yellow-500/20 animate-pulse'}`}>
                        <Gift size={20} />
                    </button>
                    <button onClick={() => setShowSettings(true)} className="bg-[#09090b] border border-white/10 p-2.5 rounded-2xl text-zinc-500 hover:text-white transition-colors hover:border-zinc-600">
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* AVISO MODO EDICIÓN */}
            {isDragEnabled && (
                <div className="mx-4 bg-yellow-500/20 border border-yellow-500/50 rounded-2xl p-3 flex justify-between items-center animate-in slide-in-from-top-2">
                    <span className="text-yellow-500 font-bold text-xs uppercase flex items-center gap-2"><Move size={16} /> MODO ORGANIZAR ACTIVO</span>
                    <button onClick={toggleDragMode} className="bg-yellow-500 text-black px-3 py-1 rounded-lg text-[10px] font-black uppercase">Terminar</button>
                </div>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 gap-4 auto-rows-[160px] grid-flow-dense pb-20 px-4">
                        {widgetOrder.map((key) => {
                            if (!visibleWidgets[key] || key === 'gains') return null;
                            const content = getWidgetContent(key);
                            if (!content) return null;
                            const isFullWidth = ['training', 'missions', 'sport'].includes(key);
                            return (
                                <SortableWidget key={key} id={key} isDragEnabled={isDragEnabled} className={`${isFullWidth ? 'col-span-2' : 'col-span-1'} h-full`}>
                                    {content}
                                </SortableWidget>
                            );
                        })}
                    </div>
                </SortableContext>
            </DndContext>

            {showSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowSettings(false)}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />
                    <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] shadow-2xl flex flex-col h-auto max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-700 to-zinc-500"></div>
                        <div className="flex justify-between items-center p-6 border-b border-white/5 shrink-0 relative z-10">
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Ajustes</h2>
                            <button onClick={() => setShowSettings(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white transition-colors border border-white/10 active:scale-95"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 relative z-10">
                            <div className="p-4 border border-blue-500/20 rounded-3xl bg-blue-900/10 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-white text-sm font-bold flex items-center gap-2"><Move size={16} className="text-blue-400" /> Organizar</span>
                                    <span className="text-[10px] text-blue-300/70 mt-0.5">{isDragEnabled ? "Activado (Arrastra)" : "Modo Scroll"}</span>
                                </div>
                                <button onClick={toggleDragMode} className={`p-2.5 rounded-xl transition-all border ${isDragEnabled ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-black text-zinc-500 border-zinc-800'}`}>
                                    {isDragEnabled ? <Unlock size={18} /> : <Lock size={18} />}
                                </button>
                            </div>
                            <div className="p-4 border border-white/5 rounded-3xl bg-zinc-900/50 flex justify-between items-center">
                                <div className="flex flex-col"><span className="text-white text-sm font-bold flex items-center gap-2">🔔 Alertas</span><span className="text-[10px] text-zinc-500 mt-0.5">Aviso castigo (20:00)</span></div>
                                <button onClick={async () => { const success = await registerPush(); if (success) alert("¡Alertas activadas!"); else alert("No se pudo activar. Revisa permisos."); }} className="text-[10px] bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl font-black uppercase tracking-wider active:scale-95 transition-transform shadow-lg shadow-yellow-500/10">ACTIVAR</button>
                            </div>
                            <div>
                                <h3 className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-3 pl-1">Visibilidad</h3>
                                <div className="space-y-2">
                                    {Object.keys(DEFAULTS_CONFIG).map(key => (
                                        <div key={key} onClick={() => toggleWidget(key)} className={`p-3.5 rounded-2xl border flex justify-between items-center cursor-pointer transition-all active:scale-[0.98] ${visibleWidgets[key] ? 'bg-zinc-900 border-yellow-500/30' : 'bg-black border-white/5 opacity-60'}`}>
                                            <span className={`text-xs font-bold capitalize ${visibleWidgets[key] ? 'text-white' : 'text-zinc-600'}`}>{widgetNames[key] || key}</span>
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