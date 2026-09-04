import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, Dumbbell, Trophy, ChevronDown, Timer, Flame } from 'lucide-react';
import api from '../../services/api';
import ProgressChart from './ProgressChart';
import { loQueHasLevantado } from '../../utils/loQueHasLevantado';

const fetcher = (url) => api.get(url).then(res => res.data);

/**
 * ESTADISTICAS.
 *
 * Aqui estaba "Otros deportes", que no pintaba nada en la seccion de gimnasio:
 * apuntar que has ido a nadar no tiene que ver con las rutinas ni con el cuerpo,
 * y ademas ya hay un widget de deporte en el home donde eso encaja solo. Se ha
 * mudado alli.
 *
 * En su hueco van las cifras, que estaban repartidas o directamente no existian:
 * la grafica de progreso por ejercicio vivia escondida al final de "Cuerpo",
 * debajo del mapa muscular, que es el ultimo sitio donde uno la busca.
 */
export default function EstadisticasTab() {
    const { data: resumen, isLoading: cargandoResumen } = useSWR('/gym/resumen', fetcher);
    const { data: entrenados } = useSWR('/gym/progress', fetcher);
    const { data: semana } = useSWR('/gym/weekly', fetcher);

    const [ejercicio, setEjercicio] = useState(null);
    const [metrica, setMetrica] = useState('bestWeight');

    const { data: progreso, isLoading: cargandoProgreso } = useSWR(
        ejercicio ? `/gym/progress/${encodeURIComponent(ejercicio)}` : null,
        fetcher
    );

    const volumen = resumen?.volumen || 0;
    const comparacion = loQueHasLevantado(volumen);

    const Cifra = ({ icono: Icono, valor, unidad, etiqueta }) => (
        <div className="bg-zinc-950 border border-white/5 rounded-2xl p-3 text-center">
            <Icono size={14} className="text-yellow-500 mx-auto mb-1.5" />
            <div className="flex items-baseline justify-center gap-0.5">
                <span className="text-xl font-black text-white tabular-nums leading-none not-italic">{valor}</span>
                {unidad && <span className="text-[10px] font-black text-zinc-500">{unidad}</span>}
            </div>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1 not-italic">{etiqueta}</p>
        </div>
    );

    return (
        <div className="space-y-5">

            {/* --- LO QUE LLEVAS --- */}
            <div>
                <h3 className="text-yellow-500 text-xs font-black uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                    <Flame size={13} /> Desde que empezaste
                </h3>

                {cargandoResumen ? (
                    <div className="h-[86px] rounded-2xl bg-zinc-900/50 animate-pulse" />
                ) : (
                    <>
                        <div className="grid grid-cols-3 gap-2">
                            <Cifra icono={Dumbbell} valor={(resumen?.entrenos || 0).toLocaleString('es-ES')} etiqueta="Entrenos" />
                            <Cifra icono={TrendingUp}
                                valor={volumen >= 1000 ? Math.round(volumen / 1000).toLocaleString('es-ES') : volumen}
                                unidad={volumen >= 1000 ? 't' : 'kg'} etiqueta="Movido" />
                            <Cifra icono={Timer} valor={Math.round((resumen?.minutos || 0) / 60).toLocaleString('es-ES')} unidad="h" etiqueta="Entrenando" />
                        </div>

                        {/* El volumen total en kilos no le dice nada a nadie:
                            traducido a algo que se pueda imaginar, si. */}
                        {comparacion && (
                            <div className="flex items-center gap-2.5 mt-2 px-3.5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                                <span className="text-xl leading-none">{comparacion.emoji}</span>
                                <div className="min-w-0">
                                    <p className="text-[12px] font-black text-white uppercase tracking-tight leading-tight not-italic">
                                        {comparacion.frase}
                                    </p>
                                    <p className="text-[9px] text-zinc-500 leading-snug mt-0.5">{comparacion.detalle}</p>
                                </div>
                            </div>
                        )}

                        {resumen?.mejorSerie && (
                            <div className="flex items-center gap-2 mt-2 bg-yellow-500/[0.07] border border-yellow-500/25 rounded-2xl px-3.5 py-2.5">
                                <Trophy size={14} className="text-yellow-500 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-black text-yellow-500 uppercase truncate not-italic">
                                        {resumen.mejorSerie.ejercicio}
                                    </p>
                                    <p className="text-[9px] text-zinc-500">Tu serie más dura</p>
                                </div>
                                <span className="text-[13px] font-black text-white tabular-nums shrink-0">
                                    {resumen.mejorSerie.peso}<span className="text-[9px] text-zinc-500">kg</span>
                                    <span className="text-zinc-600 mx-0.5">x</span>{resumen.mejorSerie.reps}
                                </span>
                            </div>
                        )}

                        {semana && (
                            <p className="text-[10px] text-zinc-500 font-bold text-center mt-2.5">
                                Esta semana: <span className="text-zinc-300">{(semana.currentVolume || 0).toLocaleString('es-ES')} kg</span>
                                {/* El porcentaje solo si hay con que comparar: sin
                                    entrenar esta semana, "-100%" es cierto y no
                                    aporta nada salvo un numero rojo. */}
                                {(semana.currentVolume || 0) > 0 && typeof semana.percentage === 'number' && semana.percentage !== 0 && (
                                    <span className={semana.percentage > 0 ? 'text-emerald-400' : 'text-orange-400'}>
                                        {' '}({semana.percentage > 0 ? '+' : ''}{semana.percentage}% que la pasada)
                                    </span>
                                )}
                            </p>
                        )}
                    </>
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
