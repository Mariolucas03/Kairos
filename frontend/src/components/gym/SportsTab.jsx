import { useState, useRef } from 'react';
import useSWR from 'swr';
import { X, Timer, MapPin, Flame, Save, Loader2, Search, Watch, Sparkles, Activity } from 'lucide-react';
import api from '../../services/api';

const fetcher = (url) => api.get(url).then(res => res.data);

export default function SportsTab({ onSaved, showToast, hoy = [] }) {
    const { data: sports } = useSWR('/gym/sports', fetcher);
    const [busqueda, setBusqueda] = useState('');
    const [elegido, setElegido] = useState(null);

    const [minutos, setMinutos] = useState('');
    const [distancia, setDistancia] = useState('');
    const [kcal, setKcal] = useState('');
    const [intensidad, setIntensidad] = useState('Media');
    const [nombreLibre, setNombreLibre] = useState('');
    const [guardando, setGuardando] = useState(false);

    const lista = (sports || []).filter(s => s.name.toLowerCase().includes(busqueda.toLowerCase()));

    // Agrupados por categoría, salvo cuando estás buscando
    const categorias = busqueda
        ? [['Resultados', lista]]
        : [...new Set((sports || []).map(s => s.group))].map(g => [g, (sports || []).filter(s => s.group === g)]);

    const abrir = (s) => {
        setElegido(s);
        setMinutos(''); setDistancia(''); setKcal('');
        setIntensidad('Media');
        setNombreLibre(s.id === 'otro' ? '' : s.name);
    };

    // Candado de reentrada. NO basta con `disabled={estado}`: el estado no cambia
    // hasta el siguiente render, y entre el primer toque y ese render el botón
    // sigue vivo. En un móvil lento un doble toque entra dos veces y duplica lo
    // que se esté creando. El ref se actualiza en el acto.
    const enVuelo = useRef(false);

    const guardar = async () => {
        if (enVuelo.current) return;
        if (!minutos || Number(minutos) <= 0) return showToast('¿Cuántos minutos?', 'error');
        if (elegido.id === 'otro' && !nombreLibre.trim()) return showToast('Ponle nombre a la actividad', 'error');

        enVuelo.current = true;
        setGuardando(true);
        try {
            const res = await api.post('/gym/sport', {
                sportId: elegido.id,
                name: nombreLibre.trim() || elegido.name,
                time: Number(minutos),
                distance: distancia ? Number(distancia) : null,
                calories: kcal ? Number(kcal) : null,
                intensity: intensidad
            });

            const origen = res.data.calorieSource;
            const nota = origen === 'reloj' ? '(las tuyas)' : origen === 'ia' ? '(calculadas por IA)' : '(estimadas)';
            showToast(`${res.data.log.caloriesBurned} kcal ${nota}`, 'success');
            setElegido(null);
            onSaved?.(res.data);
        } catch (e) {
            showToast(e.response?.data?.message || 'No se pudo registrar', 'error');
        } finally {
            enVuelo.current = false;
            setGuardando(false);
        }
    };

    return (
        <div className="pb-24">
            {/* LO DE HOY */}
            {hoy.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lime-500 text-xs font-black uppercase tracking-widest mb-3 px-1">Hoy</h3>
                    <div className="space-y-2">
                        {hoy.map((s, i) => (
                            <div key={i} className="bg-[#0a0a0c] border border-white/[0.07] rounded-[20px] p-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-lime-500/10 flex items-center justify-center text-lime-400 border border-lime-500/20 shrink-0">
                                        <Activity size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-white text-sm uppercase truncate">{s.routineName}</p>
                                        <p className="text-[10px] text-zinc-500 font-bold">
                                            {Math.round(s.duration)} min{s.distance > 0 ? ` · ${s.distance} km` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-base font-black text-white leading-none">{Math.round(s.caloriesBurned)}</p>
                                    <p className="text-[8px] font-bold text-orange-500 uppercase">kcal</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* BUSCADOR */}
            <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={16} />
                <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar deporte..."
                    className="w-full min-w-0 bg-[#0a0a0c] border border-white/[0.07] rounded-[20px] py-3 pl-11 pr-4 text-white text-sm font-bold outline-none focus:border-lime-500/40 transition-colors placeholder:text-zinc-700"
                />
            </div>

            {/* REJILLA DE DEPORTES */}
            {!sports ? (
                <div className="py-12 text-center text-zinc-600 text-xs font-bold uppercase animate-pulse">Cargando deportes...</div>
            ) : (
                categorias.map(([grupo, items]) => items.length > 0 && (
                    <div key={grupo} className="mb-5">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 px-1">{grupo}</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {items.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => abrir(s)}
                                    title={s.name}
                                    /* ⚠️ ALTURA FIJA. Es lo que arregla el descuadre.
                                       Sin ella, "Artes marciales" partía en dos líneas y su
                                       tarjeta quedaba 12 px más alta que la de al lado: la
                                       fila entera salía torcida. Medido en pantalla: había
                                       tarjetas de 77 px y de 89 conviviendo. */
                                    className="h-[84px] bg-[#0a0a0c] border border-white/[0.07] rounded-[18px] px-1.5 flex flex-col items-center justify-center gap-1.5 hover:border-lime-500/40 active:scale-95 transition-all"
                                >
                                    {/* El emoji también con caja fija: los hay más altos que
                                        otros y sin esto empujan el nombre hacia abajo. */}
                                    <span className="h-[26px] flex items-center justify-center text-[23px] leading-none">
                                        {s.icon}
                                    </span>
                                    <span className="text-[9px] font-black text-zinc-300 uppercase text-center leading-[1.15] line-clamp-2 w-full">
                                        {s.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {sports && lista.length === 0 && (
                <p className="text-center py-8 text-zinc-600 text-xs font-bold">
                    Nada con ese nombre. Usa <span className="text-zinc-400">Otro</span> para cualquier actividad.
                </p>
            )}

            {/* --- FORMULARIO --- */}
            {elegido && (
                <div style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }} className="fixed left-0 right-0 z-[200] flex items-end sm:items-center justify-center animate-in fade-in">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setElegido(null)} />
                    <div className="relative z-10 w-full sm:max-w-sm bg-zinc-950 border-t sm:border border-lime-500/20 rounded-t-[32px] sm:rounded-[32px] p-5 animate-in slide-in-from-bottom duration-200 safe-bottom max-h-[92vh] overflow-y-auto custom-scrollbar">

                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-3xl leading-none">{elegido.icon}</span>
                                <h2 className="text-xl font-black text-white not-italic uppercase tracking-tighter truncate">{elegido.name}</h2>
                            </div>
                            <button onClick={() => setElegido(null)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 border border-zinc-800 shrink-0">
                                <X size={18} />
                            </button>
                        </div>

                        {elegido.id === 'otro' && (
                            <div className="mb-4">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">¿Qué has hecho?</label>
                                <input
                                    type="text"
                                    value={nombreLibre}
                                    onChange={(e) => setNombreLibre(e.target.value)}
                                    placeholder="Ej: Escalada en rocódromo"
                                    autoFocus
                                    className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-white font-bold outline-none focus:border-lime-500 placeholder:text-zinc-700"
                                />
                            </div>
                        )}

                        <div className={`grid ${elegido.distance ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-4`}>
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                                <label className="text-[10px] font-black text-zinc-500 uppercase mb-1 flex items-center gap-1"><Timer size={10} /> Minutos</label>
                                <input type="number" inputMode="decimal" placeholder="0" value={minutos} onChange={(e) => setMinutos(e.target.value)} autoFocus={elegido.id !== 'otro'} className="w-full bg-transparent text-3xl font-black text-white outline-none p-0 placeholder:text-zinc-700" />
                            </div>
                            {elegido.distance && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase mb-1 flex items-center gap-1"><MapPin size={10} /> Km</label>
                                    <input type="number" inputMode="decimal" placeholder="-" value={distancia} onChange={(e) => setDistancia(e.target.value)} className="w-full bg-transparent text-3xl font-black text-white outline-none p-0 placeholder:text-zinc-700" />
                                </div>
                            )}
                        </div>

                        {/* Calorías del reloj: si las pones mandan ellas */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
                            <label className="text-[10px] font-black text-zinc-500 uppercase mb-1 flex items-center gap-1">
                                <Watch size={10} /> Calorías de tu reloj <span className="text-zinc-600 normal-case font-bold">(opcional)</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <Flame size={20} className="text-orange-500 shrink-0" />
                                <input type="number" inputMode="decimal" placeholder="Las calcula la app" value={kcal} onChange={(e) => setKcal(e.target.value)} className="w-full bg-transparent text-2xl font-black text-white outline-none p-0 placeholder:text-zinc-700 placeholder:text-sm placeholder:font-bold" />
                            </div>
                            <p className="text-[9px] text-zinc-600 mt-1.5 flex items-center gap-1">
                                <Sparkles size={9} /> Si lo dejas vacío las calcula la IA con tu peso y la intensidad.
                            </p>
                        </div>

                        <div className="mb-5">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Intensidad</label>
                            <div className="flex bg-black p-1 rounded-xl border border-zinc-800">
                                {['Baja', 'Media', 'Alta'].map(l => (
                                    <button key={l} onClick={() => setIntensidad(l)} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${intensidad === l ? 'bg-lime-500 text-black' : 'text-zinc-500'}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={guardar}
                            disabled={guardando}
                            className="w-full py-4 bg-lime-500 hover:bg-lime-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black rounded-2xl uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 border-lime-700 disabled:border-zinc-900"
                        >
                            {guardando ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {guardando ? 'Registrando...' : 'Registrar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
