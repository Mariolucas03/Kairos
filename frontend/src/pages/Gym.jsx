import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    Plus, Play, Trash2, Dumbbell, X, Bike, Activity, Loader2, MapPin,
    Timer, Edit, Footprints, Waves, PersonStanding, Flame, Calendar,
    Save, Trophy
} from 'lucide-react';

import api from '../services/api';
import Toast from '../components/common/Toast';
import CreateRoutineModal from '../components/gym/CreateRoutineModal';
import ActiveWorkout from '../components/gym/ActiveWorkout';

// --- CONSTANTES DEPORTE ---
const SPORT_ACTIVITIES = [
    { id: 'Caminar', icon: <Footprints size={24} />, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-500/30' },
    { id: 'Correr', icon: <PersonStanding size={24} />, color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-500/30' },
    { id: 'Ciclismo', icon: <Bike size={24} />, color: 'text-cyan-400', bg: 'bg-cyan-900/20 border-cyan-500/30' },
    { id: 'Natación', icon: <Waves size={24} />, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-500/30' },
    { id: 'Fútbol', icon: <Trophy size={24} />, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-500/30' },
    { id: 'Padel', icon: <Activity size={24} />, color: 'text-lime-400', bg: 'bg-lime-900/20 border-lime-500/30' },
];

// 🔥 TEMAS VISUALES "WIDGET STYLE" (Colores Neón)
const COLOR_THEMES = {
    blue: { border: 'border-blue-500', shadow: 'rgba(59,130,246,0.4)', bgIcon: 'bg-blue-600', textIcon: 'text-white', play: 'bg-blue-500 text-white' },
    red: { border: 'border-red-500', shadow: 'rgba(239,68,68,0.4)', bgIcon: 'bg-red-600', textIcon: 'text-white', play: 'bg-red-500 text-white' },
    green: { border: 'border-green-500', shadow: 'rgba(34,197,94,0.4)', bgIcon: 'bg-green-600', textIcon: 'text-white', play: 'bg-green-500 text-white' },
    yellow: { border: 'border-yellow-500', shadow: 'rgba(234,179,8,0.4)', bgIcon: 'bg-yellow-500', textIcon: 'text-black', play: 'bg-yellow-500 text-black' },
    purple: { border: 'border-purple-500', shadow: 'rgba(168,85,247,0.4)', bgIcon: 'bg-purple-600', textIcon: 'text-white', play: 'bg-purple-500 text-white' },
    orange: { border: 'border-orange-500', shadow: 'rgba(249,115,22,0.4)', bgIcon: 'bg-orange-600', textIcon: 'text-white', play: 'bg-orange-500 text-white' },
    pink: { border: 'border-pink-500', shadow: 'rgba(236,72,153,0.4)', bgIcon: 'bg-pink-600', textIcon: 'text-white', play: 'bg-pink-500 text-white' },
};

// --- COMPONENTE TARJETA RUTINA (WIDGET STYLE) ---
const SwipeableRoutineCard = ({ routine, onPlay, onDelete, onEdit }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);

    const handleTouchStart = (e) => { startX.current = e.touches[0].clientX; setIsDragging(true); };
    const handleTouchMove = (e) => {
        if (!isDragging) return;
        const diff = e.touches[0].clientX - startX.current;
        if (Math.abs(diff) < 150) setOffsetX(diff);
    };
    const handleTouchEnd = () => {
        setIsDragging(false);
        if (offsetX > 80) onEdit();
        else if (offsetX < -80) onDelete();
        setOffsetX(0);
    };

    const colorKey = routine.color || 'blue';
    const theme = COLOR_THEMES[colorKey] || COLOR_THEMES.blue;
    const initial = routine.name.charAt(0).toUpperCase();

    return (
        <div className="relative w-full mb-4 select-none touch-pan-y">

            {/* FONDO DE ACCIONES */}
            <div className="absolute inset-0 flex justify-between items-center px-6 rounded-3xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-2 text-blue-400 font-bold uppercase text-xs animate-in fade-in"><Edit size={20} /> Editar</div>
                <div className="flex items-center gap-2 text-red-500 font-bold uppercase text-xs animate-in fade-in">Borrar <Trash2 size={20} /></div>
            </div>

            {/* TARJETA VISIBLE (WIDGET) */}
            <div
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    boxShadow: `0 0 20px -5px ${theme.shadow}` // Sombra de neón basada en el color
                }}
                className={`
                    relative bg-zinc-950 border ${theme.border} rounded-3xl p-5 
                    flex justify-between items-center z-10 h-24 overflow-hidden
                `}
            >
                {/* Brillo sutil de fondo */}
                <div className={`absolute -right-10 -bottom-10 w-32 h-32 rounded-full blur-3xl opacity-10 ${theme.bgIcon}`}></div>

                <div className="flex items-center gap-5 pointer-events-none relative z-10">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme.bgIcon} ${theme.textIcon} font-black text-2xl shadow-lg`}>
                        {initial}
                    </div>
                    <div>
                        <h4 className="font-black text-white text-lg italic uppercase tracking-tighter leading-none mb-1">{routine.name}</h4>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{routine.exercises.length} Ejercicios</p>
                    </div>
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); onPlay(); }}
                    className={`
                        w-12 h-12 rounded-full flex items-center justify-center shadow-lg 
                        active:scale-90 transition-all z-20 hover:brightness-110
                        ${theme.play}
                    `}
                >
                    <Play size={20} fill="currentColor" className="ml-1" />
                </button>
            </div>
        </div>
    );
};

// --- COMPONENTE TARJETA DEPORTE ---
const SwipeableSportCard = ({ workout, onDelete }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);

    const handleTouchStart = (e) => { startX.current = e.touches[0].clientX; setIsDragging(true); };
    const handleTouchMove = (e) => { if (!isDragging) return; const diff = e.touches[0].clientX - startX.current; if (Math.abs(diff) < 150) setOffsetX(diff); };
    const handleTouchEnd = () => { setIsDragging(false); if (Math.abs(offsetX) > 80) onDelete(); setOffsetX(0); };

    return (
        <div className="relative w-full h-[72px] mb-3 select-none touch-pan-y">
            <div className="absolute inset-0 bg-red-900/20 border border-red-500/30 rounded-2xl flex items-center justify-center transition-all"><Trash2 className="text-red-500" /></div>
            <div
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                style={{ transform: `translateX(${offsetX}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease-out' }}
                className="absolute inset-0 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex justify-between items-center shadow-md z-10"
            >
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-lime-500/10 flex items-center justify-center text-lime-400 border border-lime-500/20"><Activity size={18} /></div>
                    <div>
                        <h4 className="font-bold text-white text-sm uppercase tracking-tight">{workout.routineName}</h4>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] text-zinc-400 font-bold"><Timer size={10} className="inline mr-1" />{Math.round(workout.duration)}m</span>
                            {workout.distance > 0 && <span className="text-[10px] text-blue-400 font-bold"><MapPin size={10} className="inline mr-1" />{workout.distance}km</span>}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-base font-black text-white">{Math.round(workout.caloriesBurned)}</span>
                    <span className="text-[8px] font-bold text-orange-500 uppercase">KCAL</span>
                </div>
            </div>
        </div>
    );
};

// --- PÁGINA PRINCIPAL ---
export default function Gym() {
    const { user, setUser, setIsUiHidden } = useOutletContext();
    const [routines, setRoutines] = useState([]);
    const [todaySports, setTodaySports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // Estados
    const [activeRoutine, setActiveRoutine] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [routineToEdit, setRoutineToEdit] = useState(null);
    const [showSportModal, setShowSportModal] = useState(false);

    // Formulario Deporte
    const [isSavingSport, setIsSavingSport] = useState(false);
    const [sportForm, setSportForm] = useState({ name: '', time: '', distance: '' });
    const [intensity, setIntensity] = useState('Media');

    useEffect(() => { fetchRoutines(); fetchTodaySport(); }, []);

    const fetchRoutines = async () => { try { const res = await api.get('/gym/routines'); setRoutines(res.data); } catch (e) { } finally { setLoading(false); } };
    const fetchTodaySport = async () => { try { const res = await api.get('/daily'); setTodaySports(res.data.sportWorkouts ? res.data.sportWorkouts.reverse() : []); } catch (e) { } };
    const showToast = (msg, type = 'success') => setToast({ message: msg, type });

    // Control UI
    const openCreateRoutine = (r) => { setRoutineToEdit(r); setShowCreateModal(true); setIsUiHidden(true); };
    const closeCreateRoutine = () => { setShowCreateModal(false); setIsUiHidden(false); };

    const openSportModal = () => {
        setSportForm({ name: '', time: '', distance: '' });
        setIntensity('Media');
        setShowSportModal(true);
        setIsUiHidden(true);
    };
    const closeSportModal = () => { setShowSportModal(false); setIsUiHidden(false); };

    const openActiveWorkout = (r) => { setActiveRoutine(r); setIsUiHidden(true); };
    const closeActiveWorkout = () => { setActiveRoutine(null); setIsUiHidden(false); };

    // Acciones
    const handleEditRoutine = (r) => openCreateRoutine(r);
    const handleDeleteRoutine = async (id) => {
        if (!window.confirm("¿Borrar rutina?")) return;
        try { await api.delete(`/gym/routines/${id}`); setRoutines(prev => prev.filter(r => r._id !== id)); showToast("Eliminada", "info"); } catch (e) { showToast("Error", "error"); }
    };
    const handleSaveSport = async () => {
        if (!sportForm.name || !sportForm.time) return showToast('Faltan datos', 'error');
        setIsSavingSport(true);
        try {
            const payload = { ...sportForm, name: sportForm.name, time: Number(sportForm.time), distance: sportForm.distance ? Number(sportForm.distance) : null, intensity };
            const res = await api.post('/gym/sport', payload);
            if (res.data.user) setUser(res.data.user);
            closeSportModal(); fetchTodaySport(); showToast(`+${res.data.log.caloriesBurned} kcal`, "success");
        } catch (e) { showToast('Error', 'error'); } finally { setIsSavingSport(false); }
    };
    const handleDeleteSport = () => showToast("Usa la web para borrar", "info");
    const handleWorkoutFinish = (data) => { closeActiveWorkout(); if (data.user) setUser(data.user); showToast(`¡Terminado! +${data.caloriesBurned} Kcal`, "success"); };

    if (loading) return <div className="text-center py-20 text-zinc-500 animate-pulse uppercase text-xs font-bold">Cargando...</div>;
    if (activeRoutine) return <ActiveWorkout routine={activeRoutine} onClose={closeActiveWorkout} onFinish={handleWorkoutFinish} />;

    return (
        <div className="animate-in fade-in space-y-8 pb-6 relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER GYM */}
            <div className="flex justify-between items-end px-1 pt-2">
                <div>
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Zona de Entreno</h1>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Supera tus límites</p>
                </div>
            </div>

            {/* SECCIÓN 1: DEPORTE (CARDIO) - SIN EMOJIS */}
            <div>
                <h3 className="text-lime-500 text-xs font-bold uppercase tracking-widest mb-3 ml-2">Cardio & Actividades</h3>

                <div onClick={openSportModal} className="bg-zinc-900/50 border border-lime-500/20 rounded-3xl p-5 flex items-center justify-between cursor-pointer active:scale-95 transition-all hover:bg-zinc-900 group mb-4 shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-lime-500/10 flex items-center justify-center text-lime-400 group-hover:bg-lime-500 group-hover:text-black transition-colors border border-lime-500/10"><Plus size={24} /></div>
                        <div><h3 className="text-white font-black text-lg italic uppercase tracking-tight">Registrar</h3><p className="text-xs text-zinc-500 font-bold uppercase">Cardio, Deportes...</p></div>
                    </div>
                </div>

                {todaySports.length > 0 && (
                    <div className="space-y-2">
                        {todaySports.map((sport, idx) => <SwipeableSportCard key={idx} workout={sport} onDelete={handleDeleteSport} />)}
                    </div>
                )}
            </div>

            {/* SECCIÓN 2: PESAS (RUTINAS) - SIN EMOJIS */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-widest ml-2">Mis Rutinas</h3>
                    <button onClick={() => openCreateRoutine(null)} className="bg-zinc-900 text-zinc-400 hover:text-white px-4 py-2 rounded-xl border border-zinc-800 active:scale-95 transition-all flex items-center gap-2 hover:bg-zinc-800"><Plus size={14} strokeWidth={3} /> <span className="text-[10px] font-black uppercase">Nueva</span></button>
                </div>

                <div className="pb-24">
                    {routines.length === 0 ? (
                        <div onClick={() => openCreateRoutine(null)} className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20 cursor-pointer hover:border-yellow-500/30 transition-colors group">
                            <Dumbbell className="mx-auto text-zinc-700 mb-3 group-hover:text-yellow-500 transition-colors" size={32} />
                            <p className="text-zinc-600 text-xs font-bold uppercase group-hover:text-yellow-100/50">Crear primera rutina</p>
                        </div>
                    ) : (
                        routines.map((routine) => <SwipeableRoutineCard key={routine._id} routine={routine} onPlay={() => openActiveWorkout(routine)} onDelete={() => handleDeleteRoutine(routine._id)} onEdit={() => handleEditRoutine(routine)} />)
                    )}
                </div>
            </div>

            {/* MODAL CREAR RUTINA */}
            {showCreateModal && <CreateRoutineModal routineToEdit={routineToEdit} onClose={closeCreateRoutine} onRoutineCreated={() => { fetchRoutines(); showToast(routineToEdit ? "Actualizada" : "Creada", "success"); }} />}

            {/* MODAL REGISTRAR DEPORTE (FIXED FULLSCREEN Z-200) */}
            {showSportModal && (
                <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-6 animate-in fade-in h-screen w-screen">
                    <div className="bg-zinc-950 w-full max-w-sm rounded-[32px] border border-lime-500/20 p-6 shadow-2xl relative flex flex-col gap-6 animate-in zoom-in-95">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-lime-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>

                        <div className="flex justify-between items-center relative z-10">
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">NUEVO <span className="text-lime-500">DEPORTE</span></h2>
                            <button onClick={closeSportModal} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-zinc-800 transition-colors"><X size={20} /></button>
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-2 block tracking-widest">Actividad</label>
                                <input type="text" placeholder="Ej: Crossfit, Tenis..." value={sportForm.name} onChange={(e) => setSportForm({ ...sportForm, name: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-white font-bold text-base outline-none focus:ring-0 focus:border-lime-500/50 transition-all placeholder:text-zinc-600" autoFocus />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase mb-1 flex items-center gap-1"><Timer size={10} /> Minutos</label>
                                    <input type="number" inputMode="decimal" placeholder="0" value={sportForm.time} onChange={(e) => setSportForm({ ...sportForm, time: e.target.value })} className="w-full bg-transparent text-3xl font-black text-white outline-none border-none focus:ring-0 placeholder:text-zinc-700 p-0" />
                                </div>
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase mb-1 flex items-center gap-1"><MapPin size={10} /> Km (Opc)</label>
                                    <input type="number" inputMode="decimal" placeholder="-" value={sportForm.distance} onChange={(e) => setSportForm({ ...sportForm, distance: e.target.value })} className="w-full bg-transparent text-3xl font-black text-white outline-none border-none focus:ring-0 placeholder:text-zinc-700 p-0" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-2 block tracking-widest">Intensidad</label>
                                <div className="flex bg-black p-1 rounded-xl border border-zinc-800">
                                    {['Baja', 'Media', 'Alta'].map((level) => (
                                        <button key={level} onClick={() => setIntensity(level)} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${intensity === level ? 'bg-lime-500 text-black shadow-lg shadow-lime-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}>{level}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-2">
                            <button onClick={handleSaveSport} disabled={isSavingSport} className="w-full py-4 bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 text-black font-black rounded-2xl uppercase tracking-widest shadow-lg shadow-lime-900/20 active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-lime-700 text-sm">
                                {isSavingSport ? <Loader2 className="animate-spin" /> : <Save size={18} />}{isSavingSport ? 'GUARDANDO...' : 'REGISTRAR ACTIVIDAD'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}