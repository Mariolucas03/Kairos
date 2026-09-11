import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { CircleDollarSign, Ticket, Disc, Spade, Zap, Dices, Building2, Lock, ArrowRight, Swords, Club } from 'lucide-react';
import api from '../services/api';
import WidgetCard, { WidgetBar } from '../components/common/WidgetCard';
import { useAuthStore } from '../store/useAuthStore';
import { crearSintetizador, haySonidoJuegos } from '../utils/sintetizador';

const fetcher = (url) => api.get(url).then(res => res.data);

/**
 * EL CASINO.
 *
 * ⚠️ ANTES ERA UNA LISTA DE TARJETAS GRISES LLAMADA "ARCADE".
 *
 * Correcta y sobria, igual que los widgets del Home. Pero entrar en un casino
 * no es abrir un menu: es la marquesina con las bombillas, el fieltro de las
 * mesas, los letreros de neon de cada maquina y la caja donde estan tus
 * fichas. Eso es lo que hay aqui ahora, sin salirse del negro de la app: la
 * luz la ponen los acentos, no el fondo.
 *
 * Los juegos siguen separados por CONTRA QUIEN se juega, que es la unica
 * diferencia que importa antes de entrar: en las MESAS hay alguien esperando
 * al otro lado y lo que pierdes lo gana un amigo; en las MAQUINAS juegas solo
 * contra la casa.
 */
const MESAS = [
    { id: 'poker', name: 'Póquer', desc: "Texas Hold'em con amigos", accent: '#2f8f5b', Icon: Club },
    { id: 'carta-alta', name: 'Carta Alta', desc: 'La más alta se lo lleva', accent: '#c9822b', Icon: Swords }
];

const MAQUINAS = [
    { id: 'roulette', name: 'Ruleta', desc: 'Europea, un solo cero', accent: '#ef4444', Icon: Disc },
    { id: 'blackjack', name: 'Blackjack', desc: 'Paga 3 a 2', accent: '#22c55e', Icon: Spade },
    { id: 'slots', name: 'Neon Slots', desc: 'Cuatro rodillos', accent: '#d946ef', Icon: Zap },
    { id: 'dice', name: 'Dados', desc: 'Menos de 7, 7, más de 7', accent: '#3b82f6', Icon: Dices },
    { id: 'scratch', name: 'Rasca', desc: 'Rasca con el dedo', accent: '#a855f7', Icon: Ticket },
    { id: 'tower', name: 'La Torre', desc: 'Sube o piérdelo', accent: '#10b981', Icon: Building2 },
    { id: 'fortune-wheel', name: 'Fortuna', desc: 'Siete ruedas', accent: '#eab308', Icon: CircleDollarSign }
];

/**
 * LA MARQUESINA: bombillas que se persiguen por el borde, como las de la
 * rueda de la fortuna. Tres fases de encendido repartidas por posicion; cada
 * bombilla tarda lo mismo pero arranca en otro punto, y eso es lo que hace
 * que la luz "corra".
 */
const Bombillas = ({ cuantas = 22 }) => (
    <div className="flex justify-between px-1" aria-hidden="true">
        {Array.from({ length: cuantas }, (_, i) => (
            <span
                key={i}
                className="casino-bombilla"
                style={{ animationDelay: `${(i % 3) * 0.33}s` }}
            />
        ))}
    </div>
);

/**
 * Una maquina o una mesa. El fieltro es un radial del acento sobre negro; el
 * nombre es un letrero de neon (el texto con su halo); y el cristal, un brillo
 * diagonal fijo por encima.
 */
const TarjetaJuego = ({ id, name, desc, accent, Icon, alta = false }) => (
    <Link to={`/games/${id}`} className="block">
        <div
            className={`relative overflow-hidden rounded-3xl border active:scale-[0.985] transition-transform ${alta ? 'h-[150px]' : 'h-[136px]'}`}
            style={{
                background: `radial-gradient(ellipse at 30% 0%, ${accent}33 0%, ${accent}14 35%, #0a0a0c 75%)`,
                borderColor: `${accent}40`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 26px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.6)`
            }}
        >
            {/* El cristal */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 30%, transparent 50%)' }} />
            {/* El icono grande, como el simbolo pintado en la maquina */}
            <Icon size={alta ? 64 : 56} className="absolute -right-2 -bottom-2 opacity-[0.10]" style={{ color: accent }} />

            <div className="relative z-10 h-full p-4 flex flex-col justify-between">
                <div className="w-10 h-10 rounded-xl bg-black/60 border flex items-center justify-center" style={{ borderColor: `${accent}55`, color: accent, boxShadow: `0 0 14px ${accent}55` }}>
                    <Icon size={20} />
                </div>
                <div>
                    {/* El letrero de neon: el nombre con su halo del mismo color */}
                    <p
                        className="text-[15px] font-black uppercase tracking-tight leading-none not-italic"
                        style={{ color: '#fff', textShadow: `0 0 8px ${accent}, 0 0 18px ${accent}88` }}
                    >
                        {name}
                    </p>
                    <p className="mt-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wide leading-none">{desc}</p>
                </div>
            </div>
        </div>
    </Link>
);

const Grupo = ({ titulo, pie, juegos, alta }) => (
    <section className="mb-7">
        <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[11px] font-black text-yellow-500/90 uppercase tracking-[0.22em] not-italic">{titulo}</h2>
            <span className="h-px flex-1 bg-gradient-to-r from-yellow-500/30 to-transparent" />
        </div>
        <p className="text-[10px] text-zinc-600 -mt-2 mb-3 leading-tight">{pie}</p>
        <div className="grid grid-cols-2 gap-3">
            {juegos.map(j => <TarjetaJuego key={j.id} {...j} alta={alta} />)}
        </div>
    </section>
);

const ACENTO_BLOQUEO = '#f43f5e';

export default function Games() {
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const fichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;

    // --- LÓGICA DE BLOQUEO ---
    // 🔥 Antes leía `user.dailyMissions`, un campo que NO existe en el backend:
    // la lista salía siempre vacía, el progreso se calculaba como 100% y el
    // arcade estaba SIEMPRE desbloqueado (la pantalla de bloqueo era inalcanzable).
    // La fuente real del progreso diario es missionStats del log del día.
    const { data: daily } = useSWR('/daily', fetcher);

    const completedMissions = daily?.missionStats?.completed || 0;
    const totalMissions = daily?.missionStats?.total || 0;

    // Sin misiones creadas no tiene sentido bloquear: se considera desbloqueado
    const progress = totalMissions > 0 ? (completedMissions / totalMissions) : 1;
    const isLocked = progress < 0.75;

    const percentage = Math.round(progress * 100);

    // Al entrar, dos notas de bienvenida: la campanilla de la puerta. Solo si
    // el casino esta abierto y el sonido encendido. Se llega aqui con un toque
    // en el menu, que es el gesto que el navegador exige para sonar.
    const sonado = useRef(false);
    useEffect(() => {
        if (isLocked || sonado.current || !haySonidoJuegos()) return;
        sonado.current = true;
        const s = crearSintetizador();
        s.nota({ frecuencia: 1047, duracion: 0.35, volumen: 0.10 });
        s.nota({ frecuencia: 1319, duracion: 0.5, volumen: 0.10, retraso: 0.12 });
        const id = setTimeout(s.parar, 1500);
        return () => clearTimeout(id);
    }, [isLocked]);

    // --- VISTA BLOQUEADA ---
    if (isLocked) {
        return (
            <div className="min-h-full flex items-center justify-center py-10 animate-in fade-in">
                <WidgetCard accent={ACENTO_BLOQUEO} className="w-full max-w-sm" padding="p-7">
                    <div className="relative z-10 flex flex-col items-center text-center gap-5">
                        <div
                            className="w-16 h-16 rounded-full bg-[#18181b] border border-white/[0.07] flex items-center justify-center"
                            style={{ color: ACENTO_BLOQUEO }}
                        >
                            <Lock size={28} />
                        </div>

                        <div>
                            <h2 className="text-[22px] font-black text-white uppercase tracking-[-0.045em] leading-none not-italic">
                                Casino cerrado
                            </h2>
                            <p className="text-[12px] text-zinc-500 leading-snug mt-2">
                                Abre al completar el <span className="text-zinc-200 font-bold">75%</span> de tus misiones del día.
                            </p>
                        </div>

                        <div className="w-full">
                            {/* La marca del 75% va sobre la barra: sin ella el número
                                de la izquierda no dice si estás cerca o lejos. */}
                            <div className="relative">
                                <WidgetBar percent={percentage} accent={ACENTO_BLOQUEO} />
                                <div className="absolute top-0 bottom-0 left-[75%] w-px bg-white/40" />
                            </div>
                            <div className="flex justify-between mt-2 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                <span>
                                    <span className="text-zinc-300">{percentage}%</span> · {completedMissions}/{totalMissions}
                                </span>
                                <span>Meta 75%</span>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/missions')}
                            className="w-full py-3.5 bg-white text-black font-black rounded-2xl uppercase text-xs tracking-[0.12em] active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            Ver misiones <ArrowRight size={16} />
                        </button>
                    </div>
                </WidgetCard>
            </div>
        );
    }

    // --- EL CASINO ---
    return (
        <div className="animate-in fade-in pb-6 relative">
            <style>{`
                @keyframes casinoBombilla {
                    0%, 100% { opacity: 0.25; box-shadow: 0 0 0 rgba(253,224,71,0); }
                    50%      { opacity: 1;    box-shadow: 0 0 8px rgba(253,224,71,0.9); }
                }
                .casino-bombilla {
                    width: 5px; height: 5px; border-radius: 9999px;
                    background: #fde047;
                    animation: casinoBombilla 1s ease-in-out infinite;
                }
                @media (prefers-reduced-motion: reduce) { .casino-bombilla { animation: none; opacity: 0.8; } }
            `}</style>

            {/* El foco de la entrada: una luz calida que cae desde arriba */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[120%] h-64 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(234,179,8,0.14) 0%, rgba(234,179,8,0.04) 40%, transparent 70%)' }} />

            {/* LA MARQUESINA */}
            <div
                className="relative rounded-3xl border border-yellow-500/30 px-4 pt-2 pb-2 mb-5 overflow-hidden"
                style={{
                    background: 'linear-gradient(180deg, #2a1206 0%, #150903 60%, #0a0a0c 100%)',
                    boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6), 0 0 30px rgba(234,179,8,0.12), 0 16px 34px rgba(0,0,0,0.6)'
                }}
            >
                <Bombillas />
                <div className="py-3 text-center">
                    <p className="text-[9px] font-black text-yellow-500/70 uppercase tracking-[0.35em] leading-none not-italic">
                        Bienvenido al
                    </p>
                    <h1
                        className="mt-2 text-[34px] font-black text-yellow-400 uppercase tracking-[-0.03em] leading-none not-italic"
                        style={{ textShadow: '0 0 10px rgba(253,224,71,0.8), 0 0 30px rgba(234,179,8,0.5), 0 2px 0 #7a5a00' }}
                    >
                        Casino
                    </h1>
                    <p className="mt-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        {totalMissions > 0 ? `${completedMissions}/${totalMissions} misiones hechas` : 'Abierto'}
                    </p>
                </div>
                <Bombillas />
            </div>

            {/* LA CAJA: tus fichas, como en la ventanilla de un casino */}
            <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-[#0a0a0c] px-4 py-3 mb-6">
                <div>
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none">En caja</p>
                    <p className="mt-1.5 text-[22px] font-black text-yellow-400 tabular-nums leading-none">
                        {fichas.toLocaleString('es-ES')}
                    </p>
                </div>
                <div className="flex -space-x-2">
                    {/* Un montoncito de fichas, decorativo */}
                    {[0, 1, 2].map(i => (
                        <img key={i} src="/assets/icons/ficha.png" alt="" className="w-8 h-8 object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,0.8)]" style={{ transform: `translateY(${-i * 3}px)` }} />
                    ))}
                </div>
            </div>

            <Grupo
                titulo="Mesas"
                pie="Hay alguien al otro lado. Lo que pierdes, lo gana él."
                juegos={MESAS}
                alta
            />

            <Grupo
                titulo="Máquinas"
                pie="Tú contra la casa, cuando te apetezca."
                juegos={MAQUINAS}
            />
        </div>
    );
}
