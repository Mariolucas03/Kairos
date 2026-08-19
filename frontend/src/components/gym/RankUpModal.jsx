import { createPortal } from 'react-dom';
import { TrendingUp, X } from 'lucide-react';

/**
 * Aviso de SUBIDA DE RANGO MUSCULAR.
 *
 * Es el premio grande del gimnasio. El entreno ya no da monedas ni fichas: da
 * XP y, cada muchas semanas, esto. Subir un rango cuesta duplicar el volumen
 * acumulado, asi que merece pararse a contarlo en vez de un aviso de dos
 * segundos que se pierde entre el resto.
 *
 * Puede llegar mas de un grupo a la vez (un entreno de pierna sube Pierna y
 * Gluteo el mismo dia), por eso recibe una lista.
 */
export default function RankUpModal({ subidas = [], monedas = 0, onClose }) {
    if (!subidas.length) return null;

    return createPortal(
        <div
            style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }}
            className="fixed left-0 right-0 z-[10000] flex items-center justify-center p-5 overflow-y-auto bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
        >
            <div className="relative w-full max-w-sm bg-[#09090b] border border-white/[0.07] rounded-[32px] p-7 overflow-hidden animate-in zoom-in-95">
                <div
                    className="absolute inset-x-0 top-0 h-[2px] pointer-events-none"
                    style={{ background: `linear-gradient(90deg, ${subidas[0].color}, transparent)` }}
                />
                <div
                    className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] pointer-events-none"
                    style={{ background: subidas[0].color, opacity: 0.11 }}
                />

                <button
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="absolute top-4 right-4 bg-zinc-900 p-2 rounded-full text-zinc-500 hover:text-white border border-white/[0.07] z-20"
                >
                    <X size={18} />
                </button>

                <div className="relative z-10 text-center">
                    <div
                        className="w-14 h-14 mx-auto rounded-full bg-[#18181b] border border-white/[0.07] flex items-center justify-center mb-4"
                        style={{ color: subidas[0].color }}
                    >
                        <TrendingUp size={26} />
                    </div>

                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] not-italic">
                        {subidas.length > 1 ? `${subidas.length} grupos han subido` : 'Has subido de rango'}
                    </p>

                    <div className="mt-4 space-y-2.5">
                        {subidas.map(s => (
                            <div
                                key={s.grupo}
                                className="relative overflow-hidden bg-[#0a0a0c] border border-white/[0.07] rounded-[20px] px-4 py-3 flex items-center justify-between gap-3"
                            >
                                <div
                                    className="absolute inset-x-0 top-0 h-[2px]"
                                    style={{ background: `linear-gradient(90deg, ${s.color}, transparent)` }}
                                />
                                <span className="text-[13px] font-black text-white uppercase tracking-[0.04em] not-italic">
                                    {s.grupo}
                                </span>
                                <span
                                    className="text-[11px] font-black uppercase tracking-[0.12em] not-italic"
                                    style={{ color: s.color }}
                                >
                                    {s.rango}
                                </span>
                            </div>
                        ))}
                    </div>

                    {monedas > 0 && (
                        <div className="mt-5 flex items-center justify-center gap-2">
                            <span className="text-[28px] font-black text-white tracking-[-0.05em] leading-none not-italic">
                                +{monedas.toLocaleString()}
                            </span>
                            <img src="/assets/icons/moneda.png" alt="Monedas" className="w-6 h-6 object-contain" />
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="mt-6 w-full py-3.5 bg-white text-black font-black rounded-2xl uppercase text-xs tracking-[0.12em] active:scale-95 transition-transform"
                    >
                        Seguir
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
