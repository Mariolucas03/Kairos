import { useState, useEffect, useRef, useMemo } from 'react';
import usePantallaEncendida from '../../hooks/usePantallaEncendida';
import { createPortal } from 'react-dom';
import {
    Check, Loader2, X, Trophy, AlertTriangle, Plus,
    SkipForward, Timer, Save, ChevronDown, Maximize2, RefreshCw, Camera, Play, TrendingUp
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../common/Toast';
import { useWorkout } from '../../context/WorkoutContext';
import ExerciseSelector from './ExerciseSelector';
import { loQueHasLevantado } from '../../utils/loQueHasLevantado';
import ExerciseSheet from './ExerciseSheet';
import RankUpModal from './RankUpModal';
import BodyMap from '../body/BodyMap';
import { compressImage } from '../../utils/imageCompressor';
import { encolar, esFalloDeRed } from '../../utils/colaEntrenos';

// ==========================================
// SUB-COMPONENTE: CRONÓMETRO GLOBAL AISLADO
// ==========================================
const GlobalTimerDisplay = ({ startTime, isMinimized }) => {
    const [seconds, setSeconds] = useState(() => Math.floor((Date.now() - startTime) / 1000));

    useEffect(() => {
        const timer = setInterval(() => {
            setSeconds(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    const formatTime = (total) => {
        const m = Math.floor(total / 60).toString().padStart(2, '0');
        const s = (total % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (isMinimized) {
        return <span className="font-mono text-lg font-bold text-zinc-300 tabular-nums">{formatTime(seconds)}</span>;
    }

    return <div className="font-mono text-5xl font-black text-white tracking-tighter leading-none tabular-nums">{formatTime(seconds)}</div>;
};

// ==========================================
// SUB-COMPONENTE: MODAL DE DESCANSO AISLADO
// ==========================================
const RestTimerModal = ({ targetTime, initialDefaultRest, onSkip, onUpdateDefaultRest, info }) => {
    const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((targetTime - Date.now()) / 1000)));
    const [localRest, setLocalRest] = useState(initialDefaultRest);

    useEffect(() => {
        const interval = setInterval(() => {
            const diff = Math.ceil((targetTime - Date.now()) / 1000);
            if (diff <= 0) {
                clearInterval(interval);
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                onSkip();
            } else {
                setRemaining(diff);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [targetTime, onSkip]);

    const handleChange = (e) => {
        const val = e.target.value;
        if (val === '') { setLocalRest(''); return; }
        const num = parseInt(val);
        if (!isNaN(num)) {
            setLocalRest(num);
            onUpdateDefaultRest(num);
        }
    };

    return (
        <div className="fixed bottom-32 left-4 right-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 p-4 rounded-[24px] shadow-2xl z-50 ring-1 ring-white/10 animate-in slide-in-from-bottom-5">
            {/* QUÉ VIENE AHORA.

                Esta pantalla se mira quince o veinte veces por sesión, y hasta
                ahora solo tenía un número bajando. Los dos minutos de descanso
                son justo el rato en el que quieres saber qué te toca y cómo fue
                la serie anterior, así que van aquí y no en otro sitio. */}
            {info && (
                <div className="flex items-center justify-between gap-3 pb-2.5 mb-3 border-b border-white/10">
                    <p className="text-[11px] font-black text-white uppercase tracking-tight truncate min-w-0">
                        {info.proximo}
                    </p>
                    {info.hecho && (
                        <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-lg border tabular-nums ${info.cumplida
                            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                            : 'text-zinc-400 border-white/10 bg-white/5'}`}>
                            {info.cumplida ? '✓ ' : ''}{info.hecho}
                        </span>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 pl-2">
                <div className="flex flex-col items-center min-w-[60px]">
                    <span className="text-4xl font-black text-white font-mono leading-none tabular-nums">{remaining}</span>
                    <span className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">Segundos</span>
                </div>
                <div className="h-8 w-[1px] bg-zinc-700"></div>
                <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-400 font-bold uppercase mb-1 flex items-center gap-1"><Timer size={10} /> Tiempo fijo</span>
                    <input type="number" inputMode="decimal" value={localRest} onChange={handleChange} className="bg-black border border-zinc-700 rounded-lg w-16 text-center text-sm font-bold text-white py-1 outline-none" />
                </div>
            </div>
            <button onClick={onSkip} className="bg-white text-black px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 active:scale-95 transition-transform">Saltar <SkipForward size={14} /></button>
            </div>
        </div>
    );
};

// ==========================================
// COMPONENTE PRINCIPAL (RUTINA)
// ==========================================
/**
 * La propuesta de hoy, escrita como se la dirías a alguien.
 *
 * El servidor manda dos números y un motivo sin cifras dentro; las unidades las
 * pone aquí, que es quien sabe cómo se mide este ejercicio: en un plancha son
 * segundos, en unas dominadas lastradas es el lastre, y en un ejercicio por lado
 * las repeticiones son de cada lado.
 */
const comoSeDice = (ex) => {
    const s = ex.sugerencia;
    if (!s) return null;

    const peso = ex.esPesoCorporal
        ? (s.peso > 0 ? `${s.peso} kg de lastre` : 'sin lastre')
        : `${s.peso} kg`;

    const cuanto = ex.esPorTiempo
        ? `${s.reps} seg`
        : `${s.reps} ${ex.porLado ? 'por lado' : 'reps'}`;

    const series = (ex.setsData || []).length;

    return {
        titular: `${peso} × ${cuanto}${series > 1 ? ' en todas las series' : ''}`,
        antes: (ex.ultimasSeries || []).map(x => x.reps).filter(n => n > 0),
        motivo: s.motivo,
        completada: s.completada
    };
};

export default function ActiveWorkout({ routine, onFinish }) {
    const { isMinimized, minimizeWorkout, maximizeWorkout, endWorkout } = useWorkout();

    // La pantalla no se apaga mientras dure el entreno. Se suelta sola al
    // terminar, para no dejarle la bateria secuestrada a nadie.
    usePantallaEncendida(true);

    const STORAGE_KEY = `workout_active_${routine._id}`;
    const REST_KEY = `workout_rest_target_${routine._id}`;
    // Qué serie acabas de terminar. Va aparte y también guardado, porque el
    // descanso sobrevive a cerrar la app: si solo estuviera en memoria, volver
    // a abrirla a mitad del descanso dejaría el cronómetro sin saber de qué.
    const RESTCTX_KEY = `workout_rest_ctx_${routine._id}`;

    // --- ESTADOS INICIALES ---
    const [startTime] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved).startTime : Date.now();
    });

    /**
     * Marca de ESTE entreno, puesta al empezar.
     *
     * Es lo que permite reintentar el envio sin miedo: el servidor la usa para
     * reconocer un entreno que ya guardo y no darlo por bueno dos veces. Tiene
     * que sobrevivir a cerrar la app a medio entreno, asi que va en el borrador
     * como todo lo demas — si se generara al pulsar "terminar", cada reintento
     * traeria una marca distinta y no serviria de nada.
     */
    const [clienteId] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        const guardado = saved ? JSON.parse(saved).clienteId : null;
        if (guardado) return guardado;
        const aleatorio = (globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2));
        return `${routine._id}-${startTime}-${aleatorio}`.slice(0, 64);
    });

    const [exercises, setExercises] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved).exercises;

        return routine.exercises.map(ex => ({
            ...ex,
            setsData: Array.from({ length: ex.sets || 3 }, () => ({ kg: '', reps: '', completed: false, type: 'N' })),
            pr: null,
            lastWeights: []
        }));
    });

    const [intensity, setIntensity] = useState('Media');

    // Nombre del ejercicio cuya ficha (GIF + ejecución) está abierta
    const [fichaAbierta, setFichaAbierta] = useState(null);

    // Subidas de rango muscular que devuelve el servidor al guardar el entreno.
    // Se guardan aparte para poder enseñarlas ANTES de cerrar la pantalla: si se
    // cerrara primero, el aviso se perdería con el desmontaje.
    const [subidasRango, setSubidasRango] = useState(null);

    const [restContexto, setRestContexto] = useState(() => {
        try { return JSON.parse(localStorage.getItem(RESTCTX_KEY)) || null; } catch { return null; }
    });
    const [restTargetTime, setRestTargetTime] = useState(() => {
        const saved = localStorage.getItem(REST_KEY);
        return saved ? parseInt(saved) : null;
    });

    const [defaultRest, setDefaultRest] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved && JSON.parse(saved).defaultRest ? JSON.parse(saved).defaultRest : 60;
    });

    const [finishing, setFinishing] = useState(false);
    const [toast, setToast] = useState(null);
    const [showExitAlert, setShowExitAlert] = useState(false);
    const [showFinishAlert, setShowFinishAlert] = useState(false);
    // Foto del entreno (se comprime en el móvil antes de subirla)
    const [photo, setPhoto] = useState(null);
    const [compressing, setCompressing] = useState(false);

    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCompressing(true);
        try {
            setPhoto(await compressImage(file));
        } catch (err) {
            setToast({ message: err.message || 'No se pudo procesar la imagen', type: 'error' });
        } finally {
            setCompressing(false);
        }
    };

    // Cifras y músculos de la sesión, para la pantalla de resumen
    const resumen = useMemo(() => {
        let totalSets = 0, volumen = 0;
        const musculos = new Set();
        const secundarios = new Set();

        exercises.forEach(ex => {
            const hechas = ex.setsData.filter(s => s.completed);
            if (hechas.length === 0) return;
            totalSets += hechas.length;
            hechas.forEach(s => {
                const kg = parseFloat(String(s.kg).replace(',', '.')) || 0;
                const reps = parseFloat(String(s.reps).replace(',', '.')) || 0;
                volumen += kg * reps;
            });
            if (ex.muscle) musculos.add(ex.muscle);
            // Los secundarios también se marcan, en tono apagado, igual que en el post
            (ex.secondary || []).forEach(s => secundarios.add(s));
        });

        // Un músculo principal no debe salir además como secundario
        musculos.forEach(m => secundarios.delete(m));

        // Cómo fue cada ejercicio CONTRA lo que la app había propuesto.
        //
        // El resumen daba series, volumen y músculos: cifras que solas no dicen
        // nada. ¿24.000 kg de volumen es bueno? No hay forma de saberlo. Pero al
        // empezar la sesión la app te dijo "80 × 8 en las tres", así que puede
        // decirte si lo hiciste, que es la única pregunta que importa.
        //
        // Solo entran los ejercicios que llevaban propuesta: la primera vez que
        // haces uno no había nada que cumplir.
        const objetivos = exercises.map(ex => {
            const obj = ex.sugerencia;
            const hechas = ex.setsData.filter(s => s.completed);
            if (!obj || hechas.length === 0) return null;

            const numero = (v) => parseFloat(String(v).replace(',', '.')) || 0;
            const cumplida = hechas.every(s => numero(s.reps) >= obj.reps && numero(s.kg) >= obj.peso);

            return {
                name: ex.name,
                pedido: `${obj.peso} × ${obj.reps}`,
                hecho: hechas.map(s => numero(s.reps)).join(' · '),
                cumplida
            };
        }).filter(Boolean);

        return { totalSets, volumen: Math.round(volumen), musculos: [...musculos], secundarios: [...secundarios], objetivos };
    }, [exercises]);
    // Lo que tocará el próximo día, que lo calcula el servidor al guardar.
    // Se enseña DESPUÉS de guardar porque hasta entonces no existe: sale de la
    // sesión que se acaba de escribir.
    const [proximaVez, setProximaVez] = useState(null);

    // El dato del final ("has levantado un mamut"). Se congela al abrir el
    // resumen: lleva un azar dentro, y si se recalculara en cada repintado la
    // frase iría cambiando sola delante de ti.
    const [comparacion, setComparacion] = useState(null);

    const [swapIndex, setSwapIndex] = useState(null);
    const [showSelector, setShowSelector] = useState(false);

    // --- EFECTOS ---

    // 1. Cargar Historial y PRs al inicio
    useEffect(() => {
        const fetchHistory = async () => {
            const needsData = exercises.some(ex => ex.pr === null);
            if (!needsData) return;

            try {
                const exerciseNames = exercises.map(e => e.name);
                // Se manda la rutina para que el servidor pueda ademas proponer
                // que peso toca hoy en cada ejercicio.
                const res = await api.post('/gym/history-stats', { exercises: exerciseNames, routineId: routine._id });
                const historyData = res.data;

                setExercises(prev => prev.map(ex => {
                    const stats = historyData[ex.name];
                    if (!stats) return ex;

                    const isClean = ex.setsData.every(s => s.kg === '' && s.reps === '');
                    let newSetsData = ex.setsData;

                    if (isClean && stats.lastSets && stats.lastSets.length > 0) {
                        newSetsData = ex.setsData.map((set, index) => {
                            const historySet = stats.lastSets[index] || stats.lastSets[stats.lastSets.length - 1];
                            // La sugerencia manda sobre el historial: el historial dice
                            // lo que hiciste, la sugerencia lo que toca hoy. Sigue
                            // siendo editable, que para eso es una sugerencia.
                            const sugerida = stats.sugerencia;
                            if (sugerida) return { ...set, kg: sugerida.peso, reps: sugerida.reps };
                            if (historySet) return { ...set, kg: historySet.weight, reps: historySet.reps };
                            return set;
                        });
                    }

                    // La propuesta se guarda entera, no solo se vuelca en las
                    // casillas: hace falta para poder DECIRLA. Rellenar los
                    // huecos y callarse es lo que hacía antes, y así nadie se
                    // enteraba de que la app estaba proponiendo nada.
                    return {
                        ...ex,
                        setsData: newSetsData,
                        pr: stats.bestSet,
                        sugerencia: stats.sugerencia || null,
                        ultimasSeries: stats.lastSets || []
                    };
                }));
            } catch (e) { console.error("Error cargando historial", e); }
        };

        fetchHistory();
    }, []);

    // 🔥 2. AUTO-SAVE OPTIMIZADO (DEBOUNCE) 🪄
    useEffect(() => {
        // En lugar de guardar de inmediato, programamos el guardado para dentro de 1 segundo
        const timeoutId = setTimeout(() => {
            const state = { startTime, clienteId, exercises, intensity, routineId: routine._id, routineName: routine.name, defaultRest };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }, 1000);

        // Si el usuario vuelve a teclear antes de que pase 1 segundo, el timeout anterior se cancela.
        // ¡Cero tirones al escribir!
        return () => clearTimeout(timeoutId);
    }, [exercises, intensity, defaultRest, startTime, clienteId, routine._id, routine.name, STORAGE_KEY]);

    // --- FUNCIONES DESCANSO ---
    /**
     * Arranca el descanso.
     *
     * Cada ejercicio puede llevar el suyo (`rest`); si vale 0 se usa el general
     * de la rutina. El campo existía en el modelo desde el principio, pero aquí
     * se ignoraba: todos los ejercicios descansaban lo mismo pasara lo que
     * pasara, así que configurarlo no servía de nada.
     */
    const startRest = (segundosDelEjercicio, exIdx = null, setIdx = null) => {
        const espera = Number(segundosDelEjercicio) > 0
            ? Number(segundosDelEjercicio)
            : defaultRest;

        if (espera > 0) {
            const targetTime = Date.now() + (espera * 1000);
            localStorage.setItem(REST_KEY, targetTime.toString());
            setRestTargetTime(targetTime);

            const ctx = exIdx === null ? null : { exIdx, setIdx };
            setRestContexto(ctx);
            if (ctx) localStorage.setItem(RESTCTX_KEY, JSON.stringify(ctx));
            else localStorage.removeItem(RESTCTX_KEY);
        }
    };

    const handleSkipRest = () => {
        localStorage.removeItem(REST_KEY);
        setRestTargetTime(null);
    };

    const handleUpdateDefaultRest = (newRestValue) => {
        setDefaultRest(newRestValue);
        const targetTime = Date.now() + (newRestValue * 1000);
        localStorage.setItem(REST_KEY, targetTime.toString());
        setRestTargetTime(targetTime);
    };

    // --- LOGICA DE SERIES Y SWAP ---
    const handleOpenSwap = (index) => { setSwapIndex(index); setShowSelector(true); };

    const handleSwapComplete = async (selectedList) => {
        if (!selectedList || selectedList.length === 0) { setShowSelector(false); return; }

        const newExData = selectedList[0];
        const currentIndex = swapIndex;

        setExercises(prev => prev.map((ex, i) => {
            if (i !== currentIndex) return ex;
            return {
                ...ex,
                name: newExData.name,
                muscle: newExData.muscle,
                setsData: Array.from({ length: ex.setsData.length }, () => ({ kg: '', reps: '', completed: false, type: 'N' })),
                pr: null
            };
        }));

        setShowSelector(false);
        setSwapIndex(null);

        try {
            const res = await api.post('/gym/history-stats', { exercises: [newExData.name] });
            const history = res.data[newExData.name];

            if (history) {
                setExercises(prev => prev.map((ex, i) => {
                    if (i !== currentIndex) return ex;
                    const updatedSets = ex.setsData.map((set, setIdx) => {
                        const lastSet = history.lastSets[setIdx] || history.lastSets[history.lastSets.length - 1];
                        return lastSet ? { ...set, kg: lastSet.weight, reps: lastSet.reps } : set;
                    });
                    return {
                        ...ex,
                        pr: history.bestSet,
                        setsData: updatedSets,
                        sugerencia: history.sugerencia || null,
                        ultimasSeries: history.lastSets || []
                    };
                }));
                setToast({ message: 'Ejercicio cambiado', type: 'success' });
            }
        } catch (error) { console.error("Error swap history:", error); }
    };

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

    /**
     * Lo que se enseña durante el descanso: cómo fue la serie que acabas de
     * hacer y cuál viene ahora.
     *
     * Sale de la serie recién marcada, no del ejercicio "actual": en una
     * superserie o cambiando de orden a mano, "el actual" no es lo que acabas de
     * levantar. El objetivo de comparación es el que la app propuso al empezar.
     */
    const infoDescanso = useMemo(() => {
        if (!restContexto) return null;
        const ex = exercises[restContexto.exIdx];
        const hecha = ex?.setsData?.[restContexto.setIdx];
        if (!ex || !hecha) return null;

        const unidad = ex.esPorTiempo ? 'seg' : 'reps';
        const numero = (v) => parseFloat(String(v).replace(',', '.')) || 0;
        const obj = ex.sugerencia;

        const hecho = `${numero(hecha.kg)} × ${numero(hecha.reps)}`;
        const cumplida = obj
            ? numero(hecha.reps) >= obj.reps && numero(hecha.kg) >= obj.peso
            : false;

        // La siguiente serie sin marcar de este mismo ejercicio
        const iProx = ex.setsData.findIndex((x, i) => i > restContexto.setIdx && !x.completed);
        if (iProx >= 0) {
            const { label } = getSetDisplayInfo(ex.setsData, iProx);
            const meta = obj ? `${obj.peso} kg × ${obj.reps} ${unidad}` : `${numero(hecha.kg)} kg`;
            return { proximo: `Ahora: serie ${label} · ${meta}`, hecho, cumplida };
        }

        // Se acabó el ejercicio: lo que viene es el siguiente que quede a medias
        const iEx = exercises.findIndex((x, i) => i > restContexto.exIdx && x.setsData.some(y => !y.completed));
        if (iEx >= 0) return { proximo: `Ahora: ${exercises[iEx].name}`, hecho, cumplida };

        return { proximo: 'Última serie. A terminar.', hecho, cumplida };
    }, [restContexto, exercises]);

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

        if (!currentSet.completed && currentSet.type !== 'D') {
            startRest(exercises[exIdx]?.rest, exIdx, setIdx);
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
            return { ...ex, setsData: [...ex.setsData, { kg: last?.kg || '', reps: last?.reps || '', completed: false, type: nextType }] };
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

        // Se declara FUERA del try para que el catch pueda encolarlo si no hay
        // red. Dentro del try no existiria ahi, y encolar el entreno es justo
        // lo que hay que hacer cuando el envio falla.
        let logData = null;

        try {
            const finalSeconds = Math.floor((Date.now() - startTime) / 1000);

            logData = {
                routineId: routine._id,
                routineName: routine.name,
                duration: finalSeconds > 0 ? finalSeconds : 1,
                intensity,
                exercises: exercises.map(ex => ({
                    name: ex.name,
                    // Como se mide este ejercicio. El servidor lo usa para
                    // calcular lo que de verdad has movido: en los de peso
                    // corporal suma tu peso, y en los de tiempo convierte los
                    // segundos. Aqui solo se manda lo que dice la rutina.
                    esPorTiempo: !!ex.esPorTiempo,
                    esPesoCorporal: !!ex.esPesoCorporal,
                    superserie: ex.superserie || '',
                    sets: ex.setsData.filter(s => s.completed).map(s => {
                        const numero = (v) => parseFloat(String(v).replace(',', '.')) || 0;
                        return {
                            // En los de peso corporal, la casilla de kg es el LASTRE
                            weight: ex.esPesoCorporal ? 0 : numero(s.kg),
                            lastre: ex.esPesoCorporal ? numero(s.kg) : 0,
                            // Y en los de tiempo, la de repeticiones son SEGUNDOS
                            reps: ex.esPorTiempo ? 0 : numero(s.reps),
                            segundos: ex.esPorTiempo ? numero(s.reps) : 0,
                            porLado: !!ex.porLado,
                            type: s.type || 'N'
                        };
                    })
                })).filter(ex => ex.sets.length > 0),
                // La foto viaja ya comprimida; el servidor la valida y deriva
                // por su cuenta los músculos trabajados a partir de los ejercicios.
                photo: photo || undefined,
                // Para que reintentarlo no lo guarde dos veces
                clienteId
            };

            const res = await api.post('/gym/log', logData);

            // ⚠️ Esto REESCRIBIA la rutina con solo cuatro campos, asi que cada
            // entreno terminado borraba su configuracion: el rango de
            // repeticiones se forzaba a "10-12", el descanso propio del ejercicio
            // y el musculo concreto desaparecian, y el peso objetivo se ponia a
            // cero. Con lo anadido despues era peor todavia: tiempo, peso
            // corporal, por lado, superserie, sistema de progresion e
            // incremento se iban tambien. Configurabas la progresion, entrenabas
            // UNA vez y se habia esfumado.
            //
            // Lo unico que tiene sentido actualizar aqui es cuantas series
            // hiciste de verdad. Todo lo demas se conserva tal cual, quitando
            // solo lo que vive en la pantalla y no en la rutina.
            const updatedStructure = exercises.map(({ setsData, pr, lastWeights, sugerencia, ultimasSeries, ...ex }) => ({
                ...ex,
                sets: setsData.length
            }));
            await api.put(`/gym/routines/${routine._id}`, { exercises: updatedStructure });

            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(REST_KEY);

            // Si algun grupo ha subido de rango, se ensena el aviso ANTES de
            // cerrar: onFinish desmonta esta pantalla y el aviso se perderia.
            // El cierre queda pendiente de que el usuario lo lea.
            if (res.data?.rankUps?.length) {
                setSubidasRango({
                    subidas: res.data.rankUps,
                    monedas: res.data.rankUpCoins || 0,
                    datos: res.data
                });
                return;
            }

            cerrarSesion(res.data);
        } catch (error) {
            console.error(error);

            // ⚠️ NO ES LO MISMO QUE NO HAYA RED A QUE EL ENTRENO ESTE MAL.
            //
            // Antes las dos cosas daban "Error al guardar" y te dejaban en la
            // pantalla del entreno. El borrador se salvaba, pero tenias que
            // acordarte de volver a entrar y darle otra vez al salir del
            // gimnasio — justo despues de entrenar, que es cuando menos ganas
            // hay de pelearse con una app.
            //
            // Si es de red, se queda en la cola y se manda solo. Si el servidor
            // lo ha rechazado, eso SI hay que ensenarlo: insistir no lo va a
            // arreglar.
            // Si el fallo ocurrio antes de montar el envio (no deberia, pero
            // un catch no puede dar nada por hecho), no hay nada que encolar.
            if (logData && esFalloDeRed(error)) {
                encolar(logData);
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(REST_KEY);
                setToast({
                    message: 'Sin conexión: se guardará solo en cuanto vuelva',
                    type: 'success'
                });
                // Se cierra igual: el entreno esta a salvo y quedarse aqui solo
                // hace pensar que se ha perdido.
                setTimeout(() => { if (onFinish) onFinish(null); }, 1200);
                return;
            }

            setToast({ message: error.response?.data?.message || 'Error al guardar', type: 'error' });
            setFinishing(false);
            setShowFinishAlert(false);
        }
    };

    /** Cierra la sesión, enseñando antes lo que toca la próxima vez si lo hay. */
    const cerrarSesion = (datos) => {
        const lista = Object.entries(datos?.proximaVez || {});
        if (lista.length > 0) {
            // El resumen se cierra: si no, se queda debajo con el boton en
            // 'Guardando...' para siempre, y asoma por los bordes.
            setShowFinishAlert(false);
            setProximaVez({ lista, datos });
            return;
        }
        if (onFinish) onFinish(datos);
    };

    const confirmExit = () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(REST_KEY);
        endWorkout();
    };

    const intensityOptions = [
        { id: 'Baja', label: 'Fuerza', color: 'bg-blue-600' },
        { id: 'Media', label: 'Hipertrofia', color: 'bg-yellow-500' },
        { id: 'Alta', label: 'Metabólico', color: 'bg-red-600' },
    ];

    // --- RENDER ---
    if (showSelector) {
        return createPortal(<div className="fixed inset-0 z-[250] bg-black"><ExerciseSelector onSelect={handleSwapComplete} onClose={() => setShowSelector(false)} /></div>, document.body);
    }

    if (isMinimized) {
        return createPortal(
            <div onClick={maximizeWorkout} className="fixed bottom-[70px] left-4 right-4 z-[90] bg-zinc-900/95 backdrop-blur-md border border-yellow-500/50 rounded-2xl p-3 flex justify-between items-center cursor-pointer animate-in slide-in-from-bottom-10">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 flex items-center justify-center bg-black rounded-xl border border-yellow-500/20">
                        {restTargetTime ? <span className="text-xs font-black text-blue-400 animate-pulse"><Timer size={16} /></span> : <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping"></div>}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">En curso</span>
                        <span className="text-sm font-black text-white truncate max-w-[150px]">{routine.name}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <GlobalTimerDisplay startTime={startTime} isMinimized={true} />
                    <button className="bg-yellow-500 text-black p-2 rounded-lg hover:bg-yellow-400"><Maximize2 size={18} /></button>
                </div>
            </div>, document.body
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom duration-300 select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER CON RELOJ AISLADO */}
            <div className="pt-6 pb-4 px-6 bg-black border-b border-zinc-900 flex justify-between items-end shrink-0 safe-top z-20">
                <div>
                    <h2 className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-1">En curso</h2>
                    <GlobalTimerDisplay startTime={startTime} isMinimized={false} />
                </div>
                <div className="flex gap-2">
                    <button onClick={minimizeWorkout} className="bg-zinc-900 text-zinc-400 p-3 rounded-full hover:text-white border border-zinc-800 transition-colors active:scale-95"><ChevronDown size={24} /></button>
                    <button onClick={() => setShowExitAlert(true)} className="bg-zinc-900 text-red-500 p-3 rounded-full hover:text-red-400 border border-red-900/30 transition-colors active:scale-95"><X size={24} /></button>
                </div>
            </div>

            {fichaAbierta && (
                <ExerciseSheet exerciseName={fichaAbierta} onClose={() => setFichaAbierta(null)} />
            )}

            {subidasRango && (
                <RankUpModal
                    subidas={subidasRango.subidas}
                    monedas={subidasRango.monedas}
                    onClose={() => {
                        const datos = subidasRango.datos;
                        setSubidasRango(null);
                        cerrarSesion(datos);
                    }}
                />
            )}

            {/* LISTA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-black pb-40">
                {exercises.map((ex, exIdx) => (
                    <div key={exIdx} className="space-y-3">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-white font-black text-xl uppercase tracking-tight flex items-center gap-2 leading-tight max-w-[65%]">
                                <span className="text-yellow-500 text-sm shrink-0">#{exIdx + 1}</span> {ex.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                {/* Récord: los kilos solos no dicen nada (no es lo mismo
                                    100 kg a 1 repetición que 100 kg a 8), así que va
                                    siempre acompañado de las reps con las que se hizo. */}
                                {ex.pr && ex.pr.value1RM > 0 && (
                                    <div className="flex items-center gap-1.5 bg-zinc-900/50 px-2 py-1.5 rounded-lg border border-zinc-800" title="Tu mejor serie en este ejercicio">
                                        <Trophy size={14} className="text-yellow-600 shrink-0" />
                                        <span className="text-xs font-black text-yellow-500 whitespace-nowrap">
                                            {ex.pr.weight}<span className="text-[10px] text-zinc-500">kg</span>
                                            <span className="text-zinc-600 mx-0.5">×</span>
                                            {ex.pr.reps}
                                        </span>
                                    </div>
                                )}
                                {/* Ver cómo se hace sin salir del entreno */}
                                <button onClick={() => setFichaAbierta(ex.name)} className="p-1.5 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white active:scale-95" aria-label={`Ver ejecución de ${ex.name}`}><Play size={16} fill="currentColor" /></button>
                                <button onClick={() => handleOpenSwap(exIdx)} className="p-1.5 bg-zinc-900 rounded-lg text-blue-400 border border-zinc-800 hover:bg-zinc-800 active:scale-95"><RefreshCw size={16} /></button>
                            </div>
                        </div>

                        {/* QUÉ TOCA HOY.

                            La app ya calculaba esto y lo metía en las casillas sin
                            decir nada: veías un 80 y un 8 puestos solos y no sabías
                            si eran de la última vez, un valor por defecto o algo
                            pensado. Dicho en una línea —y con lo que hiciste el otro
                            día al lado— se entiende de qué va y se puede discutir
                            con ello, que para eso es una propuesta y no una orden. */}
                        {(() => {
                            const hoy = comoSeDice(ex);
                            if (!hoy) return null;
                            return (
                                <div className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl border ${hoy.completada
                                    ? 'bg-emerald-500/[0.07] border-emerald-500/25'
                                    : 'bg-yellow-500/[0.06] border-yellow-500/20'}`}>
                                    <TrendingUp size={14} className={`mt-px shrink-0 ${hoy.completada ? 'text-emerald-400' : 'text-yellow-500'}`} />
                                    <div className="min-w-0">
                                        <p className={`text-[12px] font-black uppercase tracking-tight leading-tight ${hoy.completada ? 'text-emerald-400' : 'text-yellow-500'}`}>
                                            Hoy: {hoy.titular}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 leading-snug mt-0.5">
                                            {hoy.antes.length > 0 && (
                                                <span className="text-zinc-400">La última vez: {hoy.antes.join(' · ')}. </span>
                                            )}
                                            {hoy.motivo}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden p-1">
                            <div className="grid grid-cols-12 gap-2 py-2 px-2 text-[9px] text-zinc-500 font-black uppercase tracking-widest text-center border-b border-zinc-900 mb-2">
                                {/* Las columnas se llaman distinto segun como se mida el
                                    ejercicio: sin esto, escribir 90 segundos en una casilla
                                    que pone "Reps" no lo entiende nadie. */}
                                <div className="col-span-2">Set</div>
                                <div className="col-span-4">{ex.esPesoCorporal ? 'Lastre' : 'Kg'}</div>
                                <div className="col-span-3">{ex.esPorTiempo ? 'Seg' : (ex.porLado ? 'Reps/lado' : 'Reps')}</div>
                                <div className="col-span-3">Check</div>
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

            {/* LA PRÓXIMA VEZ.

                El final del círculo. La app te dijo qué tocaba al empezar, te lo
                recordó entre series y en el resumen te dijo si lo cumpliste; esto
                es la consecuencia: qué pasa el lunes que viene. Sin esto el
                entreno se acaba en un "guardado" y no queda nada a lo que volver. */}
            {proximaVez && (
                <div className="fixed inset-0 z-[10001] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-zinc-950 border border-yellow-500/30 p-5 rounded-3xl w-full max-w-sm shadow-2xl">
                        <div className="text-center mb-4">
                            <div className="bg-yellow-500/10 p-3 rounded-full text-yellow-500 inline-block mb-2"><TrendingUp size={26} /></div>
                            <h3 className="text-white font-black text-lg uppercase not-italic leading-tight">La próxima vez</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Con lo que acabas de hacer</p>
                        </div>

                        <div className="space-y-1.5 max-h-[45vh] overflow-y-auto custom-scrollbar">
                            {proximaVez.lista.map(([nombre, p]) => (
                                <div
                                    key={nombre}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border ${p.completada
                                        ? 'bg-emerald-500/[0.07] border-emerald-500/25'
                                        : 'bg-black border-white/[0.07]'}`}
                                >
                                    <span className="text-[11px] font-black text-white uppercase truncate flex-1 min-w-0">{nombre}</span>
                                    <span className={`text-[12px] font-black tabular-nums shrink-0 ${p.completada ? 'text-emerald-400' : 'text-zinc-300'}`}>
                                        {p.peso} × {p.reps}
                                    </span>
                                    {p.completada && <span className="text-[9px] font-black text-emerald-400 shrink-0">SUBE</span>}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => { const d = proximaVez.datos; setProximaVez(null); if (onFinish) onFinish(d); }}
                            className="w-full mt-4 bg-yellow-500 text-black font-black py-3.5 rounded-2xl uppercase tracking-widest text-xs active:scale-95 transition-transform"
                        >
                            Listo
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DESCANSO AISLADO */}
            {restTargetTime && (
                <RestTimerModal
                    info={infoDescanso}
                    targetTime={restTargetTime}
                    initialDefaultRest={defaultRest}
                    onSkip={handleSkipRest}
                    onUpdateDefaultRest={handleUpdateDefaultRest}
                />
            )}

            {/* FOOTER */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-black border-t border-zinc-900 safe-bottom z-30">
                <button onClick={() => { setComparacion(loQueHasLevantado(resumen.volumen)); setShowFinishAlert(true); }} disabled={finishing} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-lg uppercase tracking-widest border-b-4 border-yellow-600">
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

            {/* --- RESUMEN DE FIN DE SESIÓN (estilo Symmetry) --- */}
            {showFinishAlert && (
                <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto animate-in fade-in">
                    <div className="bg-zinc-950 border border-yellow-500/30 p-5 rounded-3xl w-full max-w-sm shadow-2xl my-6">
                        <div className="text-center mb-4">
                            <div className="bg-yellow-500/10 p-3 rounded-full text-yellow-500 inline-block mb-2"><Trophy size={28} /></div>
                            <h3 className="text-white font-black text-lg uppercase not-italic">Resumen del entreno</h3>
                        </div>

                        {/* Cifras de la sesión */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {[
                                { label: 'Tiempo', value: `${Math.max(1, Math.round((Date.now() - startTime) / 60000))}m` },
                                { label: 'Series', value: resumen.totalSets },
                                { label: 'Volumen', value: resumen.volumen >= 1000 ? `${(resumen.volumen / 1000).toFixed(1)}t` : `${resumen.volumen}kg` }
                            ].map(s => (
                                <div key={s.label} className="bg-black border border-white/5 rounded-2xl py-2.5 text-center">
                                    <div className="text-lg font-black text-white leading-none">{s.value}</div>
                                    <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* EL DATO.

                            Arriba pone "2,2 t de volumen", que es correcto y no
                            significa nada: nadie sabe si dos toneladas es mucho,
                            porque nadie ha levantado nunca dos toneladas de nada.
                            Traducido a un rinoceronte sí se entiende, y encima se
                            cuenta. */}
                        {comparacion && (
                            <div className="bg-black border border-white/5 rounded-2xl p-3.5 mb-4 text-center">
                                <div className="text-[26px] leading-none mb-1.5">{comparacion.emoji}</div>
                                <p className="text-[13px] font-black text-white uppercase tracking-tight leading-tight">
                                    {comparacion.frase}
                                </p>
                                <p className="text-[9px] text-zinc-500 mt-1 leading-snug">{comparacion.detalle}</p>
                            </div>
                        )}

                        {/* CÓMO HA IDO CONTRA LO QUE TOCABA */}
                        {resumen.objetivos.length > 0 && (
                            <div className="bg-black border border-white/5 rounded-2xl p-3 mb-4">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Lo que tocaba</p>
                                <div className="space-y-1.5">
                                    {resumen.objetivos.map(o => (
                                        <div key={o.name} className="flex items-center gap-2">
                                            <span className={`shrink-0 w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-black ${o.cumplida ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-600'}`}>
                                                {o.cumplida ? '✓' : '·'}
                                            </span>
                                            <span className="text-[11px] font-bold text-white uppercase truncate flex-1 min-w-0">{o.name}</span>
                                            <span className={`text-[10px] font-black tabular-nums shrink-0 ${o.cumplida ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                                {o.hecho}
                                            </span>
                                            <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">de {o.pedido}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Músculos trabajados sobre el cuerpo */}
                        {resumen.musculos.length > 0 && (
                            <div className="bg-black border border-white/5 rounded-2xl p-3 mb-4">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center mb-1">Músculos trabajados</p>
                                {/* ⚠️ Antes se pintaba SOLO el frente y con el botón de girar
                                    desactivado: si acababas de entrenar espalda, glúteo o
                                    tríceps, el resumen salía con el cuerpo entero apagado.
                                    Frente y espalda a la vez, igual que en el post del feed. */}
                                <div className="h-60 flex items-center justify-center">
                                    <BodyMap
                                        highlight={resumen.musculos}
                                        secondary={resumen.secundarios}
                                        showToggle={false}
                                        dual
                                        labels={false}
                                        className="h-full"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                                    {resumen.musculos.map(m => (
                                        <span key={m} className="text-[9px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded-lg uppercase">{m}</span>
                                    ))}
                                    {resumen.secundarios.map(m => (
                                        <span key={m} className="text-[9px] font-bold bg-white/5 text-zinc-500 border border-white/10 px-2 py-0.5 rounded-lg uppercase">{m}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Foto del entreno */}
                        <div className="mb-4">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Foto (opcional)</p>
                            {photo ? (
                                <div className="relative">
                                    <img src={photo} alt="Foto del entreno" className="w-full h-40 object-cover rounded-2xl border border-white/10" />
                                    <button
                                        onClick={() => setPhoto(null)}
                                        className="absolute top-2 right-2 bg-black/80 p-1.5 rounded-full text-white border border-white/20"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <label className={`w-full h-20 border-2 border-dashed border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-zinc-500 cursor-pointer hover:border-zinc-700 transition-colors ${compressing ? 'opacity-50' : ''}`}>
                                    {compressing
                                        ? <><Loader2 size={16} className="animate-spin" /> <span className="text-xs font-bold">Preparando...</span></>
                                        : <><Camera size={18} /> <span className="text-xs font-bold uppercase">Añadir foto</span></>}
                                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={compressing} />
                                </label>
                            )}
                        </div>

                        <div className="flex gap-3 w-full">
                            <button onClick={() => setShowFinishAlert(false)} disabled={finishing} className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold text-xs uppercase border border-zinc-800 disabled:opacity-50">Seguir</button>
                            <button onClick={confirmFinish} disabled={finishing || compressing} className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                {finishing ? <Loader2 className="animate-spin" size={16} /> : 'Publicar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>, document.body
    );
}