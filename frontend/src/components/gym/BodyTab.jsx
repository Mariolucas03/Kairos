import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, ChevronDown, Dumbbell, Trophy, Info } from 'lucide-react';
import api from '../../services/api';
import BodyMap from '../body/BodyMap';
import ProgressChart from './ProgressChart';

const fetcher = (url) => api.get(url).then(res => res.data);

const miles = (n) => (n || 0).toLocaleString('es-ES');

export default function BodyTab() {
    const { data: ranksData, isLoading } = useSWR('/gym/muscle-ranks', fetcher);
    const { data: entrenados } = useSWR('/gym/progress', fetcher);

    const [muscleSel, setMuscleSel] = useState(null);
    const [ejercicio, setEjercicio] = useState(null);
    const [metrica, setMetrica] = useState('bestWeight');
    const [verEscala, setVerEscala] = useState(false);

    const ranks = ranksData?.ranks || {};
    const escala = ranksData?.tiers || null;

    const { data: progreso, isLoading: cargandoProgreso } = useSWR(
        ejercicio ? `/gym/progress/${encodeURIComponent(ejercicio)}` : null,
        fetcher
    );

    // De más entrenado a menos, para que arriba salga en lo que más trabajas
    // El backend devuelve los 8 grupos Y cada músculo concreto. En la lista se
    // enseñan los grupos, y de los músculos solo los que ya tienen actividad:
    // si no, serían 38 filas y la mayoría a cero.
    const entradas = Object.entries(ranks);
    const grupos = entradas
        .filter(([, r]) => r.isGroup !== false)
        .sort((a, b) => (b[1].points || 0) - (a[1].points || 0));
    const musculos = entradas
        .filter(([, r]) => r.isGroup === false && (r.points || 0) > 0)
        .sort((a, b) => (b[1].points || 0) - (a[1].points || 0));

    if (isLoading) {
        return <div className="py-16 text-center text-zinc-600 text-xs font-bold uppercase animate-pulse">Calculando tus rangos...</div>;
    }

    return (
        <div className="space-y-6 pb-24">
            {/* --- EL CUERPO --- */}
            <div className="bg-zinc-950 border border-white/5 rounded-3xl p-4">
                <BodyMap levels={ranks} dual onSelectMuscle={(g) => setMuscleSel(g === muscleSel ? null : g)} />

                {muscleSel && ranks[muscleSel] && (
                    <div className="mt-3 bg-black border border-white/10 rounded-2xl p-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white uppercase">{muscleSel}</span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded" style={{ color: ranks[muscleSel].rankColor, backgroundColor: ranks[muscleSel].rankColor + '22' }}>
                                {ranks[muscleSel].rankLabel}
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1">
                            {miles(ranks[muscleSel].volume)} kg movidos · {ranks[muscleSel].sets} series
                        </p>
                    </div>
                )}

                <p className="text-[9px] text-zinc-600 text-center mt-2">
                    Toca un músculo para ver su detalle
                </p>
            </div>

            {/* --- RANGOS POR MÚSCULO --- */}
            <div>
                <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-yellow-500 text-xs font-black uppercase tracking-widest">Rangos</h3>
                    <button
                        onClick={() => setVerEscala(v => !v)}
                        className="text-[9px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-wide flex items-center gap-1"
                    >
                        <Info size={11} /> Cómo se sube
                    </button>
                </div>

                {verEscala && (
                    <div className="bg-zinc-950 border border-white/5 rounded-2xl p-4 mb-3 animate-in fade-in">
                        <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                            Un músculo sube por los <span className="text-white font-bold">kilos que le metes</span>:
                            cada serie suma <span className="text-white font-bold">peso × repeticiones</span>.
                            Si un ejercicio trabaja varios músculos, el principal se lleva todo y cada
                            secundario un <span className="text-white font-bold">40%</span>.
                        </p>
                        {escala && (
                            <div className="grid grid-cols-2 gap-1.5">
                                {escala.map(r => (
                                    <div key={r.key} className="flex items-center gap-2 bg-black rounded-lg px-2 py-1.5 border border-white/5">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                                        <span className="text-[10px] font-black uppercase" style={{ color: r.color }}>{r.label}</span>
                                        <span className="text-[9px] text-zinc-600 ml-auto font-bold">{miles(r.min)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    {grupos.map(([nombre, info]) => (
                        <div key={nombre} className="bg-zinc-950 border border-white/5 rounded-2xl p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: info.rankColor }} />
                                    <span className="text-xs font-black text-white uppercase truncate">{nombre}</span>
                                </div>
                                <span className="text-[10px] font-black uppercase shrink-0" style={{ color: info.rankColor }}>
                                    {info.rankLabel}
                                </span>
                            </div>

                            <div className="h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${info.progress}%`, backgroundColor: info.rankColor }}
                                />
                            </div>

                            <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[9px] font-bold text-zinc-500">{miles(info.volume)} kg movidos</span>
                                <span className="text-[9px] font-bold text-zinc-600">
                                    {info.nextRankLabel
                                        ? `Faltan ${miles(info.pointsToNext)} para ${info.nextRankLabel}`
                                        : 'Rango máximo'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* DETALLE POR MÚSCULO: solo los que ya tienen kilos encima */}
                {musculos.length > 0 && (
                    <div className="mt-5">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 px-1">
                            Por músculo
                        </h4>
                        <div className="space-y-1.5">
                            {musculos.map(([nombre, info]) => (
                                <div key={nombre} className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: info.rankColor }} />
                                    <span className="text-[11px] font-bold text-zinc-300 truncate flex-1">{nombre}</span>
                                    <span className="text-[9px] font-bold text-zinc-600 shrink-0">{miles(info.volume)} kg</span>
                                    <span className="text-[9px] font-black uppercase shrink-0 w-16 text-right" style={{ color: info.rankColor }}>
                                        {info.rankLabel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* --- PROGRESO POR EJERCICIO --- */}
            <div>
                <h3 className="text-yellow-500 text-xs font-black uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                    <TrendingUp size={13} /> Progreso por ejercicio
                </h3>

                {!entrenados || entrenados.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-zinc-900 rounded-3xl">
                        <Dumbbell className="mx-auto text-zinc-800 mb-2" size={26} />
                        <p className="text-[11px] text-zinc-600 font-bold">Entrena y aquí verás tu evolución.</p>
                    </div>
                ) : (
                    <div className="bg-zinc-950 border border-white/5 rounded-3xl p-4">
                        <div className="relative mb-3">
                            <select
                                value={ejercicio || ''}
                                onChange={(e) => setEjercicio(e.target.value || null)}
                                className="w-full appearance-none bg-black border border-zinc-800 rounded-2xl py-3 pl-4 pr-10 text-white font-bold text-sm outline-none focus:border-yellow-500/50"
                            >
                                <option value="">Elige un ejercicio...</option>
                                {entrenados.map(e => (
                                    <option key={e.name} value={e.name}>{e.name} ({e.sessions})</option>
                                ))}
                            </select>
                            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                        </div>

                        {!ejercicio ? (
                            <p className="text-center text-[11px] text-zinc-600 py-8 font-bold">
                                Elige un ejercicio para ver cómo has progresado.
                            </p>
                        ) : cargandoProgreso ? (
                            <p className="text-center text-[11px] text-zinc-600 py-8 animate-pulse font-bold uppercase">Cargando...</p>
                        ) : (
                            <>
                                {progreso?.record && (
                                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-3 py-2 mb-3">
                                        <Trophy size={14} className="text-yellow-500 shrink-0" />
                                        <span className="text-[11px] font-black text-yellow-500">
                                            Récord: {progreso.record.weight} kg × {progreso.record.reps} reps
                                        </span>
                                        <span className="text-[9px] text-zinc-500 ml-auto">
                                            {new Date(progreso.record.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                                        </span>
                                    </div>
                                )}

                                <div className="flex bg-black p-1 rounded-xl border border-zinc-800 mb-3">
                                    {[
                                        { id: 'bestWeight', label: 'Peso máx.', unit: 'kg' },
                                        { id: 'volume', label: 'Volumen', unit: 'kg' },
                                        { id: 'reps', label: 'Reps', unit: '' }
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setMetrica(m.id)}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${metrica === m.id ? 'bg-yellow-500 text-black' : 'text-zinc-500'}`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>

                                <ProgressChart
                                    points={progreso?.points || []}
                                    metric={metrica}
                                    unit={metrica === 'reps' ? 'reps' : 'kg'}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
