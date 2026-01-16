import { useState, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Zap, Info, X } from 'lucide-react';
import api from '../../services/api';

// --- RUTA DE LA IMAGEN DEL REVERSO ---
const CARD_BACK_IMG = '/assets/images/reverso-carta.png';

// --- CONFIGURACIÓN DE SÍMBOLOS Y PESOS ---
// 'weight' define qué tan frecuente aparece como "relleno" en el cartón
const SYMBOLS = {
    DIAMOND: { id: 'd', icon: '💎', prize: 500, type: 'coins', label: '500', weight: 2 },
    XP: { id: 'x', icon: '⚡', prize: 200, type: 'xp', label: '200 XP', weight: 8 },
    COIN: { id: 'c', icon: '🪙', prize: 100, type: 'coins', label: '100', weight: 15 },
    LEMON: { id: 'l', icon: '🍋', prize: 50, type: 'coins', label: '50', weight: 25 },
    SKULL: { id: 's', icon: '💀', prize: 0, type: 'none', label: '', weight: 25 },
    POOP: { id: 'p', icon: '💩', prize: 0, type: 'none', label: '', weight: 25 }
};

const SYMBOL_KEYS = Object.keys(SYMBOLS);

// --- COMPONENTE DE CATARATA DE FICHAS ---
const ChipRain = ({ isFading }) => {
    const [drops] = useState(() => Array.from({ length: 250 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        startTop: -(Math.random() * 150 + 10),
        delay: Math.random() * 1,
        duration: 1.2 + Math.random(),
        size: 15 + Math.random() * 40,
        opacity: 0.3 + Math.random() * 0.7
    })));

    return (
        <div className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-1000 ease-out ${isFading ? 'opacity-0' : 'opacity-100'}`}>
            <style>{`@keyframes cascadeFall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(200vh) rotate(720deg); } }`}</style>
            {drops.map((d) => (
                <img key={d.id} src="/assets/icons/ficha.png" className="absolute will-change-transform"
                    style={{ left: `${d.left}%`, top: `${d.startTop}vh`, width: `${d.size}px`, animation: `cascadeFall ${d.duration}s linear ${d.delay}s infinite`, opacity: d.opacity }} alt="" />
            ))}
        </div>
    );
};

export default function ScratchGame() {
    const { user, setUser, setIsUiHidden } = useOutletContext();
    const navigate = useNavigate();

    // SALDO
    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const [visualBalance, setVisualBalance] = useState(currentFichas);

    useEffect(() => { setVisualBalance(currentFichas); }, [currentFichas]);

    // Ocultar UI global
    useEffect(() => {
        setIsUiHidden(true);
        return () => setIsUiHidden(false);
    }, [setIsUiHidden]);

    // Estados
    const [isPlaying, setIsPlaying] = useState(false);
    const [grid, setGrid] = useState(Array(9).fill(null));
    const [revealed, setRevealed] = useState(Array(9).fill(false));
    const [result, setResult] = useState(null);

    // UI
    const [showInfo, setShowInfo] = useState(false);
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);

    const COST = 10;

    // --- LOGICA DE PROBABILIDAD (CORE) ---

    // Función auxiliar para obtener símbolo aleatorio basado en peso
    const getRandomFiller = () => {
        const totalWeight = Object.values(SYMBOLS).reduce((acc, s) => acc + s.weight, 0);
        let random = Math.random() * totalWeight;
        for (const key of SYMBOL_KEYS) {
            if (random < SYMBOLS[key].weight) return SYMBOLS[key];
            random -= SYMBOLS[key].weight;
        }
        return SYMBOLS.SKULL;
    };

    const generateGrid = () => {
        // 1. Determinar si gana o pierde (35% Win Rate)
        const isWin = Math.random() < 0.35;
        let items = [];

        if (isWin) {
            // --- ESCENARIO: GANADOR ---
            // Elegir premio
            const prizeRand = Math.random();
            let winSym;
            if (prizeRand < 0.05) winSym = SYMBOLS.DIAMOND;      // 5% 
            else if (prizeRand < 0.20) winSym = SYMBOLS.XP;      // 15%
            else if (prizeRand < 0.50) winSym = SYMBOLS.COIN;    // 30%
            else winSym = SYMBOLS.LEMON;                         // 50%

            // Insertar 3 copias del ganador
            items.push(winSym, winSym, winSym);

            // Rellenar los otros 6 huecos con aleatorios (para despistar)
            while (items.length < 9) {
                const filler = getRandomFiller();
                // Evitar accidentalmente crear otro premio de 3 (doble premio es raro pero posible, lo limitamos para control)
                const count = items.filter(x => x.id === filler.id).length;
                if (count < 2) {
                    items.push(filler);
                } else {
                    items.push(SYMBOLS.SKULL); // Fallback seguro
                }
            }

        } else {
            // --- ESCENARIO: PERDEDOR (EL "CASI") ---
            // Rellenamos aleatoriamente
            for (let i = 0; i < 9; i++) {
                items.push(getRandomFiller());
            }

            // VALIDACIÓN CRÍTICA: Asegurar que NO haya ganadores
            // Esto permite que haya 2 Diamantes (Casi gano!), pero rompe el tercero.
            const counts = {};
            items.forEach(item => { counts[item.id] = (counts[item.id] || 0) + 1; });

            Object.keys(counts).forEach(key => {
                if (counts[key] >= 3) {
                    // Si hay 3 iguales en un cartón perdedor, cambiamos los sobrantes por Calaveras
                    // Dejamos 2 para crear el efecto "Casi"
                    let removed = 0;
                    items = items.map(item => {
                        if (item.id === key && item.type !== 'none') {
                            removed++;
                            if (removed > 2) return Math.random() > 0.5 ? SYMBOLS.SKULL : SYMBOLS.POOP;
                        }
                        return item;
                    });
                }
            });
        }

        // Barajar el array final para que los premios no estén siempre al principio
        return items.sort(() => Math.random() - 0.5);
    };

    // --- GESTIÓN DE SALDO ---
    const syncUserWithServer = (serverUser) => {
        if (serverUser) {
            setUser(prev => {
                const updated = { ...prev, ...serverUser };
                if (serverUser.gameCoins !== undefined) {
                    updated.stats = { ...updated.stats, gameCoins: serverUser.gameCoins };
                }
                localStorage.setItem('user', JSON.stringify(updated));
                return updated;
            });
            setVisualBalance(serverUser.gameCoins ?? serverUser.stats?.gameCoins ?? 0);
        }
    };

    const updateBalanceInstant = (amountToAdd) => {
        setVisualBalance(prev => Math.max(0, prev + amountToAdd));
        setUser(prevUser => {
            const current = prevUser.stats?.gameCoins ?? prevUser.gameCoins ?? 0;
            const newBalance = Math.max(0, current + amountToAdd);
            const updatedUser = { ...prevUser, gameCoins: newBalance, stats: { ...prevUser.stats, gameCoins: newBalance } };
            return updatedUser;
        });
    };

    // --- JUGAR ---
    const play = async () => {
        if (visualBalance < COST) { alert("No tienes suficientes fichas"); return; }

        updateBalanceInstant(-COST);
        api.post('/users/reward', { gameCoins: -COST })
            .then(res => syncUserWithServer(res.data.user))
            .catch(err => updateBalanceInstant(COST));

        setIsPlaying(true);
        setRevealed(Array(9).fill(false));
        setResult(null);
        setShowRain(false);
        setIsRainFading(false);

        // Generar grid con la nueva lógica orgánica
        setGrid(generateGrid());
    };

    const reveal = (i) => {
        if (!isPlaying || revealed[i]) return;
        const newRev = [...revealed];
        newRev[i] = true;
        setRevealed(newRev);

        if (newRev.every(Boolean)) checkWin(grid);
    };

    const checkWin = async (finalGrid) => {
        setIsPlaying(false);
        const counts = {};
        finalGrid.forEach(i => counts[i.id] = (counts[i.id] || 0) + 1);

        const winSym = Object.values(SYMBOLS).find(s => counts[s.id] >= 3 && s.type !== 'none');

        if (winSym) {
            setResult({ won: true, prize: winSym.prize, label: winSym.icon });
            setShowRain(true);
            setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);

            const prize = winSym.prize;
            updateBalanceInstant(prize);
            api.post('/users/reward', { gameCoins: prize })
                .then(res => syncUserWithServer(res.data.user))
                .catch(console.error);
        } else {
            setResult({ won: false });
            api.get('/auth/me').then(res => syncUserWithServer(res.data)).catch(() => { });
        }
    };

    const winningSymbols = Object.values(SYMBOLS).filter(s => s.type !== 'none').sort((a, b) => b.prize - a.prize);

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-40 pb-4 overflow-hidden select-none font-sans">

            {showRain && <ChipRain isFading={isRainFading} />}

            {/* HEADER */}
            <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-50">
                <button onClick={() => navigate('/games')} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><ChevronLeft /></button>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-yellow-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-yellow-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <button onClick={() => setShowInfo(true)} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
            </div>

            {/* TÍTULO */}
            <div className="absolute top-28 w-full text-center z-10 pointer-events-none">
                <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] tracking-wide uppercase">
                    RASCA Y GANA
                </h1>
            </div>

            {/* ZONA DE JUEGO */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-4 relative z-10">

                <div className="bg-gradient-to-br from-zinc-800 to-black p-1 rounded-[2rem] shadow-2xl w-full transform transition-all ring-2 ring-yellow-600/30">
                    <div className="bg-black/90 rounded-[1.8rem] p-6 border border-white/5 relative overflow-hidden flex flex-col gap-6">

                        {/* CUADRÍCULA */}
                        <div className="grid grid-cols-3 gap-3 aspect-square relative z-10 w-full mx-auto">
                            {grid.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => reveal(i)}
                                    disabled={!isPlaying || revealed[i]}
                                    className={`
                                        relative w-full h-full rounded-xl overflow-hidden transition-all cursor-pointer active:scale-95 
                                        ${revealed[i] ? 'bg-zinc-900 shadow-[inset_0_0_10px_black] border border-white/5' : 'bg-transparent border-0'}
                                    `}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        {revealed[i] ? (
                                            <span className="text-5xl animate-in zoom-in duration-300 drop-shadow-md filter leading-none select-none">{item?.icon}</span>
                                        ) : (
                                            <img
                                                src={CARD_BACK_IMG}
                                                alt="reverso"
                                                className="absolute inset-0 w-full h-full object-cover animate-pulse opacity-100"
                                            />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* CONTROLES / RESULTADO */}
                        <div className="relative z-10 min-h-[60px] flex items-center justify-center">
                            {result ? (
                                <div className="text-center w-full animate-in zoom-in">
                                    <div className="mb-4">
                                        {result.won ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="font-black text-2xl uppercase tracking-widest text-green-400 animate-pulse">¡PREMIO!</span>
                                                <div className="flex items-center gap-2 bg-green-900/40 px-4 py-1 rounded-full border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                                    <span className="font-black text-white text-xl">+{result.prize}</span>
                                                    <img src="/assets/icons/ficha.png" alt="f" className="w-5 h-5 object-contain" />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="font-black text-xl uppercase tracking-widest text-zinc-500">Sin Premio</span>
                                        )}
                                    </div>

                                    <button
                                        onClick={play}
                                        disabled={visualBalance < COST}
                                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black py-4 rounded-xl uppercase transition-all shadow-lg shadow-yellow-900/20 active:scale-95 text-lg border-b-4 border-yellow-700 flex items-center justify-center gap-2"
                                    >
                                        <span>Jugar de nuevo</span>
                                        <div className="flex items-center bg-black/20 px-2 py-0.5 rounded text-sm">
                                            {COST} <img src="/assets/icons/ficha.png" className="w-4 h-4 ml-1" alt="c" />
                                        </div>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={play}
                                    disabled={isPlaying || visualBalance < COST}
                                    className={`
                                        w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest shadow-lg transition-all active:scale-95 border-b-4
                                        ${isPlaying
                                            ? 'bg-zinc-800 text-zinc-500 border-zinc-900 cursor-default'
                                            : visualBalance < COST
                                                ? 'bg-zinc-800 text-zinc-500 border-zinc-900 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black shadow-yellow-900/20 border-yellow-700'
                                        }
                                    `}
                                >
                                    {isPlaying ? '¡RASCA LAS CASILLAS!' : (
                                        <div className="flex items-center justify-center gap-2">
                                            <span>COMPRAR CARTÓN</span>
                                            <div className="flex items-center bg-black/20 px-2 py-0.5 rounded text-sm">
                                                {COST} <img src="/assets/icons/ficha.png" className="w-4 h-4 ml-1" alt="c" />
                                            </div>
                                        </div>
                                    )}
                                </button>
                            )}
                        </div>

                    </div>
                </div>

            </div>

            {/* MODAL INFO */}
            {showInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-zinc-900 border border-white/10 rounded-[2rem] p-6 w-full max-w-xs relative shadow-2xl">
                        <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24} /></button>
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Tabla de Premios</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Encuentra 3 iguales para ganar</p>
                        </div>
                        <div className="space-y-2 mb-4">
                            {winningSymbols.map((s) => (
                                <div key={s.id} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                                    <div className="text-2xl filter drop-shadow-sm">{s.icon}</div>
                                    <div className="flex items-center gap-1">
                                        <span className={`font-black text-lg ${s.type === 'xp' ? 'text-blue-400' : 'text-yellow-400'}`}>{s.label}</span>
                                        {s.type === 'xp' ? <Zap size={16} className="text-blue-400" /> : <img src="/assets/icons/ficha.png" alt="Ficha" className="w-5 h-5 object-contain" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] text-zinc-600 uppercase font-bold">Calaveras y cacas no tienen premio.</p>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}