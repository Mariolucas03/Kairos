import { useEffect, useState } from 'react';
import { Heart, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * ¡HAS SUBIDO DE NIVEL!
 *
 * ⚠️ ANTES NO PASABA NADA.
 *
 * El servidor devolvía `leveledUp` desde siempre y en el móvil no lo miraba
 * nadie: subías de nivel, te restauraba la vida por dentro, y ni un aviso. El
 * momento más gordo de un juego de niveles ocurría en absoluto silencio.
 *
 * Se dispara desde el store —ahí se compara el nivel del usuario nuevo con el
 * del anterior— así que salta igual venga de un entreno, de una misión, de la
 * comida o de la ruleta, sin tener que acordarse en cada pantalla.
 *
 * ⚠️ LA ANIMACION NO USA NINGUNA LIBRERIA.
 *
 * Son cuatro `@keyframes` en un `<style>` de este mismo fichero. Meter una
 * dependencia de animación para una pantalla que sale una vez cada varios días
 * engordaría el bundle que se descarga SIEMPRE, y este proyecto ya arrastra
 * avisos de "chunks mayores de 500 kB".
 */

// Los rayos de luz de detrás. Se calculan una vez y no cambian: recalcularlos
// en cada pintado los haría temblar.
const RAYOS = Array.from({ length: 12 }, (_, i) => ({
    angulo: i * 30,
    retraso: (i % 4) * 0.08
}));

const CHISPAS = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    izquierda: 4 + Math.random() * 92,
    retraso: Math.random() * 0.9,
    duracion: 1.4 + Math.random() * 1.2,
    tamaño: 4 + Math.random() * 7
}));

export default function SubidaDeNivel() {
    const subida = useAuthStore(s => s.subidaDeNivel);
    const cerrar = useAuthStore(s => s.cerrarSubidaDeNivel);

    // El número cuenta desde el nivel viejo hasta el nuevo. Es el detalle que
    // convierte "pone 12" en "he subido": se ve el salto, no el resultado.
    const [numero, setNumero] = useState(null);

    useEffect(() => {
        if (!subida) { setNumero(null); return; }

        setNumero(subida.de);
        const id = setTimeout(() => setNumero(subida.a), 550);
        return () => clearTimeout(id);
    }, [subida]);

    // Se cierra con Escape además de con el botón: en el navegador de escritorio
    // es lo que uno hace sin pensar.
    useEffect(() => {
        if (!subida) return;
        const alPulsar = (e) => { if (e.key === 'Escape') cerrar(); };
        window.addEventListener('keydown', alPulsar);
        return () => window.removeEventListener('keydown', alPulsar);
    }, [subida, cerrar]);

    if (!subida) return null;

    const premio = subida.premio;

    return (
        <div
            className="fixed inset-0 z-[9000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={cerrar}
            role="dialog"
            aria-label={`Has subido al nivel ${subida.a}`}
        >
            <style>{`
                @keyframes kairosRayo {
                    0%   { opacity: 0; transform: rotate(var(--a)) scaleY(0.2); }
                    45%  { opacity: 0.85; }
                    100% { opacity: 0.25; transform: rotate(var(--a)) scaleY(1); }
                }
                @keyframes kairosGiro { to { transform: rotate(360deg); } }
                @keyframes kairosGolpe {
                    0%   { transform: scale(0.3); opacity: 0; }
                    55%  { transform: scale(1.18); opacity: 1; }
                    75%  { transform: scale(0.94); }
                    100% { transform: scale(1); }
                }
                @keyframes kairosChispa {
                    0%   { transform: translateY(0) scale(1); opacity: 0; }
                    15%  { opacity: 1; }
                    100% { transform: translateY(-88vh) scale(0.3); opacity: 0; }
                }
                @keyframes kairosEntraAbajo {
                    from { transform: translateY(14px); opacity: 0; }
                    to   { transform: translateY(0); opacity: 1; }
                }
                /* Quien haya pedido menos movimiento en su móvil no tiene por
                   qué comerse doce rayos girando. Se le deja lo que se lee. */
                @media (prefers-reduced-motion: reduce) {
                    .kairos-anim, .kairos-anim * { animation: none !important; }
                }
            `}</style>

            {/* Las chispas suben por toda la pantalla, por detrás de la tarjeta */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none kairos-anim">
                {CHISPAS.map(c => (
                    <span
                        key={c.id}
                        className="absolute bottom-0 rounded-full bg-yellow-400"
                        style={{
                            left: `${c.izquierda}%`,
                            width: c.tamaño,
                            height: c.tamaño,
                            filter: 'blur(0.5px)',
                            boxShadow: '0 0 12px #eab308',
                            animation: `kairosChispa ${c.duracion}s ease-out ${c.retraso}s infinite`
                        }}
                    />
                ))}
            </div>

            <div
                className="relative w-full max-w-sm text-center kairos-anim"
                onClick={(e) => e.stopPropagation()}
            >
                {/* El sol de rayos */}
                <div
                    className="absolute left-1/2 top-[92px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ width: 320, height: 320, animation: 'kairosGiro 24s linear infinite' }}
                >
                    {RAYOS.map(r => (
                        <span
                            key={r.angulo}
                            className="absolute left-1/2 top-0 origin-bottom"
                            style={{
                                '--a': `${r.angulo}deg`,
                                width: 3,
                                height: '50%',
                                marginLeft: -1.5,
                                background: 'linear-gradient(to top, transparent, #eab308)',
                                animation: `kairosRayo 1.1s ease-out ${r.retraso}s both`
                            }}
                        />
                    ))}
                </div>

                <p className="relative text-[11px] font-black text-yellow-500 uppercase tracking-[0.35em] not-italic mb-4">
                    Has subido de nivel
                </p>

                {/* EL NÚMERO. Sale con un golpe y cambia del viejo al nuevo. */}
                <div
                    className="relative mx-auto w-[150px] h-[150px] rounded-full flex items-center justify-center mb-6"
                    style={{
                        background: 'radial-gradient(circle at 50% 35%, rgba(234,179,8,0.28), rgba(0,0,0,0.9))',
                        border: '2px solid rgba(234,179,8,0.55)',
                        boxShadow: '0 0 60px rgba(234,179,8,0.35), inset 0 0 40px rgba(234,179,8,0.15)',
                        animation: 'kairosGolpe 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both'
                    }}
                >
                    <span
                        key={numero}
                        className="text-[64px] font-black text-white leading-none tabular-nums not-italic"
                        style={{
                            textShadow: '0 0 30px rgba(234,179,8,0.9)',
                            animation: numero === subida.a ? 'kairosGolpe 0.5s ease-out both' : undefined
                        }}
                    >
                        {numero ?? subida.a}
                    </span>
                </div>

                {/* LO QUE TE LLEVAS */}
                <div
                    className="bg-[#0a0a0c] border border-white/[0.07] rounded-2xl p-4 space-y-2.5"
                    style={{ animation: 'kairosEntraAbajo 0.5s ease-out 0.45s both' }}
                >
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                        <Heart size={15} fill="currentColor" />
                        <span className="text-[12px] font-black uppercase tracking-tight not-italic">
                            Vida al máximo
                        </span>
                    </div>

                    {premio && (
                        <div className="flex items-center justify-center gap-5 pt-1">
                            <div className="flex items-center gap-1.5">
                                <img src="/assets/icons/moneda.png" alt="" className="w-5 h-5 object-contain" />
                                <span className="text-[15px] font-black text-white tabular-nums">
                                    +{premio.monedas}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <img src="/assets/icons/ficha.png" alt="" className="w-5 h-5 object-contain" />
                                <span className="text-[15px] font-black text-yellow-500 tabular-nums">
                                    +{premio.fichas}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={cerrar}
                    className="mt-5 w-full bg-yellow-500 text-black font-black py-3.5 rounded-2xl uppercase tracking-widest text-sm active:scale-95 transition-transform border-b-4 border-yellow-700"
                    style={{ animation: 'kairosEntraAbajo 0.5s ease-out 0.6s both' }}
                >
                    Seguir
                </button>

                <button
                    type="button"
                    onClick={cerrar}
                    aria-label="Cerrar"
                    className="absolute -top-2 -right-1 w-9 h-9 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
