import { useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, ChevronDown, Dumbbell, Trophy, Info } from 'lucide-react';
import api from '../../services/api';
import BodyMap from '../body/BodyMap';
import ProgressChart from './ProgressChart';
import IconoRango from './IconoRango';
import { useAuthStore } from '../../store/useAuthStore';

const fetcher = (url) => api.get(url).then(res => res.data);

const miles = (n) => (n || 0).toLocaleString('es-ES');

export default function BodyTab() {
    // El cuerpo que se pinta: el de mujer si asi se dijo al crear el personaje.
    const mujer = useAuthStore(state => state.user?.physicalStats?.gender === 'female');
    const { data: ranksData, isLoading, error, mutate: recargarRangos } = useSWR('/gym/muscle-ranks', fetcher);
    const { data: entrenados } = useSWR('/gym/progress', fetcher);

    const [muscleSel, setMuscleSel] = useState(null);
    const [ejercicio, setEjercicio] = useState(null);
    const [metrica, setMetrica] = useState('bestWeight');
    const [verEscala, setVerEscala] = useState(false);
    // Qué grupo está desplegado en la lista (solo uno a la vez, para no marear)
    const [grupoAbierto, setGrupoAbierto] = useState(null);

    const ranks = ranksData?.ranks || {};
    const escala = ranksData?.tiers || null;
    const general = ranksData?.general || null;

    const { data: progreso, isLoading: cargandoProgreso } = useSWR(
        ejercicio ? `/gym/progress/${encodeURIComponent(ejercicio)}` : null,
        fetcher
    );

    // De más entrenado a menos, para que arriba salga en lo que más trabajas.
    // El backend devuelve los 8 grupos Y cada músculo concreto: los grupos son
    // las filas de la lista y cada uno despliega los suyos al pulsarlo.
    const entradas = Object.entries(ranks);
    const grupos = entradas
        .filter(([, r]) => r.isGroup !== false)
        .sort((a, b) => (b[1].points || 0) - (a[1].points || 0));

    // Índice grupo -> sus músculos, ordenados de más a menos trabajado
    const musculosPorGrupo = {};
    entradas
        .filter(([, r]) => r.isGroup === false)
        .sort((a, b) => (b[1].points || 0) - (a[1].points || 0))
        .forEach(([nombre, r]) => {
            const g = r.group || 'Otros';
            (musculosPorGrupo[g] = musculosPorGrupo[g] || []).push([nombre, r]);
        });

    if (isLoading) {
        return <div className="py-16 text-center text-zinc-600 text-xs font-bold uppercase animate-pulse">Calculando tus rangos...</div>;
    }

    // ⚠️ Si la peticion falla (el servidor gratuito despertando, o sin red), la
    // pestaña se quedaba VACIA: ni cuerpo ni rangos ni explicacion. Parecia
    // que todo habia desaparecido. Se dice, y se puede reintentar.
    if (error && !ranksData) {
        return (
            <div className="py-12 text-center">
                <p className="text-sm font-black text-white uppercase">No se han podido cargar tus rangos</p>
                <p className="text-[11px] text-zinc-500 mt-1">El servidor no ha contestado. Suele ser que estaba despertando.</p>
                <button onClick={() => recargarRangos()} className="mt-4 px-5 py-2.5 rounded-xl bg-yellow-500 text-black text-xs font-black uppercase tracking-widest active:scale-95 transition-transform">Reintentar</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24">
            {/* --- TU RANGO GENERAL, como el "Symmetry Rank": la media de los
                ocho grupos, con el escalon grande, y entre que parte de la
                gente estas. Encima del cuerpo, que es lo primero que se mira. */}
            {general && (
                <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0a0a0c] p-4 flex items-center gap-4">
                    <div className="relative shrink-0 w-16 h-16 flex items-center justify-center rounded-2xl" style={{ background: general.rankColor + '1a' }}>
                        <IconoRango rango={general.rank} color={general.rankColor} tamano={44} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] not-italic">Tu rango</p>
                        <p className="text-2xl font-black uppercase tracking-tight leading-none mt-1 not-italic" style={{ color: general.rankColor }}>{general.rankLabel}</p>
                        <p className="text-[11px] text-zinc-400 font-bold mt-1.5 not-italic">
                            {general.percentil !== null && general.percentil !== undefined
                                ? <>Estás entre el <span className="text-white">{general.percentil}%</span> más fuerte de Kairos</>
                                : `${miles(general.total)} kg movidos en total`}
                        </p>
                        <div className="mt-2 h-1.5 bg-black/60 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${general.progress || 0}%`, background: general.rankColor }} />
                        </div>
                        <p className="text-[9px] text-zinc-600 font-bold mt-1 not-italic">{general.nextRankLabel ? `Media de tus grupos · faltan ${miles(general.pointsToNext)} kg para ${general.nextRankLabel}` : 'Escalón máximo'}</p>
                    </div>
                </div>
            )}

            {/* --- EL CUERPO --- */}
            <div className="bg-zinc-950 border border-white/[0.07] rounded-3xl p-4">
                <BodyMap levels={ranks} dual mujer={mujer} selected={muscleSel} onSelectMuscle={(g) => setMuscleSel(g === muscleSel ? null : g)} />

                {/* Mini leyenda de rangos: sin ella los colores del cuerpo no
                    significan nada. Los tramos los manda el servidor (tiers),
                    asi que no hay una segunda tabla que se pueda desincronizar.
                    Aqui se deja el color a secas a proposito: esta franja
                    explica los COLORES del mapa del cuerpo, no los rangos. Los
                    iconos van en la escala de abajo y en cada musculo. Antes:
                    cuando haya iconos por rango se
                    sustituye el circulo por su logo. */}
                {Array.isArray(escala) && escala.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 justify-center">
                        {escala.map((t) => (
                            <span key={t.label || t.name} className="flex items-center gap-1.5">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ background: t.color || '#71717a' }}
                                />
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.1em] not-italic">
                                    {t.label || t.name}
                                </span>
                            </span>
                        ))}
                    </div>
                )}

                {/* EL DETALLE DEL MUSCULO, como en Symmetry: su escalon, lo que
                    falta para el siguiente, y CON QUE lo has subido: cada
                    ejercicio, cuantas veces, cuanto le ha dejado y su propio
                    escalon. Es lo que convierte un color en una explicacion. */}
                {muscleSel && ranks[muscleSel] && (() => {
                    const m = ranks[muscleSel];
                    return (
                        <div className="mt-3 bg-black border border-white/10 rounded-2xl p-3 animate-in fade-in">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <IconoRango rango={m.rank} color={m.rankColor} tamano={26} />
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-white uppercase truncate not-italic">{muscleSel}</p>
                                        <p className="text-[10px] font-black uppercase not-italic" style={{ color: m.rankColor }}>{m.rankLabel}</p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[11px] font-black text-white tabular-nums not-italic">{miles(m.volume)} kg</p>
                                    <p className="text-[9px] text-zinc-500 font-bold not-italic">{m.sets} series</p>
                                </div>
                            </div>
                            <div className="mt-2 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${m.progress || 0}%`, background: m.rankColor }} />
                            </div>
                            <p className="text-[9px] text-zinc-500 font-bold mt-1 not-italic">
                                {m.nextRankLabel ? `Faltan ${miles(m.pointsToNext)} kg para ${m.nextRankLabel}` : 'Escalón máximo'}
                            </p>

                            {m.ejercicios && m.ejercicios.length > 0 ? (
                                <>
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.14em] mt-3 mb-1.5 not-italic">Con qué lo has subido</p>
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 pb-1">
                                        {m.ejercicios.map(e => (
                                            <button
                                                key={e.nombre}
                                                type="button"
                                                onClick={() => setEjercicio(e.nombre)}
                                                className="shrink-0 w-[140px] text-left rounded-2xl border overflow-hidden active:scale-[0.98] transition-transform"
                                                style={{ borderColor: e.rankColor + '55', background: e.rankColor + '0f' }}
                                            >
                                                {/* El dibujo del ejercicio, para saber cual es de un
                                                    vistazo (como en Symmetry). Sin dibujo, el nombre. */}
                                                <div className="h-[84px] bg-white flex items-center justify-center overflow-hidden">
                                                    {(e.thumb || e.gif)
                                                        ? <img src={e.thumb || e.gif} alt="" loading="lazy" className="w-full h-full object-cover" onError={(ev) => { ev.currentTarget.style.display = 'none'; }} />
                                                        : <span className="text-[10px] font-black text-zinc-400 uppercase px-2 text-center">{e.nombre}</span>}
                                                </div>
                                                <div className="p-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <IconoRango rango={e.rank} color={e.rankColor} tamano={16} />
                                                    <span className="text-[9px] font-black uppercase not-italic truncate" style={{ color: e.rankColor }}>{e.rankLabel}</span>
                                                </div>
                                                <p className="text-[11px] font-black text-white leading-tight mt-1.5 line-clamp-2 not-italic">{e.nombre}</p>
                                                <p className="text-[9px] text-zinc-400 font-bold mt-1 not-italic">{e.sesiones} {e.sesiones === 1 ? 'vez' : 'veces'} · {miles(e.volumen)} kg</p>
                                                {e.mejorPeso > 0 && <p className="text-[9px] text-zinc-600 font-bold not-italic">mejor {e.mejorPeso} kg</p>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p className="text-[10px] text-zinc-600 font-bold mt-3 not-italic">Todavía ningún ejercicio ha trabajado este músculo.</p>
                            )}

                            {/* La grafica del ejercicio tocado, aqui mismo */}
                            {ejercicio && (
                                <div className="mt-3 rounded-2xl border border-white/[0.07] bg-zinc-950 p-3 animate-in fade-in">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[11px] font-black text-white uppercase truncate not-italic">{ejercicio}</p>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {[['bestWeight', 'Peso'], ['volume', 'Volumen']].map(([k, t]) => (
                                                <button key={k} type="button" onClick={() => setMetrica(k)} className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${metrica === k ? 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10' : 'text-zinc-500 border-white/[0.07]'}`}>{t}</button>
                                            ))}
                                            <button type="button" onClick={() => setEjercicio(null)} aria-label="Cerrar" className="text-zinc-500 text-[10px] font-black px-1.5">✕</button>
                                        </div>
                                    </div>
                                    {cargandoProgreso
                                        ? <div className="h-32 animate-pulse bg-zinc-900 rounded-xl" />
                                        : <ProgressChart points={progreso?.points || []} metric={metrica} color={m.rankColor} unit="kg" />}
                                </div>
                            )}
                        </div>
                    );
                })()}

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
                    <div className="bg-zinc-950 border border-white/[0.07] rounded-2xl p-4 mb-3 animate-in fade-in">
                        <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                            Un músculo sube por los <span className="text-white font-bold">kilos que le metes</span>:
                            cada serie suma <span className="text-white font-bold">peso × repeticiones</span>.
                            Si un ejercicio trabaja varios músculos, el principal se lleva todo y cada
                            secundario un <span className="text-white font-bold">40%</span>.
                            Cada rango tiene <span className="text-white font-bold">tres escalones</span> (Madera I, II y III) antes del siguiente.
                        </p>
                        {escala && (
                            <div className="grid grid-cols-2 gap-1.5">
                                {escala.map(r => (
                                    <div key={r.key} className="flex items-center gap-2 bg-black rounded-lg px-2 py-1.5 border border-white/[0.07]">
                                        <IconoRango rango={r.key} color={r.color} tamano={18} />
                                        <span className="text-[10px] font-black uppercase" style={{ color: r.color }}>{r.label}</span>
                                        <span className="text-[9px] text-zinc-600 ml-auto font-bold">{miles(r.min)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    {grupos.map(([nombre, info]) => {
                        const hijos = musculosPorGrupo[nombre] || [];
                        const abierto = grupoAbierto === nombre;

                        return (
                            <div key={nombre} className="bg-zinc-950 border border-white/[0.07] rounded-2xl overflow-hidden">
                                {/* Cabecera: pulsa para desplegar los músculos del grupo */}
                                <button
                                    onClick={() => hijos.length > 0 && setGrupoAbierto(abierto ? null : nombre)}
                                    disabled={hijos.length === 0}
                                    aria-expanded={abierto}
                                    className="w-full text-left p-3 disabled:cursor-default"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <IconoRango rango={info.rank} color={info.rankColor} tamano={22} />
                                            <span className="text-xs font-black text-white uppercase truncate">{nombre}</span>
                                            {hijos.length > 0 && (
                                                <ChevronDown
                                                    size={13}
                                                    className={`text-zinc-600 shrink-0 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
                                                />
                                            )}
                                        </div>
                                        <span className="text-[10px] font-black uppercase shrink-0" style={{ color: info.rankColor }}>
                                            {info.rankLabel}
                                        </span>
                                    </div>

                                    <div className="h-1.5 bg-black rounded-full overflow-hidden border border-white/[0.07]">
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
                                </button>

                                {/* Los músculos de dentro. Se ven TODOS, también los
                                    que están a cero: así se nota lo que no entrenas. */}
                                {abierto && (
                                    <div className="border-t border-white/[0.07] bg-black/40 px-3 py-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                        {hijos.map(([musculo, r]) => {
                                            const sinTrabajo = (r.points || 0) === 0;
                                            return (
                                                <div key={musculo} className={sinTrabajo ? 'opacity-45' : ''}>
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <span className="text-[11px] font-bold text-zinc-300 truncate">{musculo}</span>
                                                        <span className="text-[9px] font-black uppercase shrink-0" style={{ color: sinTrabajo ? '#52525b' : r.rankColor }}>
                                                            {sinTrabajo ? 'Sin entrenar' : r.rankLabel}
                                                        </span>
                                                    </div>
                                                    <div className="h-1 bg-black rounded-full overflow-hidden border border-white/[0.07]">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-700"
                                                            style={{ width: `${r.progress || 0}%`, backgroundColor: r.rankColor }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] font-bold text-zinc-600 mt-0.5 block">{miles(r.volume)} kg</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}
