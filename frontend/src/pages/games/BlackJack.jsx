import { useState, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Spade, Club, Heart, Diamond, Info, X, Trophy, Frown, Handshake } from 'lucide-react';
import api from '../../services/api';

// --- COMPONENTE CARTA ---
const Card = ({ card, hidden, small }) => (
    <div className={`
        flex-shrink-0 animate-in fade-in zoom-in slide-in-from-top-4 duration-500
        ${small ? 'w-12 h-16 md:w-14 md:h-20 text-xs' : 'w-16 h-24 md:w-20 md:h-28 text-base'}
        rounded-xl shadow-xl flex flex-col items-center justify-center relative transition-all select-none overflow-hidden
        ${hidden ? 'border-2 border-white/20 bg-black' : 'bg-white border border-zinc-300'}
    `}>
        {hidden ? (
            <img src="/assets/images/reverso-carta.png" alt="Hidden" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
            <>
                <span className={`font-black absolute top-1 left-1.5 leading-none ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>{card.value}</span>
                <span className={`text-2xl md:text-4xl ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>{card.suit}</span>
                <span className={`font-black absolute bottom-1 right-1.5 rotate-180 leading-none ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>{card.value}</span>
            </>
        )}
    </div>
);

// Calcular score visualmente en frontend (el servidor ya validó la lógica)
const calculateScore = (hand) => {
    let score = 0, aces = 0;
    hand.forEach(c => { if (c.hidden) return; score += c.weight; if (c.value === 'A') aces++; });
    while (score > 21 && aces > 0) { score -= 10; aces--; }
    return score;
};

export default function BlackJack() {
    const { user, setUser, setIsUiHidden } = useOutletContext();
    const navigate = useNavigate();

    // SALDO VISUAL INSTANTÁNEO
    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const [visualBalance, setVisualBalance] = useState(currentFichas);

    useEffect(() => { setVisualBalance(currentFichas); }, [currentFichas]);
    useEffect(() => { setIsUiHidden(true); return () => setIsUiHidden(false); }, [setIsUiHidden]);

    // Estados JWT y Backend
    const [sessionToken, setSessionToken] = useState(null);
    const [gameState, setGameState] = useState(null); // {pHands, dHand, activeHand, status, payout}

    const [bet, setBet] = useState(20);
    const [isProcessing, setIsProcessing] = useState(false);
    const [resultModal, setResultModal] = useState(null);
    const [showInfo, setShowInfo] = useState(false);

    // --- SINCRONIZACIÓN ---
    const updateBalanceInstant = (amountToAdd) => {
        setVisualBalance(prev => Math.max(0, prev + amountToAdd));
    };

    // --- ACCIÓN CENTRALIZADA HACIA EL BACKEND ---
    const handleAction = async (action) => {
        if (isProcessing) return;

        // Validaciones pre-vuelo
        if (action === 'deal' && visualBalance < bet) return alert("Fichas insuficientes");
        if (action === 'double' && visualBalance < gameState.pHands[gameState.activeHand].bet) return alert("Fichas insuficientes para doblar");

        setIsProcessing(true);
        if (action === 'deal') { setResultModal(null); updateBalanceInstant(-bet); }

        try {
            const res = await api.post('/games/blackjack', { action, bet, token: sessionToken });
            const { state, token, user: updatedUser } = res.data;

            setSessionToken(token);
            setGameState(state);

            // Si el estado es ended, mostrar modal de resultado
            if (state.status === 'ended') {
                setTimeout(() => {
                    const won = state.payout > 0;
                    const isPush = state.payout > 0 && state.payout === state.pHands.reduce((acc, h) => acc + h.bet, 0); // Lógica simple para UI de empate

                    if (updatedUser) {
                        setUser(updatedUser);
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        setVisualBalance(updatedUser.gameCoins ?? updatedUser.stats?.gameCoins ?? 0);
                    }

                    setResultModal({
                        type: won ? (isPush ? 'push' : 'win') : 'lose',
                        amount: state.payout
                    });
                }, 1000); // 1 segundo de suspense al levantar carta del dealer
            }

        } catch (error) {
            console.error("BJ Error:", error);
            alert(error.response?.data?.message || "Error conectando al casino.");
            if (action === 'deal') updateBalanceInstant(bet); // Rollback
        } finally {
            setIsProcessing(false);
        }
    };

    const resetGame = () => {
        setGameState(null);
        setSessionToken(null);
        setResultModal(null);
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-40 pb-4 overflow-hidden select-none font-sans">

            {/* HEADER FLOTANTE */}
            <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-50">
                <button onClick={() => navigate('/games')} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><ChevronLeft /></button>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-green-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-green-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <button onClick={() => setShowInfo(true)} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
            </div>

            {/* ZONA DE JUEGO */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-4 gap-6">

                {/* --- MESA --- */}
                <div className="w-full bg-[#1b4d3e] border-[8px] border-[#2d2a2a] rounded-[3rem] p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[480px]">
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>

                    {/* DEALER */}
                    <div className="flex flex-col items-center relative z-10 pt-4">
                        <div className="bg-black/60 px-4 py-1.5 rounded-full border border-white/10 mb-3 backdrop-blur-sm shadow-lg">
                            <span className="text-[10px] font-black text-zinc-200 uppercase tracking-widest">
                                Crupier: {gameState ? calculateScore(gameState.dHand) : '?'}
                            </span>
                        </div>
                        <div className="flex -space-x-8 h-28 items-center justify-center">
                            {gameState?.dHand ? gameState.dHand.map((c, i) => (
                                <Card key={i} card={c} hidden={c.hidden} />
                            )) : (
                                <div className="w-16 h-24 border-2 border-white/20 rounded-xl border-dashed opacity-30"></div>
                            )}
                        </div>
                    </div>

                    {/* JUGADOR */}
                    <div className="flex justify-center gap-4 relative z-10 pb-4">
                        {!gameState ? (
                            <div className="w-16 h-24 border-2 border-white/20 rounded-xl border-dashed opacity-30"></div>
                        ) : (
                            gameState.pHands.map((hand, index) => {
                                const isActive = gameState.status === 'playing' && index === gameState.activeHand;
                                const score = calculateScore(hand.cards);
                                return (
                                    <div key={index} className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-105 z-20' : 'opacity-80 scale-95 z-10'}`}>
                                        <div className="flex -space-x-8 mb-2">
                                            {hand.cards.map((c, idx) => <Card key={idx} card={c} small={gameState.pHands.length > 1} />)}
                                        </div>
                                        <div className={`px-3 py-1 rounded-full border text-xs font-black shadow-xl ${isActive ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-black/70 text-white border-white/20'}`}>
                                            {score}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* CONTROLES */}
                <div className="w-full bg-zinc-900/90 backdrop-blur-md rounded-[2.5rem] border border-white/10 p-5 shadow-2xl flex flex-col gap-4">
                    {gameState?.status === 'playing' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleAction('hit')} disabled={isProcessing} className="bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-black text-lg shadow-[0_4px_0_#14532d] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest disabled:opacity-50">PEDIR</button>
                            <button onClick={() => handleAction('stand')} disabled={isProcessing} className="bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black text-lg shadow-[0_4px_0_#7f1d1d] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest disabled:opacity-50">PLANTAR</button>

                            <button onClick={() => handleAction('double')} disabled={isProcessing || visualBalance < gameState.pHands[gameState.activeHand].bet || gameState.pHands[gameState.activeHand].cards.length !== 2} className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl font-bold text-sm shadow-[0_3px_0_#1e3a8a] active:shadow-none active:translate-y-1 transition-all uppercase disabled:opacity-50 disabled:grayscale">DOBLAR APUESTA</button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="bg-black rounded-2xl flex items-center p-1 border border-zinc-800 shrink-0 shadow-inner">
                                <button onClick={() => setBet(Math.max(10, bet - 10))} className="w-12 h-12 bg-zinc-800 rounded-xl text-white font-bold hover:bg-zinc-700 active:scale-95 transition-transform">-</button>
                                <div className="min-w-[80px] flex items-center justify-center gap-1 font-black text-yellow-500 text-xl">
                                    {bet}
                                    <img src="/assets/icons/ficha.png" className="w-6 h-6 object-contain drop-shadow-md" alt="c" />
                                </div>
                                <button onClick={() => setBet(Math.min(visualBalance, bet + 10))} className="w-12 h-12 bg-zinc-800 rounded-xl text-white font-bold hover:bg-zinc-700 active:scale-95 transition-transform">+</button>
                            </div>

                            <button
                                onClick={() => handleAction('deal')}
                                disabled={visualBalance < bet || isProcessing}
                                className="flex-1 h-14 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-xl rounded-2xl shadow-[0_4px_0_#b45309] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                            >
                                REPARTIR
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL RESULTADO */}
            {resultModal && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
                    <div className={`w-full max-w-xs rounded-[32px] p-8 text-center border-2 shadow-2xl relative ${resultModal.type === 'win' ? 'bg-green-900/40 border-green-500' : resultModal.type === 'lose' ? 'bg-red-900/40 border-red-500' : 'bg-zinc-900 border-zinc-500'}`}>
                        <div className="mb-6 flex justify-center">
                            <div className={`p-6 rounded-full border-4 shadow-xl ${resultModal.type === 'win' ? 'bg-green-500 border-green-300' : resultModal.type === 'lose' ? 'bg-red-500 border-red-300' : 'bg-zinc-600 border-zinc-400'}`}>
                                {resultModal.type === 'win' && <Trophy size={48} className="text-white animate-bounce" />}
                                {resultModal.type === 'lose' && <Frown size={48} className="text-white" />}
                                {resultModal.type === 'push' && <Handshake size={48} className="text-white" />}
                            </div>
                        </div>

                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">
                            {resultModal.type === 'win' ? '¡GANASTE!' : resultModal.type === 'lose' ? 'LA BANCA GANA' : 'EMPATE'}
                        </h2>

                        <div className="flex items-center justify-center gap-2 mb-8">
                            <span className={`text-2xl font-black ${resultModal.type === 'win' ? 'text-green-400' : resultModal.type === 'lose' ? 'text-red-400' : 'text-zinc-400'}`}>
                                {resultModal.type === 'win' ? '+' : ''}{resultModal.amount}
                            </span>
                            <img src="/assets/icons/ficha.png" className="w-8 h-8" alt="f" />
                        </div>

                        <button onClick={resetGame} className="w-full py-4 bg-white text-black font-black rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-transform hover:bg-zinc-200">
                            NUEVA RONDA
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL INFO */}
            {showInfo && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-900 w-full max-w-xs rounded-3xl border border-white/10 p-6 relative shadow-2xl">
                        <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                        <h3 className="text-xl font-black text-white text-center mb-4 uppercase italic">Reglas Blackjack</h3>
                        <div className="space-y-2 text-xs text-zinc-300">
                            <div className="flex justify-between bg-black/50 p-2 rounded border border-white/5"><span>Blackjack (A+10/J/Q/K)</span><span className="font-bold text-yellow-400">x2.5</span></div>
                            <div className="flex justify-between bg-black/50 p-2 rounded border border-white/5"><span>Victoria Normal</span><span className="font-bold text-green-400">x2</span></div>
                            <div className="flex justify-between bg-black/50 p-2 rounded border border-white/5"><span>Empate</span><span className="font-bold text-zinc-400">Recuperas</span></div>
                        </div>
                        <div className="mt-4 p-3 bg-green-900/20 rounded-xl border border-green-500/20 text-[10px] text-green-200 leading-relaxed text-center">El crupier debe pedir carta hasta sumar <strong>17</strong> o más.</div>
                    </div>
                </div>
            )}
        </div>
    );
}