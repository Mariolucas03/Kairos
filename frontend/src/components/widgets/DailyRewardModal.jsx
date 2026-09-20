import { useEffect } from 'react';
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
    const hoyColor = COLOR[hoy?.tipo] || ACENTO;
    const proximos = tramo.filter(p => p.dia >= dia).slice(0, 7);
    const proximoHito = tramo.find(p => p.dia > dia && p.hito) || null;

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

                {/* EL PREMIO DE HOY, en el centro */}
                <div className="px-5 pt-5 pb-4 flex flex-col items-center text-center relative z-10">
                    <div
                        className="w-24 h-24 rounded-full flex items-center justify-center border-2"
                        style={{ background: (hoyColor) + '1a', borderColor: cobradoHoy ? ACENTO : hoyColor, boxShadow: cobradoHoy ? 'none' : `0 0 40px ${hoyColor}44` }}
                    >
                        {cobradoHoy || premioRecogido
                            ? <Check size={44} color={ACENTO} strokeWidth={3} />
                            : <IconoPremio tipo={hoy?.tipo} tamano={44} color={hoyColor} />}
                    </div>
                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 not-italic">Día {dia}</p>
                    <p className="mt-1 text-[26px] font-black text-white leading-none not-italic">
                        {premioRecogido ? premioRecogido.etiqueta : hoy?.etiqueta || '—'}
                    </p>
                    <p className="mt-2 text-[12px] text-zinc-400 font-medium max-w-[260px]">
                        {premioRecogido
                            ? (premioRecogido.tipo === 'cofre' ? 'Ya está en tu mochila, en la tienda. Ábrelo cuando quieras.' : 'Recogido. Mañana te espera el siguiente.')
                            : cobradoHoy
                                ? `Ya lo tienes. Mañana toca el día ${dia + 1}.`
                                : dia === 1
                                    ? 'Hoy empieza. Cada día que entres, un premio distinto; si fallas uno, vuelves al 1.'
                                    : 'Si un día no entras, vuelves al 1.'}
                    </p>
                </div>

                {/* LA SEMANA QUE VIENE: siete casillas, la de hoy primero */}
                <div className="px-5 pb-4 relative z-10">
                    <div className="grid grid-cols-7 gap-1.5">
                        {proximos.map(p => {
                            const esHoy = p.dia === dia;
                            const color = COLOR[p.tipo] || ACENTO;
                            const hecho = esHoy && cobradoHoy;
                            return (
                                <div key={p.dia} className="flex flex-col items-center gap-1">
                                    <div
                                        className="w-full aspect-square rounded-xl flex items-center justify-center border relative"
                                        style={{
                                            background: hecho ? ACENTO : esHoy ? color + '26' : p.hito ? COLOR.cofre + '14' : '#0f0f12',
                                            borderColor: esHoy ? (hecho ? ACENTO : color) : p.hito ? COLOR.cofre + '66' : 'rgba(255,255,255,0.08)'
                                        }}
                                    >
                                        {hecho ? <Check size={16} color="#fff" strokeWidth={3} /> : <IconoPremio tipo={p.tipo} tamano={p.hito ? 20 : 17} color={color} />}
                                    </div>
                                    <span className={`text-[9px] font-black tabular-nums not-italic ${esHoy ? 'text-white' : p.hito ? 'text-yellow-500' : 'text-zinc-500'}`}>{p.dia}</span>
                                </div>
                            );
                        })}
                    </div>
                    {proximoHito && (
                        <p className="mt-2 text-center text-[10px] text-zinc-500 font-bold not-italic">
                            Día {proximoHito.dia}: <span className="text-yellow-500">{proximoHito.etiqueta}</span>
                        </p>
                    )}
                </div>

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
                            {claiming ? <Loader2 className="animate-spin" size={18} /> : 'Recoger'}
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
