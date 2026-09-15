import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, Heart, Loader2, Package, Check, Flame } from 'lucide-react';

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

const IconoPremio = ({ tipo, tamano = 22, color }) => {
    if (tipo === 'fichas') return <img src="/assets/icons/ficha.png" alt="" className="object-contain" style={{ width: tamano, height: tamano }} draggable="false" />;
    if (tipo === 'xp') return <Zap size={tamano} color={color} fill={color} />;
    if (tipo === 'hp') return <Heart size={tamano} color={color} fill={color} />;
    return <Package size={tamano} color={color} />;
};

export default function DailyRewardModal({ camino, premioRecogido, onClose, onClaim, claiming = false }) {
    const hoyRef = useRef(null);

    // El de hoy, al centro, nada mas abrir.
    useEffect(() => {
        hoyRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    }, [camino?.dia]);

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

    const estadoDe = (d) => {
        if (d < dia) return 'hecho';
        if (d === dia) return cobradoHoy ? 'hecho-hoy' : 'hoy';
        return 'futuro';
    };

    return createPortal(
        <div
            style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }}
            className="fixed left-0 right-0 z-[9999] flex items-center justify-center p-4"
        >
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} aria-hidden="true" />

            <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-4xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${ACENTO}, transparent)` }} />
                <div className="absolute -right-10 -top-10 w-48 h-48 halo pointer-events-none" style={{ background: ACENTO, opacity: 0.12 }} />

                <button onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 z-20 bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/[0.07]">
                    <X size={18} />
                </button>

                {/* LA CABECERA: la racha, en grande */}
                <div className="px-6 pt-6 pb-2 relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] not-italic" style={{ color: ACENTO }}>Tu racha</p>
                    <div className="flex items-end gap-3 mt-1">
                        <div className="flex items-center gap-2">
                            <Flame size={30} color={ACENTO} fill={ACENTO} />
                            <span className="text-5xl font-black text-white tracking-[-0.05em] leading-none not-italic tabular-nums">{cobradoHoy ? dia : Math.max(0, dia - 1)}</span>
                        </div>
                        <span className="text-[12px] font-black text-zinc-500 uppercase tracking-wider pb-1 not-italic">
                            {(cobradoHoy ? dia : dia - 1) === 1 ? 'día seguido' : 'días seguidos'}
                        </span>
                    </div>
                    <p className="text-[12px] text-zinc-400 mt-2 font-medium">
                        {cobradoHoy
                            ? `Día ${dia} recogido. Mañana, el ${dia + 1}.`
                            : dia === 1
                                ? 'Hoy empieza el camino. Cada día que entres, un premio distinto.'
                                : `Hoy es el día ${dia}. Si un día no entras, vuelves al 1.`}
                    </p>
                </div>

                {/* EL CAMINO */}
                <div className="relative z-10 mt-3 overflow-x-auto no-scrollbar" style={{ scrollSnapType: 'x proximity' }}>
                    <div className="flex items-end gap-0 px-6 py-5 min-w-max">
                        {tramo.map((p, i) => {
                            const estado = estadoDe(p.dia);
                            const esHoy = estado === 'hoy' || estado === 'hecho-hoy';
                            const hecho = estado === 'hecho' || estado === 'hecho-hoy';
                            const color = COLOR[p.tipo] || ACENTO;
                            const tam = esHoy ? 66 : p.hito ? 54 : 44;
                            return (
                                <div key={p.dia} className="flex items-center" ref={esHoy ? hoyRef : undefined} style={{ scrollSnapAlign: esHoy ? 'center' : 'none' }}>
                                    <div className="flex flex-col items-center" style={{ width: esHoy ? 84 : 66 }}>
                                        <span className={`text-[10px] font-black uppercase tracking-wider mb-1.5 not-italic ${esHoy ? 'text-white' : hecho ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                            {esHoy ? 'Hoy' : `Día ${p.dia}`}
                                        </span>
                                        <div
                                            className={`relative rounded-full flex items-center justify-center transition-all ${esHoy && !cobradoHoy ? 'animate-pulse' : ''}`}
                                            style={{
                                                width: tam, height: tam,
                                                background: hecho ? `${ACENTO}` : esHoy ? '#18181b' : '#0f0f12',
                                                border: `${esHoy ? 3 : 2}px solid ${hecho ? ACENTO : esHoy ? color : p.hito ? `${COLOR.cofre}88` : 'rgba(255,255,255,0.08)'}`,
                                                boxShadow: esHoy ? `0 0 26px ${color}66` : hecho ? `0 0 12px ${ACENTO}55` : 'none',
                                                opacity: estado === 'futuro' && !p.hito ? 0.55 : 1
                                            }}
                                        >
                                            {hecho
                                                ? <Check size={esHoy ? 30 : 20} color="#fff" strokeWidth={3} />
                                                : <IconoPremio tipo={p.tipo} tamano={esHoy ? 30 : p.hito ? 24 : 18} color={color} />}
                                            {p.hito && !hecho && (
                                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-black" style={{ background: COLOR.cofre }}>★</span>
                                            )}
                                        </div>
                                        <span className={`mt-1.5 text-[9px] font-black text-center leading-tight not-italic ${esHoy ? 'text-white' : 'text-zinc-500'}`} style={{ color: esHoy ? color : undefined }}>
                                            {p.etiqueta}
                                        </span>
                                    </div>
                                    {i < tramo.length - 1 && (
                                        <div className="h-[3px] w-4 -mx-2 rounded-full mb-5" style={{ background: p.dia < dia || (p.dia === dia && cobradoHoy) ? ACENTO : 'rgba(255,255,255,0.08)' }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* LO DE HOY, Y EL BOTON */}
                <div className="px-6 pb-6 pt-1 relative z-10">
                    {premioRecogido ? (
                        <div className="rounded-2xl border px-4 py-3 text-center animate-in zoom-in-95" style={{ borderColor: `${COLOR[premioRecogido.tipo] || ACENTO}55`, background: `${COLOR[premioRecogido.tipo] || ACENTO}14` }}>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 not-italic">Recogido</p>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <IconoPremio tipo={premioRecogido.tipo} tamano={22} color={COLOR[premioRecogido.tipo] || ACENTO} />
                                <span className="text-xl font-black text-white not-italic">{premioRecogido.etiqueta}</span>
                            </div>
                            {premioRecogido.tipo === 'cofre' && <p className="text-[10px] text-zinc-500 mt-1">Está en tu mochila, en la tienda. Ábrelo cuando quieras.</p>}
                        </div>
                    ) : hoy && !cobradoHoy ? (
                        <button
                            onClick={onClaim}
                            disabled={claiming}
                            className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.12em] text-sm text-black active:scale-95 transition-transform border-b-4 flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: ACENTO, borderColor: '#9a3412' }}
                        >
                            {claiming ? <Loader2 className="animate-spin" size={18} /> : <>Recoger · {hoy.etiqueta}</>}
                        </button>
                    ) : (
                        <button onClick={onClose} className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.12em] text-sm bg-zinc-900 border border-white/[0.07] text-zinc-300 active:scale-95 transition-transform">
                            Mañana, el día {dia + 1}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
