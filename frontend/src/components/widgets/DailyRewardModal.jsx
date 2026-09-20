import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, Heart, Loader2, Package, Check, Flame } from '../../iconos';

/**
 * EL CAMINO DE LA RACHA.
 *
 * Un camino de dias que se recorre de izquierda a derecha: los que ya has
 * recogido, el de hoy (grande y encendido) y los que vienen. Cada dia lleva
 * su premio, distinto del anterior; los hitos (7, 14, 30...) son mas grandes
 * y dan cofre. El tramo que se pinta y lo que da cada dia lo manda el
 * servidor (`camino`): aqui no hay ninguna tabla.
 *
 *   camino: { dia, cobradoHoy, rachaViva, hoy, camino: [{ dia, tipo, valor, etiqueta, hito }] }
 *   premioRecogido: lo que acaba de tocar, para el momento de recoger.
 */

const ACENTO = '#f97316';

const COLOR = {
    fichas: '#a855f7',
    xp: '#22d3ee',
    hp: '#f43f5e',
    cofre: '#eab308'
};

const nombreTipo = (tipo) => ({ fichas: 'Fichas', xp: 'Experiencia', hp: 'Vida', cofre: 'Cofre' })[tipo] || 'Premio';

const IconoPremio = ({ tipo, tamano = 22, color }) => {
    if (tipo === 'fichas') return <img src="/assets/icons/ficha.png" alt="" className="object-contain" style={{ width: tamano, height: tamano }} draggable="false" />;
    if (tipo === 'xp') return <Zap size={tamano} color={color} fill={color} />;
    if (tipo === 'hp') return <Heart size={tamano} color={color} fill={color} />;
    return <Package size={tamano} color={color} />;
};

export default function DailyRewardModal({ camino, premioRecogido, onClose, onClaim, claiming = false }) {
    // El confeti solo al recoger, y la libreria se carga aqui: quien no abre
    // esta ventana no se la descarga.
    useEffect(() => {
        if (!premioRecogido) return;
        let cancelado = false;
        let intervalo;
        import('canvas-confetti').then(({ default: confetti }) => {
            if (cancelado) return;
            const fin = Date.now() + 1800;
            intervalo = setInterval(() => {
                if (Date.now() > fin) return clearInterval(intervalo);
                confetti({ particleCount: 30, spread: 70, startVelocity: 28, ticks: 60, zIndex: 20000, origin: { x: Math.random(), y: 0.2 }, colors: [ACENTO, '#fde047', '#fff'] });
            }, 220);
        }).catch(() => {});
        return () => { cancelado = true; clearInterval(intervalo); };
    }, [premioRecogido]);

    const dia = camino?.dia ?? 1;
    const cobradoHoy = camino?.cobradoHoy ?? false;
    const tramo = camino?.camino || [];
    const hoy = camino?.hoy;

    // Lo que se enseña: la racha visible, el color del premio de hoy, los
    // siete dias a partir de hoy y el proximo hito con cofre.
    const rachaVisible = cobradoHoy ? dia : Math.max(0, dia - 1);
    const proximoHito = tramo.find(p => p.dia > dia && p.hito) || null;

    // La carta de hoy, al centro, nada mas abrir
    const hoyRef = useRef(null);
    useEffect(() => {
        hoyRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    }, [camino?.dia]);

    return createPortal(
        <div
            style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }}
            className="fixed left-0 right-0 z-[9999] flex items-center justify-center p-4"
        >
            <div className="absolute inset-0 bg-black/95" onClick={onClose} aria-hidden="true" />

            <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-4xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${ACENTO}, transparent)` }} />

                <button onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 z-20 bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/[0.07]">
                    <X size={18} />
                </button>

                {/* ARRIBA: la racha, pequeña, y el cierre */}
                <div className="px-5 pt-5 flex items-center gap-2 relative z-10">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] not-italic" style={{ background: ACENTO + '1f', color: ACENTO }}>
                        <Flame size={13} fill={ACENTO} /> {rachaVisible} {rachaVisible === 1 ? 'día' : 'días'} seguidos
                    </span>
                </div>

                {/* LAS CARTAS: una por dia, el premio en grande. La de hoy en medio */}
                <div className="relative z-10 mt-4 overflow-x-auto no-scrollbar" style={{ scrollSnapType: 'x mandatory' }}>
                    <div className="flex items-stretch gap-3 px-5 py-3 min-w-max">
                        {tramo.map(p => {
                            const esHoy = p.dia === dia;
                            const pasado = p.dia < dia;
                            const hecho = pasado || (esHoy && (cobradoHoy || !!premioRecogido));
                            const color = COLOR[p.tipo] || ACENTO;
                            return (
                                <div
                                    key={p.dia}
                                    ref={esHoy ? hoyRef : undefined}
                                    className={`relative shrink-0 rounded-3xl border flex flex-col items-center justify-between px-3 py-4 transition-all ${esHoy && !hecho ? 'animate-pulse' : ''}`}
                                    style={{
                                        width: esHoy ? 168 : 138,
                                        height: esHoy ? 236 : 208,
                                        scrollSnapAlign: 'center',
                                        background: hecho ? '#0f0f12' : esHoy ? `linear-gradient(180deg, ${color}2e 0%, #0f0f12 70%)` : '#0c0c0e',
                                        borderColor: esHoy ? (hecho ? ACENTO : color) : hecho ? 'rgba(255,255,255,0.06)' : p.hito ? COLOR.cofre + '66' : 'rgba(255,255,255,0.09)',
                                        borderWidth: esHoy ? 2 : 1,
                                        boxShadow: esHoy && !hecho ? `0 0 40px ${color}44` : 'none',
                                        opacity: pasado ? 0.55 : 1
                                    }}
                                >
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] not-italic ${esHoy ? 'text-white' : 'text-zinc-500'}`}>
                                        {esHoy ? 'Hoy' : `Día ${p.dia}`}
                                    </span>

                                    <div
                                        className="rounded-full flex items-center justify-center"
                                        style={{ width: esHoy ? 92 : 72, height: esHoy ? 92 : 72, background: hecho ? 'rgba(255,255,255,0.05)' : color + '22', border: `2px solid ${hecho ? 'rgba(255,255,255,0.08)' : color}` }}
                                    >
                                        {hecho
                                            ? <Check size={esHoy ? 40 : 30} color={ACENTO} strokeWidth={3} />
                                            : <IconoPremio tipo={p.tipo} tamano={esHoy ? 48 : 36} color={color} />}
                                    </div>

                                    <div className="text-center">
                                        <p className={`font-black leading-tight not-italic ${esHoy ? 'text-[19px] text-white' : 'text-[14px] text-zinc-200'}`}>{p.etiqueta}</p>
                                        <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] not-italic" style={{ color: hecho ? '#71717a' : color }}>
                                            {hecho ? 'Recogido' : p.hito ? 'Hito' : nombreTipo(p.tipo)}
                                        </p>
                                    </div>

                                    {p.hito && !hecho && (
                                        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-black" style={{ background: COLOR.cofre }}>★</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <p className="relative z-10 px-5 pb-3 text-center text-[11px] text-zinc-400 font-medium">
                    {premioRecogido
                        ? (premioRecogido.tipo === 'cofre' ? 'El cofre ya está en tu mochila, en la tienda.' : `Recogido. Mañana, el día ${dia + 1}.`)
                        : cobradoHoy
                            ? `Ya lo tienes. Mañana toca el día ${dia + 1}${proximoHito ? ` · día ${proximoHito.dia}: ${proximoHito.etiqueta}` : ''}.`
                            : dia === 1
                                ? 'Hoy empieza. Cada día un premio; si fallas uno, vuelves al 1.'
                                : `Si un día no entras, vuelves al 1${proximoHito ? ` · día ${proximoHito.dia}: ${proximoHito.etiqueta}` : ''}.`}
                </p>

                {/* EL BOTON */}
                <div className="px-5 pb-5 relative z-10">
                    {premioRecogido ? (
                        <button onClick={onClose} className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.12em] text-sm bg-zinc-900 border border-white/[0.07] text-zinc-200 active:scale-95 transition-transform">
                            Listo
                        </button>
                    ) : hoy && !cobradoHoy ? (
                        <button
                            onClick={onClaim}
                            disabled={claiming}
                            className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.12em] text-sm text-black active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: ACENTO }}
                        >
                            {claiming ? <Loader2 className="animate-spin" size={18} /> : <>Recoger · {hoy.etiqueta}</>}
                        </button>
                    ) : (
                        <button onClick={onClose} className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.12em] text-sm bg-zinc-900 border border-white/[0.07] text-zinc-300 active:scale-95 transition-transform">
                            Hasta mañana
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
