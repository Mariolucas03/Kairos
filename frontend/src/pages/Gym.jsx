import { useState, useRef } from 'react';
// 🔥 QUITAMOS useOutletContext
// import { useOutletContext } from 'react-router-dom';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../store/useAuthStore';
import {
    Plus, Play, Trash2, Dumbbell, Activity, Edit, PersonStanding, Lock
} from 'lucide-react';

import api from '../services/api';
import Toast from '../components/common/Toast';
import LoadingScreen from '../components/common/LoadingScreen';
import ConfirmDialog from '../components/common/ConfirmDialog';
import CreateRoutineModal from '../components/gym/CreateRoutineModal';
import BodyTab from '../components/gym/BodyTab';
import SportsTab from '../components/gym/SportsTab';
import { useWorkout } from '../context/WorkoutContext';
import { useSmoothMount } from '../hooks/useSmoothMount';

// 🔥 IMPORTAMOS SWR
import useSWR from 'swr';

// Fetcher global para SWR
const fetcher = (url) => api.get(url).then(res => res.data);

const ACENTO = '#eab308'; // oro: el color de la sección de entreno

// Las tres pestañas de la sección
const PESTANAS = [
    { id: 'gym', label: 'Gym', icon: Dumbbell },
    { id: 'body', label: 'Cuerpo', icon: PersonStanding },
    { id: 'otros', label: 'Otros', icon: Activity }
];

// Un tono por rutina. Se respeta el color que el usuario eligió al crearla y,
// si no tiene ninguno, se reparte por orden para que la lista tenga ritmo.
const TONOS_RUTINA = {
    yellow: '#eab308',
    blue: '#3b82f6',
    green: '#4ade80',
    purple: '#a855f7',
    orange: '#f97316',
    red: '#f87171',
    pink: '#FE90AF'
};
const ORDEN_TONOS = ['#eab308', '#3b82f6', '#4ade80', '#a855f7', '#f97316', '#22d3ee', '#FE90AF'];

const tonoDeRutina = (routine, index) =>
    TONOS_RUTINA[routine.color] || ORDEN_TONOS[index % ORDEN_TONOS.length];

const SwipeableRoutineCard = ({ routine, index, onPlay, onDelete, onEdit, isLocked }) => {
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

    const acento = tonoDeRutina(routine, index);
    const initial = routine.name.charAt(0).toUpperCase();

    return (
        <div className="relative w-full mb-3 select-none touch-pan-y overflow-hidden rounded-[24px]">
            {/* Acciones que asoman al deslizar */}
            <div className="absolute inset-0 flex justify-between items-center px-6 bg-[#0a0a0c] border border-white/[0.07] rounded-[24px]">
                <div className={`flex items-center gap-2 ${isLocked ? 'text-zinc-600' : 'text-blue-400'} font-black uppercase text-[10px] tracking-[0.1em] transition-opacity ${offsetX > 50 ? 'opacity-100' : 'opacity-30'}`}>
                    {isLocked ? <><Lock size={18} /> Bloqueado</> : <><Edit size={18} /> Editar</>}
                </div>
                <div className={`flex items-center gap-2 ${isLocked ? 'text-zinc-600' : 'text-red-400'} font-black uppercase text-[10px] tracking-[0.1em] transition-opacity ${offsetX < -50 ? 'opacity-100' : 'opacity-30'}`}>
                    {isLocked ? <>Bloqueado <Lock size={18} /></> : <>Borrar <Trash2 size={18} /></>}
                </div>
            </div>

            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    // La rutina en curso se distingue por el borde, no por un glow
                    borderColor: isLocked ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.07)'
                }}
                className="relative bg-[#0a0a0c] border rounded-[24px] p-[18px] flex justify-between items-center z-10 will-change-transform overflow-hidden"
            >
                {/* Línea de acento arriba */}
                <div className="absolute top-0 left-0 w-full h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${acento}, transparent)` }} />
                {/* Halo difuso */}
                <div className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] opacity-[0.11] pointer-events-none" style={{ background: acento }} />

                <div className="flex items-center gap-4 pointer-events-none relative z-10 min-w-0">
                    <div
                        className="w-12 h-12 rounded-[16px] flex items-center justify-center font-black text-xl shrink-0 not-italic"
                        style={{ background: `${acento}24`, color: acento }}
                    >
                        {initial}
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-black text-white text-[17px] uppercase tracking-[-0.03em] leading-none truncate not-italic">{routine.name}</h4>
                        <p className="mt-2 text-[9px] font-black uppercase tracking-[0.08em] not-italic" style={{ color: isLocked ? acento : '#71717a' }}>
                            {routine.exercises.length} Ejercicios{isLocked && ' · En curso'}
                        </p>
                    </div>
                </div>

                {isLocked ? (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[#18181b] text-zinc-500 border border-white/[0.06] z-20 shrink-0">
                        <Activity size={19} className="animate-pulse" />
                    </div>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPlay(); }}
                        aria-label={`Empezar ${routine.name}`}
                        className="w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform z-20 shrink-0"
                        style={{ background: acento, color: '#000' }}
                    >
                        <Play size={19} fill="currentColor" className="ml-0.5" />
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
    // Confirmación de borrado con el modal de la app (antes era un window.confirm nativo)
    const [routineToDelete, setRoutineToDelete] = useState(null);

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

    const pedirBorrado = (routine) => {
        if (activeRoutine && activeRoutine._id === routine._id) return showToast("⚠️ En curso: No se puede borrar.", "error");
        setRoutineToDelete(routine);
    };

    const handleDeleteRoutine = async (id) => {
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
        <div className="animate-in fade-in pb-6 relative w-full max-w-full overflow-x-hidden bg-black min-h-screen select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {routineToDelete && (
                <ConfirmDialog
                    message={`¿Borrar la rutina "${routineToDelete.name}"? No se puede deshacer.`}
                    confirmLabel="Borrar"
                    onCancel={() => setRoutineToDelete(null)}
                    onConfirm={() => { handleDeleteRoutine(routineToDelete._id); setRoutineToDelete(null); }}
                />
            )}

            {/* CABECERA DE PÁGINA */}
            <div className="pt-[18px]">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none not-italic">
                    Supera tus límites
                </p>
                <h1 className="mt-[9px] text-[26px] font-black text-white uppercase tracking-[-0.045em] leading-none not-italic">
                    Zona de entreno
                </h1>
            </div>

            {/* PESTAÑAS: Gym · Cuerpo · Otros */}
            <div className="flex gap-1 mt-[18px] bg-[#0a0a0c] border border-white/[0.07] rounded-[18px] p-1 sticky top-0 z-30">
                {PESTANAS.map(({ id, label, icon: Icon }) => {
                    const activa = tab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={`flex-1 py-2.5 rounded-[14px] flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-[0.1em] transition-colors not-italic ${activa ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                            style={activa ? { background: ACENTO } : undefined}
                        >
                            <Icon size={14} strokeWidth={activa ? 2.6 : 2} /> {label}
                        </button>
                    );
                })}
            </div>

            {/* --- GYM: TUS RUTINAS --- */}
            {tab === 'gym' && (
                <div className="animate-in fade-in duration-200 mt-[18px]">
                    <button
                        onClick={() => openCreateRoutine(null)}
                        className="w-full rounded-[20px] py-4 flex items-center justify-center gap-2 font-black uppercase tracking-[0.14em] text-[11px] active:scale-[0.985] transition-transform mb-5 not-italic"
                        style={{ background: ACENTO, color: '#000' }}
                    >
                        <Plus size={18} strokeWidth={3} /> Nueva rutina
                    </button>

                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-300 not-italic">Mis rutinas</h3>
                        {routines.length > 0 && (
                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.08em] not-italic">Desliza para editar o borrar</span>
                        )}
                    </div>

                    <div className="pb-24">
                        {routines.length === 0 ? (
                            <div onClick={() => openCreateRoutine(null)} className="text-center py-14 border-2 border-dashed border-white/[0.12] rounded-[24px] cursor-pointer hover:border-yellow-500/30 transition-colors group">
                                <Dumbbell className="mx-auto text-zinc-700 mb-3 group-hover:text-yellow-500 transition-colors" size={32} />
                                <p className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.1em] not-italic">Todavía no tienes rutinas</p>
                                <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.08em] mt-2 not-italic">Toca aquí para crear la primera</p>
                            </div>
                        ) : (
                            routines.map((routine, index) => (
                                <SwipeableRoutineCard
                                    key={routine._id}
                                    routine={routine}
                                    index={index}
                                    onPlay={() => openActiveWorkout(routine)}
                                    onDelete={() => pedirBorrado(routine)}
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
                <div className="animate-in fade-in duration-200 mt-[18px]">
                    <BodyTab />
                </div>
            )}

            {/* --- OTROS: CUALQUIER DEPORTE --- */}
            {tab === 'otros' && (
                <div className="animate-in fade-in duration-200 mt-[18px]">
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
