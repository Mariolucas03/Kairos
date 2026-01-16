import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, X, Trophy, AlertTriangle, Plus, SkipForward, Timer, Save } from 'lucide-react';
import api from '../../services/api';
import Toast from '../common/Toast';

export default function ActiveWorkout({ routine, onClose, onFinish }) {
    const STORAGE_KEY = `workout_active_${routine._id}`;

    // --- ESTADOS ---
    const [startTime] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved).startTime : Date.now();
    });

    const [exercises, setExercises] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved).exercises;

        // Inicialización correcta con objetos independientes
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

    // Descanso
    const [isResting, setIsResting] = useState(false);
    const [restTimer, setRestTimer] = useState(60);
    const [defaultRest, setDefaultRest] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && JSON.parse(saved).defaultRest ? JSON.parse(saved).defaultRest : 60;
    });

    // UI & Alertas
    const [finishing, setFinishing] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [toast, setToast] = useState(null);
    const [showExitAlert, setShowExitAlert] = useState(false);
    const [showFinishAlert, setShowFinishAlert] = useState(false);

    // --- EFECTOS ---

    // 1. Auto-cierre del Toast a los 2 segundos
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                setToast(null);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // 2. Cronómetro
    useEffect(() => {
        if (!startTime) return;
        const timer = setInterval(() => {
            const now = Date.now();
            setSeconds(Math.floor((now - startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    // 3. Timer Descanso
    useEffect(() => {
        let interval = null;
        if (isResting && restTimer > 0) {
            interval = setInterval(() => setRestTimer(prev => prev - 1), 1000);
        } else if (restTimer === 0 && isResting) {
            setIsResting(false);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
        return () => clearInterval(interval);
    }, [isResting, restTimer]);

    // 4. Auto-save
    useEffect(() => {
        const state = { startTime, exercises, intensity, routineId: routine._id, defaultRest };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [exercises, intensity, startTime, routine._id, STORAGE_KEY, defaultRest]);

    // 5. Cargar Historial
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const savedLocal = localStorage.getItem(STORAGE_KEY);
                const isClean = exercises.every(ex => ex.setsData.every(s => s.kg === '' && s.reps === ''));

                const exerciseNames = routine.exercises.map(e => e.name);
                const res = await api.post('/gym/history-stats', { exercises: exerciseNames });
                const historyData = res.data;

                setExercises(prev => prev.map(ex => {
                    const stats = historyData[ex.name];
                    if (!stats) return ex;

                    let newSetsData = ex.setsData;
                    if (isClean && !savedLocal) {
                        newSetsData = ex.setsData.map((set, index) => {
                            if (stats.lastSets && stats.lastSets[index]) {
                                return { ...set, kg: stats.lastSets[index].weight, reps: stats.lastSets[index].reps };
                            }
                            return set;
                        });
                    }

                    return { ...ex, setsData: newSetsData, pr: stats.bestSet };
                }));
            } catch (e) { console.error(e); } finally { setLoadingHistory(false); }
        };
        fetchHistory();
    }, []);

    const formatTime = (total) => {
        const m = Math.floor(total / 60).toString().padStart(2, '0');
        const s = (total % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // --- HANDLERS ---

    const handleInputChange = (exIdx, setIdx, field, val) => {
        setExercises(prev => {
            const newExercises = [...prev];
            const newSetsData = [...newExercises[exIdx].setsData];
            newSetsData[setIdx] = { ...newSetsData[setIdx], [field]: val };
            newExercises[exIdx] = { ...newExercises[exIdx], setsData: newSetsData };
            return newExercises;
        });
    };

    const toggleSetComplete = (exIdx, setIdx) => {
        const currentExercise = exercises[exIdx];
        const currentSet = currentExercise.setsData[setIdx];

        if (!currentSet.kg || !currentSet.reps) return setToast({ message: 'Faltan datos', type: 'error' });

        setExercises(prev => {
            const newExercises = [...prev];
            const newSetsData = [...newExercises[exIdx].setsData];
            newSetsData[setIdx] = { ...newSetsData[setIdx], completed: !newSetsData[setIdx].completed };
            newExercises[exIdx] = { ...newExercises[exIdx], setsData: newSetsData };
            return newExercises;
        });

        if (!currentSet.completed) {
            setRestTimer(defaultRest === '' ? 60 : defaultRest);
            setIsResting(true);
        }
    };

    const handleAddSet = (exIdx) => {
        setExercises(prev => {
            const newExercises = [...prev];
            const currentSets = newExercises[exIdx].setsData;
            const last = currentSets[currentSets.length - 1];

            const newSet = { kg: last?.kg || '', reps: last?.reps || '', completed: false };

            newExercises[exIdx] = {
                ...newExercises[exIdx],
                setsData: [...currentSets, newSet]
            };
            return newExercises;
        });
    };

    const handleRestInputChange = (e) => {
        const val = e.target.value;
        if (val === '') {
            setDefaultRest('');
            return;
        }
        const num = parseInt(val);
        if (!isNaN(num)) {
            setDefaultRest(num);
            if (isResting) setRestTimer(num);
        }
    };

    const handleRestInputBlur = () => {
        if (defaultRest === '' || defaultRest === 0) {
            setDefaultRest(60);
            if (isResting) setRestTimer(60);
        }
    };

    // --- FINALIZAR ---

    const confirmFinish = async () => {
        setFinishing(true);
        setShowFinishAlert(false);
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
            onFinish(res.data);
        } catch (error) {
            setToast({ message: 'Error al guardar', type: 'error' });
            setFinishing(false);
        }
    };

    const confirmExit = () => {
        localStorage.removeItem(STORAGE_KEY);
        onClose();
    };

    const intensityOptions = [
        { id: 'Baja', label: 'Fuerza', color: 'bg-blue-600', border: 'border-blue-500' },
        { id: 'Media', label: 'Hipertrofia', color: 'bg-yellow-500', border: 'border-yellow-400' },
        { id: 'Alta', label: 'Metabólico', color: 'bg-red-600', border: 'border-red-500' },
    ];

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom duration-300 select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* 1. HEADER */}
            <div className="pt-6 pb-4 px-6 bg-black border-b border-zinc-900 flex justify-between items-end shrink-0 safe-top z-20">
                <div>
                    <h2 className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-1">En curso</h2>
                    <div className="font-mono text-5xl font-black text-white tracking-tighter leading-none tabular-nums">
                        {formatTime(seconds)}
                    </div>
                </div>
                <button onClick={() => setShowExitAlert(true)} className="bg-zinc-900 text-zinc-400 p-3 rounded-full hover:text-white border border-zinc-800 transition-colors active:scale-95">
                    <X size={24} />
                </button>
            </div>

            {/* 2. LISTA DE EJERCICIOS */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-black pb-40">
                {exercises.map((ex, exIdx) => (
                    <div key={exIdx} className="space-y-3">
                        {/* Título + PR */}
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

                        {/* Tabla Sets */}
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

                                        {/* Número */}
                                        <div className="col-span-1 flex justify-center">
                                            <div className="w-6 h-6 rounded-full bg-zinc-900 text-zinc-500 flex items-center justify-center text-xs font-bold border border-zinc-800">
                                                {sIdx + 1}
                                            </div>
                                        </div>

                                        {/* Inputs */}
                                        <div className="col-span-3">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder={loadingHistory ? "..." : "-"}
                                                value={set.kg}
                                                onChange={(e) => handleInputChange(exIdx, sIdx, 'kg', e.target.value)}
                                                className={`w-full text-center bg-zinc-900 font-black text-lg text-white rounded-xl py-2.5 outline-none focus:ring-1 focus:ring-yellow-500 transition-all placeholder:text-zinc-700 ${set.completed ? 'text-green-500' : ''}`}
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="-"
                                                value={set.reps}
                                                onChange={(e) => handleInputChange(exIdx, sIdx, 'reps', e.target.value)}
                                                className={`w-full text-center bg-zinc-900 font-black text-lg text-white rounded-xl py-2.5 outline-none focus:ring-1 focus:ring-yellow-500 transition-all placeholder:text-zinc-700 ${set.completed ? 'text-green-500' : ''}`}
                                            />
                                        </div>

                                        {/* Botón Check Cuadrado */}
                                        <div className="col-span-3 flex justify-center">
                                            <button
                                                onClick={() => toggleSetComplete(exIdx, sIdx)}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${set.completed ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-zinc-800 text-zinc-600 hover:bg-zinc-700'}`}
                                            >
                                                <Check size={20} strokeWidth={4} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button onClick={() => handleAddSet(exIdx)} className="w-full mt-2 py-3 bg-black hover:bg-zinc-900 text-zinc-500 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors border-t border-zinc-900">
                                <Plus size={14} /> Añadir Serie
                            </button>
                        </div>
                    </div>
                ))}

                {/* Intensidad */}
                <div className="pt-4 pb-2">
                    <h3 className="text-[10px] font-black text-zinc-500 uppercase ml-2 mb-3 tracking-widest">Intensidad Percibida</h3>
                    <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
                        {intensityOptions.map((opt) => (
                            <button key={opt.id} onClick={() => setIntensity(opt.id)} className={`flex-1 py-3 rounded-xl flex flex-col items-center justify-center transition-all ${intensity === opt.id ? `${opt.color} text-white shadow-lg` : 'text-zinc-500 hover:text-zinc-300'}`}>
                                <span className="text-[10px] font-black uppercase">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. MODAL DESCANSO */}
            {isResting && (
                <div className="fixed bottom-32 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 p-4 rounded-[24px] shadow-2xl z-50 animate-in slide-in-from-bottom-10 fade-in flex items-center justify-between ring-1 ring-white/10">
                    <div className="flex items-center gap-4 pl-2">
                        <div className="flex flex-col items-center min-w-[60px]">
                            <span className="text-4xl font-black text-white font-mono leading-none tabular-nums">{restTimer}</span>
                            <span className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">Segundos</span>
                        </div>
                        <div className="h-8 w-[1px] bg-zinc-700"></div>
                        <div className="flex flex-col">
                            <span className="text-[9px] text-zinc-400 font-bold uppercase mb-1 flex items-center gap-1"><Timer size={10} /> Tiempo fijo</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={defaultRest}
                                    onChange={handleRestInputChange}
                                    onBlur={handleRestInputBlur}
                                    className="bg-black border border-zinc-700 rounded-lg w-16 text-center text-sm font-bold text-white py-1 focus:border-yellow-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setIsResting(false)} className="bg-white text-black px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition-transform">
                        Saltar <SkipForward size={14} fill="currentColor" />
                    </button>
                </div>
            )}

            {/* 4. FOOTER */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-black border-t border-zinc-900 safe-bottom z-30">
                <button
                    onClick={() => setShowFinishAlert(true)}
                    disabled={finishing}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-all text-lg uppercase tracking-widest border-b-4 border-yellow-600"
                >
                    {finishing ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                    {finishing ? 'GUARDANDO...' : 'TERMINAR SESIÓN'}
                </button>
            </div>

            {/* 5. ALERTAS */}
            {showExitAlert && (
                <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-950 border border-red-900/50 p-6 rounded-3xl w-full max-w-xs shadow-2xl relative">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="bg-red-500/10 p-4 rounded-full text-red-500"><AlertTriangle size={32} /></div>
                            <div>
                                <h3 className="text-white font-black text-lg uppercase">¿Salir sin guardar?</h3>
                                <p className="text-zinc-500 text-xs font-bold mt-1">Se perderá todo el progreso actual.</p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button onClick={() => setShowExitAlert(false)} className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold text-xs uppercase border border-zinc-800">Cancelar</button>
                                <button onClick={confirmExit} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold text-xs uppercase">Salir</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showFinishAlert && (
                <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-950 border border-yellow-500/30 p-6 rounded-3xl w-full max-w-xs shadow-2xl relative">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="bg-yellow-500/10 p-4 rounded-full text-yellow-500"><Trophy size={32} /></div>
                            <div>
                                <h3 className="text-white font-black text-lg uppercase">¿Terminar Sesión?</h3>
                                <p className="text-zinc-500 text-xs font-bold mt-1">Buen trabajo. Vamos a guardar esto.</p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button onClick={() => setShowFinishAlert(false)} className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold text-xs uppercase border border-zinc-800">Seguir</button>
                                <button onClick={confirmFinish} className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-bold text-xs uppercase">Terminar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}