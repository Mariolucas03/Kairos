import { useState, useRef } from 'react';
// 🔥 QUITAMOS useOutletContext
// import { useOutletContext } from 'react-router-dom';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../store/useAuthStore';
import {
    Plus, Play, Trash2, Dumbbell, Activity, Timer, Edit, PersonStanding, Lock
} from 'lucide-react';

import api from '../services/api';
import Toast from '../components/common/Toast';
import LoadingScreen from '../components/common/LoadingScreen';
import CreateRoutineModal from '../components/gym/CreateRoutineModal';
import BodyTab from '../components/gym/BodyTab';
import SportsTab from '../components/gym/SportsTab';
import { useWorkout } from '../context/WorkoutContext';
import { useSmoothMount } from '../hooks/useSmoothMount';

// 🔥 IMPORTAMOS SWR
import useSWR from 'swr';

// Fetcher global para SWR
const fetcher = (url) => api.get(url).then(res => res.data);

// Las tres pestañas de la sección
const PESTANAS = [
    { id: 'gym', label: 'Gym', icon: Dumbbell },
    { id: 'body', label: 'Cuerpo', icon: PersonStanding },
    { id: 'otros', label: 'Otros', icon: Activity }
];

const COLOR_THEMES = {
    blue: { border: 'border-blue-500', shadow: 'rgba(59,130,246,0.4)', bgIcon: 'bg-blue-600', textIcon: 'text-white', play: 'bg-blue-500 text-white' },
    red: { border: 'border-red-500', shadow: 'rgba(239,68,68,0.4)', bgIcon: 'bg-red-600', textIcon: 'text-white', play: 'bg-red-500 text-white' },
    green: { border: 'border-green-500', shadow: 'rgba(34,197,94,0.4)', bgIcon: 'bg-green-600', textIcon: 'text-white', play: 'bg-green-500 text-white' },
    yellow: { border: 'border-yellow-500', shadow: 'rgba(234,179,8,0.4)', bgIcon: 'bg-yellow-500', textIcon: 'text-black', play: 'bg-yellow-500 text-black' },
    purple: { border: 'border-purple-500', shadow: 'rgba(168,85,247,0.4)', bgIcon: 'bg-purple-600', textIcon: 'text-white', play: 'bg-purple-500 text-white' },
    orange: { border: 'border-orange-500', shadow: 'rgba(249,115,22,0.4)', bgIcon: 'bg-orange-600', textIcon: 'text-white', play: 'bg-orange-500 text-white' },
    pink: { border: 'border-pink-500', shadow: 'rgba(236,72,153,0.4)', bgIcon: 'bg-pink-600', textIcon: 'text-white', play: 'bg-pink-500 text-white' },
};

const SwipeableRoutineCard = ({ routine, onPlay, onDelete, onEdit, isLocked }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);

    const handleTouchStart = (e) => {
        startX.current = e.touches[0].clientX;
        setIsDragging(true);
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX.current;
        if (Math.abs(diff) < 200) setOffsetX(diff);
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        if (offsetX > 100) onEdit();
        else if (offsetX < -100) onDelete();
        setOffsetX(0);
    };

    const colorKey = routine.color || 'blue';
    const theme = COLOR_THEMES[colorKey] || COLOR_THEMES.blue;
    const initial = routine.name.charAt(0).toUpperCase();

    return (
        <div className="relative w-full mb-4 select-none touch-pan-y overflow-hidden rounded-3xl">
            <div className="absolute inset-0 flex justify-between items-center px-6 bg-zinc-900 border border-zinc-800">
                <div className={`flex items-center gap-2 ${isLocked ? 'text-zinc-500' : 'text-blue-400'} font-bold uppercase text-xs transition-opacity ${offsetX > 50 ? 'opacity-100' : 'opacity-30'}`}>
                    {isLocked ? <><Lock size={20} /> Bloqueado</> : <><Edit size={20} /> Editar</>}
                </div>
                <div className={`flex items-center gap-2 ${isLocked ? 'text-zinc-500' : 'text-red-500'} font-bold uppercase text-xs transition-opacity ${offsetX < -50 ? 'opacity-100' : 'opacity-30'}`}>
                    {isLocked ? <>Bloqueado <Lock size={20} /></> : <>Borrar <Trash2 size={20} /></>}
                </div>
            </div>

            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    boxShadow: `0 0 20px -5px ${theme.shadow}`
                }}
                className={`relative bg-zinc-950 border ${theme.border} rounded-3xl p-5 flex justify-between items-center z-10 h-24 will-change-transform`}
            >
                <div className={`absolute -right-10 -bottom-10 w-32 h-32 rounded-full blur-3xl opacity-10 ${theme.bgIcon} pointer-events-none`}></div>

                <div className="flex items-center gap-5 pointer-events-none relative z-10">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme.bgIcon} ${theme.textIcon} font-black text-2xl shadow-lg`}>
                        {initial}
                    </div>
                    <div>
                        <h4 className="font-black text-white text-lg italic uppercase tracking-tighter leading-none mb-1">{routine.name}</h4>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{routine.exercises.length} Ejercicios</p>
                    </div>
                </div>

                {isLocked ? (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-zinc-800 text-zinc-500 border border-zinc-700 z-20">
                        <Activity size={20} className="animate-pulse" />
                    </div>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPlay(); }}
                        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all z-20 hover:brightness-110 ${theme.play}`}
                    >
                        <Play size={20} fill="currentColor" className="ml-1" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default function Gym() {
    // 🔥 USAMOS ZUSTAND PARA ESTADO GLOBAL
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);

    const { startWorkout, activeRoutine } = useWorkout();

    const isSmoothMounted = useSmoothMount();

    // 🔥 MAGIA DE SWR: Obtenemos rutinas y diarios en caché instantánea
    const { data: routinesData, mutate: mutateRoutines, isLoading: loadingRoutines } = useSWR('/gym/routines', fetcher);
    const { data: dailyData, mutate: mutateDaily, isLoading: loadingDaily } = useSWR('/daily', fetcher);

    // Asignamos datos de forma segura
    const routines = routinesData || [];
    const todaySports = dailyData?.sportWorkouts ? [...dailyData.sportWorkouts].reverse() : [];

    // Solo mostramos el spinner si es la primerísima vez que carga y la caché está vacía
    const isFirstLoad = (!routinesData && loadingRoutines) || (!dailyData && loadingDaily);

    const [toast, setToast] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [routineToEdit, setRoutineToEdit] = useState(null);
    const [tab, setTab] = useState('gym');

    const showToast = (msg, type = 'success') => setToast({ message: msg, type });

    const openCreateRoutine = (r) => { setRoutineToEdit(r); setShowCreateModal(true); setIsUiHidden(true); };
    const closeCreateRoutine = () => { setShowCreateModal(false); setIsUiHidden(false); };

    const openActiveWorkout = (r) => {
        if (activeRoutine && activeRoutine._id === r._id) return;
        if (activeRoutine) return showToast("Ya hay una rutina en curso", "error");
        startWorkout(r);
    };

    const handleEditRoutine = (r) => {
        if (activeRoutine && activeRoutine._id === r._id) return showToast("⚠️ En curso: Finaliza para editar.", "error");
        openCreateRoutine(r);
    };

    const handleDeleteRoutine = async (id) => {
        if (activeRoutine && activeRoutine._id === id) return showToast("⚠️ En curso: No se puede borrar.", "error");
        if (!window.confirm("¿Borrar rutina?")) return;

        // Optimistic UI para borrado de rutina
        mutateRoutines(routines.filter(r => r._id !== id), false);

        try {
            await api.delete(`/gym/routines/${id}`);
            mutateRoutines(); // Sincroniza al terminar
            showToast("Eliminada", "info");
        } catch (e) {
            mutateRoutines(); // Rollback
            showToast("Error al eliminar", "error");
        }
    };


    // 🔥 PANTALLA DE CARGA CON LA PROTECCIÓN DEL BOTÓN (SMOOTH MOUNT)
    if (!isSmoothMounted || isFirstLoad) return <LoadingScreen message="Preparando zona de entreno..." />;

    return (
        <div className="animate-in fade-in pb-6 relative w-full max-w-full overflow-x-hidden bg-black min-h-screen">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* CABECERA */}
            <div className="px-1 pt-2 mb-4">
                <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Zona de Entreno</h1>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Supera tus límites</p>
            </div>

            {/* PESTAÑAS: Gym · Cuerpo · Otros */}
            <div className="flex bg-zinc-950 border border-white/5 p-1 rounded-2xl mb-6 sticky top-0 z-30">
                {PESTANAS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wide transition-all ${
                            tab === id ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/10' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <Icon size={14} strokeWidth={tab === id ? 2.6 : 2} /> {label}
                    </button>
                ))}
            </div>

            {/* --- GYM: TUS RUTINAS --- */}
            {tab === 'gym' && (
                <div className="animate-in fade-in duration-200">
                    <button
                        onClick={() => openCreateRoutine(null)}
                        className="w-full bg-yellow-500 text-black rounded-2xl py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs active:scale-[0.98] transition-transform border-b-4 border-yellow-600 mb-5"
                    >
                        <Plus size={18} strokeWidth={3} /> Nueva rutina
                    </button>

                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-yellow-500 text-xs font-black uppercase tracking-widest">Mis rutinas</h3>
                        {routines.length > 0 && (
                            <span className="text-[9px] font-bold text-zinc-600 uppercase">Desliza para editar o borrar</span>
                        )}
                    </div>

                    <div className="pb-24">
                        {routines.length === 0 ? (
                            <div onClick={() => openCreateRoutine(null)} className="text-center py-14 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20 cursor-pointer hover:border-yellow-500/30 transition-colors group">
                                <Dumbbell className="mx-auto text-zinc-700 mb-3 group-hover:text-yellow-500 transition-colors" size={32} />
                                <p className="text-zinc-500 text-xs font-black uppercase">Todavía no tienes rutinas</p>
                                <p className="text-zinc-600 text-[10px] mt-1">Toca aquí para crear la primera</p>
                            </div>
                        ) : (
                            routines.map((routine) => (
                                <SwipeableRoutineCard
                                    key={routine._id}
                                    routine={routine}
                                    onPlay={() => openActiveWorkout(routine)}
                                    onDelete={() => handleDeleteRoutine(routine._id)}
                                    onEdit={() => handleEditRoutine(routine)}
                                    isLocked={activeRoutine && activeRoutine._id === routine._id}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* --- CUERPO: RANGOS Y PROGRESO --- */}
            {tab === 'body' && (
                <div className="animate-in fade-in duration-200">
                    <BodyTab />
                </div>
            )}

            {/* --- OTROS: CUALQUIER DEPORTE --- */}
            {tab === 'otros' && (
                <div className="animate-in fade-in duration-200">
                    <SportsTab
                        hoy={todaySports}
                        showToast={showToast}
                        onSaved={(data) => {
                            if (data.user) setUser(data.user);
                            mutateDaily();
                        }}
                    />
                </div>
            )}

            {showCreateModal && (
                <CreateRoutineModal
                    routineToEdit={routineToEdit}
                    onClose={closeCreateRoutine}
                    onRoutineCreated={() => { mutateRoutines(); showToast(routineToEdit ? "Actualizada" : "Creada", "success"); }}
                />
            )}
        </div>
    );
}
