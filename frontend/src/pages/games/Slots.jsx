import { useState, useRef, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft, Zap, Cherry, Gem, Star, Crown, Clover, Info, X, Skull, Ghost } from 'lucide-react';
import api from '../../services/api';

// --- IMAGEN DE PORTADA ---
const SLOT_COVER_IMG = '/assets/images/neon-cover.png';

// --- LLUVIA DE FICHAS ---
const ChipRain = ({ isFading }) => {
    const [drops] = useState(() => Array.from({ length: 150 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        startTop: -(Math.random() * 100 + 10),
        delay: Math.random() * 0.5,
        duration: 1 + Math.random(),
        size: 15 + Math.random() * 40,
        opacity: 0.4 + Math.random() * 0.6
    })));

    return (
        <div className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-1000 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
            <style>{`@keyframes slotFall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(120vh) rotate(360deg); } }`}</style>
            {drops.map((d) => (
                <img key={d.id} src="/assets/icons/ficha.png" className="absolute will-change-transform"
                    style={{ left: `${d.left}%`, top: `${d.startTop}vh`, width: `${d.size}px`, opacity: d.opacity, animation: `slotFall ${d.duration}s linear ${d.delay}s infinite` }} alt="" />
            ))}
        </div>
    );
};

// --- ICONOS PARA EL FRONTEND ---
const ICONS = {
    cherry: <Cherry size={32} className="text-red-500" />,
    clover: <Clover size={32} className="text-green-500" />,
    zap: <Zap size={32} className="text-yellow-400" />,
    star: <Star size={32} className="text-purple-400" />,
    gem: <Gem size={32} className="text-cyan-400" />,
    crown: <Crown size={32} className="text-yellow-600" />,
    skull: <Skull size={32} className="text-zinc-600" />,
    ghost: <Ghost size={32} className="text-zinc-500" />
};

// --- VISUALES DE PAGO (Solo para Info Modal) ---
const PAYTABLE = [
    { id: 'crown', icon: <Crown size={24} className="text-yellow-600" />, val: 50 },
    { id: 'gem', icon: <Gem size={24} className="text-cyan-400" />, val: 20 },
    { id: 'star', icon: <Star size={24} className="text-purple-400" />, val: 10 },
    { id: 'zap', icon: <Zap size={24} className="text-yellow-400" />, val: 5 },
    { id: 'clover', icon: <Clover size={24} className="text-green-500" />, val: 3 },
    { id: 'cherry', icon: <Cherry size={24} className="text-red-500" />, val: 1.5 },
];

export default function Slots() {
    const { user, setUser, setIsUiHidden } = useOutletContext();
    const navigate = useNavigate();

    // Saldo
    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const [visualBalance, setVisualBalance] = useState(currentFichas);

    useEffect(() => { setVisualBalance(currentFichas); }, [currentFichas]);

    // Estados Juego
    const [gameStarted, setGameStarted] = useState(false);
    const [bet, setBet] = useState(20);
    // Grid inicial visual para que no esté vacío
    const [cols, setCols] = useState(Array(4).fill(Array(4).fill({ id: 'cherry' })));

    // Control de Animación
    const [spinningCols, setSpinningCols] = useState([false, false, false, false]);
    const spinningRef = useRef([false, false, false, false]);
    const finalGridRef = useRef(null);
    const animationRef = useRef(null);

    const [isGameActive, setIsGameActive] = useState(false);

    // RESULTADO
    const [result, setResult] = useState({ won: false, payout: 0, winningCells: [] });
    const [msg, setMsg] = useState("¡Consigue 3 en línea!");

    // UI
    const [showInfo, setShowInfo] = useState(false);
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);

    useEffect(() => {
        setIsUiHidden(true);
        return () => setIsUiHidden(false);
    }, [setIsUiHidden]);

    // Función auxiliar para obtener columnas aleatorias durante la animación visual
    const getRandomCol = () => Array(4).fill(null).map(() => {
        const keys = Object.keys(ICONS);
        return { id: keys[Math.floor(Math.random() * keys.length)] };
    });

    // --- JUGAR (CONEXIÓN AL BACKEND) ---
    const handleSpin = async () => {
        if (!gameStarted) { setGameStarted(true); return; }
        if (isGameActive) return;
        if (visualBalance < bet) { alert("Faltan fichas"); return; }

        // 1. Cobrar visualmente al instante
        setVisualBalance(prev => prev - bet);
        setIsGameActive(true);
        setSpinningCols([true, true, true, true]);
        spinningRef.current = [true, true, true, true];
        setMsg("Girando...");
        setResult({ won: false, payout: 0, winningCells: [] });
        setShowRain(false);
        setIsRainFading(false);

        try {
            // 2. Pedir resultado al backend
            const res = await api.post('/games/slots', { bet });

            // 3. Guardamos la matriz ganadora que dice el backend
            finalGridRef.current = res.data.grid;

            // 4. Bucle Animación Visual Rápida
            animationRef.current = setInterval(() => {
                setCols(prevCols => prevCols.map((col, i) => {
                    if (!spinningRef.current[i]) return finalGridRef.current[i];
                    return getRandomCol();
                }));
            }, 50);

            // 5. Paradas Secuenciales
            setTimeout(() => stopColumn(0), 500);
            setTimeout(() => stopColumn(1), 1000);
            setTimeout(() => stopColumn(2), 1500);
            setTimeout(() => {
                clearInterval(animationRef.current);
                stopColumn(3);

                // Mostrar resultados del servidor
                setResult({
                    won: res.data.won,
                    payout: res.data.payout,
                    winningCells: res.data.winningCells
                });

                if (res.data.won) {
                    setMsg("¡PREMIO!");
                    setShowRain(true);
                    setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);
                } else {
                    setMsg("Inténtalo de nuevo");
                }

                // Sincronizar saldo final
                if (res.data.user) {
                    setUser(res.data.user);
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                    setVisualBalance(res.data.user.gameCoins ?? res.data.user.stats?.gameCoins ?? 0);
                }

                setIsGameActive(false);
            }, 2000);

        } catch (error) {
            console.error("Error en Slots:", error);
            alert(error.response?.data?.message || "Error al tirar");
            clearInterval(animationRef.current);
            setIsGameActive(false);
            setSpinningCols([false, false, false, false]);
            setVisualBalance(currentFichas); // Rollback
        }
    };

    const stopColumn = (index) => {
        spinningRef.current[index] = false;
        setSpinningCols(prev => { const next = [...prev]; next[index] = false; return next; });
        setCols(prev => {
            const next = [...prev];
            next[index] = finalGridRef.current[index];
            return next;
        });
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-32 pb-10 overflow-hidden select-none font-sans">
            {showRain && <ChipRain isFading={isRainFading} />}

            <style>{`
                .slot-spin { animation: slotScroll 0.1s linear infinite; }
                @keyframes slotScroll { 0% { transform: translateY(-5%); filter: blur(2px); } 50% { transform: translateY(5%); } 100% { transform: translateY(-5%); } }
            `}</style>

            {/* HEADER */}
            <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-50">
                <button onClick={() => navigate('/games')} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><ChevronLeft /></button>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-purple-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-purple-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <button onClick={() => setShowInfo(true)} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
            </div>

            {/* TÍTULO */}
            <div className="absolute top-28 w-full text-center z-10 pointer-events-none">
                <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-400 to-purple-600 drop-shadow-[0_0_15px_rgba(192,38,211,0.5)] tracking-wide leading-normal pb-1 pr-2">
                    NEON SLOTS
                </h1>
            </div>

            {/* MÁQUINA */}
            <div className="w-full max-w-sm px-4 relative z-10 flex flex-col items-center gap-4">
                <div className="w-full aspect-[4/3.5] bg-zinc-900 rounded-[2rem] border-[6px] border-zinc-800 shadow-2xl relative overflow-hidden ring-4 ring-purple-900/20">

                    {/* PORTADA LIMPIA */}
                    <div className={`absolute inset-0 z-50 bg-black flex flex-col items-center justify-center transition-transform duration-500 ${gameStarted ? '-translate-y-full' : 'translate-y-0'}`}>
                        <img src={SLOT_COVER_IMG} alt="Cover" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]"></div>
                    </div>

                    {/* GRID */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-900 to-black grid grid-cols-4 gap-1 p-2">
                        {cols.map((column, colIdx) => (
                            <div key={colIdx} className={`relative flex flex-col justify-around bg-white/5 rounded-lg overflow-hidden ${spinningCols[colIdx] ? 'slot-spin' : ''}`}>
                                <div className="absolute inset-0 shadow-[inset_0_0_10px_black] pointer-events-none z-10" />
                                {column.map((symbol, rowIdx) => {
                                    const isWinCell = result.won && result.winningCells && result.winningCells.includes(`${colIdx}-${rowIdx}`);
                                    return (
                                        <div key={rowIdx} className={`flex-1 flex items-center justify-center transition-all duration-300 ${isWinCell ? 'bg-yellow-500/30 shadow-[inset_0_0_20px_rgba(234,179,8,0.5)]' : ''}`}>
                                            <div className={`drop-shadow-md transform ${isWinCell ? 'scale-125 brightness-125' : 'scale-100'}`}>
                                                {ICONS[symbol.id]}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* CONTROLES */}
                <div className="w-full bg-zinc-900/80 backdrop-blur-md rounded-3xl border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
                    <div className="bg-black/60 rounded-xl py-3 border border-white/5 text-center h-12 flex items-center justify-center">
                        {result.won ? (
                            <span className="text-green-400 font-black text-xl animate-pulse">+{result.payout} FICHAS</span>
                        ) : (
                            <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest">{msg}</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="bg-black rounded-2xl flex items-center p-1 border border-zinc-800 shrink-0">
                            <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={isGameActive} className="w-12 h-12 bg-zinc-800 rounded-xl text-white font-bold hover:bg-zinc-700 disabled:opacity-50 active:scale-95 transition-transform">-</button>
                            <div className="min-w-[80px] flex items-center justify-center gap-1 font-black text-yellow-500 text-xl">
                                {bet}
                                <img src="/assets/icons/ficha.png" className="w-7 h-7 object-contain drop-shadow-md" alt="c" />
                            </div>
                            <button onClick={() => setBet(Math.min(visualBalance, bet + 10))} disabled={isGameActive} className="w-12 h-12 bg-zinc-800 rounded-xl text-white font-bold hover:bg-zinc-700 disabled:opacity-50 active:scale-95 transition-transform">+</button>
                        </div>

                        <button
                            onClick={handleSpin}
                            disabled={isGameActive || (gameStarted && visualBalance < bet)}
                            className={`flex-1 h-14 rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg active:scale-95 transition-all border-b-4 
                                ${isGameActive
                                    ? 'bg-zinc-800 border-zinc-900 text-zinc-600'
                                    : 'bg-gradient-to-r from-fuchsia-600 to-purple-600 border-purple-800 text-white hover:brightness-110'
                                }`}
                        >
                            {isGameActive ? '...' : (gameStarted ? 'GIRAR' : 'JUGAR')}
                        </button>
                    </div>
                </div>
            </div>

            {/* INFO MODAL */}
            {showInfo && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-900 w-full max-w-xs rounded-3xl border border-white/10 p-6 relative shadow-2xl">
                        <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                        <h3 className="text-xl font-black text-white text-center mb-6 uppercase italic">TABLA DE PAGOS</h3>
                        <div className="space-y-2">
                            {PAYTABLE.map(s => (
                                <div key={s.id} className="flex items-center justify-between bg-black/40 p-2 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-2">{s.icon} <span className="font-bold text-sm text-zinc-300">3x</span></div>
                                    <span className="font-mono font-black text-white text-lg">x{s.val}</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-center text-[10px] text-zinc-400 mt-4 bg-purple-900/20 p-2 rounded-lg border border-purple-500/20">
                            Calaveras y Fantasmas no dan premio.<br />
                            ¡Consigue <strong>3 o 4 iguales</strong> en línea!
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}