import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

/**
 * ABRIR UN COFRE.
 *
 * Tocas el cofre, tiembla, y sale lo que habia dentro: fichas, XP o un objeto
 * del catalogo. El premio ya viene decidido del servidor (`reward`); aqui
 * solo se le da teatro.
 *
 * ⚠️ El icono del cofre es un EMOJI. Antes se metia en un <img src>, y un emoji
 * no es una URL: salia el icono de imagen rota en vez del cofre.
 *
 * `reward`: { tipo: 'fichas'|'xp'|'objeto', valor, objeto?, duplicado?, cofre }
 */

const RAREZA = {
    comun: { nombre: 'Común', color: '#a1a1aa' },
    raro: { nombre: 'Raro', color: '#60a5fa' },
    epico: { nombre: 'Épico', color: '#c084fc' },
    legendario: { nombre: 'Legendario', color: '#facc15' }
};

const Icono = ({ icono, clase = 'text-8xl' }) => (
    (icono?.startsWith?.('/') || icono?.startsWith?.('http'))
        ? <img src={icono} alt="" className="w-full h-full object-contain" draggable="false" />
        : <span className={`${clase} leading-none select-none`}>{icono || '📦'}</span>
);

export default function ChestModal({ isOpen, onClose, reward }) {
    const [fase, setFase] = useState('cerrado');   // cerrado, abriendo, abierto

    useEffect(() => { if (isOpen) setFase('cerrado'); }, [isOpen]);

    if (!isOpen) return null;

    const abrir = () => {
        if (fase !== 'cerrado') return;
        setFase('abriendo');
        setTimeout(() => setFase('abierto'), 1400);
    };

    const cofre = reward?.cofre || {};
    const rarezaCofre = RAREZA[cofre.rareza] || RAREZA.comun;
    const objeto = reward?.objeto;
    const rarezaPremio = objeto ? (RAREZA[objeto.rarity] || RAREZA.comun) : null;
    const color = reward?.tipo === 'objeto' ? rarezaPremio.color : reward?.tipo === 'xp' ? '#22d3ee' : '#a855f7';

    const titulo = reward?.tipo === 'objeto' ? '¡Objeto nuevo!' : reward?.duplicado ? 'Ya lo tenías' : '¡Premio!';
    const detalle = reward?.tipo === 'objeto'
        ? `${objeto.name} · ${rarezaPremio.nombre}`
        : reward?.duplicado
            ? `${objeto?.name} repetido: ${reward.valor} fichas`
            : reward?.tipo === 'xp' ? `+${reward.valor} XP` : `+${reward?.valor} fichas`;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm select-none animate-in fade-in">
            <style>{`
                @keyframes cofreTiembla {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    15% { transform: translate(-4px, 2px) rotate(-3deg); }
                    30% { transform: translate(4px, -2px) rotate(3deg); }
                    45% { transform: translate(-4px, 0) rotate(-2deg); }
                    60% { transform: translate(4px, 2px) rotate(2deg); }
                    75% { transform: translate(-2px, -2px) rotate(-1deg); }
                }
                @keyframes cofreFlota { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes cofreSale { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
                .cofre-flota { animation: cofreFlota 1.6s ease-in-out infinite; }
                .cofre-tiembla { animation: cofreTiembla 0.35s linear infinite; }
                .cofre-sale { animation: cofreSale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
            `}</style>

            <div className="flex flex-col items-center relative px-6 w-full max-w-sm">
                {fase !== 'abierto' ? (
                    <>
                        <div
                            onClick={abrir}
                            className={`w-44 h-44 flex items-center justify-center cursor-pointer relative ${fase === 'cerrado' ? 'cofre-flota' : 'cofre-tiembla'}`}
                        >
                            <div className="absolute inset-4 halo opacity-40" style={{ background: rarezaCofre.color }} />
                            <div className="relative"><Icono icono={cofre.icono} /></div>
                        </div>
                        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: rarezaCofre.color }}>{cofre.nombre || 'Cofre'}</p>
                        <p className="mt-4 text-white/80 font-bold animate-pulse uppercase tracking-widest text-sm">
                            {fase === 'cerrado' ? 'Toca para abrir' : 'Abriendo…'}
                        </p>
                    </>
                ) : (
                    <div className="flex flex-col items-center cofre-sale w-full">
                        <div className="relative w-36 h-36 flex items-center justify-center mb-5">
                            <div className="absolute inset-0 halo opacity-50" style={{ background: color }} />
                            <div className="relative w-28 h-28 rounded-3xl flex items-center justify-center border" style={{ background: `${color}22`, borderColor: `${color}66` }}>
                                {reward?.tipo === 'objeto' || reward?.duplicado
                                    ? <Icono icono={objeto?.sprite || objeto?.icon} clase="text-6xl" />
                                    : reward?.tipo === 'xp'
                                        ? <Zap size={56} color={color} fill={color} />
                                        : <img src="/assets/icons/ficha.png" alt="" className="w-16 h-16 object-contain" />}
                            </div>
                        </div>

                        <h2 className="text-3xl font-black text-white uppercase tracking-tight not-italic text-center">{titulo}</h2>
                        <div className="mt-3 text-base font-black px-6 py-2.5 rounded-full border text-white text-center" style={{ background: `${color}22`, borderColor: `${color}66` }}>
                            {detalle}
                        </div>
                        {reward?.tipo === 'objeto' && (
                            <p className="mt-3 text-[11px] text-zinc-500 font-bold text-center">Ya está en tu inventario. Equípalo desde ahí.</p>
                        )}

                        <button
                            onClick={onClose}
                            className="mt-8 w-full py-4 bg-white text-black font-black rounded-2xl uppercase tracking-widest active:scale-95 transition-transform shadow-lg"
                        >
                            Recoger
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
