import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
    Activity, ChevronLeft, ChevronRight, Lock, MapPin, LogOut
} from 'lucide-react';
import api from '../services/api';

// --- DND KIT (Solo visualización del Grid) ---
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import SortableWidget from '../components/common/SortableWidget';

// --- WIDGETS AUTÓNOMOS (Cada uno maneja su propio Modal) ---
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
// COMPONENTE PRINCIPAL PERFIL
// ==========================================

export default function Profile() {
    const { user, setUser } = useOutletContext();
    const navigate = useNavigate();

    // Estados de Datos
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [calendarViewDate, setCalendarViewDate] = useState(new Date());
    const [dailyData, setDailyData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Modal Exclusivo de Perfil (Fuerza 1RM)
    const [openStrength, setOpenStrength] = useState(false);

    // --- CONFIGURACIÓN DE WIDGETS (Sincronizada con Home) ---
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

    // Sensores DnD (Desactivamos delay largo para permitir scroll, pero no drag en perfil)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 999999, tolerance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 999999, tolerance: 5 } })
    );

    // Cargar orden desde LocalStorage (Espejo del Home)
    useEffect(() => {
        try {
            const savedOrder = JSON.parse(localStorage.getItem('home_widgets_order'));
            if (savedOrder && Array.isArray(savedOrder)) {
                // Filtramos 'gains' que no se usa aquí
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

    // Cargar Historial Diario
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
    // Aquí es donde está la magia. Pasamos los datos y permitimos la interacción (clases interactivas).
    const renderWidgetByKey = (key) => {
        const safeData = dailyData || {};
        const noOp = () => { }; // En historial, algunos widgets son solo lectura (updates bloqueados)

        // Clase base para widgets que SÍ queremos que sean clickables (abren modal)
        const interactiveClass = "h-full w-full cursor-pointer touch-manipulation active:scale-[0.98] transition-transform duration-200";
        // Clase para widgets estáticos (solo lectura sin modal, ej: Racha)
        const staticClass = "h-full w-full pointer-events-none";

        switch (key) {
            case 'missions':
                return (
                    <div className={interactiveClass}>
                        <MissionsWidget
                            completed={safeData.missionStats?.completed}
                            total={safeData.missionStats?.total}
                            completedMissions={safeData.missionStats?.listCompleted}
                        // No pasamos onClick para que use su propio modal interno
                        />
                    </div>
                );
            case 'sport':
                return (
                    <div className={interactiveClass}>
                        <SportWidget workouts={safeData.sportWorkouts || []} />
                    </div>
                );
            case 'training':
                return (
                    <div className={interactiveClass}>
                        <TrainingWidget workouts={safeData.gymWorkouts || []} />
                    </div>
                );
            case 'food':
                const intake = safeData.nutrition?.totalKcal || safeData.totalKcal || 0;
                // Estructuramos las comidas para que el widget las entienda si vienen del backend plano
                const mealsData = safeData.nutrition?.meals || {};
                return (
                    <div className={interactiveClass}>
                        <FoodWidget
                            currentKcal={intake}
                            limitKcal={user?.macros?.calories}
                            meals={mealsData}
                        />
                    </div>
                );
            case 'sleep':
                return <div className={staticClass}><SleepWidget hours={safeData.sleepHours || 0} onUpdate={noOp} /></div>;
            case 'steps':
                return <div className={staticClass}><StepsWidget steps={safeData.steps || 0} onUpdate={noOp} /></div>;
            case 'mood':
                return <div className={staticClass}><MoodWidget mood={safeData.mood} onUpdate={noOp} /></div>;
            case 'weight':
                return <div className={staticClass}><WeightWidget initialWeight={safeData.weight || 0} onUpdate={noOp} /></div>;
            case 'streak':
                // Racha siempre actual del usuario, no del historial
                return <div className={staticClass}><StreakWidget streak={user?.streak?.current || 0} /></div>;
            case 'weekly':
                // 🔥 ESTE ERA EL QUE FALLABA: Quitamos pointer-events-none para que abra su modal
                return (
                    <div className={interactiveClass}>
                        <WeeklyWidget />
                    </div>
                );
            case 'kcalBalance':
                const intake2 = safeData.nutrition?.totalKcal || safeData.totalKcal || 0;
                const burned = (safeData.sportWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0) + (safeData.gymWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0);
                return (
                    <div className={interactiveClass}>
                        <KcalBalanceWidget intake={intake2} burned={burned} weight={safeData.weight || user?.weight} />
                    </div>
                );
            default: return null;
        }
    };

    // --- CALENDARIO (Visualización) ---
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

                {/* 2. CUERPO (BLOQUEADO / FUTURO) */}
                <div className="relative w-full h-[160px] rounded-[32px] overflow-hidden border border-zinc-800 group bg-zinc-900">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                        <Lock className="text-zinc-500 mb-2" size={32} />
                        <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                            <MapPin size={14} /> MAPA MUSCULAR
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
                                if (!visibleWidgets[key]) return null;
                                if (key === 'gains') return null;

                                const isFullWidth = ['training', 'missions', 'sport'].includes(key);
                                const content = renderWidgetByKey(key);

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

            {/* MODAL 1RM GRANDE (ESTILO PREMIUM) - Único modal propio del perfil */}
            {openStrength && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="w-full max-w-2xl relative z-10">
                        <ProfileStats onCloseExternal={() => setOpenStrength(false)} />
                    </div>
                </div>
            )}
        </div>
    );
}