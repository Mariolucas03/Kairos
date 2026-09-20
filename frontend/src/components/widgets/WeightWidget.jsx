import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Plus, TrendingDown, TrendingUp, Scale } from '../../iconos';
import WidgetCard, { WIDGET_ACCENTS } from '../common/WidgetCard';

/**
 * EL PESO.
 *
 * El numero que se ve es SIEMPRE el ultimo que apuntaste: el servidor copia
 * el peso del dia anterior al crear el registro de hoy, asi que no hace falta
 * pesarse cada dia para que el widget diga algo. Cuando te pesas, se cambia.
 *
 * `history` son los dias con peso apuntado (fecha, kg), del mas viejo al mas
 * nuevo: con eso se pinta la linea de la tarjeta y la de la ventana, y se
 * dice cuanto has cambiado en la ultima semana y en el ultimo mes.
 */

const diasEntre = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

/** El primer registro que tenga al menos `dias` de antiguedad respecto al ultimo. */
const hace = (history, dias) => {
    if (history.length < 2) return null;
    const ultimo = history[history.length - 1];
    for (let i = history.length - 2; i >= 0; i--) {
        if (diasEntre(history[i].date, ultimo.date) >= dias) return history[i];
    }
    return null;
};

const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const conSigno = (n) => `${n > 0 ? '+' : ''}${fmt(n)}`;

/** Una linea con sus puntos, en un SVG que se estira. */
const Linea = ({ puntos, accent, alto = 60, grosor = 2.5, conPuntos = false, conArea = true, id = 'peso' }) => {
    if (puntos.length < 2) return null;
    const W = 100, H = alto;
    const vals = puntos.map(p => p.weight);
    const min = Math.min(...vals), max = Math.max(...vals);
    const rango = Math.max(0.5, max - min);
    const xy = puntos.map((p, i) => ({
        x: (i / (puntos.length - 1)) * W,
        y: H - 6 - ((p.weight - min) / rango) * (H - 12),
        ...p
    }));
    const d = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
            <defs>
                <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </linearGradient>
            </defs>
            {conArea && <path d={`${d} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${id}-area)`} />}
            <path d={d} fill="none" stroke={accent} strokeWidth={grosor} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            {conPuntos && xy.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={i === xy.length - 1 ? 2.2 : 1.4} fill={i === xy.length - 1 ? '#fff' : accent} vectorEffect="non-scaling-stroke" />
            ))}
        </svg>
    );
};

export default function WeightWidget({ initialWeight = 0, history = [], onUpdate }) {
    const pesoSeguro = Number(initialWeight) || 0;
    const [isOpen, setIsOpen] = useState(false);
    const [weight, setWeight] = useState(pesoSeguro ? String(pesoSeguro) : '');
    const accent = WIDGET_ACCENTS.weight;

    useEffect(() => { setWeight(pesoSeguro ? String(pesoSeguro) : ''); }, [pesoSeguro]);

    // Solo los dias con peso, sin repetir dias iguales seguidos (el servidor
    // copia el peso de un dia al siguiente: eso no es una pesada nueva).
    const serie = useMemo(() => {
        const limpia = (history || []).filter(h => Number(h.weight) > 0).map(h => ({ date: h.date, weight: Number(h.weight) }));
        return limpia.filter((h, i) => i === 0 || h.weight !== limpia[i - 1].weight || i === limpia.length - 1);
    }, [history]);

    const actual = pesoSeguro || (serie.length ? serie[serie.length - 1].weight : 0);
    const semana = hace(serie, 7);
    const mes = hace(serie, 28);
    const cambioSemana = semana ? actual - semana.weight : null;
    const cambioMes = mes ? actual - mes.weight : null;
    const ultimos = serie.slice(-14);
    const ultimaPesada = serie.length ? serie[serie.length - 1].date : null;

    const numero = parseFloat(String(weight).replace(',', '.'));
    const valido = Number.isFinite(numero) && numero > 20 && numero < 400;

    const ajustar = (delta) => {
        const base = valido ? numero : (actual || 70);
        setWeight((Math.round((base + delta) * 10) / 10).toString());
    };

    const guardar = () => {
        if (!valido) return;
        if (onUpdate && numero !== pesoSeguro) onUpdate(numero);
        setIsOpen(false);
    };

    const Tendencia = ({ cambio, etiqueta }) => (
        <div className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.14em] not-italic">{etiqueta}</p>
            <p className={`mt-1 text-lg font-black tabular-nums not-italic flex items-center gap-1 ${cambio === null ? 'text-zinc-600' : cambio < 0 ? 'text-emerald-400' : cambio > 0 ? 'text-rose-400' : 'text-zinc-300'}`}>
                {cambio === null ? '—' : <>{cambio < 0 ? <TrendingDown size={15} /> : cambio > 0 ? <TrendingUp size={15} /> : null}{conSigno(cambio)} kg</>}
            </p>
        </div>
    );

    return (
        <div className="h-full w-full relative z-0">
            <WidgetCard
                accent={accent}
                onClick={() => setIsOpen(true)}
                className={`h-full flex flex-col justify-between ${isOpen ? 'opacity-0 pointer-events-none' : ''}`}
                label="PESO"
            >
                <div className="relative z-10 mt-auto pt-2">
                    <div className="flex items-baseline gap-1">
                        <span className="text-[30px] leading-none font-black tracking-[-0.05em] text-white not-italic tabular-nums">
                            {actual ? fmt(actual) : '—'}
                        </span>
                        <span className="text-[12px] font-black not-italic" style={{ color: accent }}>KG</span>
                    </div>
                    {/* La linea de los ultimos pesos, o donde pedirlo */}
                    <div className="mt-2 h-9 -mx-1">
                        {ultimos.length >= 2
                            ? <Linea puntos={ultimos} accent={accent} alto={36} id="peso-mini" />
                            : <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.08em] not-italic pt-3">{actual ? 'Pésate otro día y verás la línea' : 'Toca para apuntar tu peso'}</p>}
                    </div>
                    <div className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] not-italic"
                        style={{ color: cambioSemana === null ? '#71717a' : cambioSemana < 0 ? '#4ade80' : cambioSemana > 0 ? '#f87171' : '#a1a1aa' }}>
                        {cambioSemana === null ? (ultimaPesada ? 'ÚLTIMA PESADA APUNTADA' : 'SIN PESADAS') : `${conSigno(cambioSemana)} KG ESTA SEMANA`}
                    </div>
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }} className="fixed left-0 right-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />

                    <div
                        className="bg-[#09090b] border border-white/10 w-full max-w-sm rounded-4xl p-6 shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95 duration-200 overflow-hidden z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center shrink-0 relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2 tracking-tighter not-italic">
                                <Scale size={22} style={{ color: accent }} /> PESO
                            </h2>
                            <button onClick={() => setIsOpen(false)} aria-label="Cerrar" className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/[0.07] transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* LA CIFRA, con -/+ de 0,1 y la casilla para escribir */}
                        <div className="rounded-3xl border border-white/[0.07] bg-black p-3 flex items-center gap-2">
                            <button type="button" onClick={() => ajustar(-0.1)} aria-label="Bajar 0,1 kg" className="w-11 h-11 shrink-0 rounded-2xl bg-zinc-900 border border-white/[0.07] text-zinc-300 flex items-center justify-center active:scale-90 transition-transform"><Minus size={18} /></button>
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
                                    onFocus={(e) => e.target.select()}
                                    placeholder={actual ? fmt(actual) : '70,0'}
                                    aria-label="Peso en kilos"
                                    className="w-full bg-transparent text-center text-[44px] leading-none font-black text-white outline-none tabular-nums not-italic placeholder:text-zinc-700"
                                />
                                <span className="absolute right-1 bottom-1 text-[11px] font-black not-italic" style={{ color: accent }}>KG</span>
                            </div>
                            <button type="button" onClick={() => ajustar(0.1)} aria-label="Subir 0,1 kg" className="w-11 h-11 shrink-0 rounded-2xl bg-zinc-900 border border-white/[0.07] text-zinc-300 flex items-center justify-center active:scale-90 transition-transform"><Plus size={18} /></button>
                        </div>

                        <div className="flex gap-2">
                            <Tendencia cambio={cambioSemana} etiqueta="Esta semana" />
                            <Tendencia cambio={cambioMes} etiqueta="Este mes" />
                        </div>

                        {/* LA LINEA de las ultimas pesadas */}
                        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-3">
                            <div className="flex items-baseline justify-between mb-2">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.14em] not-italic">Últimas pesadas</p>
                                {serie.length >= 2 && (
                                    <p className="text-[9px] font-bold text-zinc-600 not-italic tabular-nums">
                                        {fmt(Math.min(...ultimos.map(p => p.weight)))} – {fmt(Math.max(...ultimos.map(p => p.weight)))} kg
                                    </p>
                                )}
                            </div>
                            <div className="h-24">
                                {ultimos.length >= 2
                                    ? <Linea puntos={ultimos} accent={accent} alto={96} conPuntos id="peso-grande" />
                                    : <p className="text-[11px] text-zinc-600 font-bold text-center pt-9">Con dos pesadas ya hay línea.</p>}
                            </div>
                            {ultimos.length >= 2 && (
                                <div className="flex justify-between mt-1 text-[9px] font-bold text-zinc-600 not-italic">
                                    <span>{new Date(ultimos[0].date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                                    <span>{new Date(ultimos[ultimos.length - 1].date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={guardar}
                            disabled={!valido || numero === pesoSeguro}
                            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.12em] text-black transition-all active:scale-[0.98] disabled:opacity-40 border-b-4"
                            style={{ background: accent, borderColor: '#9d174d' }}
                        >
                            {numero === pesoSeguro && valido ? 'Es tu peso actual' : 'Apuntar el peso de hoy'}
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
