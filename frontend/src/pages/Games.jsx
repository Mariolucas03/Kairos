import { Link, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { CircleDollarSign, Ticket, Disc, Spade, Zap, Dices, Building2, Lock, ArrowRight, Swords } from 'lucide-react';
import api from '../services/api';
import WidgetCard, { WidgetLabel, WidgetBar } from '../components/common/WidgetCard';

const fetcher = (url) => api.get(url).then(res => res.data);

/**
 * Un tono por juego, igual que los widgets del Home tienen un tono por métrica.
 *
 * Antes cada tarjeta era un degradado de dos colores con borde encendido, halo
 * de color y el icono repetido de fondo al 5%: siete juegos gritando a la vez.
 * Ahora el color se reduce a la línea de acento de 2px y al icono, y la tarjeta
 * es la misma superficie que el resto de la app.
 */
/**
 * Los juegos, separados por CONTRA QUIÉN se juega.
 *
 * No es un adorno: es la única diferencia que importa antes de entrar. En los de
 * arriba hay alguien esperando al otro lado y lo que pierdes lo gana un amigo;
 * en los de abajo juegas solo contra la casa. Mezclados, "Carta Alta" parecía
 * otra tragaperras.
 */
const MULTIJUGADOR = [
    { id: 'carta-alta', name: 'Carta Alta', desc: 'Sala con amigos', accent: '#c9822b', Icon: Swords }
];

const CONTRA_LA_MAQUINA = [
    { id: 'roulette', name: 'Ruleta', desc: 'Casino Royal', accent: '#ef4444', Icon: Disc },
    { id: 'blackjack', name: 'Blackjack', desc: 'Suma 21', accent: '#22c55e', Icon: Spade },
    { id: 'slots', name: 'Neon Slots', desc: 'Jackpot', accent: '#d946ef', Icon: Zap },
    { id: 'dice', name: 'Dados', desc: 'High / Low', accent: '#3b82f6', Icon: Dices },
    { id: 'scratch', name: 'Rasca', desc: 'Premio rápido', accent: '#a855f7', Icon: Ticket },
    { id: 'tower', name: 'La Torre', desc: 'Sube o piérdelo', accent: '#10b981', Icon: Building2 },
    { id: 'fortune-wheel', name: 'Fortuna', desc: 'Giro diario', accent: '#eab308', Icon: CircleDollarSign }
];

const TarjetaJuego = ({ id, name, desc, accent, Icon }) => (
    <Link to={`/games/${id}`} className="block">
        <WidgetCard accent={accent} padding="p-4" className="h-[132px] active:scale-[0.985]">
            <div className="relative z-10 h-full flex flex-col justify-between">
                <Icon size={26} style={{ color: accent }} />
                <div>
                    <WidgetLabel>{name}</WidgetLabel>
                    <p className="mt-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wide leading-none">
                        {desc}
                    </p>
                </div>
            </div>
        </WidgetCard>
    </Link>
);

const Grupo = ({ titulo, pie, juegos }) => (
    <section className="mb-7">
        <div className="mb-3">
            <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.16em] not-italic">{titulo}</h2>
            <p className="text-[10px] text-zinc-600 mt-1 leading-tight">{pie}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
            {juegos.map(j => <TarjetaJuego key={j.id} {...j} />)}
        </div>
    </section>
);

const ACENTO_BLOQUEO = '#f43f5e';

export default function Games() {
    const navigate = useNavigate();

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
                                Arcade bloqueado
                            </h2>
                            <p className="text-[12px] text-zinc-500 leading-snug mt-2">
                                Completa el <span className="text-zinc-200 font-bold">75%</span> de tus misiones del día.
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

    // --- VISTA DESBLOQUEADA ---
    return (
        <div className="animate-in fade-in pb-6">
            {/* Misma cabecera que Misiones: sobretítulo diminuto + título grande */}
            <div className="mb-4">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none not-italic">
                    {totalMissions > 0 ? `${completedMissions}/${totalMissions} misiones hechas` : 'Zona desbloqueada'}
                </p>
                <h1 className="mt-[9px] text-[26px] font-black text-white uppercase tracking-[-0.045em] leading-none not-italic">
                    Arcade
                </h1>
            </div>

            <Grupo
                titulo="Con amigos"
                pie="Hay alguien al otro lado. Lo que pierdes, lo gana él."
                juegos={MULTIJUGADOR}
            />

            <Grupo
                titulo="Contra la máquina"
                pie="Tú contra la casa, cuando te apetezca."
                juegos={CONTRA_LA_MAQUINA}
            />
        </div>
    );
}
