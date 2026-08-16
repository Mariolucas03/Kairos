import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Info, X } from 'lucide-react';
import BackButton from '../../components/common/BackButton';
import api from '../../services/api';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../../store/useAuthStore';

// --- RUTA DE LA IMAGEN DEL REVERSO ---
const CARD_BACK_IMG = '/assets/images/reverso-carta.png';

// --- CONFIGURACIÓN VISUAL DE SÍMBOLOS (Para el Frontend) ---
const SYMBOLS = {
    DIAMOND: { id: 'd', icon: '💎', prize: 500, type: 'coins', label: '500' },
    XP: { id: 'x', icon: '⚡', prize: 200, type: 'xp', label: '200 XP' },
    COIN: { id: 'c', icon: '🪙', prize: 100, type: 'coins', label: '100' },
    LEMON: { id: 'l', icon: '🍋', prize: 50, type: 'coins', label: '50' },
    SKULL: { id: 's', icon: '💀', prize: 0, type: 'none', label: '' },
    POOP: { id: 'p', icon: '💩', prize: 0, type: 'none', label: '' }
};

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
    // 🔥 CONECTAMOS CON ZUSTAND
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);
    const navigate = useNavigate();

    // Ocultar UI global
    useEffect(() => {
        setIsUiHidden(true);
        return () => setIsUiHidden(false);
    }, [setIsUiHidden]);

    // Estados
    const [isPlaying, setIsPlaying] = useState(false);
    const [grid, setGrid] = useState(Array(9).fill(null));
    const [revealed, setRevealed] = useState(Array(9).fill(false));
    const [result, setResult] = useState(null); // Guardaremos el resultado del backend aquí

    // UI
    const [showInfo, setShowInfo] = useState(false);
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    const COST = 10;

    // SALDO DERIVADO: mientras rascas se descuenta el cartón y, al terminar,
    // manda el saldo real que devolvió el servidor. Antes era un estado aparte
    // que había que ir sincronizando a mano en cuatro sitios distintos.
    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const visualBalance = isPlaying ? Math.max(0, currentFichas - COST) : currentFichas;

    // --- JUGAR (CONEXIÓN AL BACKEND) ---
    const play = async () => {
        if (visualBalance < COST) { setErrorMsg("No te llegan las fichas"); return; }

        setErrorMsg(null);
        setIsPlaying(true);
        setRevealed(Array(9).fill(false));
        setResult(null);
        setShowRain(false);
        setIsRainFading(false);

        try {
            // 2. Pedir resultado al backend (Inhackeable)
            const res = await api.post('/games/scratch');

            // 3. Cargar la matriz devuelta por el servidor (oculta hasta rascar)
            setGrid(res.data.grid);

            // 4. Guardar el resultado en memoria para cuando termine de rascar
            setResult({
                won: res.data.won,
                prize: res.data.prize,
                type: res.data.prizeType,
                user: res.data.user // Usuario actualizado con el premio (si lo hubo)
            });

        } catch (error) {
            console.error("Error comprando cartón:", error);
            // Sin rollback manual: al salir de isPlaying el saldo vuelve solo al real
            setErrorMsg(error.response?.data?.message || "No se pudo comprar el cartón");
            setIsPlaying(false);
        }
    };

    const reveal = (i) => {
        if (!isPlaying || revealed[i] || !grid[i]) return;
        const newRev = [...revealed];
        newRev[i] = true;
        setRevealed(newRev);

        // Si es la última casilla rascada, mostramos el resultado
        if (newRev.every(Boolean) && result) {
            setIsPlaying(false);

            if (result.won) {
                setShowRain(true);
                setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);
            }

            // Sincronizar el usuario con los datos que nos dio el servidor
            if (result.user) {
                setUser(result.user);
                localStorage.setItem('user', JSON.stringify(result.user));
            }
        }
    };

    const winningSymbols = Object.values(SYMBOLS).filter(s => s.type !== 'none').sort((a, b) => b.prize - a.prize);

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-40 pb-4 overflow-hidden select-none font-sans">

            {showRain && <ChipRain isFading={isRainFading} />}

            {/* HEADER */}
            <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-50">
                <BackButton to="/games" />
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-yellow-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-yellow-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <button onClick={() => setShowInfo(true)} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
            </div>

            {/* TÍTULO */}
            <div className="absolute top-28 w-full text-center z-10">
                <h1 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] tracking-wide uppercase pointer-events-none">
                    RASCA Y GANA
                </h1>
                {errorMsg && (
                    <div onClick={() => setErrorMsg(null)} className="mx-6 mt-3 bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase tracking-wide px-4 py-2.5 rounded-2xl cursor-pointer">
                        {errorMsg}
                    </div>
                )}
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
                                        {revealed[i] && item ? (
                                            <span className="text-5xl animate-in zoom-in duration-300 drop-shadow-md filter leading-none select-none">{item.icon}</span>
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
                            {revealed.every(Boolean) && result ? (
                                <div className="text-center w-full animate-in zoom-in">
                                    <div className="mb-4">
                                        {result.won ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="font-black text-2xl uppercase tracking-widest text-green-400 animate-pulse">¡PREMIO!</span>
                                                <div className="flex items-center gap-2 bg-green-900/40 px-4 py-1 rounded-full border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                                                    <span className="font-black text-white text-xl">+{result.prize}</span>
                                                    {result.type === 'xp' ? <Zap size={20} className="text-blue-400" /> : <img src="/assets/icons/ficha.png" alt="f" className="w-5 h-5 object-contain" />}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="font-black text-xl uppercase tracking-widest text-zinc-500">Sin Premio</span>
                                        )}
                                    </div>

                                    <button
                                        onClick={play}
                                        disabled={visualBalance < COST}
                                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black py-4 rounded-xl uppercase transition-all shadow-lg shadow-yellow-900/20 active:scale-95 text-lg border-b-4 border-yellow-700 flex items-center justify-center gap-2 disabled:grayscale disabled:opacity-50"
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