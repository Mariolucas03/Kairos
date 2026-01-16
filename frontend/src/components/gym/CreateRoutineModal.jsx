import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Save, Trash2, Dumbbell, ArrowUp, ArrowDown, Check } from 'lucide-react';
import api from '../../services/api';
import ExerciseSelector from './ExerciseSelector';

// Colores disponibles para la tarjeta de rutina
const ROUTINE_COLORS = [
    { id: 'blue', value: 'bg-blue-600', border: 'border-blue-500' },
    { id: 'red', value: 'bg-red-600', border: 'border-red-500' },
    { id: 'green', value: 'bg-green-600', border: 'border-green-500' },
    { id: 'yellow', value: 'bg-yellow-500', border: 'border-yellow-500' },
    { id: 'purple', value: 'bg-purple-600', border: 'border-purple-500' },
    { id: 'orange', value: 'bg-orange-600', border: 'border-orange-500' },
    { id: 'pink', value: 'bg-pink-600', border: 'border-pink-500' },
];

export default function CreateRoutineModal({ onClose, onRoutineCreated, routineToEdit = null }) {
    // Datos Rutina
    const [routineName, setRoutineName] = useState('');
    const [routineColor, setRoutineColor] = useState(ROUTINE_COLORS[0].id);
    const [addedExercises, setAddedExercises] = useState([]);

    // Estados UI
    const [showExerciseSelector, setShowExerciseSelector] = useState(false);
    const [loading, setLoading] = useState(false);

    // Cargar datos si editamos
    useEffect(() => {
        if (routineToEdit) {
            setRoutineName(routineToEdit.name);
            setAddedExercises(routineToEdit.exercises || []);
            setRoutineColor(routineToEdit.color || 'blue');
        }
    }, [routineToEdit]);

    // Manejadores
    const handleAddExercises = (selectedList) => {
        const formatted = selectedList.map(ex => ({
            name: ex.name,
            muscle: ex.muscle,
            sets: 3,
            reps: "10-12",
            targetWeight: 0
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

    const handleSave = async () => {
        if (!routineName.trim()) return alert("Ponle un nombre a la rutina");
        if (addedExercises.length === 0) return alert("Añade al menos un ejercicio");

        setLoading(true);
        try {
            const payload = {
                name: routineName,
                color: routineColor,
                exercises: addedExercises,
                difficulty: 'Guerrero'
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
            alert("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    if (showExerciseSelector) {
        return <ExerciseSelector onSelect={handleAddExercises} onClose={() => setShowExerciseSelector(false)} />;
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom-5 duration-300">

            {/* HEADER */}
            <div className="pt-4 pb-4 px-6 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0 safe-top">
                <h2 className="font-black text-white text-xl uppercase italic tracking-wide flex items-center gap-2">
                    <Dumbbell className="text-yellow-500" size={24} />
                    <span>{routineToEdit ? 'Editar' : 'Crear'} Rutina</span>
                </h2>
                <button onClick={onClose} className="bg-zinc-900 text-zinc-400 hover:text-white p-3 rounded-full border border-zinc-800 transition-colors active:scale-95">
                    <X size={20} />
                </button>
            </div>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black p-6 pb-32 space-y-8">

                {/* 1. SECCIÓN NOMBRE Y COLOR */}
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

                    {/* SELECTOR DE COLOR */}
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase ml-1 mb-2 block tracking-widest">Color de la Tarjeta</label>

                        {/* 🔥 FIX: Margen negativo y padding para que NO SE CORTEN los círculos ni sus sombras */}
                        <div className="flex gap-4 overflow-x-auto py-4 -mx-6 px-6 no-scrollbar">
                            {ROUTINE_COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => setRoutineColor(c.id)}
                                    className={`w-12 h-12 shrink-0 rounded-full ${c.value} flex items-center justify-center transition-all duration-300 ${routineColor === c.id ? 'scale-125 ring-4 ring-zinc-900 shadow-xl z-10' : 'opacity-60 hover:opacity-100 scale-100'}`}
                                >
                                    {routineColor === c.id && <Check size={20} className="text-white drop-shadow-md" strokeWidth={4} />}
                                </button>
                            ))}
                        </div>
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
                                <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group">

                                    {/* INFO EJERCICIO (IZQUIERDA) */}
                                    <div className="flex items-center gap-4 flex-1">
                                        {/* 🔥 FIX: CUADRADO AMARILLO CON EL NÚMERO */}
                                        <div className="w-8 h-8 rounded-lg bg-yellow-500 text-black font-black text-sm flex items-center justify-center shadow-lg shadow-yellow-900/20 shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm uppercase">{ex.name}</h4>
                                            <span className="text-[10px] text-zinc-500 font-bold uppercase bg-black px-2 py-0.5 rounded border border-zinc-800 mt-1 inline-block">
                                                {ex.muscle}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CONTROLES (DERECHA) */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col gap-1 mr-2">
                                            <button
                                                onClick={() => moveExercise(idx, -1)}
                                                disabled={idx === 0}
                                                className="bg-zinc-800 p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                                            >
                                                <ArrowUp size={14} />
                                            </button>

                                            <button
                                                onClick={() => moveExercise(idx, 1)}
                                                disabled={idx === addedExercises.length - 1}
                                                className="bg-zinc-800 p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                                            >
                                                <ArrowDown size={14} />
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => removeExercise(idx)}
                                            className="bg-red-900/20 p-2.5 rounded-xl text-red-500 border border-red-500/20 hover:bg-red-900/40 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
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