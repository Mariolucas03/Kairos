import { useState, useEffect } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Spade, Club, Heart, Diamond, Info, X, Trophy, Frown, Handshake } from 'lucide-react';
import api from '../../services/api';

// --- UTILIDAD PARA PAUSAS ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- COMPONENTE DE CATARATA DE FICHAS ---
const ChipRain = ({ isFading }) => {
    const [drops] = useState(() => Array.from({ length: 200 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        startTop: -(Math.random() * 150 + 10),
        delay: Math.random() * 1,
        duration: 1.2 + Math.random(),
        size: 15 + Math.random() * 60,
        opacity: 0.3 + Math.random() * 0.7
    })));

    return (
        <div className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-1000 ease-out ${isFading ? 'opacity-0' : 'opacity-100'}`}>
            <style>{`@keyframes cascadeFall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(150vh) rotate(720deg); } }`}</style>
            {drops.map((drop) => (
                <img key={drop.id} src="/assets/icons/ficha.png" alt="ficha" className="absolute will-change-transform" style={{ left: `${drop.left}%`, top: `${drop.startTop}vh`, width: `${drop.size}px`, height: `${drop.size}px`, opacity: drop.opacity, animation: `cascadeFall ${drop.duration}s linear ${drop.delay}s infinite` }} />
            ))}
        </div>
    );
};

// LÓGICA DE BARAJA
const SUITS = ['♠', '♥', '♣', '♦'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const createDeck = () => {
    let deck = [];
    for (let suit of SUITS) for (let value of VALUES) {
        let weight = parseInt(value);
        if (['J', 'Q', 'K'].includes(value)) weight = 10;
        if (value === 'A') weight = 11;
        deck.push({ suit, value, weight, id: Math.random() });
    }
    return deck.sort(() => Math.random() - 0.5);
};

const calculateScore = (hand) => {
    let score = 0, aces = 0;
    hand.forEach(c => { score += c.weight; if (c.value === 'A') aces++; });
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

    // Ocultar UI global
    useEffect(() => {
        setIsUiHidden(true);
        return () => setIsUiHidden(false);
    }, [setIsUiHidden]);

    const [deck, setDeck] = useState([]);
    const [dealerHand, setDealerHand] = useState([]);
    const [playerHands, setPlayerHands] = useState([]);
    const [currentHandIndex, setCurrentHandIndex] = useState(0);

    const [gameState, setGameState] = useState('betting');
    const [bet, setBet] = useState(20);
    const [isProcessing, setIsProcessing] = useState(false);

    // Estados UI
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [resultModal, setResultModal] = useState(null);

    useEffect(() => { setDeck(createDeck()); }, []);

    // --- FUNCIÓN CRÍTICA: SINCRONIZAR CON HEADER ---
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

    // --- PAGO INSTANTÁNEO (OPTIMISTA) ---
    const updateBalanceInstant = (amountToAdd) => {
        setVisualBalance(prev => Math.max(0, prev + amountToAdd));
        setUser(prevUser => {
            const current = prevUser.stats?.gameCoins ?? prevUser.gameCoins ?? 0;
            const newBalance = Math.max(0, current + amountToAdd);
            const updatedUser = { ...prevUser, gameCoins: newBalance, stats: { ...prevUser.stats, gameCoins: newBalance } };
            return updatedUser;
        });
    };

    // --- REPARTIR INICIAL ---
    const dealGame = async () => {
        if (visualBalance < bet) { alert("No tienes suficientes fichas"); return; }
        if (isProcessing) return;
        setIsProcessing(true);

        setResultModal(null);
        setShowRain(false); setIsRainFading(false);

        // 1. Cobro Instantáneo Visual
        updateBalanceInstant(-bet);

        // 2. Cobro Real en Backend
        api.post('/users/reward', { gameCoins: -bet })
            .then(res => syncUserWithServer(res.data.user))
            .catch(err => {
                console.error(err);
                updateBalanceInstant(bet); // Rollback
            });

        setGameState('dealing');
        setDealerHand([]);
        setPlayerHands([]);
        setCurrentHandIndex(0);

        let currentDeck = [...deck];
        if (currentDeck.length < 15) currentDeck = createDeck();

        // Reparto animación
        const p1 = currentDeck.pop();
        setPlayerHands([{ cards: [p1], bet: bet, isDone: false, isDoubled: false }]);
        setDeck([...currentDeck]);
        await sleep(400);

        const d1 = currentDeck.pop();
        setDealerHand([d1]);
        setDeck([...currentDeck]);
        await sleep(400);

        const p2 = currentDeck.pop();
        setPlayerHands(prev => {
            const newHands = [...prev];
            const updatedHand = { ...newHands[0] };
            updatedHand.cards = [...updatedHand.cards, p2];
            newHands[0] = updatedHand;
            return newHands;
        });
        setDeck([...currentDeck]);
        await sleep(400);

        const d2 = currentDeck.pop();
        setDealerHand([d1, d2]);
        setDeck([...currentDeck]);
        await sleep(400);

        setGameState('playing');
        setIsProcessing(false);

        // Check Blackjack Natural
        if (calculateScore([p1, p2]) === 21) {
            setPlayerHands([{ cards: [p1, p2], bet: bet, isDone: true, isDoubled: false }]);
            await sleep(500);
            resolveGame([d1, d2], [{ cards: [p1, p2], bet: bet, isDone: true }]);
        }
    };

    // --- ACCIONES ---
    const hit = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        const newDeck = [...deck];
        const card = newDeck.pop();
        setDeck(newDeck);

        let busted = false;

        setPlayerHands(prev => {
            const newHands = [...prev];
            const currentHand = { ...newHands[currentHandIndex], cards: [...newHands[currentHandIndex].cards] };
            currentHand.cards.push(card);
            newHands[currentHandIndex] = currentHand;

            if (calculateScore(currentHand.cards) > 21) {
                currentHand.isDone = true;
                busted = true;
            }
            return newHands;
        });

        await sleep(500);

        if (busted) {
            nextHand(playerHands);
        }
        setIsProcessing(false);
    };

    const stand = () => {
        if (isProcessing) return;
        setPlayerHands(prev => {
            const newHands = [...prev];
            newHands[currentHandIndex] = { ...newHands[currentHandIndex], isDone: true };
            setTimeout(() => nextHand(newHands), 0);
            return newHands;
        });
    };

    const doubleDown = () => {
        const currentHand = playerHands[currentHandIndex];
        if (visualBalance < currentHand.bet) { alert("No tienes fichas para doblar"); return; }
        if (isProcessing) return;
        setIsProcessing(true);

        updateBalanceInstant(-currentHand.bet);
        api.post('/users/reward', { gameCoins: -currentHand.bet })
            .then(res => syncUserWithServer(res.data.user))
            .catch(err => updateBalanceInstant(currentHand.bet));

        const newDeck = [...deck];
        const card = newDeck.pop();
        setDeck(newDeck);

        setPlayerHands(prev => {
            const newHands = [...prev];
            const handCopy = { ...newHands[currentHandIndex], cards: [...newHands[currentHandIndex].cards] };
            handCopy.bet *= 2;
            handCopy.isDoubled = true;
            handCopy.cards.push(card);
            handCopy.isDone = true;
            newHands[currentHandIndex] = handCopy;

            setTimeout(() => {
                nextHand(newHands);
                setIsProcessing(false);
            }, 1000);
            return newHands;
        });
    };

    const split = async () => {
        const currentHand = playerHands[currentHandIndex];
        if (visualBalance < currentHand.bet) { alert("No tienes fichas para dividir"); return; }
        if (isProcessing) return;
        setIsProcessing(true);

        updateBalanceInstant(-currentHand.bet);
        api.post('/users/reward', { gameCoins: -currentHand.bet })
            .then(res => syncUserWithServer(res.data.user))
            .catch(err => updateBalanceInstant(currentHand.bet));

        let currentDeck = [...deck];
        const splitCard1 = currentHand.cards[0];
        const splitCard2 = currentHand.cards[1];

        const hand1Base = { cards: [splitCard1], bet: currentHand.bet, isDone: false };
        const hand2Base = { cards: [splitCard2], bet: currentHand.bet, isDone: false };

        let tempHands = [...playerHands];
        tempHands.splice(currentHandIndex, 1, hand1Base, hand2Base);
        setPlayerHands(tempHands);
        await sleep(500);

        const card1 = currentDeck.pop();
        tempHands = [...tempHands];
        tempHands[currentHandIndex].cards = [splitCard1, card1];
        setPlayerHands([...tempHands]);
        setDeck([...currentDeck]);
        await sleep(500);

        const card2 = currentDeck.pop();
        tempHands = [...tempHands];
        tempHands[currentHandIndex + 1].cards = [splitCard2, card2];
        setPlayerHands([...tempHands]);
        setDeck([...currentDeck]);

        setIsProcessing(false);
    };

    const nextHand = (currentHandsState) => {
        const handsToCheck = currentHandsState || playerHands;
        const nextIndex = handsToCheck.findIndex(h => !h.isDone);

        if (nextIndex !== -1) {
            setCurrentHandIndex(nextIndex);
        } else {
            setGameState('dealerTurn');
            playDealer(handsToCheck);
        }
    };

    const playDealer = async (finalPlayerHands) => {
        const allBusted = finalPlayerHands.every(h => calculateScore(h.cards) > 21);

        if (allBusted) {
            await sleep(500);
            resolveGame(dealerHand, finalPlayerHands);
            return;
        }

        let dHand = [...dealerHand];
        let currentDeck = [...deck];

        while (calculateScore(dHand) < 17) {
            await sleep(1000);
            dHand.push(currentDeck.pop());
            setDealerHand([...dHand]);
            setDeck([...currentDeck]);
        }

        await sleep(800);
        resolveGame(dHand, finalPlayerHands);
    };

    const resolveGame = (finalDealerHand, finalPlayerHands) => {
        setGameState('ended');
        const dScore = calculateScore(finalDealerHand);
        let totalWin = 0;
        let anyWin = false;
        let anyPush = false;

        finalPlayerHands.forEach(hand => {
            const pScore = calculateScore(hand.cards);
            let handWin = 0;

            if (pScore > 21) {
                handWin = 0;
            } else if (dScore > 21 || pScore > dScore) {
                if (pScore === 21 && hand.cards.length === 2 && !hand.isDoubled && finalPlayerHands.length === 1) {
                    handWin = hand.bet * 2.5;
                } else {
                    handWin = hand.bet * 2;
                }
                anyWin = true;
            } else if (pScore === dScore) {
                handWin = hand.bet;
                anyPush = true;
            }
            totalWin += handWin;
        });

        if (anyWin) {
            setResultModal({ type: 'win', amount: totalWin });
            updateBalanceInstant(totalWin);
            api.post('/users/reward', { gameCoins: totalWin })
                .then(res => syncUserWithServer(res.data.user))
                .catch(console.error);

            const totalBet = finalPlayerHands.reduce((acc, h) => acc + h.bet, 0);
            if (totalWin > totalBet) {
                setShowRain(true);
                setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);
            }
        } else if (anyPush && totalWin > 0) {
            setResultModal({ type: 'push', amount: totalWin });
            updateBalanceInstant(totalWin);
            api.post('/users/reward', { gameCoins: totalWin })
                .then(res => syncUserWithServer(res.data.user))
                .catch(console.error);
        } else {
            setResultModal({ type: 'lose', amount: 0 });
            api.get('/auth/me').then(res => syncUserWithServer(res.data)).catch(() => { });
        }
    };

    // --- VARIABLES DE ESTADO ---
    const canDouble = gameState === 'playing' && playerHands[currentHandIndex]?.cards.length === 2;
    const canSplit = gameState === 'playing' &&
        playerHands[currentHandIndex]?.cards.length === 2 &&
        playerHands[currentHandIndex].cards[0].weight === playerHands[currentHandIndex].cards[1].weight;

    // --- COMPONENTE VISUAL CARTA (TAMAÑO ORIGINAL RESTAURADO) ---
    const Card = ({ card, hidden, small }) => (
        <div
            className={`
                flex-shrink-0
                animate-in fade-in zoom-in slide-in-from-top-4 duration-500
                ${/* 🔥 TAMAÑO ESTÁNDAR RESTAURADO 🔥 */ ''}
                ${small ? 'w-12 h-16 md:w-14 md:h-20 text-xs' : 'w-16 h-24 md:w-20 md:h-28 text-base'}
                rounded-xl shadow-xl flex flex-col items-center justify-center relative transition-all select-none overflow-hidden
                ${hidden ? 'border-2 border-white/20' : 'bg-white border border-zinc-300'}
            `}
        >
            {hidden ? (
                <img
                    src="/assets/images/reverso-carta.png"
                    alt="Hidden"
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <>
                    <span className={`font-black absolute top-1 left-1.5 leading-none ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>{card.value}</span>
                    <span className={`text-2xl md:text-4xl ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>{card.suit}</span>
                    <span className={`font-black absolute bottom-1 right-1.5 rotate-180 leading-none ${['♥', '♦'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>{card.value}</span>
                </>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-40 pb-4 overflow-hidden select-none">

            {showRain && <ChipRain isFading={isRainFading} />}

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
                                Crupier: {(gameState === 'playing' || gameState === 'dealing') ? '?' : calculateScore(dealerHand)}
                            </span>
                        </div>
                        <div className="flex -space-x-8 h-28 items-center justify-center">
                            {dealerHand.map((c, i) => (
                                <Card key={c.id} card={c} hidden={i === 1 && (gameState === 'playing' || gameState === 'dealing')} />
                            ))}
                            {dealerHand.length === 0 && <div className="w-16 h-24 border-2 border-white/20 rounded-xl border-dashed opacity-30"></div>}
                        </div>
                    </div>

                    {/* JUGADOR */}
                    <div className="flex justify-center gap-4 relative z-10 pb-4">
                        {playerHands.length === 0 ? (
                            <div className="w-16 h-24 border-2 border-white/20 rounded-xl border-dashed opacity-30"></div>
                        ) : (
                            playerHands.map((hand, index) => {
                                const isActive = gameState === 'playing' && index === currentHandIndex;
                                const score = calculateScore(hand.cards);
                                return (
                                    <div key={index} className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-105 z-20' : 'opacity-80 scale-95 z-10'}`}>
                                        <div className="flex -space-x-8 mb-2">
                                            {hand.cards.map((c) => <Card key={c.id} card={c} small={playerHands.length > 1} />)}
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

                    {gameState === 'playing' && (
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={hit} disabled={isProcessing} className="bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-black text-lg shadow-[0_4px_0_#14532d] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest">PEDIR</button>
                            <button onClick={stand} disabled={isProcessing} className="bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black text-lg shadow-[0_4px_0_#7f1d1d] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest">PLANTAR</button>

                            <button onClick={doubleDown} disabled={isProcessing || !canDouble || visualBalance < playerHands[currentHandIndex]?.bet} className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl font-bold text-xs shadow-[0_3px_0_#1e3a8a] active:shadow-none active:translate-y-1 transition-all uppercase disabled:opacity-50 disabled:grayscale">DOBLAR</button>
                            <button onClick={split} disabled={isProcessing || !canSplit || visualBalance < playerHands[currentHandIndex]?.bet} className="bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-2xl font-bold text-xs shadow-[0_3px_0_#581c87] active:shadow-none active:translate-y-1 transition-all uppercase disabled:opacity-50 disabled:grayscale">DIVIDIR</button>
                        </div>
                    )}

                    {(gameState === 'betting' || gameState === 'ended' || gameState === 'dealerTurn') && (
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
                                onClick={dealGame}
                                disabled={visualBalance < bet}
                                className="flex-1 h-14 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-xl rounded-2xl shadow-[0_4px_0_#b45309] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                            >
                                {gameState === 'ended' ? 'REPETIR' : 'REPARTIR'}
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