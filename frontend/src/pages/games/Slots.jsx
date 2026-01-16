import { useState, useRef, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
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

// --- SÍMBOLOS, VALORES Y PESOS (AJUSTE "DILUCIÓN") ---
const SYMBOLS = [
    // Símbolos con Valor
    { id: 'cherry', icon: <Cherry size={32} />, color: 'text-red-500', val: 1.5, weight: 25 },
    { id: 'clover', icon: <Clover size={32} />, color: 'text-green-500', val: 3, weight: 15 },
    { id: 'zap', icon: <Zap size={32} />, color: 'text-yellow-400', val: 5, weight: 10 },
    { id: 'star', icon: <Star size={32} />, color: 'text-purple-400', val: 10, weight: 8 },
    { id: 'gem', icon: <Gem size={32} />, color: 'text-cyan-400', val: 20, weight: 4 },
    { id: 'crown', icon: <Crown size={32} />, color: 'text-yellow-600', val: 50, weight: 1 },

    // Símbolos "Basura" (Sin valor, para romper combos fáciles)
    { id: 'skull', icon: <Skull size={32} />, color: 'text-zinc-600', val: 0, weight: 20 },
    { id: 'ghost', icon: <Ghost size={32} />, color: 'text-zinc-500', val: 0, weight: 17 },
];

// Generador ponderado
const getRandomSymbol = () => {
    const totalWeight = SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
    let random = Math.random() * totalWeight;
    for (const symbol of SYMBOLS) {
        if (random < symbol.weight) return symbol;
        random -= symbol.weight;
    }
    return SYMBOLS[0];
};

const getRandomCol = () => Array(4).fill(null).map(() => getRandomSymbol());
const generateInitialGrid = () => Array(4).fill(null).map(() => getRandomCol());

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
    const [cols, setCols] = useState(generateInitialGrid());

    // Control de Animación
    const [spinningCols, setSpinningCols] = useState([false, false, false, false]);
    const spinningRef = useRef([false, false, false, false]);
    const finalGridRef = useRef(null);

    const [isGameActive, setIsGameActive] = useState(false);

    // RESULTADO (Sin winningDetails porque ya no pintamos líneas, solo celdas)
    const [result, setResult] = useState({ won: false, payout: 0, winningCells: [] });
    const [msg, setMsg] = useState("¡Consigue 3 en línea!");

    // UI
    const [showInfo, setShowInfo] = useState(false);
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);
    const animationRef = useRef(null);

    useEffect(() => {
        setIsUiHidden(true);
        return () => setIsUiHidden(false);
    }, [setIsUiHidden]);

    // --- PAGO INSTANTÁNEO ---
    const updateBalanceInstant = (amountToAdd) => {
        setVisualBalance(prev => Math.max(0, prev + amountToAdd));
        setUser(prevUser => {
            const current = prevUser.stats?.gameCoins ?? prevUser.gameCoins ?? 0;
            const newBalance = Math.max(0, current + amountToAdd);
            const updatedUser = { ...prevUser, gameCoins: newBalance, stats: { ...prevUser.stats, gameCoins: newBalance } };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            return updatedUser;
        });
    };

    // --- JUGAR ---
    const handleSpin = () => {
        if (!gameStarted) { setGameStarted(true); return; }
        if (isGameActive) return;
        if (visualBalance < bet) { alert("Faltan fichas"); return; }

        // 1. Cobrar
        updateBalanceInstant(-bet);
        api.post('/users/reward', { gameCoins: -bet }).catch(err => updateBalanceInstant(bet));

        // 2. Iniciar
        setIsGameActive(true);
        setSpinningCols([true, true, true, true]);
        spinningRef.current = [true, true, true, true];
        setMsg("Girando...");
        setResult({ won: false, payout: 0, winningCells: [] });
        setShowRain(false);
        setIsRainFading(false);

        // 3. Generar resultado FINAL (usando pesos)
        const finalCols = generateInitialGrid();
        finalGridRef.current = finalCols;

        // 4. Bucle Animación
        animationRef.current = setInterval(() => {
            setCols(prevCols => prevCols.map((col, i) => {
                if (!spinningRef.current[i]) return finalGridRef.current[i];
                return getRandomCol();
            }));
        }, 50);

        // 5. Paradas
        setTimeout(() => stopColumn(0), 500);
        setTimeout(() => stopColumn(1), 1000);
        setTimeout(() => stopColumn(2), 1500);
        setTimeout(() => {
            clearInterval(animationRef.current);
            stopColumn(3);
            checkWin(finalGridRef.current);
            setIsGameActive(false);
        }, 2000);
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

    // --- WIN CHECK ---
    const checkWin = async (finalCols) => {
        let totalPayout = 0;
        let winningCells = [];

        const rows = [];
        for (let r = 0; r < 4; r++) rows.push(finalCols.map(col => col[r]));

        const checkLines = [
            // Filas
            { type: 'row', index: 0, syms: rows[0], coords: [[0, 0], [1, 0], [2, 0], [3, 0]] },
            { type: 'row', index: 1, syms: rows[1], coords: [[0, 1], [1, 1], [2, 1], [3, 1]] },
            { type: 'row', index: 2, syms: rows[2], coords: [[0, 2], [1, 2], [2, 2], [3, 2]] },
            { type: 'row', index: 3, syms: rows[3], coords: [[0, 3], [1, 3], [2, 3], [3, 3]] },
            // Diagonales
            { type: 'diag', index: 1, syms: [rows[0][0], rows[1][1], rows[2][2], rows[3][3]], coords: [[0, 0], [1, 1], [2, 2], [3, 3]] },
            { type: 'diag', index: 2, syms: [rows[0][3], rows[1][2], rows[2][1], rows[3][0]], coords: [[0, 3], [1, 2], [2, 1], [3, 0]] },
            // Columnas
            { type: 'col', index: 0, syms: finalCols[0], coords: [[0, 0], [0, 1], [0, 2], [0, 3]] },
            { type: 'col', index: 1, syms: finalCols[1], coords: [[1, 0], [1, 1], [1, 2], [1, 3]] },
            { type: 'col', index: 2, syms: finalCols[2], coords: [[2, 0], [2, 1], [2, 2], [2, 3]] },
            { type: 'col', index: 3, syms: finalCols[3], coords: [[3, 0], [3, 1], [3, 2], [3, 3]] }
        ];

        checkLines.forEach(line => {
            const s = line.syms;
            let matchIndices = [];
            let winningSymbolVal = 0;

            // Ignoramos símbolos basura (val = 0)
            if (s[0].val === 0) return;

            // Caso 1: 4 Iguales
            if (s[0].id === s[1].id && s[1].id === s[2].id && s[2].id === s[3].id) {
                matchIndices = [0, 1, 2, 3];
                winningSymbolVal = s[0].val;
            }
            // Caso 2: 3 Primeros
            else if (s[0].id === s[1].id && s[1].id === s[2].id) {
                matchIndices = [0, 1, 2];
                winningSymbolVal = s[0].val;
            }
            // Caso 3: 3 Últimos
            else if (s[1].id === s[2].id && s[2].id === s[3].id) {
                // Verificar que el segundo símbolo no sea basura
                if (s[1].val > 0) {
                    matchIndices = [1, 2, 3];
                    winningSymbolVal = s[1].val;
                }
            }

            if (matchIndices.length >= 3) {
                const multiplier = matchIndices.length === 4 ? 2 : 1;
                totalPayout += bet * winningSymbolVal * multiplier;

                // Guardar celdas para iluminarlas
                matchIndices.forEach(i => {
                    const [c, r] = line.coords[i];
                    winningCells.push(`${c}-${r}`);
                });
            }
        });

        if (totalPayout > 0) {
            setMsg("¡PREMIO!");
            setResult({ won: true, payout: totalPayout, winningCells });
            setShowRain(true);
            setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);
            updateBalanceInstant(totalPayout);
            api.post('/users/reward', { gameCoins: totalPayout }).catch(console.error);
        } else {
            setMsg("Inténtalo de nuevo");
        }
    };

    // --- RENDER ---
    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-48 pb-10 overflow-hidden select-none">
            {showRain && <ChipRain isFading={isRainFading} />}

            <style>{`
                .slot-spin { animation: slotScroll 0.1s linear infinite; }
                @keyframes slotScroll { 0% { transform: translateY(-5%); filter: blur(2px); } 50% { transform: translateY(5%); } 100% { transform: translateY(-5%); } }
            `}</style>

            {/* HEADER */}
            <div className="absolute top-16 left-4 right-4 flex justify-between items-center z-50">
                <button onClick={() => navigate('/games')} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><ChevronLeft /></button>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-purple-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-purple-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <button onClick={() => setShowInfo(true)} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
            </div>

            {/* MÁQUINA */}
            <div className="w-full max-w-sm px-4 relative z-10 flex flex-col items-center gap-4">
                <div className="text-center px-4 w-full">
                    <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-400 to-purple-600 drop-shadow-[0_0_15px_rgba(192,38,211,0.5)] tracking-wide leading-normal pb-1 pr-2">
                        NEON SLOTS
                    </h1>
                </div>

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
                                    // ILUMINAR CELDAS GANADORAS
                                    const isWinCell = result.won && result.winningCells && result.winningCells.includes(`${colIdx}-${rowIdx}`);
                                    return (
                                        <div key={rowIdx} className={`flex-1 flex items-center justify-center transition-all duration-300 ${isWinCell ? 'bg-yellow-500/30 shadow-[inset_0_0_20px_rgba(234,179,8,0.5)]' : ''}`}>
                                            <div className={`${symbol.color} drop-shadow-md transform ${isWinCell ? 'scale-125 brightness-125' : 'scale-100'}`}>{symbol.icon}</div>
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
                            onClick={gameStarted ? handleSpin : () => setGameStarted(true)}
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
                    <div className="bg-zinc-900 w-full max-w-xs rounded-3xl border border-white/10 p-6 relative">
                        <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                        <h3 className="text-xl font-black text-white text-center mb-6">TABLA DE PAGOS</h3>
                        <div className="space-y-2">
                            {SYMBOLS.filter(s => s.val > 0).map(s => (
                                <div key={s.id} className="flex items-center justify-between bg-black/40 p-2 rounded-lg border border-white/5">
                                    <div className={`flex items-center gap-2 ${s.color}`}>{s.icon} <span className="font-bold text-sm text-zinc-300">3x</span></div>
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