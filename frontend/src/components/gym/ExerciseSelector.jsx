import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Search, X, Dumbbell, Plus, CheckCircle2, Save, Sparkles } from 'lucide-react';
import api from '../../services/api';

const fetcher = (url) => api.get(url).then(res => res.data);

export default function ExerciseSelector({ onSelect, onClose }) {
    const [exercises, setExercises] = useState([]);
    const [selectedExercises, setSelectedExercises] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMuscle, setSelectedMuscle] = useState('Todos');
    const [loading, setLoading] = useState(true);

    // Formulario de creación rápida
    const [showCreate, setShowCreate] = useState(false);
    const [newExerciseName, setNewExerciseName] = useState('');
    // Músculo concreto elegido en modo PRO
    const [newDetail, setNewDetail] = useState('');

    // 🔥 El catálogo y el modo (normal/pro) los manda el servidor, así no hay
    // dos listas de músculos que se puedan desincronizar.
    const { data: catalog } = useSWR('/gym/muscles', fetcher);
    const isPro = catalog?.mode === 'pro';
    const groups = catalog?.groups || ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Glúteo', 'Abdomen'];
    const specific = catalog?.specific || {};

    const muscles = ['Todos', ...groups];

    useEffect(() => {
        const fetchExercises = async () => {
            try {
                const res = await api.get('/gym/exercises');
                setExercises(res.data);
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchExercises();
    }, []);

    // LÓGICA DE SELECCIÓN POR ORDEN (1, 2, 3...)
    const toggleSelection = (exercise) => {
        const index = selectedExercises.findIndex(ex => ex._id === exercise._id);

        if (index !== -1) {
            // Si ya existe, lo quitamos y reordenamos los siguientes
            const newSelection = selectedExercises.filter(ex => ex._id !== exercise._id);
            setSelectedExercises(newSelection);
        } else {
            // Si es nuevo, lo añadimos al final (toma el siguiente número)
            setSelectedExercises(prev => [...prev, exercise]);
        }
    };

    // Grupo al que irá el ejercicio nuevo (si estás en "Todos", el primero de la lista)
    const grupoDestino = selectedMuscle === 'Todos' ? groups[0] : selectedMuscle;

    const handleCreateNew = async () => {
        if (!newExerciseName.trim()) return;

        try {
            // En modo PRO mandamos el músculo concreto y el servidor deriva el grupo
            const payload = { name: newExerciseName, muscle: grupoDestino };
            if (isPro && newDetail) payload.muscleDetail = newDetail;

            const res = await api.post('/gym/exercises', payload);
            const newEx = res.data;
            setExercises([...exercises, newEx]);
            // Al crear, lo seleccionamos automáticamente al final
            setSelectedExercises([...selectedExercises, newEx]);
            setNewExerciseName('');
            setNewDetail('');
            setShowCreate(false);
            setSearchTerm('');
        } catch (e) {
            console.error('Error al crear ejercicio', e);
        }
    };

    // Filtrado
    const filtered = exercises.filter(ex => {
        const matchName = ex.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchMuscle = selectedMuscle === 'Todos' || ex.muscle === selectedMuscle;
        return matchName && matchMuscle;
    });

    // Agrupados por músculo y en el orden oficial de grupos, en vez de una
    // lista plana de 82 ejercicios donde no se encontraba nada.
    const agrupados = groups
        .map(g => [g, filtered.filter(ex => ex.muscle === g)])
        .filter(([, lista]) => lista.length > 0);

    return (
        <div className="fixed inset-0 z-[110] bg-zinc-950 flex flex-col h-[100dvh] w-full animate-in slide-in-from-right duration-300">

            {/* HEADER */}
            <div className="pt-4 pb-2 px-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0 safe-top">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 -ml-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800">
                        <X size={20} />
                    </button>
                    <h2 className="font-black text-white text-lg uppercase italic">Seleccionar</h2>
                </div>
                <button
                    onClick={() => onSelect(selectedExercises)}
                    disabled={selectedExercises.length === 0}
                    className="text-black bg-yellow-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all active:scale-95"
                >
                    Añadir ({selectedExercises.length})
                </button>
            </div>

            {/* FILTROS */}
            <div className="p-4 space-y-3 bg-zinc-950 border-b border-zinc-900">
                <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-zinc-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar ejercicio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-12 text-white font-bold outline-none focus:border-yellow-500/50 transition-colors"
                    />
                </div>
                {/* Lista de músculos horizontal */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {muscles.map(m => (
                        <button key={m} onClick={() => setSelectedMuscle(m)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap border transition-colors ${selectedMuscle === m ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-black text-zinc-500 border-zinc-800'}`}>
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {/* CREACIÓN RÁPIDA */}
            {searchTerm && !filtered.find(e => e.name.toLowerCase() === searchTerm.toLowerCase()) && (
                <div className="px-4 mt-4">
                    <button onClick={() => { setNewExerciseName(searchTerm); setShowCreate(true); }} className="w-full flex items-center justify-between p-4 bg-blue-900/20 border border-blue-500/30 rounded-2xl text-left active:scale-95 transition-all">
                        <div>
                            <p className="text-blue-400 font-bold text-sm">Crear "{searchTerm}"</p>
                            <p className="text-[10px] text-zinc-500 uppercase">En {grupoDestino}</p>
                        </div>
                        <Plus className="text-blue-400" />
                    </button>
                </div>
            )}

            {/* FORMULARIO CREAR */}
            {showCreate && (
                <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 animate-in slide-in-from-top-2 space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newExerciseName}
                            onChange={(e) => setNewExerciseName(e.target.value)}
                            placeholder="Nombre del ejercicio"
                            className="flex-1 bg-black border border-zinc-700 rounded-xl p-3 text-white text-sm font-bold outline-none focus:border-blue-500"
                        />
                        <button onClick={handleCreateNew} className="bg-blue-600 text-white p-3 rounded-xl font-bold active:scale-95 transition-transform"><Save size={18} /></button>
                    </div>

                    {/* 🔥 MODO PRO: además del grupo, se elige el músculo concreto */}
                    {isPro && (specific[grupoDestino] || []).length > 0 && (
                        <div>
                            <label className="text-[9px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                                <Sparkles size={10} /> Músculo concreto ({grupoDestino})
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {(specific[grupoDestino] || []).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setNewDetail(newDetail === m ? '' : m)}
                                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${newDetail === m
                                            ? 'bg-purple-600 text-white border-purple-500'
                                            : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-700'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9px] text-zinc-600 mt-2">
                                Opcional. Se guardará dentro de <span className="text-zinc-400 font-bold">{grupoDestino}</span> para las estadísticas.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* LISTA DE EJERCICIOS, AGRUPADA POR MÚSCULO */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black p-4 space-y-2 pb-24">
                {loading ? <div className="text-center py-10 text-zinc-600 animate-pulse font-bold text-xs uppercase">Cargando...</div> :
                    agrupados.map(([grupo, lista]) => (
                        <div key={grupo} className="mb-4">
                            <div className="flex items-center justify-between px-1 mb-2 sticky top-0 bg-black py-1 z-10">
                                <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">{grupo}</h3>
                                <span className="text-[9px] font-bold text-zinc-600">{lista.length}</span>
                            </div>
                            <div className="space-y-2">
                                {lista.map(ex => {
                        // BUSCAMOS SU POSICIÓN EN LA LISTA DE SELECCIONADOS PARA EL NÚMERO
                        const selectionIndex = selectedExercises.findIndex(s => s._id === ex._id);
                        const isSelected = selectionIndex !== -1;

                        return (
                            <div
                                key={ex._id}
                                onClick={() => toggleSelection(ex)}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer active:scale-98 ${isSelected ? 'bg-yellow-900/20 border-yellow-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                            >
                                <div className="flex items-center gap-4">

                                    {/* MUESTRA EL NÚMERO DE ORDEN SI ESTÁ SELECCIONADO */}
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black transition-all ${isSelected ? 'bg-yellow-500 text-black text-xl shadow-lg shadow-yellow-500/20' : 'bg-black text-zinc-600'}`}>
                                        {isSelected ? (selectionIndex + 1) : <Dumbbell size={20} />}
                                    </div>

                                    <div>
                                        <p className={`font-bold text-sm uppercase ${isSelected ? 'text-yellow-500' : 'text-zinc-300'}`}>{ex.name}</p>
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase">
                                            {ex.muscle}
                                            {/* En modo PRO mostramos también el músculo concreto si lo tiene */}
                                            {isPro && ex.muscleDetail && (
                                                <span className="text-purple-400 normal-case"> · {ex.muscleDetail}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Checkmark visual a la derecha */}
                                {isSelected ? <CheckCircle2 className="text-yellow-500" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-zinc-800"></div>}
                            </div>
                        );
                                })}
                            </div>
                        </div>
                    ))
                }
                {filtered.length === 0 && !searchTerm && <div className="text-center py-10 text-zinc-700 text-xs font-bold uppercase">No hay ejercicios en esta categoría</div>}
            </div>
        </div>
    );
}