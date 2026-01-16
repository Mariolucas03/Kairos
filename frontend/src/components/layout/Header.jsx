import { Link } from 'react-router-dom';
import HealthWidget from './HealthWidget';

// --- DEFINICIÓN DE ANIMACIÓN CSS SUAVE ---
const customAnimationsStyle = `
  @keyframes smoothGradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .animate-smooth-gradient {
    background-size: 400% 400%;
    animation: smoothGradient 5s ease infinite;
  }
`;

// --- HELPER: COLORES DE NIVEL ---
const getLevelStyle = (level) => {
    // Nivel 100+ (Cromático Suave - Sin parpadeo)
    // Usamos un gradiente largo y la clase personalizada para moverlo suavemente
    if (level >= 100) return "bg-gradient-to-r from-red-500 via-purple-500 via-blue-500 via-green-500 to-red-500 text-white border-white/50 shadow-[0_0_10px_rgba(255,255,255,0.5)] animate-smooth-gradient";

    // Rangos normales
    if (level >= 90) return "bg-cyan-900/40 text-cyan-400 border-cyan-500/40 shadow-[0_0_8px_rgba(34,211,238,0.2)]";
    if (level >= 80) return "bg-pink-900/40 text-pink-400 border-pink-500/40";
    if (level >= 70) return "bg-purple-900/40 text-purple-400 border-purple-500/40";
    if (level >= 60) return "bg-red-900/40 text-red-400 border-red-500/40";
    if (level >= 50) return "bg-orange-900/40 text-orange-400 border-orange-500/40";
    if (level >= 40) return "bg-yellow-900/40 text-yellow-400 border-yellow-500/40";
    if (level >= 30) return "bg-emerald-900/40 text-emerald-400 border-emerald-500/40";
    if (level >= 20) return "bg-blue-900/40 text-blue-400 border-blue-500/40";
    if (level >= 10) return "bg-indigo-900/40 text-indigo-400 border-indigo-500/40";

    // Nivel 1-9 (Básico)
    return "bg-zinc-800 text-zinc-400 border-zinc-700";
};

export default function Header({ user, setUser }) {
    if (!user) return null;

    // --- DATOS ---
    const level = user.level || 1;
    const currentXP = user.currentXP || 0;
    const nextLevelXP = user.nextLevelXP || 100;
    const coins = user.coins || 0;
    const gameCoins = user.stats?.gameCoins ?? user.gameCoins ?? 0;
    const username = user.username || "Usuario";
    const userTitle = user.title || "Novato";

    const xpPercent = Math.min((currentXP / nextLevelXP) * 100, 100);

    // --- IMÁGENES ---
    const userAvatar = user.avatar;
    const userFrame = user.frame;
    const userPet = user.pet;

    const ICON_COINS = "/assets/icons/moneda.png";
    const ICON_CHIPS = "/assets/icons/ficha.png";

    // Lógica Borde Avatar
    const avatarBorderClass = userFrame ? 'border-transparent' : (userAvatar ? 'border-gold-500' : 'border-zinc-700');
    const avatarBgClass = userAvatar ? 'bg-transparent' : 'bg-zinc-900';

    // Estilo Nivel
    const levelClass = getLevelStyle(level);

    // Ajuste de fuente dinámico
    const getFontSize = (num) => {
        const str = num.toString();
        if (str.length > 6) return 'text-[9px]';
        if (str.length > 4) return 'text-[10px]';
        return 'text-xs';
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-zinc-800/50 safe-top pb-2 px-3 shadow-2xl select-none transition-all duration-300">
            {/* Inyectamos los estilos de la animación suave */}
            <style>{customAnimationsStyle}</style>

            <div className="max-w-4xl mx-auto flex justify-between items-center relative h-14 sm:h-16">

                {/* 1. IZQUIERDA: PERFIL */}
                <div className="flex items-center gap-3 group flex-1 min-w-0 mr-1">

                    {/* A. AVATAR */}
                    <Link to="/profile" className="relative flex-shrink-0 cursor-pointer active:scale-95 transition-transform overflow-visible">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center overflow-hidden border-2 ${avatarBgClass} ${avatarBorderClass}`}>
                            {userAvatar ? (
                                <img src={userAvatar} alt="Av" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-lg font-bold text-gold-400">{username.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        {userFrame && (
                            <img src={userFrame} alt="Frame" className="absolute -top-2.5 -left-2.5 sm:-top-3 sm:-left-3 w-[68px] h-[68px] sm:w-[80px] sm:h-[80px] max-w-none pointer-events-none z-10" />
                        )}
                        {userPet && (
                            <img src={userPet} alt="Pet" className="absolute -bottom-1 -right-2 w-6 h-6 sm:w-7 sm:h-7 object-contain z-30 drop-shadow-md filter" />
                        )}
                    </Link>

                    {/* B. INFO TEXTO */}
                    <div className="flex flex-col justify-center w-full max-w-[140px] sm:max-w-[220px]">
                        <span className="text-[9px] sm:text-[10px] text-gold-500/80 italic font-bold tracking-wider mb-0.5 truncate uppercase">
                            {userTitle}
                        </span>

                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-bold text-sm truncate leading-none">
                                {username}
                            </span>

                            {/* 🔥 CAJA DE NIVEL (Cromático Suave) */}
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wide leading-none ${levelClass}`}>
                                Lvl {level}
                            </span>
                        </div>

                        {/* Barra XP */}
                        <div className="relative w-full h-2.5 sm:h-3.5 bg-zinc-900 rounded-full border border-zinc-700 overflow-hidden shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all duration-500 ease-out"
                                style={{ width: `${xpPercent}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[8px] sm:text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                                    {currentXP}/{nextLevelXP} XP
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. DERECHA: PACK VIDA + ECONOMÍA */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="scale-90 sm:scale-100 origin-right">
                        <HealthWidget user={user} setUser={setUser} />
                    </div>

                    <div className="flex flex-col gap-1.5 w-auto items-end">
                        {/* Botón Monedas */}
                        <Link
                            to="/shop"
                            state={{ openCategory: 'reward' }}
                            className="relative flex items-center bg-zinc-900/90 border border-gold-500/30 hover:border-gold-500/80 rounded-lg h-6 min-w-[64px] w-auto px-2 shadow-md overflow-hidden transition-all active:scale-95 group"
                        >
                            <span className={`relative z-10 text-gold-400 font-black w-full text-right pr-5 ${getFontSize(coins)}`}>
                                {coins > 99999 ? (coins / 1000).toFixed(0) + 'k' : coins.toLocaleString()}
                            </span>
                            <img
                                src={ICON_COINS}
                                alt="C"
                                className="absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 object-contain opacity-100 group-hover:scale-110 transition-all"
                            />
                        </Link>

                        {/* Botón Fichas */}
                        <Link
                            to="/games"
                            className="relative flex items-center bg-zinc-900/90 border border-purple-500/30 hover:border-purple-500/80 rounded-lg h-6 min-w-[64px] w-auto px-2 shadow-md overflow-hidden transition-all active:scale-95 group"
                        >
                            <span className={`relative z-10 text-purple-300 font-black w-full text-right pr-5 ${getFontSize(gameCoins)}`}>
                                {gameCoins > 99999 ? (gameCoins / 1000).toFixed(0) + 'k' : gameCoins.toLocaleString()}
                            </span>
                            <img
                                src={ICON_CHIPS}
                                alt="F"
                                className="absolute right-1 top-1/2 transform -translate-y-1/2 w-4 h-4 object-contain opacity-100 group-hover:scale-110 transition-all"
                            />
                        </Link>
                    </div>
                </div>

            </div>
        </header>
    );
}