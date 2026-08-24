import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Save, Trash2, Dumbbell, ArrowUp, ArrowDown, Check, Timer, Hash, Play, Clock, PersonStanding, MoveHorizontal, Link2 } from 'lucide-react';
import api from '../../services/api';
import ExerciseSelector from './ExerciseSelector';
import ExerciseSheet from './ExerciseSheet';

// Paleta de la app. Es una sugerencia, no una jaula: debajo hay un selector
// libre para cualquier color. Se guardan como HEX, no como nombre ('blue'),
// para que quepa cualquiera; `tonoDeRutina` en Gym.jsx sigue entendiendo los
// nombres antiguos de las rutinas ya creadas.
const PALETA_RUTINAS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c'
];

// Equivalencia de los nombres antiguos, para que al EDITAR una rutina vieja
// el selector aparezca marcando su color de verdad y no en blanco.
const NOMBRE_A_HEX = {
    yellow: '#eab308', blue: '#3b82f6', green: '#22c55e', purple: '#a855f7',
    orange: '#f97316', red: '#ef4444', pink: '#ec4899'
};

const aHex = (c) => (/^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : (NOMBRE_A_HEX[c] || '#3b82f6'));

export default function CreateRoutineModal({ onClose, onRoutineCreated, routineToEdit = null }) {
    // Datos Rutina
    const [routineName, setRoutineName] = useState('');
    const [routineColor, setRoutineColor] = useState(PALETA_RUTINAS[10]);
    const [restTime, setRestTime] = useState(60); // 🔥 FIX PUNTO 14: Tiempo descanso
    const [addedExercises, setAddedExercises] = useState([]);

    // Estados UI
    const [showExerciseSelector, setShowExerciseSelector] = useState(false);
    const [loading, setLoading] = useState(false);
    // Mensaje de error del formulario (nombre vacío, sin ejercicios, fallo al
    // guardar). Se usaba en cinco sitios pero faltaba declararlo: el componente
    // lanzaba "errorMsg is not defined" nada más renderizarse, así que abrir
    // "Nueva rutina" tiraba la pantalla entera.
    const [errorMsg, setErrorMsg] = useState(null);
    // Nombre del ejercicio cuya ficha (GIF + ejecución) está abierta
    const [fichaAbierta, setFichaAbierta] = useState(null);

    // Cargar datos si editamos
    useEffect(() => {
        if (routineToEdit) {
            setRoutineName(routineToEdit.name);
            setAddedExercises(routineToEdit.exercises || []);
            setRoutineColor(aHex(routineToEdit.color));
            // Si la rutina guardada tenía descanso personalizado, lo cargamos, si no 60
            setRestTime(routineToEdit.defaultRest || 60);
        }
    }, [routineToEdit]);

    // Manejadores
    const handleAddExercises = (selectedList) => {
        const formatted = selectedList.map(ex => ({
            name: ex.name,
            muscle: ex.muscle,
            // Guardamos también qué músculos trabaja, para mostrarlo en la rutina
            muscleDetail: ex.muscleDetail || '',
            secondary: ex.secondary || [],
            sets: 3, // Valor inicial por defecto
            reps: "10-12",
            targetWeight: 0,
            rest: 0 // 0 = usa el descanso general de la rutina
        }));
        setAddedExercises([...addedExercises, ...formatted]);
        setShowExerciseSelector(false);
    };

    const removeExercise = (index) => {
        setAddedExercises(prev => prev.filter((_, i) => i !== index));
    };

    const moveExercise = (index, direction) => {
        const newExercises = [...addedExercises];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newExercises.length) return;
        [newExercises[index], newExercises[targetIndex]] = [newExercises[targetIndex], newExercises[index]];
        setAddedExercises(newExercises);
    };

    // 🔥 FIX PUNTO 14: Actualizar series de un ejercicio específico
    const updateExerciseSets = (index, val) => {
        const newExercises = [...addedExercises];
        const num = parseInt(val);
        newExercises[index].sets = isNaN(num) || num < 1 ? 1 : num;
        setAddedExercises(newExercises);
    };

    /**
     * Descanso propio de UN ejercicio.
     *
     * El campo `rest` ya existía en el modelo con la regla "0 = usa el descanso
     * general de la rutina", pero no había forma de tocarlo desde la interfaz:
     * todos los ejercicios se quedaban forzosamente con el general. Vaciar la
     * casilla vuelve a 0, o sea, a heredar el de la rutina.
     */
    /**
     * Interruptores de cómo se mide un ejercicio.
     *
     * Van en la RUTINA y no en cada entreno a propósito: "plancha" se mide por
     * tiempo siempre, no solo hoy. Marcarlo una vez y olvidarse es la diferencia
     * entre que esto se use y que no se use.
     */
    const alternarOpcion = (index, campo) => {
        const nuevos = [...addedExercises];
        nuevos[index] = { ...nuevos[index], [campo]: !nuevos[index][campo] };

        // Por tiempo y por lado no tienen sentido juntos: un isométrico no se
        // cuenta por repeticiones, así que tampoco por repeticiones de cada lado.
        if (campo === 'esPorTiempo' && nuevos[index].esPorTiempo) nuevos[index].porLado = false;
        if (campo === 'porLado' && nuevos[index].porLado) nuevos[index].esPorTiempo = false;

        setAddedExercises(nuevos);
    };

    /** Letra de superserie. Los ejercicios con la misma letra van seguidos. */
    const cambiarSuperserie = (index, valor) => {
        const nuevos = [...addedExercises];
        nuevos[index] = { ...nuevos[index], superserie: valor.toUpperCase().slice(0, 1) };
        setAddedExercises(nuevos);
    };

    const updateExerciseRest = (index, val) => {
        const newExercises = [...addedExercises];
        const num = parseInt(val);
        newExercises[index].rest = isNaN(num) || num < 0 ? 0 : Math.min(num, 600);
        setAddedExercises(newExercises);
    };

    // Candado de reentrada. NO basta con `disabled={estado}`: el estado no cambia
    // hasta el siguiente render, y entre el primer toque y ese render el botón
    // sigue vivo. En un móvil lento un doble toque entra dos veces y duplica lo
    // que se esté creando. El ref se actualiza en el acto.
    const enVuelo = useRef(false);

    const handleSave = async () => {
        if (enVuelo.current) return;
        if (!routineName.trim()) return setErrorMsg("Ponle un nombre a la rutina");
        if (addedExercises.length === 0) return setErrorMsg("Añade al menos un ejercicio");

        enVuelo.current = true;
        setErrorMsg(null);
        setLoading(true);
        try {
            const payload = {
                name: routineName,
                color: routineColor,
                exercises: addedExercises,
                defaultRest: parseInt(restTime) || 60 // 🔥 ENVIAMOS EL DESCANSO AL BACKEND
            };

            if (routineToEdit) {
                await api.put(`/gym/routines/${routineToEdit._id}`, payload);
            } else {
                await api.post('/gym/routines', payload);
            }

            onRoutineCreated();
            onClose();
        } catch (error) {
            console.error(error);
            setErrorMsg(error.response?.data?.message || "No se pudo guardar la rutina");
        } finally {
            enVuelo.current = false;
            setLoading(false);
        }
    };

    if (showExerciseSelector) {
        return <ExerciseSelector onSelect={handleAddExercises} onClose={() => setShowExerciseSelector(false)} />;
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom-5 duration-300">

            {fichaAbierta && (
                <ExerciseSheet exerciseName={fichaAbierta} onClose={() => setFichaAbierta(null)} />
            )}

            {/* HEADER */}
            <div className="pt-4 pb-4 px-6 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0 safe-top">
                <h2 className="font-black text-white text-xl uppercase not-italic tracking-wide flex items-center gap-2">
                    <Dumbbell className="text-yellow-500" size={24} />
                    <span>{routineToEdit ? 'Editar' : 'Crear'} Rutina</span>
                </h2>
                <button onClick={onClose} className="bg-zinc-900 text-zinc-400 hover:text-white p-3 rounded-full border border-zinc-800 transition-colors active:scale-95">
                    <X size={20} />
                </button>
            </div>

            {errorMsg && (
                <div onClick={() => setErrorMsg(null)} className="mx-6 mt-4 bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase tracking-wide px-4 py-2.5 rounded-2xl text-center cursor-pointer shrink-0">
                    {errorMsg}
                </div>
            )}

            {/* BODY */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black p-6 pb-32 space-y-8">

                {/* 1. SECCIÓN CONFIGURACIÓN */}
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-2 block tracking-widest">Nombre de la Rutina</label>
                        <input
                            type="text"
                            placeholder="Ej: PECHO Y BICEPS"
                            value={routineName}
                            onChange={(e) => setRoutineName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-white font-black text-lg focus:border-yellow-500 outline-none transition-colors placeholder:text-zinc-700 uppercase"
                        />
                    </div>

                    {/* 🔥 FIX PUNTO 14: INPUT DESCANSO */}
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-2 block tracking-widest flex items-center gap-1">
                            <Timer size={12} /> Descanso entre series (Seg)
                        </label>
                        <p className="text-[10px] text-zinc-600 mb-2 ml-1 leading-tight">
                            Es el de toda la rutina. Cada ejercicio puede llevar el suyo propio
                            en su casilla <span className="text-zinc-400">SEG</span>; en blanco usa este.
                        </p>
                        <input
                            type="number"
                            placeholder="60"
                            value={restTime}
                            onChange={(e) => setRestTime(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-white font-bold text-base focus:border-blue-500 outline-none transition-colors text-center"
                        />
                    </div>

                    {/* SELECTOR DE COLOR */}
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-2 block tracking-widest">Color de la Tarjeta</label>
                        <div className="grid grid-cols-9 gap-2 py-2">
                            {PALETA_RUTINAS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setRoutineColor(c)}
                                    aria-label={'Color ' + c}
                                    className={`aspect-square rounded-full flex items-center justify-center transition-transform ${routineColor.toLowerCase() === c ? 'scale-110 ring-2 ring-white' : 'active:scale-95'}`}
                                    style={{ background: c }}
                                >
                                    {routineColor.toLowerCase() === c && <Check size={13} className="text-black" strokeWidth={4} />}
                                </button>
                            ))}
                        </div>

                        {/* Cualquier otro color: el selector nativo del sistema.
                            No hace falta libreria y en el movil abre la rueda
                            de color del propio telefono. */}
                        <label className="mt-3 flex items-center gap-3 bg-[#0a0a0c] border border-white/[0.07] rounded-2xl p-3 cursor-pointer">
                            <span
                                className="w-9 h-9 rounded-full border border-white/10 shrink-0"
                                style={{ background: routineColor }}
                            />
                            <span className="flex-1 min-w-0">
                                <span className="block text-[11px] font-black text-zinc-200 uppercase tracking-[0.12em] not-italic">Otro color</span>
                                <span className="block text-[10px] text-zinc-500 mt-0.5 uppercase">{routineColor}</span>
                            </span>
                            <input
                                type="color"
                                value={routineColor}
                                onChange={(e) => setRoutineColor(e.target.value)}
                                className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                            />
                        </label>
                    </div>
                </div>

                {/* 2. SECCIÓN EJERCICIOS */}
                <div>
                    <div className="flex justify-between items-center mb-3 px-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ejercicios ({addedExercises.length})</label>
                        <button onClick={() => setShowExerciseSelector(true)} className="text-yellow-500 text-xs font-bold uppercase flex items-center gap-1 hover:underline">
                            <Plus size={14} /> Añadir
                        </button>
                    </div>

                    <div className="space-y-2">
                        {addedExercises.length === 0 ? (
                            <div onClick={() => setShowExerciseSelector(true)} className="border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-center cursor-pointer hover:bg-zinc-900/50 hover:border-yellow-500/30 transition-all group">
                                <Plus className="mx-auto text-zinc-600 group-hover:text-yellow-500 mb-2" />
                                <p className="text-zinc-500 text-xs font-bold uppercase">Toca para añadir ejercicios</p>
                            </div>
                        ) : (
                            addedExercises.map((ex, idx) => (
                                <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group animate-in slide-in-from-bottom-2 duration-300">

                                    {/* INFO EJERCICIO */}
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-yellow-500 text-black font-black text-sm flex items-center justify-center shadow-lg shadow-yellow-900/20 shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="min-w-0 pr-2">
                                            <h4 className="text-white font-bold text-sm uppercase truncate">{ex.name}</h4>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-[10px] text-zinc-500 font-bold uppercase bg-black px-2 py-0.5 rounded border border-zinc-800 inline-block">
                                                    {ex.muscle}
                                                </span>
                                                {/* Ver la ejecución también aquí: al montar la rutina
                                                    ya sólo tienes el nombre, y con 1.291 ejercicios
                                                    en el catálogo muchos no se distinguen por él.
                                                    Va por nombre porque la rutina guarda
                                                    subdocumentos sin referencia al catálogo. */}
                                                <button
                                                    onClick={() => setFichaAbierta(ex.name)}
                                                    className="w-6 h-6 rounded-md bg-black border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-600 active:scale-95 transition-all shrink-0"
                                                    aria-label={`Ver ejecución de ${ex.name}`}
                                                >
                                                    <Play size={10} fill="currentColor" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 🔥 FIX PUNTO 14: INPUT SERIES DENTRO DE LA TARJETA */}
                                    <div className="flex items-center gap-3">
                                        {/* Descanso propio. Vacío = hereda el de la rutina */}
                                        <div className="flex flex-col items-center bg-black p-1.5 rounded-lg border border-zinc-800">
                                            <label className="text-[8px] font-black text-zinc-500 uppercase flex items-center gap-0.5 mb-0.5">
                                                <Timer size={8} /> SEG
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="600"
                                                step="5"
                                                value={ex.rest || ''}
                                                placeholder={String(restTime)}
                                                onChange={(e) => updateExerciseRest(idx, e.target.value)}
                                                title="Descanso solo para este ejercicio. Vacío usa el general."
                                                className="w-10 bg-transparent text-center text-white font-bold text-sm outline-none focus:text-yellow-500 p-0 placeholder:text-zinc-700"
                                            />
                                        </div>

                                        <div className="flex flex-col items-center bg-black p-1.5 rounded-lg border border-zinc-800">
                                            <label className="text-[8px] font-black text-zinc-500 uppercase flex items-center gap-0.5 mb-0.5">
                                                <Hash size={8} /> SETS
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={ex.sets}
                                                onChange={(e) => updateExerciseSets(idx, e.target.value)}
                                                className="w-10 bg-transparent text-center text-white font-bold text-sm outline-none focus:text-yellow-500 p-0"
                                            />
                                        </div>

                                        {/* CONTROLES ORDEN/BORRAR */}
                                        <div className="flex flex-col gap-1 border-l border-zinc-800 pl-3">
                                            <div className="flex gap-1">
                                                <button onClick={() => moveExercise(idx, -1)} disabled={idx === 0} className="bg-zinc-800 p-1 rounded hover:bg-zinc-700 text-zinc-400 disabled:opacity-20"><ArrowUp size={12} /></button>
                                                <button onClick={() => moveExercise(idx, 1)} disabled={idx === addedExercises.length - 1} className="bg-zinc-800 p-1 rounded hover:bg-zinc-700 text-zinc-400 disabled:opacity-20"><ArrowDown size={12} /></button>
                                            </div>
                                            <button onClick={() => removeExercise(idx)} className="bg-red-900/20 p-1 rounded text-red-500 hover:bg-red-900/40 w-full flex justify-center"><Trash2 size={14} /></button>
                                        </div>
                                    </div>

                                    {/* CÓMO SE MIDE ESTE EJERCICIO */}
                                    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-zinc-900">
                                        {[
                                            { campo: 'esPorTiempo', icono: Clock, texto: 'Tiempo', ayuda: 'Se mide en segundos: plancha, isométricos, muerto colgado' },
                                            { campo: 'esPesoCorporal', icono: PersonStanding, texto: 'Corporal', ayuda: 'Dominadas o fondos: cuenta tu peso más el lastre' },
                                            { campo: 'porLado', icono: MoveHorizontal, texto: 'Por lado', ayuda: 'Las repeticiones son de cada lado' }
                                        ].map(({ campo, icono: Icono, texto, ayuda }) => (
                                            <button
                                                key={campo}
                                                onClick={() => alternarOpcion(idx, campo)}
                                                title={ayuda}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-colors ${ex[campo]
                                                    ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-500'
                                                    : 'bg-black border-zinc-800 text-zinc-600'}`}
                                            >
                                                <Icono size={10} /> {texto}
                                            </button>
                                        ))}

                                        {/* Superserie: misma letra = van seguidos sin descanso */}
                                        <div
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black border border-zinc-800"
                                            title="Misma letra en los ejercicios que hagas seguidos sin descanso"
                                        >
                                            <Link2 size={10} className={ex.superserie ? 'text-yellow-500' : 'text-zinc-600'} />
                                            <input
                                                type="text"
                                                maxLength={1}
                                                value={ex.superserie || ''}
                                                placeholder="—"
                                                onChange={(e) => cambiarSuperserie(idx, e.target.value)}
                                                className="w-4 bg-transparent text-center text-[10px] font-black uppercase text-yellow-500 outline-none placeholder:text-zinc-700"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {addedExercises.length > 3 && (
                    <button onClick={() => setShowExerciseSelector(true)} className="w-full py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 font-bold text-xs uppercase flex items-center justify-center gap-2 hover:text-white hover:bg-zinc-800 transition-all">
                        <Plus size={16} /> Añadir otro ejercicio
                    </button>
                )}
            </div>

            {/* FOOTER */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-zinc-950 border-t border-zinc-900 safe-bottom">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl shadow-lg shadow-yellow-500/20 flex justify-center gap-3 items-center uppercase tracking-widest active:scale-95 transition-all text-base border-b-4 border-yellow-600"
                >
                    {loading ? 'Guardando...' : <><Save size={20} /> Guardar Rutina</>}
                </button>
            </div>
        </div>,
        document.body
    );
}