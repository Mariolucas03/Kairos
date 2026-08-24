import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Lock, MapPin, LogOut } from 'lucide-react';
import api from '../services/api';
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import SortableWidget from '../components/common/SortableWidget';
// ⚠️ Se usaba más abajo sin importarlo: si esa condición se cumplía, la página
// petaba con "LoadingScreen is not defined" en vez de mostrar la carga.
import LoadingScreen from '../components/common/LoadingScreen';

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

import RPGBody from '../components/profile/RPGBody';
// Las graficas usan recharts, que son 338 kB: mas que el resto de la app junta.
// Cargandolo aparte, el perfil ABRE al momento y la grafica aparece un instante
// despues, en vez de dejar la pantalla en blanco esperando a la libreria.
const ProfileStats = lazy(() => import('../components/profile/ProfileStats'));

// Hueco del tamano aproximado de la grafica, para que no salte el contenido
// cuando termina de cargar.
// El mapa de constancia es ligero (solo fechas y niveles), asi que va directo y
// no en carga diferida como las graficas.
const MapaActividad = lazy(() => import('../components/profile/MapaActividad'));

/**
 * Título de sección.
 *
 * El perfil eran cinco bloques uno detrás de otro sin ninguna etiqueta: la
 * tarjeta de fuerza, el mapa de constancia, el mapa muscular, el calendario y
 * los widgets del día, todos con separaciones distintas. Se leía como una lista
 * de cosas sueltas en vez de como una pantalla. Con un título por grupo se
 * entiende de un vistazo qué es cada parte y dónde empieza la siguiente.
 */
const Seccion = ({ titulo, children, className = '' }) => (
    <section className={`mb-7 ${className}`}>
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 pl-2">{titulo}</h3>
        {children}
    </section>
);

const CargandoGrafica = ({ alto = 180 }) => (
    <div className="w-full rounded-[24px] bg-[#0a0a0c] border border-white/[0.07] animate-pulse" style={{ height: alto }} />
);
import { getMadridDateString } from '../utils/dateHelpers';

// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../store/useAuthStore';

export default function Profile() {
    // 🔥 CONECTAMOS CON ZUSTAND
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const navigate = useNavigate();

    // 🔥 Fecha en hora de Madrid, no UTC: con toISOString() el calendario abría en
    // el día anterior entre las 00:00 y las 02:00 y no encontraba el registro de hoy.
    const [selectedDate, setSelectedDate] = useState(getMadridDateString());
    const [calendarViewDate, setCalendarViewDate] = useState(new Date());
    const [dailyData, setDailyData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [openStrength, setOpenStrength] = useState(false);

    const DEFAULTS_ORDER = ['missions', 'sport', 'food', 'sleep', 'steps', 'mood', 'weight', 'training', 'streak', 'weekly', 'kcalBalance'];
    const DEFAULTS_CONFIG = { missions: true, sport: true, food: true, sleep: true, steps: true, mood: true, weight: true, training: true, streak: true, weekly: true, kcalBalance: true };

    const [widgetOrder, setWidgetOrder] = useState(DEFAULTS_ORDER);
    const [visibleWidgets, setVisibleWidgets] = useState(DEFAULTS_CONFIG);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 999999, tolerance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 999999, tolerance: 5 } })
    );

    useEffect(() => {
        try {
            const savedOrder = JSON.parse(localStorage.getItem('home_widgets_order'));
            if (savedOrder && Array.isArray(savedOrder)) {
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
        } catch (e) { }
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

    const renderWidgetByKey = (key) => {
        const safeData = dailyData || {};
        const noOp = () => { };
        const interactiveClass = "h-full w-full cursor-pointer touch-manipulation active:scale-[0.98] transition-transform duration-200";
        const staticClass = "h-full w-full pointer-events-none";

        switch (key) {
            case 'missions': return <div className={interactiveClass}><MissionsWidget completed={safeData.missionStats?.completed} total={safeData.missionStats?.total} completedMissions={safeData.missionStats?.listCompleted} /></div>;
            case 'sport': return <div className={interactiveClass}><SportWidget workouts={safeData.sportWorkouts || []} /></div>;
            case 'training': return <div className={interactiveClass}><TrainingWidget workouts={safeData.gymWorkouts || []} /></div>;
            case 'food': {
                const intake = safeData.nutrition?.totalKcal || safeData.totalKcal || 0;
                // ⚠️ El backend devuelve `meals` como ARRAY [{name:'DESAYUNO', foods:[...]}],
                // pero FoodWidget espera un objeto por comida. Antes se le pasaba el array
                // tal cual, así que el desglose por comidas del perfil salía siempre a cero.
                const rawMeals = safeData.nutrition?.meals || [];
                const mealsData = Array.isArray(rawMeals) ? {
                    breakfast: rawMeals.find(m => m.name === 'DESAYUNO')?.foods || [],
                    lunch: rawMeals.find(m => m.name === 'COMIDA')?.foods || [],
                    merienda: rawMeals.find(m => m.name === 'MERIENDA')?.foods || [],
                    dinner: rawMeals.find(m => m.name === 'CENA')?.foods || [],
                    snacks: rawMeals.find(m => m.name === 'SNACK')?.foods || []
                } : rawMeals;
                return <div className={interactiveClass}><FoodWidget currentKcal={intake} limitKcal={user?.macros?.calories} meals={mealsData} /></div>;
            }
            case 'sleep': return <div className={staticClass}><SleepWidget hours={safeData.sleepHours || 0} onUpdate={noOp} /></div>;
            case 'steps': return <div className={staticClass}><StepsWidget steps={safeData.steps || 0} onUpdate={noOp} /></div>;
            case 'mood': return <div className={staticClass}><MoodWidget mood={safeData.mood} onUpdate={noOp} /></div>;
            case 'weight': return <div className={staticClass}><WeightWidget initialWeight={safeData.weight || 0} onUpdate={noOp} /></div>;
            case 'streak': return <div className={staticClass}><StreakWidget streak={user?.streak?.current || 0} /></div>;
            case 'weekly': return <div className={interactiveClass}><WeeklyWidget /></div>;
            case 'kcalBalance':
                const intake2 = safeData.nutrition?.totalKcal || safeData.totalKcal || 0;
                const burned = (safeData.sportWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0) + (safeData.gymWorkouts?.reduce((a, c) => a + (c.caloriesBurned || 0), 0) || 0);
                return <div className={interactiveClass}><KcalBalanceWidget intake={intake2} burned={burned} weight={safeData.weight || user?.weight} /></div>;
            default: return null;
        }
    };

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
            const isToday = getMadridDateString() === dStr;
            const isFuture = new Date(dStr) > new Date();

            days.push(
                <button key={i} onClick={() => !isFuture && setSelectedDate(dStr)} disabled={isFuture}
                    className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all relative ${isSelected ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30 scale-110 z-10 border border-yellow-400' : isFuture ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
                    {i}{isToday && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 bg-white rounded-full"></div>}
                </button>
            );
        }

        return (
            <div className="bg-[#0a0a0c] border border-white/[0.07] p-5 rounded-[24px] shadow-xl relative overflow-hidden">
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

    if (loading && !dailyData && !user) return <LoadingScreen message="Cargando perfil..." />;

    return (
        <div className="pb-24 pt-4 px-4 min-h-screen animate-in fade-in select-none bg-black">

            {/* QUIÉN ERES. El perfil no tenía ninguna cabecera: entrabas y lo
                primero era una gráfica de fuerza, sin tu nombre por ningún lado. */}
            <div className="flex items-center gap-4 mb-7 px-1">
                <div className="w-16 h-16 rounded-full bg-[#0a0a0c] border border-white/[0.07] flex items-center justify-center text-xl font-black text-zinc-500 overflow-hidden shrink-0">
                    {user?.avatar
                        ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                        : (user?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter not-italic truncate leading-none">
                        {user?.username || '—'}
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mt-1.5">
                        Nivel {user?.level ?? 1} · {user?.title || 'Novato'}
                    </p>
                </div>
            </div>

            <Seccion titulo="Tu progreso">
                <div className="space-y-3">
                    <Suspense fallback={<CargandoGrafica alto={140} />}><ProfileStats mini={true} onClick={() => setOpenStrength(true)} /></Suspense>
                    <Suspense fallback={<CargandoGrafica alto={190} />}><MapaActividad /></Suspense>
                    <div className="relative w-full h-[160px] rounded-[24px] overflow-hidden border border-white/[0.07] group bg-zinc-900">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                            <Lock className="text-zinc-500 mb-2" size={28} />
                            <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><MapPin size={14} /> Mapa muscular</span>
                            <span className="text-[9px] text-zinc-600 mt-1.5 uppercase tracking-wide">Se ve en la pestaña Cuerpo del Gym</span>
                        </div>
                        <div className="absolute inset-0 opacity-20 pointer-events-none"><RPGBody mini={true} /></div>
                    </div>
                </div>
            </Seccion>

            <Seccion titulo="Calendario">
                {renderCalendar()}
            </Seccion>

            <div className="mb-8">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 pl-2">Registro del día</h3>
                <DndContext sensors={sensors} collisionDetection={closestCenter}>
                    <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-2 gap-4 auto-rows-[160px] grid-flow-dense px-1">
                            {widgetOrder.map((key) => {
                                if (!visibleWidgets[key] || key === 'gains') return null;
                                const content = renderWidgetByKey(key);
                                if (!content) return null;
                                const isFullWidth = ['training', 'missions', 'sport'].includes(key);
                                return (
                                    // 🔥 isDragEnabled en false para que el perfil nunca intente arrastrar
                                    <SortableWidget key={key} id={key} isDragEnabled={false} className={`${isFullWidth ? 'col-span-2' : 'col-span-1'} h-full`}>
                                        {content}
                                    </SortableWidget>
                                );
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            <Seccion titulo="Cuenta" className="border-t border-white/[0.07] pt-6">
                <button onClick={handleLogout} className="w-full bg-red-950/20 border border-red-900/30 text-red-500 p-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm hover:bg-red-900/40 transition-all active:scale-95">
                    <LogOut size={18} /> Cerrar sesión
                </button>
                {/* El identificador solo sirve para dar soporte ("mándame tu ID"),
                    así que se queda pero en pequeño y sin gritar. */}
                <p className="text-center text-[9px] text-zinc-800 mt-4 font-mono select-text">{user?._id}</p>
            </Seccion>

            {openStrength && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="w-full max-w-2xl relative z-10"><Suspense fallback={<CargandoGrafica alto={320} />}><ProfileStats onCloseExternal={() => setOpenStrength(false)} /></Suspense></div>
                </div>
            )}
        </div>
    );
}