import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Check, Loader2, X, Trophy, AlertTriangle, Plus,
    SkipForward, Timer, Save, ChevronDown, Maximize2, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../common/Toast';
import { useWorkout } from '../../context/WorkoutContext';
import ExerciseSelector from './ExerciseSelector';

export default function ActiveWorkout({ routine, onFinish }) {
    // Contexto Global para minimizar/maximizar
    const { isMinimized, minimizeWorkout, maximizeWorkout, endWorkout } = useWorkout();

    const STORAGE_KEY = `workout_active_${routine._id}`;
    const REST_KEY = `workout_rest_target_${routine._id}`;

    // --- ESTADOS INICIALES ---

    // 1. Tiempo de Inicio (Persistente para que no se reinicie al recargar)
    const [startTime] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        // Si ya había una sesión guardada, usamos su hora de inicio. Si no, ahora.
        return saved ? JSON.parse(saved).startTime : Date.now();
    });

    const [exercises, setExercises] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved).exercises;

        // Estructura inicial limpia
        return routine.exercises.map(ex => ({
            ...ex,
            setsData: Array.from({ length: ex.sets || 3 }, () => ({
                kg: '',
                reps: '',
                completed: false,
                type: 'N'
            })),
            pr: null,         // Se llenará con la API
            lastWeights: []   // Se llenará con la API
        }));
    });

    const [intensity, setIntensity] = useState('Media');
    const [seconds, setSeconds] = useState(0);

    // Lógica de Descanso
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

    // Swap
    const [swapIndex, setSwapIndex] = useState(null);
    const [showSelector, setShowSelector] = useState(false);

    // --- EFECTOS ---

    // 1. Cronómetro Global (Delta Time para precisión)
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            setSeconds(Math.floor((now - startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    // 2. 🔥 FIX PUNTO 11: CARGAR HISTORIAL Y PRs AL INICIO
    useEffect(() => {
        const fetchHistory = async () => {
            // Solo cargamos si los ejercicios NO tienen datos de PR aún (evitar recargas innecesarias)
            const needsData = exercises.some(ex => ex.pr === null);
            if (!needsData) return;

            try {
                const exerciseNames = exercises.map(e => e.name);
                const res = await api.post('/gym/history-stats', { exercises: exerciseNames });
                const historyData = res.data;

                setExercises(prev => prev.map(ex => {
                    const stats = historyData[ex.name];
                    if (!stats) return ex;

                    // Si los inputs están vacíos, rellenamos con la última sesión (Auto-fill inteligente)
                    const isClean = ex.setsData.every(s => s.kg === '' && s.reps === '');
                    let newSetsData = ex.setsData;

                    if (isClean && stats.lastSets && stats.lastSets.length > 0) {
                        newSetsData = ex.setsData.map((set, index) => {
                            // Mapear set actual con el histórico correspondiente
                            const historySet = stats.lastSets[index] || stats.lastSets[stats.lastSets.length - 1];
                            if (historySet) {
                                return { ...set, kg: historySet.weight, reps: historySet.reps };
                            }
                            return set;
                        });
                    }

                    return {
                        ...ex,
                        setsData: newSetsData,
                        pr: stats.bestSet // Guardamos el récord personal
                    };
                }));
            } catch (e) { console.error("Error cargando historial", e); }
        };

        fetchHistory();
    }, []); // Se ejecuta solo al montar

    // 3. Auto-save (Persistencia Local)
    useEffect(() => {
        const state = { startTime, exercises, intensity, routineId: routine._id, routineName: routine.name, defaultRest };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [exercises, intensity, startTime, routine._id, routine.name, defaultRest, STORAGE_KEY]);

    // 4. 🔥 FIX PUNTO 11: TEMPORIZADOR DE DESCANSO ROBUSTO
    // Al iniciar descanso, guardamos el TIMESTAMP de fin. Así si sales y entras, calcula la diferencia.
    useEffect(() => {
        let interval = null;

        const checkRest = () => {
            const target = localStorage.getItem(REST_KEY);
            if (!target) {
                if (isResting) setIsResting(false); // Si no hay target pero el estado dice resting, corregimos
                return;
            }

            const diff = Math.ceil((parseInt(target) - Date.now()) / 1000);

            if (diff <= 0) {
                setIsResting(false);
                setRestRemaining(0);
                localStorage.removeItem(REST_KEY);
                // Vibración al terminar
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            } else {
                if (!isResting) setIsResting(true); // Recuperar estado visual
                setRestRemaining(diff);
            }
        };

        // Chequeo inicial al montar
        checkRest();

        // Intervalo
        interval = setInterval(checkRest, 1000);

        return () => clearInterval(interval);
    }, []); // Dependencias vacías para que el interval maneje todo leyendo LS

    // --- FUNCIONES DESCANSO ---
    const startRest = () => {
        if (defaultRest > 0) {
            const targetTime = Date.now() + (defaultRest * 1000);
            localStorage.setItem(REST_KEY, targetTime.toString());
            setIsResting(true);
            setRestRemaining(defaultRest);
        }
    };

    const skipRest = () => {
        setIsResting(false);
        setRestRemaining(0);
        localStorage.removeItem(REST_KEY);
    };

    const handleRestInputChange = (e) => {
        const val = e.target.value;
        if (val === '') { setDefaultRest(''); return; }
        const num = parseInt(val);
        if (!isNaN(num)) {
            setDefaultRest(num);
            // Si cambiamos el tiempo mientras descansamos, ajustamos el target actual
            if (isResting) {
                const targetTime = Date.now() + (num * 1000);
                localStorage.setItem(REST_KEY, targetTime.toString());
                setRestRemaining(num);
            }
        }
    };

    // --- SWAP LOGIC ---
    const handleOpenSwap = (index) => {
        setSwapIndex(index);
        setShowSelector(true);
    };

    const handleSwapComplete = async (selectedList) => {
        if (!selectedList || selectedList.length === 0) { setShowSelector(false); return; }

        const newExData = selectedList[0];
        const currentIndex = swapIndex;

        // Actualización Optimista
        setExercises(prev => prev.map((ex, i) => {
            if (i !== currentIndex) return ex;
            const currentSetsCount = ex.setsData.length;
            return {
                ...ex,
                name: newExData.name,
                muscle: newExData.muscle,
                setsData: Array.from({ length: currentSetsCount }, () => ({ kg: '', reps: '', completed: false, type: 'N' })),
                pr: null // Reseteamos PR hasta cargar el nuevo
            };
        }));

        setShowSelector(false);
        setSwapIndex(null);

        // Fetch historial del nuevo ejercicio
        try {
            const res = await api.post('/gym/history-stats', { exercises: [newExData.name] });
            const history = res.data[newExData.name];

            if (history) {
                setExercises(prev => prev.map((ex, i) => {
                    if (i !== currentIndex) return ex;

                    // Rellenar con historial nuevo
                    const updatedSets = ex.setsData.map((set, setIdx) => {
                        const lastSet = history.lastSets[setIdx] || history.lastSets[history.lastSets.length - 1];
                        return lastSet ? { ...set, kg: lastSet.weight, reps: lastSet.reps } : set;
                    });

                    return { ...ex, pr: history.bestSet, setsData: updatedSets };
                }));
                setToast({ message: 'Ejercicio cambiado', type: 'success' });
            }
        } catch (error) {
            console.error("Error swap history:", error);
        }
    };

    // --- LOGIC SETS ---
    const getSetDisplayInfo = (allSets, currentIndex) => {
        const type = allSets[currentIndex].type || 'N';
        if (type === 'W') return { label: 'C', style: 'bg-orange-900/20 text-orange-500 border border-orange-500/50 rounded-lg', containerClass: 'justify-center' };

        let normalCount = 0;
        for (let i = 0; i <= currentIndex; i++) { if (allSets[i].type !== 'D' && allSets[i].type !== 'W') normalCount++; }

        if (type === 'D') {
            let dropDepth = 0;
            for (let i = currentIndex; i >= 0; i--) { if (allSets[i].type !== 'D') break; dropDepth++; }
            return { label: `${normalCount}.${dropDepth}`, style: 'bg-transparent text-purple-400 font-black border-none p-0 text-sm', containerClass: 'justify-end pr-4' };
        }
        if (type === 'F') return { label: normalCount, style: 'bg-red-900/20 text-red-500 border border-red-500/50 rounded-lg', containerClass: 'justify-center' };
        return { label: normalCount, style: 'bg-zinc-900 text-zinc-500 border border-zinc-800 rounded-lg', containerClass: 'justify-center' };
    };

    const cycleSetType = (exIdx, setIdx) => {
        const types = ['N', 'W', 'F', 'D'];
        setExercises(prev => prev.map((ex, i) => {
            if (i !== exIdx) return ex;
            return {
                ...ex,
                setsData: ex.setsData.map((set, j) => {
                    if (j !== setIdx) return set;
                    const nextIndex = (types.indexOf(set.type || 'N') + 1) % types.length;
                    return { ...set, type: types[nextIndex] };
                })
            };
        }));
    };

    const toggleSetComplete = (exIdx, setIdx) => {
        const currentSet = exercises[exIdx].setsData[setIdx];
        if (String(currentSet.kg).trim() === '' || String(currentSet.reps).trim() === '') {
            return setToast({ message: 'Introduce peso y repeticiones', type: 'error' });
        }

        setExercises(prev => prev.map((ex, i) => {
            if (i !== exIdx) return ex;
            return {
                ...ex,
                setsData: ex.setsData.map((set, j) => {
                    if (j !== setIdx) return set;
                    return { ...set, completed: !set.completed };
                })
            };
        }));

        // Si completamos (y no desmarcamos), activamos descanso
        // Excepción: Dropsets no suelen tener descanso entre medias
        if (!currentSet.completed && currentSet.type !== 'D') {
            startRest();
        }
    };

    const handleInputChange = (exIdx, setIdx, field, val) => {
        setExercises(prev => prev.map((ex, i) => {
            if (i !== exIdx) return ex;
            return {
                ...ex,
                setsData: ex.setsData.map((set, j) => {
                    if (j !== setIdx) return set;
                    return { ...set, [field]: val };
                })
            };
        }));
    };

    const handleAddSet = (exIdx) => {
        setExercises(prev => prev.map((ex, i) => {
            if (i !== exIdx) return ex;
            const last = ex.setsData[ex.setsData.length - 1];
            const nextType = last?.type === 'D' ? 'D' : 'N';
            return {
                ...ex,
                setsData: [...ex.setsData, { kg: last?.kg || '', reps: last?.reps || '', completed: false, type: nextType }]
            };
        }));
    };

    // --- FINALIZAR ---
    const confirmFinish = async () => {
        if (finishing) return;
        const hasAnyCompleted = exercises.some(ex => ex.setsData.some(s => s.completed));
        if (!hasAnyCompleted) {
            setToast({ message: 'Completa al menos una serie', type: 'error' });
            setShowFinishAlert(false);
            return;
        }

        setFinishing(true);
        try {
            const logData = {
                routineId: routine._id,
                routineName: routine.name,
                duration: seconds > 0 ? seconds : 1,
                intensity,
                exercises: exercises.map(ex => ({
                    name: ex.name,
                    sets: ex.setsData.filter(s => s.completed).map(s => ({
                        weight: parseFloat(String(s.kg).replace(',', '.')) || 0,
                        reps: parseFloat(String(s.reps).replace(',', '.')) || 0,
                        type: s.type || 'N'
                    }))
                })).filter(ex => ex.sets.length > 0)
            };

            const res = await api.post('/gym/log', logData);

            // Actualizar plantilla con nuevos valores por defecto
            const updatedStructure = exercises.map(ex => ({
                name: ex.name,
                muscle: ex.muscle || 'Global',
                sets: ex.setsData.length,
                reps: "10-12",
                targetWeight: 0
            }));

            await api.put(`/gym/routines/${routine._id}`, { exercises: updatedStructure });

            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(REST_KEY);

            if (onFinish) onFinish(res.data);
        } catch (error) {
            console.error(error);
            setToast({ message: 'Error al guardar', type: 'error' });
            setFinishing(false);
            setShowFinishAlert(false);
        }
    };

    const confirmExit = () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(REST_KEY);
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

    // --- RENDER ---
    if (showSelector) {
        return createPortal(
            <div className="fixed inset-0 z-[250] bg-black">
                <ExerciseSelector onSelect={handleSwapComplete} onClose={() => setShowSelector(false)} />
            </div>, document.body
        );
    }

    // MODO MINIMIZADO
    if (isMinimized) {
        return createPortal(
            <div onClick={maximizeWorkout} className="fixed bottom-[70px] left-4 right-4 z-[90] bg-zinc-900/95 backdrop-blur-md border border-yellow-500/50 rounded-2xl p-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex justify-between items-center cursor-pointer animate-in slide-in-from-bottom-10">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 flex items-center justify-center bg-black rounded-xl border border-yellow-500/20">
                        {isResting ? <span className="text-sm font-black text-blue-400 animate-pulse">{restRemaining}s</span> : <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping"></div>}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">En curso</span>
                        <span className="text-sm font-black text-white truncate max-w-[150px]">{routine.name}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold text-zinc-300 tabular-nums">{formatTime(seconds)}</span>
                    <button className="bg-yellow-500 text-black p-2 rounded-lg hover:bg-yellow-400"><Maximize2 size={18} /></button>
                </div>
            </div>, document.body
        );
    }

    // MODO MAXIMIZADO
    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom duration-300 select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER */}
            <div className="pt-6 pb-4 px-6 bg-black border-b border-zinc-900 flex justify-between items-end shrink-0 safe-top z-20">
                <div>
                    <h2 className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-1">En curso</h2>
                    <div className="font-mono text-5xl font-black text-white tracking-tighter leading-none tabular-nums">{formatTime(seconds)}</div>
                </div>
                <div className="flex gap-2">
                    <button onClick={minimizeWorkout} className="bg-zinc-900 text-zinc-400 p-3 rounded-full hover:text-white border border-zinc-800 transition-colors active:scale-95"><ChevronDown size={24} /></button>
                    <button onClick={() => setShowExitAlert(true)} className="bg-zinc-900 text-red-500 p-3 rounded-full hover:text-red-400 border border-red-900/30 transition-colors active:scale-95"><X size={24} /></button>
                </div>
            </div>

            {/* LISTA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-black pb-40">
                {exercises.map((ex, exIdx) => (
                    <div key={exIdx} className="space-y-3">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-white font-black text-xl uppercase tracking-tight flex items-center gap-2 leading-tight max-w-[65%]">
                                <span className="text-yellow-500 text-sm shrink-0">#{exIdx + 1}</span> {ex.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                {/* 🔥 ETIQUETA PR (SI EXISTE) */}
                                {ex.pr && ex.pr.value1RM > 0 && (
                                    <div className="flex items-center gap-1 bg-zinc-900/50 px-2 py-1.5 rounded-lg border border-zinc-800">
                                        <Trophy size={14} className="text-yellow-600" />
                                        <span className="text-xs font-black text-yellow-500 whitespace-nowrap">{ex.pr.weight} <span className="text-[10px] text-zinc-500">KG</span></span>
                                    </div>
                                )}
                                <button onClick={() => handleOpenSwap(exIdx)} className="p-1.5 bg-zinc-900 rounded-lg text-blue-400 border border-zinc-800 hover:bg-zinc-800 active:scale-95"><RefreshCw size={16} /></button>
                            </div>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden p-1">
                            <div className="grid grid-cols-12 gap-2 py-2 px-2 text-[9px] text-zinc-500 font-black uppercase tracking-widest text-center border-b border-zinc-900 mb-2">
                                <div className="col-span-2">Set</div><div className="col-span-4">Kg</div><div className="col-span-3">Reps</div><div className="col-span-3">Check</div>
                            </div>
                            <div className="space-y-1">
                                {ex.setsData.map((set, sIdx) => {
                                    const { label, style, containerClass } = getSetDisplayInfo(ex.setsData, sIdx);
                                    return (
                                        <div key={sIdx} className={`grid grid-cols-12 gap-2 items-center p-1 rounded-2xl transition-all ${set.completed ? 'bg-zinc-900/50 opacity-60' : ''}`}>
                                            <div className={`col-span-2 flex ${containerClass}`}>
                                                <button onClick={() => cycleSetType(exIdx, sIdx)} className={`w-8 h-8 flex items-center justify-center text-xs font-black transition-all active:scale-95 ${style}`}>{label}</button>
                                            </div>
                                            <div className="col-span-4"><input type="number" inputMode="decimal" placeholder="Kg" value={set.kg} onChange={(e) => handleInputChange(exIdx, sIdx, 'kg', e.target.value)} className="w-full bg-zinc-900 text-white text-center font-bold py-3 rounded-xl outline-none focus:ring-1 focus:ring-yellow-500" /></div>
                                            <div className="col-span-3"><input type="number" inputMode="decimal" placeholder="-" value={set.reps} onChange={(e) => handleInputChange(exIdx, sIdx, 'reps', e.target.value)} className="w-full bg-zinc-900 text-white text-center font-bold py-3 rounded-xl outline-none focus:ring-1 focus:ring-yellow-500" /></div>
                                            <div className="col-span-3 flex justify-center"><button onClick={() => toggleSetComplete(exIdx, sIdx)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${set.completed ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}><Check size={20} strokeWidth={4} /></button></div>
                                        </div>
                                    );
                                })}
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

            {/* MODAL DESCANSO (Restaurado) */}
            {isResting && (
                <div className="fixed bottom-32 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 p-4 rounded-[24px] shadow-2xl z-50 flex items-center justify-between ring-1 ring-white/10 animate-in slide-in-from-bottom-5">
                    <div className="flex items-center gap-4 pl-2">
                        <div className="flex flex-col items-center min-w-[60px]">
                            <span className="text-4xl font-black text-white font-mono leading-none tabular-nums">{restRemaining}</span>
                            <span className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">Segundos</span>
                        </div>
                        <div className="h-8 w-[1px] bg-zinc-700"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-400 font-bold uppercase mb-1 flex items-center gap-1"><Timer size={10} /> Tiempo fijo</span>
                            <input type="number" inputMode="decimal" value={defaultRest} onChange={handleRestInputChange} className="bg-black border border-zinc-700 rounded-lg w-16 text-center text-sm font-bold text-white py-1 outline-none" />
                        </div>
                    </div>
                    <button onClick={skipRest} className="bg-white text-black px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition-transform">Saltar <SkipForward size={14} /></button>
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
        </div>, document.body
    );
}