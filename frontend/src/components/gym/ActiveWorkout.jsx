import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Check, Loader2, X, Trophy, AlertTriangle, Plus,
    SkipForward, Timer, Save, ChevronDown, Maximize2
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../common/Toast';
import { useWorkout } from '../../context/WorkoutContext';

export default function ActiveWorkout({ routine }) {
    const { isMinimized, minimizeWorkout, maximizeWorkout, endWorkout } = useWorkout();

    const STORAGE_KEY = `workout_active_${routine._id}`;

    // --- ESTADOS (IGUAL QUE ANTES) ---
    const [startTime] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved).startTime : Date.now();
    });

    const [exercises, setExercises] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved).exercises;
        return routine.exercises.map(ex => ({
            ...ex,
            setsData: Array.from({ length: ex.sets || 3 }, () => ({
                kg: '',
                reps: '',
                completed: false
            })),
            pr: null
        }));
    });

    const [intensity, setIntensity] = useState('Media');
    const [seconds, setSeconds] = useState(0);

    // --- LÓGICA DE DESCANSO PERSISTENTE ---
    const [isResting, setIsResting] = useState(false);
    const [restRemaining, setRestRemaining] = useState(0);
    const [defaultRest, setDefaultRest] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && JSON.parse(saved).defaultRest ? JSON.parse(saved).defaultRest : 60;
    });

    // UI & Alertas
    const [finishing, setFinishing] = useState(false);
    const [toast, setToast] = useState(null);
    const [showExitAlert, setShowExitAlert] = useState(false);
    const [showFinishAlert, setShowFinishAlert] = useState(false);

    // --- EFECTOS ---

    // 1. Cargar estado del descanso
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.restEndTime) {
                const now = Date.now();
                const diff = Math.ceil((data.restEndTime - now) / 1000);
                if (diff > 0) {
                    setIsResting(true);
                    setRestRemaining(diff);
                } else {
                    const newState = { ...data, restEndTime: null };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
                    setIsResting(false);
                }
            }
        }
    }, [STORAGE_KEY]);

    // 2. Cronómetro del Descanso
    useEffect(() => {
        let interval = null;
        if (isResting) {
            interval = setInterval(() => {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (!saved) return;
                const data = JSON.parse(saved);
                if (!data.restEndTime) { setIsResting(false); return; }
                const now = Date.now();
                const diff = Math.ceil((data.restEndTime - now) / 1000);

                if (diff <= 0) {
                    setIsResting(false);
                    setRestRemaining(0);
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    const newState = { ...data, restEndTime: null };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
                } else {
                    setRestRemaining(diff);
                }
            }, 500);
        }
        return () => clearInterval(interval);
    }, [isResting, STORAGE_KEY]);

    // 3. Auto-save
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        const prevData = saved ? JSON.parse(saved) : {};
        const state = {
            ...prevData,
            startTime, exercises, intensity, routineId: routine._id, routineName: routine.name, defaultRest
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [exercises, intensity, startTime, routine._id, routine.name, STORAGE_KEY, defaultRest]);

    // 4. Cronómetro Global
    useEffect(() => {
        if (!startTime) return;
        const timer = setInterval(() => {
            const now = Date.now();
            setSeconds(Math.floor((now - startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    // 5. Cargar Historial (Solo una vez)
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const exerciseNames = routine.exercises.map(e => e.name);
                const res = await api.post('/gym/history-stats', { exercises: exerciseNames });
                const historyData = res.data;
                setExercises(prev => prev.map(ex => {
                    const stats = historyData[ex.name];
                    if (!stats) return ex;
                    const isClean = ex.setsData.every(s => s.kg === '' && s.reps === '');
                    let newSetsData = ex.setsData;
                    if (isClean) {
                        newSetsData = ex.setsData.map((set, index) => {
                            if (stats.lastSets && stats.lastSets[index]) {
                                return { ...set, kg: stats.lastSets[index].weight, reps: stats.lastSets[index].reps };
                            }
                            return set;
                        });
                    }
                    return { ...ex, setsData: newSetsData, pr: stats.bestSet };
                }));
            } catch (e) { console.error(e); }
        };
        fetchHistory();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // --- HANDLERS ---
    const startRest = () => {
        const time = defaultRest === '' ? 60 : parseInt(defaultRest);
        const endTime = Date.now() + (time * 1000);
        setRestRemaining(time);
        setIsResting(true);
        const saved = localStorage.getItem(STORAGE_KEY);
        const data = saved ? JSON.parse(saved) : {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, restEndTime: endTime }));
    };

    const skipRest = () => {
        setIsResting(false);
        setRestRemaining(0);
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, restEndTime: null }));
        }
    };

    const toggleSetComplete = (exIdx, setIdx) => {
        const currentSet = exercises[exIdx].setsData[setIdx];
        if (!currentSet.kg || !currentSet.reps) return setToast({ message: 'Faltan datos', type: 'error' });
        setExercises(prev => {
            const newExercises = [...prev];
            const newSetsData = [...newExercises[exIdx].setsData];
            newSetsData[setIdx] = { ...newSetsData[setIdx], completed: !newSetsData[setIdx].completed };
            newExercises[exIdx] = { ...newExercises[exIdx], setsData: newSetsData };
            return newExercises;
        });
        if (!currentSet.completed) startRest();
    };

    const handleInputChange = (exIdx, setIdx, field, val) => {
        setExercises(prev => {
            const newExercises = [...prev];
            const newSetsData = [...newExercises[exIdx].setsData];
            newSetsData[setIdx] = { ...newSetsData[setIdx], [field]: val };
            newExercises[exIdx] = { ...newExercises[exIdx], setsData: newSetsData };
            return newExercises;
        });
    };

    const handleAddSet = (exIdx) => {
        setExercises(prev => {
            const newExercises = [...prev];
            const currentSets = newExercises[exIdx].setsData;
            const last = currentSets[currentSets.length - 1];
            const newSet = { kg: last?.kg || '', reps: last?.reps || '', completed: false };
            newExercises[exIdx] = { ...newExercises[exIdx], setsData: [...currentSets, newSet] };
            return newExercises;
        });
    };

    const handleRestInputChange = (e) => {
        const val = e.target.value;
        if (val === '') { setDefaultRest(''); return; }
        const num = parseInt(val);
        if (!isNaN(num)) {
            setDefaultRest(num);
            if (isResting) {
                const endTime = Date.now() + (num * 1000);
                setRestRemaining(num);
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const data = JSON.parse(saved);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, restEndTime: endTime }));
                }
            }
        }
    };

    const confirmFinish = async () => {
        if (finishing) return;
        setFinishing(true);
        try {
            const logData = {
                routineId: routine._id,
                routineName: routine.name,
                duration: seconds,
                intensity,
                exercises: exercises.map(ex => ({
                    name: ex.name,
                    sets: ex.setsData.filter(s => s.completed).map(s => ({ weight: parseFloat(s.kg), reps: parseFloat(s.reps) }))
                })).filter(ex => ex.sets.length > 0)
            };
            const res = await api.post('/gym/log', logData);
            localStorage.removeItem(STORAGE_KEY);
            // Usamos el endWorkout del contexto
            endWorkout();
            // Si el padre pasó onFinish (para actualizar UI local de Gym si estamos ahí), lo llamamos
            // Pero como es global, quizás no hace falta, pero por si acaso.
            if (window.location.pathname === '/gym') {
                window.location.reload(); // Forma bruta pero efectiva de refrescar el gym
            }
        } catch (error) {
            setToast({ message: 'Error al guardar', type: 'error' });
            setFinishing(false);
        }
    };

    const confirmExit = () => {
        localStorage.removeItem(STORAGE_KEY);
        endWorkout();
    };

    const formatTime = (total) => {
        const m = Math.floor(total / 60).toString().padStart(2, '0');
        const s = (total % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const intensityOptions = [
        { id: 'Baja', label: 'Fuerza', color: 'bg-blue-600' },
        { id: 'Media', label: 'Hipertrofia', color: 'bg-yellow-500' },
        { id: 'Alta', label: 'Metabólico', color: 'bg-red-600' },
    ];

    // --- RENDERIZADO ---

    // 1. MODO MINIMIZADO (Barra Flotante "Spotify")
    if (isMinimized) {
        return createPortal(
            <div
                onClick={maximizeWorkout}
                className="fixed bottom-[68px] left-4 right-4 z-[90] bg-zinc-900/95 backdrop-blur-md border border-yellow-500/50 rounded-2xl p-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex justify-between items-center cursor-pointer animate-in slide-in-from-bottom-10"
            >
                <div className="flex items-center gap-3">
                    {/* Indicador animado */}
                    <div className="relative w-10 h-10 flex items-center justify-center bg-black rounded-xl border border-yellow-500/20">
                        {isResting ? (
                            <span className="text-sm font-black text-blue-400 animate-pulse">{restRemaining}s</span>
                        ) : (
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping"></div>
                        )}
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">En curso</span>
                        <span className="text-sm font-black text-white truncate max-w-[150px]">{routine.name}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold text-zinc-300 tabular-nums">{formatTime(seconds)}</span>
                    <button className="bg-yellow-500 text-black p-2 rounded-lg hover:bg-yellow-400">
                        <Maximize2 size={18} />
                    </button>
                </div>
            </div>,
            document.body
        );
    }

    // 2. MODO EXPANDIDO (Pantalla Completa)
    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom duration-300 select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER */}
            <div className="pt-6 pb-4 px-6 bg-black border-b border-zinc-900 flex justify-between items-end shrink-0 safe-top z-20">
                <div>
                    <h2 className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-1">En curso</h2>
                    <div className="font-mono text-5xl font-black text-white tracking-tighter leading-none tabular-nums">
                        {formatTime(seconds)}
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* Botón Minimizar */}
                    <button onClick={minimizeWorkout} className="bg-zinc-900 text-zinc-400 p-3 rounded-full hover:text-white border border-zinc-800 transition-colors active:scale-95">
                        <ChevronDown size={24} />
                    </button>
                    {/* Botón Cerrar */}
                    <button onClick={() => setShowExitAlert(true)} className="bg-zinc-900 text-red-500 p-3 rounded-full hover:text-red-400 border border-red-900/30 transition-colors active:scale-95">
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* LISTA EJERCICIOS */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-black pb-40">
                {exercises.map((ex, exIdx) => (
                    <div key={exIdx} className="space-y-3">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-white font-black text-xl uppercase tracking-tight flex items-center gap-2 leading-tight max-w-[65%]">
                                <span className="text-yellow-500 text-sm shrink-0">#{exIdx + 1}</span> {ex.name}
                            </h3>
                            {ex.pr && ex.pr.value1RM > 0 && (
                                <span className="text-xs text-yellow-500 font-black flex items-center gap-1.5 whitespace-nowrap">
                                    <Trophy size={14} className="text-yellow-600" />
                                    {ex.pr.weight}kg <span className="text-zinc-600">x</span> {ex.pr.reps}
                                </span>
                            )}
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden p-1">
                            <div className="grid grid-cols-10 gap-2 py-2 px-2 text-[9px] text-zinc-500 font-black uppercase tracking-widest text-center border-b border-zinc-900 mb-2">
                                <div className="col-span-1">#</div>
                                <div className="col-span-3">Kg</div>
                                <div className="col-span-3">Reps</div>
                                <div className="col-span-3">Hecho</div>
                            </div>

                            <div className="space-y-1">
                                {ex.setsData.map((set, sIdx) => (
                                    <div key={sIdx} className={`grid grid-cols-10 gap-2 items-center p-1 rounded-2xl transition-all ${set.completed ? 'bg-zinc-900/50 opacity-60' : 'bg-transparent'}`}>
                                        <div className="col-span-1 flex justify-center">
                                            <div className="w-6 h-6 rounded-full bg-zinc-900 text-zinc-500 flex items-center justify-center text-xs font-bold border border-zinc-800">
                                                {sIdx + 1}
                                            </div>
                                        </div>
                                        <div className="col-span-3">
                                            <input type="number" inputMode="decimal" placeholder="-" value={set.kg} onChange={(e) => handleInputChange(exIdx, sIdx, 'kg', e.target.value)} className={`w-full text-center bg-zinc-900 font-black text-lg text-white rounded-xl py-2.5 outline-none focus:ring-1 focus:ring-yellow-500 transition-all ${set.completed ? 'text-green-500' : ''}`} />
                                        </div>
                                        <div className="col-span-3">
                                            <input type="number" inputMode="decimal" placeholder="-" value={set.reps} onChange={(e) => handleInputChange(exIdx, sIdx, 'reps', e.target.value)} className={`w-full text-center bg-zinc-900 font-black text-lg text-white rounded-xl py-2.5 outline-none focus:ring-1 focus:ring-yellow-500 transition-all ${set.completed ? 'text-green-500' : ''}`} />
                                        </div>
                                        <div className="col-span-3 flex justify-center">
                                            <button onClick={() => toggleSetComplete(exIdx, sIdx)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${set.completed ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-zinc-800 text-zinc-600 hover:bg-zinc-700'}`}>
                                                <Check size={20} strokeWidth={4} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => handleAddSet(exIdx)} className="w-full mt-2 py-3 bg-black hover:bg-zinc-900 text-zinc-500 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors border-t border-zinc-900"><Plus size={14} /> Añadir Serie</button>
                        </div>
                    </div>
                ))}

                <div className="pt-4 pb-2">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-3 tracking-widest">Intensidad</h3>
                    <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
                        {intensityOptions.map((opt) => (
                            <button key={opt.id} onClick={() => setIntensity(opt.id)} className={`flex-1 py-3 rounded-xl flex flex-col items-center justify-center transition-all ${intensity === opt.id ? `${opt.color} text-white shadow-lg` : 'text-zinc-500'}`}>
                                <span className="text-[10px] font-black uppercase">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* MODAL DESCANSO */}
            {isResting && (
                <div className="fixed bottom-32 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 p-4 rounded-[24px] shadow-2xl z-50 animate-in slide-in-from-bottom-10 fade-in flex items-center justify-between ring-1 ring-white/10">
                    <div className="flex items-center gap-4 pl-2">
                        <div className="flex flex-col items-center min-w-[60px]">
                            <span className="text-4xl font-black text-white font-mono leading-none tabular-nums">{restRemaining}</span>
                            <span className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">Segundos</span>
                        </div>
                        <div className="h-8 w-[1px] bg-zinc-700"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-400 font-bold uppercase mb-1 flex items-center gap-1"><Timer size={10} /> Tiempo fijo</span>
                            <input type="number" inputMode="decimal" value={defaultRest} onChange={handleRestInputChange} className="bg-black border border-zinc-700 rounded-lg w-16 text-center text-sm font-bold text-white py-1 focus:border-yellow-500 outline-none" />
                        </div>
                    </div>
                    <button onClick={skipRest} className="bg-white text-black px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition-transform">Saltar <SkipForward size={14} fill="currentColor" /></button>
                </div>
            )}

            {/* FOOTER */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-black border-t border-zinc-900 safe-bottom z-30">
                <button onClick={() => setShowFinishAlert(true)} disabled={finishing} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-all text-lg uppercase tracking-widest border-b-4 border-yellow-600">
                    {finishing ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {finishing ? 'GUARDANDO...' : 'TERMINAR SESIÓN'}
                </button>
            </div>

            {/* ALERTAS */}
            {showExitAlert && (
                <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-950 border border-red-900/50 p-6 rounded-3xl w-full max-w-xs shadow-2xl relative text-center">
                        <div className="bg-red-500/10 p-4 rounded-full text-red-500 inline-block mb-4"><AlertTriangle size={32} /></div>
                        <h3 className="text-white font-black text-lg uppercase">¿Salir sin guardar?</h3>
                        <div className="flex gap-3 w-full mt-4">
                            <button onClick={() => setShowExitAlert(false)} className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold text-xs uppercase border border-zinc-800">Cancelar</button>
                            <button onClick={confirmExit} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold text-xs uppercase">Salir</button>
                        </div>
                    </div>
                </div>
            )}

            {showFinishAlert && (
                <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-950 border border-yellow-500/30 p-6 rounded-3xl w-full max-w-xs shadow-2xl relative text-center">
                        <div className="bg-yellow-500/10 p-4 rounded-full text-yellow-500 inline-block mb-4"><Trophy size={32} /></div>
                        <h3 className="text-white font-black text-lg uppercase">¿Terminar Sesión?</h3>
                        <div className="flex gap-3 w-full mt-4">
                            <button onClick={() => setShowFinishAlert(false)} disabled={finishing} className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold text-xs uppercase border border-zinc-800 disabled:opacity-50">Seguir</button>
                            <button onClick={confirmFinish} disabled={finishing} className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                {finishing ? <Loader2 className="animate-spin" size={16} /> : 'Terminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}