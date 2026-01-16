import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { CircleDollarSign, Ticket, Disc, Spade, Zap, Dices, Lock, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Games() {
    const { user } = useOutletContext();
    const navigate = useNavigate();

    // --- LÓGICA DE BLOQUEO ---
    const missions = user?.dailyMissions || [];
    const totalMissions = missions.length;
    const completedMissions = missions.filter(m => m.completed).length;

    // Si no hay misiones (0), consideramos que está desbloqueado
    const progress = totalMissions > 0 ? (completedMissions / totalMissions) : 1;
    const isLocked = progress < 0.75;

    const percentage = Math.round(progress * 100);

    const gamesList = [
        {
            id: 'roulette',
            name: 'Ruleta',
            desc: 'Casino Royal',
            icon: <Disc size={32} className="text-red-400" />,
            color: 'from-red-900/40 to-black border-red-500/30',
            glow: 'shadow-red-500/20'
        },
        {
            id: 'blackjack',
            name: 'Blackjack',
            desc: 'Suma 21',
            icon: <Spade size={32} className="text-green-400" />,
            color: 'from-green-900/40 to-black border-green-500/30',
            glow: 'shadow-green-500/20'
        },
        {
            id: 'slots',
            name: 'Neon Slots',
            desc: 'Jackpot',
            icon: <Zap size={32} className="text-fuchsia-400" />,
            color: 'from-fuchsia-900/40 to-black border-fuchsia-500/30',
            glow: 'shadow-fuchsia-500/20'
        },
        {
            id: 'dice',
            name: 'Dados',
            desc: 'High / Low',
            icon: <Dices size={32} className="text-blue-400" />,
            color: 'from-blue-900/40 to-black border-blue-500/30',
            glow: 'shadow-blue-500/20'
        },
        {
            id: 'scratch',
            name: 'Rasca',
            desc: 'Premio Rápido',
            icon: <Ticket size={32} className="text-purple-400" />,
            color: 'from-purple-900/40 to-black border-purple-500/30',
            glow: 'shadow-purple-500/20'
        },
        {
            id: 'fortune-wheel',
            name: 'Fortuna',
            desc: 'Giro Diario',
            icon: <CircleDollarSign size={32} className="text-yellow-400" />,
            color: 'from-yellow-900/40 to-black border-yellow-500/30',
            glow: 'shadow-yellow-500/20'
        }
    ];

    // --- VISTA BLOQUEADA ---
    if (isLocked) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 select-none pt-20">
                <div className="w-full max-w-sm bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col items-center gap-6">
                        <div className="w-20 h-20 bg-zinc-950 rounded-full border-2 border-red-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                            <Lock size={40} className="text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">ARCADE BLOQUEADO</h2>
                            <p className="text-sm text-zinc-400 leading-relaxed">Completa el <strong className="text-white">75%</strong> de tus misiones.</p>
                        </div>
                        <div className="w-full bg-zinc-800 h-4 rounded-full overflow-hidden border border-white/5 relative">
                            <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }} />
                            <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-white/50 z-20"></div>
                        </div>
                        <div className="flex justify-between w-full text-xs font-bold text-zinc-500 px-1 uppercase tracking-wider">
                            <span>Progreso: {percentage}%</span>
                            <span>Meta: 75%</span>
                        </div>
                        <button onClick={() => navigate('/missions')} className="w-full py-4 bg-white text-black font-black rounded-xl uppercase tracking-widest shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                            Ver Misiones <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- VISTA DESBLOQUEADA (FIJA) ---
    return (
        // 🔥 CAMBIO CLAVE: pt-40 para bajar todo el contenido y que no se pegue al header
        <div className="fixed inset-0 bg-black flex flex-col pt-32 pb-20 overflow-hidden font-sans select-none">

            {/* CABECERA COMPACTA */}
            <div className="px-6 mb-4 shrink-0 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500 italic uppercase tracking-tighter">
                        ARCADE
                    </h1>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-green-500" /> Zona Desbloqueada
                    </p>
                </div>
            </div>

            {/* GRID DE JUEGOS (2 COLUMNAS) */}
            <div className="flex-1 px-4 pb-4">
                <div className="grid grid-cols-2 gap-3 h-full max-w-md mx-auto content-start">
                    {gamesList.map((game) => (
                        <Link
                            key={game.id}
                            to={`/games/${game.id}`}
                            className={`
                                relative p-[1px] rounded-2xl bg-gradient-to-b ${game.color} 
                                transition-all duration-200 active:scale-95 group h-full max-h-[140px]
                            `}
                        >
                            <div className="bg-black/90 backdrop-blur-md rounded-2xl h-full w-full flex flex-col items-center justify-center gap-3 relative overflow-hidden border border-white/5 p-2">

                                {/* Brillo Superior */}
                                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

                                {/* Icono */}
                                <div className={`p-3 rounded-full bg-zinc-900 border border-white/5 shadow-lg ${game.glow} group-hover:scale-110 transition-transform duration-300`}>
                                    {game.icon}
                                </div>

                                {/* Texto */}
                                <div className="text-center z-10">
                                    <h3 className="text-white font-black text-sm uppercase italic tracking-tighter leading-none mb-1">
                                        {game.name}
                                    </h3>
                                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wide">{game.desc}</p>
                                </div>

                                {/* Decoración Fondo */}
                                <div className="absolute -right-2 -bottom-2 opacity-5 rotate-12 scale-150 pointer-events-none grayscale group-hover:grayscale-0 transition-all duration-500">
                                    {game.icon}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}