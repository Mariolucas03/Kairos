import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Search, X, Dumbbell, Plus, CheckCircle2, Save, Play } from 'lucide-react';
import api from '../../services/api';
import ExerciseSheet from './ExerciseSheet';

const fetcher = (url) => api.get(url).then(res => res.data);

const GRUPOS_POR_DEFECTO = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Glúteo', 'Abdomen'];
const FAMILIAS_POR_DEFECTO = ['Pesas', 'Máquina', 'Polea', 'Peso corporal', 'Otros'];

export default function ExerciseSelector({ onSelect, onClose }) {
    const [exercises, setExercises] = useState([]);
    const [selectedExercises, setSelectedExercises] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMuscle, setSelectedMuscle] = useState('Todos');
    const [loading, setLoading] = useState(true);

    // Ficha abierta (GIF + ejecución)
    const [fichaAbierta, setFichaAbierta] = useState(null);
    // Filtro por familia de equipamiento: 'Todos', 'Pesas', 'Máquina'...
    const [equipoActivo, setEquipoActivo] = useState('Todos');

    // El catálogo tiene 1291 ejercicios: la lista ya no se trae entera y se
    // filtra en el móvil. Sin filtros el servidor manda sólo los básicos (los
    // 82 de siempre) y los tuyos; al buscar o elegir grupo, busca en todo.
    const [busquedaAplicada, setBusquedaAplicada] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setBusquedaAplicada(searchTerm.trim()), 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const modoBasicos = !busquedaAplicada && selectedMuscle === 'Todos';

    // --- CREAR EJERCICIO ---
    // Es una pantalla propia con su botón siempre a la vista. Antes la única
    // forma de crear uno era escribir en el buscador el nombre de un ejercicio
    // que NO existiera y esperar a que apareciese un enlace: si el nombre se
    // parecía a otro ya existente, no había manera de crearlo.
    const [showCreate, setShowCreate] = useState(false);
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [nuevoGrupo, setNuevoGrupo] = useState('Pecho');
    // Músculo concreto dentro del grupo ('' = todo el grupo)
    const [nuevoDetalle, setNuevoDetalle] = useState('');
    const [nuevoSecundarios, setNuevoSecundarios] = useState([]);
    const [guardando, setGuardando] = useState(false);
    const [errorCrear, setErrorCrear] = useState('');

    const { data: catalog } = useSWR('/gym/muscles', fetcher);
    const groups = catalog?.groups || GRUPOS_POR_DEFECTO;
    const muscles = ['Todos', ...groups];
    // El orden lo manda el backend (utils/equipment.js) para no tener dos listas
    const familias = catalog?.equipmentGroups || FAMILIAS_POR_DEFECTO;

    useEffect(() => {
        let vivo = true;
        const fetchExercises = async () => {
            setLoading(true);
            try {
                const res = await api.get('/gym/exercises', {
                    params: {
                        ...(selectedMuscle !== 'Todos' && { muscle: selectedMuscle }),
                        ...(busquedaAplicada && { q: busquedaAplicada })
                    }
                });
                if (vivo) setExercises(res.data);
            } catch (error) { console.error(error); }
            finally { if (vivo) setLoading(false); }
        };
        fetchExercises();
        return () => { vivo = false; };
    }, [selectedMuscle, busquedaAplicada]);

    // LÓGICA DE SELECCIÓN POR ORDEN (1, 2, 3...)
    const toggleSelection = (exercise) => {
        const index = selectedExercises.findIndex(ex => ex._id === exercise._id);
        if (index !== -1) setSelectedExercises(selectedExercises.filter(ex => ex._id !== exercise._id));
        else setSelectedExercises(prev => [...prev, exercise]);
    };

    const abrirCrear = () => {
        setNuevoNombre(searchTerm.trim());
        setNuevoGrupo(selectedMuscle === 'Todos' ? groups[0] : selectedMuscle);
        setNuevoDetalle('');
        setNuevoSecundarios([]);
        setErrorCrear('');
        setShowCreate(true);
    };

    const toggleSecundario = (g) => {
        setNuevoSecundarios(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
    };

    const handleCreateNew = async () => {
        const nombre = nuevoNombre.trim();
        if (!nombre) return setErrorCrear('Ponle un nombre al ejercicio');
        if (exercises.some(e => e.name.toLowerCase() === nombre.toLowerCase())) {
            return setErrorCrear('Ya tienes un ejercicio con ese nombre');
        }

        setGuardando(true);
        setErrorCrear('');
        try {
            const res = await api.post('/gym/exercises', {
                name: nombre,
                muscle: nuevoGrupo,
                muscleDetail: nuevoDetalle,
                secondary: nuevoSecundarios.filter(g => g !== nuevoGrupo)
            });
            const nuevo = res.data;
            setExercises(prev => [...prev, nuevo]);
            setSelectedExercises(prev => [...prev, nuevo]);
            setShowCreate(false);
            setSearchTerm('');
        } catch (e) {
            setErrorCrear(e.response?.data?.message || 'No se pudo crear el ejercicio');
        } finally {
            setGuardando(false);
        }
    };

    // El filtrado lo hace el servidor (ver el useEffect de arriba): con 1291
    // ejercicios, traérselos todos para descartarlos en el móvil eran cientos
    // de KB por apertura.
    const filtered = exercises;

    // El equipamiento es un FILTRO, no una división de la lista: partir cada
    // grupo muscular en cinco secciones dejaba cabeceras por todas partes y
    // obligaba a bajar entre bloques que no te interesan. Ahora eliges "Polea"
    // y ves sólo poleas.
    const porEquipo = equipoActivo === 'Todos'
        ? filtered
        : filtered.filter(ex => (ex.equipmentGroup || 'Otros') === equipoActivo);

    const agrupados = groups
        .map(g => [g, porEquipo.filter(ex => ex.muscle === g)])
        .filter(([, lista]) => lista.length > 0);

    // Cuántos hay de cada familia, para no ofrecer filtros que dan lista vacía
    const cuentaEquipo = familias.reduce((acc, f) => {
        acc[f] = filtered.filter(ex => (ex.equipmentGroup || 'Otros') === f).length;
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-[110] bg-zinc-950 flex flex-col h-[100dvh] w-full animate-in slide-in-from-right duration-300">

            {/* HEADER */}
            <div className="pt-4 pb-2 px-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0 safe-top">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 -ml-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800">
                        <X size={20} />
                    </button>
                    <h2 className="font-black text-white text-lg uppercase not-italic">Ejercicios</h2>
                </div>
                <button
                    onClick={() => onSelect(selectedExercises)}
                    disabled={selectedExercises.length === 0}
                    className="text-black bg-yellow-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 transition-all active:scale-95"
                >
                    Añadir ({selectedExercises.length})
                </button>
            </div>

            {/* BUSCADOR + CREAR (siempre visible) */}
            <div className="p-4 space-y-3 bg-zinc-950 border-b border-zinc-900 shrink-0">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-3.5 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar ejercicio..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-12 text-white font-bold outline-none focus:border-yellow-500/50 transition-colors"
                        />
                    </div>
                    <button
                        onClick={abrirCrear}
                        className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-2xl flex items-center gap-1.5 active:scale-95 transition-all font-black text-[11px] uppercase tracking-wide"
                    >
                        <Plus size={16} strokeWidth={3} /> Crear
                    </button>
                </div>

                {/* Lista de músculos horizontal */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {muscles.map(m => (
                        <button key={m} onClick={() => setSelectedMuscle(m)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap border transition-colors ${selectedMuscle === m ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-black text-zinc-500 border-zinc-800'}`}>
                            {m}
                        </button>
                    ))}
                </div>

                {/* Subfiltro de equipamiento: MISMA pastilla que la fila de
                    músculos —mismo tamaño, mismo radio, mismo borde— para que se
                    lean como el mismo control. Lo único que cambia es el color
                    del activo: amarillo el músculo (lo que buscas), blanco el
                    equipo (con qué lo haces). Así se ve que es un nivel por
                    debajo sin inventarse otra forma de botón.
                    Sólo se ofrecen las familias que tienen algo. */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {['Todos', ...familias.filter(f => cuentaEquipo[f] > 0)].map(f => (
                        <button
                            key={f}
                            onClick={() => setEquipoActivo(f)}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap border transition-colors ${equipoActivo === f
                                ? 'bg-zinc-100 text-black border-zinc-100'
                                : 'bg-black text-zinc-500 border-zinc-800'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {/* Sin esto la lista parece incompleta: por defecto sólo salen
                    los básicos, y no hay forma de adivinar que hay 1.200 más. */}
                {modoBasicos && !loading && (
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide leading-tight">
                        Básicos ({filtered.length}). Busca o elige un grupo para ver el catálogo completo.
                    </p>
                )}
                {!modoBasicos && !loading && filtered.length >= 300 && (
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wide leading-tight">
                        Primeros 300 resultados. Afina la búsqueda si no lo encuentras.
                    </p>
                )}
            </div>

            {/* LISTA DE EJERCICIOS, AGRUPADA POR MÚSCULO */}
            {/* Sin padding ARRIBA a propósito: `sticky top-0` se ancla al borde
                del área de scroll, así que con `p-4` la cabecera se quedaba 16px
                más abajo y por esa franja se veían pasar las filas. El hueco lo
                pone ahora la propia cabecera con su `pt-4`. */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black px-4 pt-0 pb-24 space-y-2">
                {loading ? <div className="text-center py-10 text-zinc-600 animate-pulse font-bold text-xs uppercase">Cargando...</div> :
                    agrupados.map(([grupo, lista]) => (
                        <div key={grupo} className="mb-4">
                            {/* Cabecera del grupo muscular: se queda pegada
                                mientras recorres sus ejercicios */}
                            <div className="flex items-center justify-between px-1 mb-2 sticky top-0 bg-black pt-4 pb-1.5 z-10">
                                <h3 className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">{grupo}</h3>
                                <span className="text-[9px] font-bold text-zinc-600">{lista.length}</span>
                            </div>
                            <div className="space-y-2">
                                {lista.map(ex => {
                                    const selectionIndex = selectedExercises.findIndex(s => s._id === ex._id);
                                    const isSelected = selectionIndex !== -1;
                                    const secundarios = (ex.secondary || []).filter(s => s !== ex.muscle);

                                    return (
                                        <div
                                            key={ex._id}
                                            onClick={() => toggleSelection(ex)}
                                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer active:scale-98 ${isSelected ? 'bg-yellow-900/20 border-yellow-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                {/* Miniatura del ejercicio. `loading="lazy"` es lo que
                                                    evita que abrir un grupo dispare 200 descargas de
                                                    golpe: sólo baja lo que entra en pantalla. */}
                                                <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center font-black transition-all overflow-hidden ${isSelected ? 'bg-yellow-500 text-black text-xl shadow-lg shadow-yellow-500/20' : ex.thumb ? 'bg-white' : 'bg-black text-zinc-600'}`}>
                                                    {isSelected ? (selectionIndex + 1) : ex.thumb ? (
                                                        <img
                                                            src={ex.thumb}
                                                            alt=""
                                                            loading="lazy"
                                                            decoding="async"
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    ) : <Dumbbell size={20} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`font-bold text-sm uppercase truncate ${isSelected ? 'text-yellow-500' : 'text-zinc-300'}`}>{ex.name}</p>
                                                    {/* El grupo y la familia ya los dicen las cabeceras:
                                                        aquí va el equipamiento concreto (Multipower,
                                                        Barra Z...) y los músculos secundarios. */}
                                                    <p className="text-[10px] text-zinc-600 font-bold uppercase truncate">
                                                        {ex.equipment || ex.muscle}
                                                        {secundarios.length > 0 && (
                                                            <span className="text-zinc-700 normal-case"> · también {secundarios.join(', ')}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Ver la ejecución sin seleccionar el ejercicio. Sólo
                                                    si hay GIF: los que creas tú no tienen ninguno, y
                                                    el botón invitaba a pulsar para encontrarte un
                                                    "no hay demostración". */}
                                                {ex.gif && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setFichaAbierta(ex); }}
                                                        className="w-8 h-8 rounded-lg bg-black border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-600 active:scale-95 transition-all"
                                                        aria-label={`Ver ejecución de ${ex.name}`}
                                                    >
                                                        <Play size={13} fill="currentColor" />
                                                    </button>
                                                )}
                                                {isSelected ? <CheckCircle2 className="text-yellow-500" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-zinc-800"></div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                }

                {!loading && porEquipo.length === 0 && (
                    <div className="text-center py-12">
                        <Dumbbell className="mx-auto text-zinc-800 mb-3" size={32} />
                        <p className="text-zinc-600 text-xs font-bold uppercase mb-4">
                            {searchTerm ? `No hay ningún "${searchTerm}"` : 'No hay ejercicios en esta categoría'}
                        </p>
                        <button onClick={abrirCrear} className="bg-blue-600 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wide inline-flex items-center gap-2 active:scale-95 transition-transform">
                            <Plus size={16} strokeWidth={3} /> Crear ejercicio
                        </button>
                    </div>
                )}
            </div>

            {fichaAbierta && (
                <ExerciseSheet exercise={fichaAbierta} onClose={() => setFichaAbierta(null)} />
            )}

            {/* --- PANTALLA DE CREAR EJERCICIO --- */}
            {showCreate && (
                <div className="absolute inset-0 z-20 bg-zinc-950 flex flex-col animate-in slide-in-from-bottom duration-200">
                    <div className="pt-4 pb-3 px-4 border-b border-zinc-800 flex items-center gap-3 shrink-0 safe-top">
                        <button onClick={() => setShowCreate(false)} className="p-2 -ml-2 rounded-full text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800">
                            <X size={20} />
                        </button>
                        <h2 className="font-black text-white text-lg uppercase not-italic">Nuevo ejercicio</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                        <div>
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Nombre</label>
                            <input
                                type="text"
                                value={nuevoNombre}
                                onChange={(e) => { setNuevoNombre(e.target.value); setErrorCrear(''); }}
                                placeholder="Ej: Press inclinado con mancuernas"
                                autoFocus
                                className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-700"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">
                                Grupo muscular principal
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {groups.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => { setNuevoGrupo(g); setNuevoDetalle(''); setNuevoSecundarios(s => s.filter(x => x !== g)); }}
                                        className={`py-3 rounded-2xl text-xs font-black uppercase border transition-all ${nuevoGrupo === g
                                            ? 'bg-yellow-500 text-black border-yellow-500'
                                            : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-700'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* MÚSCULO CONCRETO: lo que decide qué zona del mapa se
                            colorea y qué rango sube. Sin esto, todo el volumen
                            se reparte al grupo entero y la pierna sube de rango
                            de golpe en vez de solo el músculo trabajado. */}
                        {(especificosDelGrupo.length > 0) && (
                            <div>
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">
                                    ¿Qué músculo en concreto?
                                </label>
                                <p className="text-[10px] text-zinc-600 mb-2 leading-tight">
                                    Opcional, pero es lo que hace que suba de rango <span className="text-zinc-400">ese</span> músculo
                                    y se pinte solo su zona del cuerpo.
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        onClick={() => setNuevoDetalle('')}
                                        className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase border transition-colors ${!nuevoDetalle
                                            ? 'bg-zinc-700 text-white border-zinc-600'
                                            : 'bg-black text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}
                                    >
                                        Todo el grupo
                                    </button>
                                    {especificosDelGrupo.map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setNuevoDetalle(m)}
                                            className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase border transition-colors ${nuevoDetalle === m
                                                ? 'bg-yellow-500 text-black border-yellow-500'
                                                : 'bg-black text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">
                                ¿Trabaja algún otro músculo?
                            </label>
                            {/* Aquí está la respuesta al "press militar es pecho y hombro":
                                el principal se lleva todo el volumen y cada secundario un 40% */}
                            <p className="text-[10px] text-zinc-600 mb-2 leading-tight">
                                Opcional. Los secundarios reciben el 40% de los kilos para sus rangos.
                                Ej: el press militar es <span className="text-zinc-400">Hombro</span> y además trabaja pecho y tríceps.
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {groups.filter(g => g !== nuevoGrupo).map(g => (
                                    <button
                                        key={g}
                                        onClick={() => toggleSecundario(g)}
                                        className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase border transition-colors ${nuevoSecundarios.includes(g)
                                            ? 'bg-blue-600 text-white border-blue-500'
                                            : 'bg-black text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {errorCrear && (
                            <p className="text-[11px] font-bold text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl p-3">
                                {errorCrear}
                            </p>
                        )}
                    </div>

                    <div className="p-4 border-t border-zinc-800 bg-zinc-950 shrink-0 safe-bottom">
                        <button
                            onClick={handleCreateNew}
                            disabled={guardando || !nuevoNombre.trim()}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black rounded-2xl uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 border-blue-800 disabled:border-zinc-900"
                        >
                            <Save size={18} /> {guardando ? 'Creando...' : 'Crear y añadir'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
