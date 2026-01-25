import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Check, Loader2, X, Trophy, AlertTriangle, Plus,
    SkipForward, Timer, Save, ChevronDown, Maximize2
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../common/Toast';
import { useWorkout } from '../../context/WorkoutContext';

export default function ActiveWorkout({ routine, onFinish }) {
    // Contexto Global para minimizar/maximizar
    const { isMinimized, minimizeWorkout, maximizeWorkout, endWorkout } = useWorkout();

    const STORAGE_KEY = `workout_active_${routine._id}`;

    // --- ESTADOS INICIALES ---
    const [startTime] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved).startTime : Date.now();
    });

    const [exercises, setExercises] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved).exercises;

        // Inicializamos sets con tipo 'N' (Normal)
        return routine.exercises.map(ex => ({
            ...ex,
            setsData: Array.from({ length: ex.sets || 3 }, () => ({
                kg: '',
                reps: '',
                completed: false,
                type: 'N' // Tipos: N=Normal, W=Warmup (Calentamiento), F=Failure (Fallo), D=Drop
            })),
            pr: null
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

    // --- FUNCIONES AUXILIARES DE DESCANSO ---
    const startRest = () => {
        if (defaultRest > 0) {
            setIsResting(true);
            setRestRemaining(defaultRest);
        }
    };

    const skipRest = () => {
        setIsResting(false);
        setRestRemaining(0);
    };

    // --- EFECTOS ---

    // 1. Cronómetro Global
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            setSeconds(Math.floor((now - startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    // 2. Auto-save (Persistencia)
    useEffect(() => {
        const state = { startTime, exercises, intensity, routineId: routine._id, routineName: routine.name, defaultRest };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [exercises, intensity, startTime, routine._id, routine.name, defaultRest, STORAGE_KEY]);

    // 3. Cronómetro Descanso
    useEffect(() => {
        let interval = null;
        if (isResting && restRemaining > 0) {
            interval = setInterval(() => {
                setRestRemaining(prev => {
                    if (prev <= 1) {
                        setIsResting(false);
                        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isResting, restRemaining]);

    // 4. Cargar Historial (PRs y pesos anteriores)
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const exerciseNames = routine.exercises.map(e => e.name);
                const res = await api.post('/gym/history-stats', { exercises: exerciseNames });
                const historyData = res.data;

                setExercises(prev => prev.map(ex => {
                    const stats = historyData[ex.name];
                    if (!stats) return ex;

                    // Solo rellenamos si los campos están vacíos
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


    // --- LÓGICA DE ESTILOS Y NUMERACIÓN (HEVY STYLE) ---
    const getSetDisplayInfo = (allSets, currentIndex) => {
        const type = allSets[currentIndex].type || 'N';

        // 1. CALENTAMIENTO (Naranja, Caja)
        if (type === 'W') {
            return {
                label: 'C',
                style: 'bg-orange-900/20 text-orange-500 border border-orange-500/50 rounded-lg',
                containerClass: 'justify-center'
            };
        }

        // Calcular el número de serie "base" (ignorando drop sets anteriores)
        let normalCount = 0;
        for (let i = 0; i <= currentIndex; i++) {
            if (allSets[i].type !== 'D' && allSets[i].type !== 'W') normalCount++;
        }

        // 2. DROP SET (Morado, SIN CAJA, Indentado)
        if (type === 'D') {
            // Buscamos a qué serie normal pertenece este drop
            let dropDepth = 0;
            // Retrocedemos hasta encontrar el padre no-drop
            for (let i = currentIndex; i >= 0; i--) {
                if (allSets[i].type !== 'D') break; // Encontramos el padre
                dropDepth++;
            }

            // Si es el primer drop es .1, segundo .2, etc.
            return {
                label: `${normalCount}.${dropDepth}`,
                style: 'bg-transparent text-purple-400 font-black border-none p-0 text-sm',
                containerClass: 'justify-end pr-4' // Alineado a la derecha o indentado
            };
        }

        // 3. FALLO (Rojo, Caja)
        if (type === 'F') {
            return {
                label: normalCount,
                style: 'bg-red-900/20 text-red-500 border border-red-500/50 rounded-lg',
                containerClass: 'justify-center'
            };
        }

        // 4. NORMAL (Gris, Caja)
        return {
            label: normalCount,
            style: 'bg-zinc-900 text-zinc-500 border border-zinc-800 rounded-lg',
            containerClass: 'justify-center'
        };
    };

    // --- HANDLERS CORREGIDOS (Inmutabilidad Estricta) ---

    // 1. Ciclo: Normal -> Calentamiento -> Fallo -> Drop -> Normal
    const cycleSetType = (exIdx, setIdx) => {
        const types = ['N', 'W', 'F', 'D'];
        setExercises(prev => prev.map((ex, i) => {
            if (i !== exIdx) return ex;
            return {
                ...ex,
                setsData: ex.setsData.map((set, j) => {
                    if (j !== setIdx) return set;
                    const currentType = set.type || 'N';
                    const nextIndex = (types.indexOf(currentType) + 1) % types.length;
                    return { ...set, type: types[nextIndex] };
                })
            };
        }));
    };

    // 2. Marcar Check (Completado)
    const toggleSetComplete = (exIdx, setIdx) => {
        const currentSet = exercises[exIdx].setsData[setIdx];

        // Validación visual para no marcar cosas vacías
        if (String(currentSet.kg).trim() === '' || String(currentSet.reps).trim() === '') {
            return setToast({ message: 'Faltan datos (Kg o Reps)', type: 'error' });
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

        // Solo iniciamos descanso si se completa y NO es Drop Set (los drop sets son seguidos)
        if (!currentSet.completed && currentSet.type !== 'D') {
            startRest();
        }
    };

    // 3. Escribir en inputs (Peso/Reps)
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

    // 4. Añadir Serie
    const handleAddSet = (exIdx) => {
        setExercises(prev => prev.map((ex, i) => {
            if (i !== exIdx) return ex;

            const last = ex.setsData[ex.setsData.length - 1];
            // Si el anterior era Drop, el nuevo probablemente también lo sea
            const nextType = last?.type === 'D' ? 'D' : 'N';

            return {
                ...ex,
                setsData: [
                    ...ex.setsData,
                    {
                        kg: last?.kg || '',
                        reps: last?.reps || '',
                        completed: false,
                        type: nextType
                    }
                ]
            };
        }));
    };

    const handleRestInputChange = (e) => {
        const val = e.target.value;
        if (val === '') { setDefaultRest(''); return; }
        const num = parseInt(val);
        if (!isNaN(num)) {
            setDefaultRest(num);
            if (isResting) {
                // Si cambiamos el tiempo mientras descansamos, ajustamos
                setRestRemaining(num);
            }
        }
    };

    // --- FINALIZAR RUTINA BLINDADA ---
    const confirmFinish = async () => {
        if (finishing) return;

        // Validar que haya al menos una serie completada
        const hasAnyCompleted = exercises.some(ex => ex.setsData.some(s => s.completed));
        if (!hasAnyCompleted) {
            setToast({ message: 'Completa al menos una serie', type: 'error' });
            // Cerramos la alerta para que el usuario pueda seguir editando
            setShowFinishAlert(false);
            return;
        }

        setFinishing(true);
        try {
            const logData = {
                routineId: routine._id,
                routineName: routine.name,
                duration: seconds > 0 ? seconds : 1, // Duración mínima 1s
                intensity,
                exercises: exercises.map(ex => ({
                    name: ex.name,
                    // Enviamos SOLO las series marcadas como completadas
                    sets: ex.setsData
                        .filter(s => s.completed)
                        .map(s => ({
                            // Convertimos comas a puntos y aseguramos números
                            weight: parseFloat(String(s.kg).replace(',', '.')) || 0,
                            reps: parseFloat(String(s.reps).replace(',', '.')) || 0,
                            type: s.type || 'N'
                        }))
                })).filter(ex => ex.sets.length > 0) // Quitamos ejercicios sin series hechas
            };

            const res = await api.post('/gym/log', logData);
            localStorage.removeItem(STORAGE_KEY);
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

    // 1. MODO MINIMIZADO (Barra Flotante)
    if (isMinimized) {
        return createPortal(
            <div
                onClick={maximizeWorkout}
                className="fixed bottom-[70px] left-4 right-4 z-[90] bg-zinc-900/95 backdrop-blur-md border border-yellow-500/50 rounded-2xl p-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex justify-between items-center cursor-pointer animate-in slide-in-from-bottom-10"
            >
                <div className="flex items-center gap-3">
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
                    <button onClick={minimizeWorkout} className="bg-zinc-900 text-zinc-400 p-3 rounded-full hover:text-white border border-zinc-800 transition-colors active:scale-95">
                        <ChevronDown size={24} />
                    </button>
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
                            {/* CABECERAS DE COLUMNAS */}
                            <div className="grid grid-cols-12 gap-2 py-2 px-2 text-[9px] text-zinc-500 font-black uppercase tracking-widest text-center border-b border-zinc-900 mb-2">
                                <div className="col-span-2">Set</div>
                                <div className="col-span-4">Kg</div>
                                <div className="col-span-3">Reps</div>
                                <div className="col-span-3">Check</div>
                            </div>

                            <div className="space-y-1">
                                {ex.setsData.map((set, sIdx) => {
                                    // OBTENER VISUALIZACIÓN (Caja vs Drop sin caja)
                                    const { label, style, containerClass } = getSetDisplayInfo(ex.setsData, sIdx);

                                    return (
                                        <div key={sIdx} className={`grid grid-cols-12 gap-2 items-center p-1 rounded-2xl transition-all ${set.completed ? 'bg-zinc-900/50 opacity-60' : ''}`}>

                                            {/* BOTÓN NÚMERO DE SERIE */}
                                            <div className={`col-span-2 flex ${containerClass}`}>
                                                <button
                                                    onClick={() => cycleSetType(exIdx, sIdx)}
                                                    className={`w-8 h-8 flex items-center justify-center text-xs font-black transition-all active:scale-95 ${style}`}
                                                >
                                                    {label}
                                                </button>
                                            </div>

                                            <div className="col-span-4">
                                                <input type="number" inputMode="decimal" placeholder="Kg" value={set.kg} onChange={(e) => handleInputChange(exIdx, sIdx, 'kg', e.target.value)} className="w-full bg-zinc-900 text-white text-center font-bold py-3 rounded-xl outline-none focus:ring-1 focus:ring-yellow-500" />
                                            </div>
                                            <div className="col-span-3">
                                                <input type="number" inputMode="decimal" placeholder="-" value={set.reps} onChange={(e) => handleInputChange(exIdx, sIdx, 'reps', e.target.value)} className="w-full bg-zinc-900 text-white text-center font-bold py-3 rounded-xl outline-none focus:ring-1 focus:ring-yellow-500" />
                                            </div>
                                            <div className="col-span-3 flex justify-center">
                                                <button onClick={() => toggleSetComplete(exIdx, sIdx)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${set.completed ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                                                    <Check size={20} strokeWidth={4} />
                                                </button>
                                            </div>
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

            {/* MODAL DESCANSO */}
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
        </div>,
        document.body
    );
}