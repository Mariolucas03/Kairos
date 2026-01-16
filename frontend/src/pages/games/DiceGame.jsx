import { useState, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, X, Trophy, Frown } from 'lucide-react';
import api from '../../services/api';

// --- UTILIDAD PAUSA ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            <style>{`@keyframes fall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(120vh) rotate(360deg); } }`}</style>
            {drops.map((d) => (
                <img key={d.id} src="/assets/icons/ficha.png" className="absolute will-change-transform"
                    style={{ left: `${d.left}%`, top: `${d.startTop}vh`, width: `${d.size}px`, animation: `fall ${d.duration}s linear ${d.delay}s infinite`, opacity: d.opacity }} alt="" />
            ))}
        </div>
    );
};

// --- COMPONENTE DADO DIGITAL (CASILLA 2D) ---
const DigitalDie = ({ value, rolling }) => {
    const [displayNum, setDisplayNum] = useState(value);

    // Efecto de números cambiando rápidamente mientras rueda
    useEffect(() => {
        let interval;
        if (rolling) {
            interval = setInterval(() => {
                setDisplayNum(Math.floor(Math.random() * 6) + 1);
            }, 80); // Cambia cada 80ms
        } else {
            setDisplayNum(value);
        }
        return () => clearInterval(interval);
    }, [rolling, value]);

    return (
        <div className={`
            w-32 h-32 md:w-40 md:h-40 
            bg-black/80 backdrop-blur-xl
            border-4 border-cyan-500/50 
            rounded-[2rem] 
            flex items-center justify-center 
            shadow-[0_0_30px_rgba(6,182,212,0.15)]
            relative overflow-hidden
            transition-all duration-300
            ${rolling ? 'scale-95 border-cyan-500/20' : 'scale-100 border-cyan-400'}
        `}>
            {/* Brillo interior */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none"></div>

            {/* Número */}
            <span className={`
                text-8xl md:text-9xl font-black text-white 
                drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]
                ${rolling ? 'blur-sm opacity-50' : 'blur-0 opacity-100'}
                transition-all duration-100
            `}>
                {displayNum}
            </span>
        </div>
    );
};

export default function Dice() {
    const { user, setUser, setIsUiHidden } = useOutletContext();
    const navigate = useNavigate();

    // SALDO
    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const [visualBalance, setVisualBalance] = useState(currentFichas);

    useEffect(() => { setVisualBalance(currentFichas); }, [currentFichas]);

    // Ocultar UI Global
    useEffect(() => {
        setIsUiHidden(true);
        return () => setIsUiHidden(false);
    }, [setIsUiHidden]);

    // Estados Juego
    const [dices, setDices] = useState([1, 1]);
    const [bet, setBet] = useState(20);
    const [selectedOption, setSelectedOption] = useState(null); // 'under', 'seven', 'over'
    const [rolling, setRolling] = useState(false);
    const [resultModal, setResultModal] = useState(null); // { won: boolean, amount: number, sum: number }

    // UI Feedback
    const [showInfo, setShowInfo] = useState(false);
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);

    // --- SINCRONIZACIÓN ---
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
    const handleRoll = async () => {
        if (!selectedOption) { alert("Elige una opción: Menos de 7, 7 o Más de 7"); return; }
        if (visualBalance < bet) { alert("Faltan fichas"); return; }
        if (rolling) return;

        setResultModal(null);
        setRolling(true);
        setShowRain(false);
        setIsRainFading(false);

        // 1. Cobrar Apuesta
        updateBalanceInstant(-bet);
        api.post('/users/reward', { gameCoins: -bet })
            .then(res => syncUserWithServer(res.data.user))
            .catch(err => updateBalanceInstant(bet));

        // 2. Determinar Resultado
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const sum = d1 + d2;

        // 3. Esperar animación
        await sleep(1500); // 1.5 segundos de "barajado"
        setDices([d1, d2]);
        setRolling(false);

        // 4. Calcular Ganancia
        let won = false;
        let multiplier = 0;

        if (selectedOption === 'under' && sum < 7) { won = true; multiplier = 2; }
        else if (selectedOption === 'seven' && sum === 7) { won = true; multiplier = 5; }
        else if (selectedOption === 'over' && sum > 7) { won = true; multiplier = 2; }

        const payout = won ? bet * multiplier : 0;

        // 5. Pagar
        if (won) {
            updateBalanceInstant(payout);
            api.post('/users/reward', { gameCoins: payout })
                .then(res => syncUserWithServer(res.data.user))
                .catch(console.error);

            setShowRain(true);
            setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);
        } else {
            api.get('/auth/me').then(res => syncUserWithServer(res.data)).catch(() => { });
        }

        setResultModal({ won, amount: payout, sum });
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-40 pb-4 overflow-hidden select-none font-sans">

            {showRain && <ChipRain isFading={isRainFading} />}

            {/* HEADER FLOTANTE */}
            <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-50">
                <button onClick={() => navigate('/games')} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><ChevronLeft /></button>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-blue-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-blue-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <button onClick={() => setShowInfo(true)} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
            </div>

            {/* TÍTULO */}
            <div className="absolute top-28 w-full text-center z-10 pointer-events-none">
                <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-cyan-400 to-blue-600 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] tracking-wide">
                    NEON DICE
                </h1>
            </div>

            {/* ZONA DE JUEGO */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-4 gap-8 relative z-10">

                {/* CAJAS DE DADOS */}
                <div className="relative w-full flex items-center justify-center gap-6">
                    {/* Brillo de fondo */}
                    <div className="absolute inset-0 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>

                    <DigitalDie value={dices[0]} rolling={rolling} />
                    <DigitalDie value={dices[1]} rolling={rolling} />
                </div>

                {/* SUMA TOTAL INDICADOR */}
                <div className={`transition-all duration-300 transform ${rolling ? 'opacity-50 scale-90' : 'opacity-100 scale-100'}`}>
                    <div className="bg-black/60 px-8 py-3 rounded-full border border-white/10 backdrop-blur-md shadow-2xl flex flex-col items-center min-w-[120px]">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1">Suma Total</span>
                        <span className="text-5xl font-black text-white">{rolling ? '?' : dices[0] + dices[1]}</span>
                    </div>
                </div>

                {/* OPCIONES DE APUESTA */}
                <div className="w-full grid grid-cols-3 gap-3">
                    <button
                        onClick={() => setSelectedOption('under')}
                        disabled={rolling}
                        className={`py-4 rounded-2xl border-b-4 transition-all active:scale-95 flex flex-col items-center justify-center gap-1
                            ${selectedOption === 'under'
                                ? 'bg-cyan-600 border-cyan-800 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)] scale-105'
                                : 'bg-zinc-800 border-zinc-900 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        <span className="font-black text-lg">2 - 6</span>
                        <span className="text-[10px] uppercase font-bold">x2</span>
                    </button>

                    <button
                        onClick={() => setSelectedOption('seven')}
                        disabled={rolling}
                        className={`py-4 rounded-2xl border-b-4 transition-all active:scale-95 flex flex-col items-center justify-center gap-1
                            ${selectedOption === 'seven'
                                ? 'bg-purple-600 border-purple-800 text-white shadow-[0_0_20px_rgba(147,51,234,0.4)] scale-105'
                                : 'bg-zinc-800 border-zinc-900 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        <span className="font-black text-2xl">7</span>
                        <span className="text-[10px] uppercase font-bold text-yellow-400">x5</span>
                    </button>

                    <button
                        onClick={() => setSelectedOption('over')}
                        disabled={rolling}
                        className={`py-4 rounded-2xl border-b-4 transition-all active:scale-95 flex flex-col items-center justify-center gap-1
                            ${selectedOption === 'over'
                                ? 'bg-pink-600 border-pink-800 text-white shadow-[0_0_20px_rgba(219,39,119,0.4)] scale-105'
                                : 'bg-zinc-800 border-zinc-900 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                        <span className="font-black text-lg">8 - 12</span>
                        <span className="text-[10px] uppercase font-bold">x2</span>
                    </button>
                </div>

                {/* CONTROLES INFERIORES */}
                <div className="w-full bg-zinc-900/90 backdrop-blur-md rounded-[2rem] border border-white/10 p-4 shadow-2xl flex items-center gap-3">
                    <div className="bg-black rounded-xl flex items-center p-1 border border-zinc-800 shrink-0">
                        <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={rolling} className="w-12 h-12 bg-zinc-800 rounded-lg text-white font-bold hover:bg-zinc-700 active:scale-95 transition-transform">-</button>
                        <div className="min-w-[80px] flex items-center justify-center gap-1 font-black text-yellow-500 text-xl">
                            {bet}
                            <img src="/assets/icons/ficha.png" className="w-6 h-6 object-contain" alt="c" />
                        </div>
                        <button onClick={() => setBet(Math.min(visualBalance, bet + 10))} disabled={rolling} className="w-12 h-12 bg-zinc-800 rounded-lg text-white font-bold hover:bg-zinc-700 active:scale-95 transition-transform">+</button>
                    </div>

                    <button
                        onClick={handleRoll}
                        disabled={rolling || visualBalance < bet || !selectedOption}
                        className={`flex-1 h-14 rounded-xl font-black text-xl uppercase tracking-widest shadow-lg active:scale-95 transition-all border-b-4 
                            ${rolling || !selectedOption
                                ? 'bg-zinc-800 border-zinc-900 text-zinc-600'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-600 border-blue-800 text-white hover:brightness-110 shadow-blue-900/20'
                            }`}
                    >
                        {rolling ? '...' : 'TIRAR'}
                    </button>
                </div>
            </div>

            {/* MODAL RESULTADO */}
            {resultModal && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95 duration-200" onClick={() => setResultModal(null)}>
                    <div className={`w-full max-w-xs rounded-[32px] p-8 text-center border-2 shadow-2xl relative ${resultModal.won ? 'bg-green-900/40 border-green-500' : 'bg-red-900/40 border-red-500'}`} onClick={e => e.stopPropagation()}>
                        <div className="mb-6 flex justify-center">
                            <div className={`p-6 rounded-full border-4 shadow-xl ${resultModal.won ? 'bg-green-500 border-green-300' : 'bg-red-500 border-red-300'}`}>
                                {resultModal.won ? <Trophy size={48} className="text-white animate-bounce" /> : <Frown size={48} className="text-white" />}
                            </div>
                        </div>

                        <div className="text-sm text-zinc-300 font-bold mb-2 uppercase tracking-widest">Suma Total</div>
                        <div className="text-6xl font-black text-white mb-6 drop-shadow-lg">{resultModal.sum}</div>

                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">
                            {resultModal.won ? '¡VICTORIA!' : 'SUERTE LA PRÓXIMA'}
                        </h2>

                        {resultModal.won && (
                            <div className="flex items-center justify-center gap-2 mb-6 bg-black/40 py-2 rounded-xl">
                                <span className="text-3xl font-black text-green-400">+{resultModal.amount}</span>
                                <img src="/assets/icons/ficha.png" className="w-8 h-8" alt="f" />
                            </div>
                        )}

                        <button onClick={() => setResultModal(null)} className="w-full py-4 bg-white text-black font-black rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-transform hover:bg-zinc-200">
                            CONTINUAR
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL INFO */}
            {showInfo && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-900 w-full max-w-xs rounded-3xl border border-white/10 p-6 relative shadow-2xl">
                        <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                        <h3 className="text-xl font-black text-white text-center mb-6 uppercase italic">Pagos</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between bg-black/50 p-3 rounded-xl border border-white/5 items-center">
                                <span className="text-zinc-300 font-bold text-sm">2 - 6 (Menos)</span>
                                <span className="font-black text-cyan-400 text-lg">x2</span>
                            </div>
                            <div className="flex justify-between bg-black/50 p-3 rounded-xl border border-white/5 items-center ring-1 ring-purple-500/50">
                                <span className="text-white font-bold text-sm">7 (Exacto)</span>
                                <span className="font-black text-purple-400 text-xl">x5</span>
                            </div>
                            <div className="flex justify-between bg-black/50 p-3 rounded-xl border border-white/5 items-center">
                                <span className="text-zinc-300 font-bold text-sm">8 - 12 (Más)</span>
                                <span className="font-black text-pink-400 text-lg">x2</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}