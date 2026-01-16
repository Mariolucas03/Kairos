import { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, X, Trash2, Undo2, ChevronDown, ChevronUp, Trophy, Frown, Paintbrush } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../../services/api';

// --- CONSTANTES ---
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const SEGMENT_ANGLE = 360 / 37;
const CHIP_VALUES = [10, 20, 50, 100, 500];
const SPIN_DURATION = 3500;

const TABLE_ROWS = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
];

// --- LLUVIA DE FICHAS ---
const ChipRain = ({ isFading }) => {
    const [drops] = useState(() => Array.from({ length: 100 }).map((_, i) => ({
        id: i, left: Math.random() * 100, startTop: -(Math.random() * 100 + 10), delay: Math.random() * 0.5, duration: 1 + Math.random(), size: 15 + Math.random() * 30, opacity: 0.4 + Math.random() * 0.6,
    })));
    return (
        <div className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-1000 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
            <style>{`@keyframes cascadeFall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(150vh) rotate(720deg); } }`}</style>
            {drops.map((d) => <img key={d.id} src="/assets/icons/ficha.png" className="absolute will-change-transform" style={{ left: `${d.left}%`, top: `${d.startTop}vh`, width: `${d.size}px`, opacity: d.opacity, animation: `cascadeFall ${d.duration}s linear ${d.delay}s infinite` }} alt="" />)}
        </div>
    );
};

export default function Roulette() {
    const { user, setUser, setIsUiHidden } = useOutletContext();
    const navigate = useNavigate();

    // SALDO VISUAL
    const [visualBalance, setVisualBalance] = useState(user?.stats?.gameCoins ?? user?.gameCoins ?? 0);

    useEffect(() => {
        setVisualBalance(user?.stats?.gameCoins ?? user?.gameCoins ?? 0);
    }, [user?.stats?.gameCoins]);

    useEffect(() => { setIsUiHidden(true); return () => setIsUiHidden(false); }, [setIsUiHidden]);

    // Estados Juego
    const [selectedChip, setSelectedChip] = useState(10);
    const [bets, setBets] = useState([]);
    const currentBetTotal = useMemo(() => bets.reduce((acc, b) => acc + b.amount, 0), [bets]);

    // UI Modos
    const [paintMode, setPaintMode] = useState(false);
    const [isPointerDown, setIsPointerDown] = useState(false);
    const lastPaintedNumber = useRef(null);
    const [isTableOpen, setIsTableOpen] = useState(false);

    // Animación
    const [spinning, setSpinning] = useState(false);
    const [wheelRotation, setWheelRotation] = useState(0);
    const [ballRotation, setBallRotation] = useState(0);
    const [ballDistance, setBallDistance] = useState(100);

    const [resultModal, setResultModal] = useState(null);
    const [showInfo, setShowInfo] = useState(false);
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);

    // --- SYNC ---
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
        }
    };

    // --- APUESTAS ---
    const placeBet = (type, value, numbersCovered, multiplier) => {
        if (spinning) return;
        if (visualBalance < selectedChip) return;

        setVisualBalance(prev => prev - selectedChip);
        const newBet = { id: Math.random(), amount: selectedChip, type, value, numbers: numbersCovered, multiplier };
        setBets(prev => [...prev, newBet]);
    };

    const undoLastBet = () => {
        if (!spinning && bets.length > 0) {
            const lastBet = bets[bets.length - 1];
            setVisualBalance(prev => prev + lastBet.amount);
            setBets(prev => prev.slice(0, -1));
        }
    };

    const clearBets = () => {
        if (!spinning && bets.length > 0) {
            setVisualBalance(prev => prev + currentBetTotal);
            setBets([]);
        }
    };

    // --- PINTAR ---
    const handleInteractionStart = (num) => {
        setIsPointerDown(true);
        if (paintMode || !isPointerDown) {
            placeBet('number', num, [num], 36);
            lastPaintedNumber.current = num;
        }
    };

    const handleInteractionMove = (e) => {
        if (!paintMode || !isPointerDown) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const element = document.elementFromPoint(clientX, clientY);
        if (element && element.dataset.number) {
            const num = parseInt(element.dataset.number);
            if (num !== lastPaintedNumber.current) {
                placeBet('number', num, [num], 36);
                lastPaintedNumber.current = num;
            }
        }
    };

    const handleInteractionEnd = () => {
        setIsPointerDown(false);
        lastPaintedNumber.current = null;
    };

    const handleNumberClick = (num) => !paintMode && placeBet('number', num, [num], 36);

    // --- JUGAR ---
    const spin = async () => {
        if (bets.length === 0) {
            if (!isTableOpen) setIsTableOpen(true);
            return;
        }
        if (spinning) return;

        api.post('/users/reward', { gameCoins: -currentBetTotal })
            .then(res => syncUserWithServer(res.data.user))
            .catch(err => {
                console.error(err);
                setVisualBalance(prev => prev + currentBetTotal);
                setBets([]);
                alert("Error de conexión");
                return;
            });

        setIsTableOpen(false);
        setSpinning(true);
        setResultModal(null);
        setShowRain(false);
        setIsRainFading(false);
        setBallDistance(100);

        const winIndex = Math.floor(Math.random() * WHEEL_NUMBERS.length);
        const winNum = WHEEL_NUMBERS[winIndex];

        // Animación
        const wheelSpins = 5;
        const segmentCenterOffset = SEGMENT_ANGLE / 2;
        const currentRotationNormalized = wheelRotation % 360;
        const targetAngle = winIndex * SEGMENT_ANGLE;

        const newWheelRotation = wheelRotation + (360 * wheelSpins) + (targetAngle - currentRotationNormalized);
        setWheelRotation(newWheelRotation);

        const ballSpins = 8 * 360;
        setBallRotation(ballRotation + ballSpins);

        setTimeout(() => setBallDistance(54), SPIN_DURATION - 800);

        setTimeout(() => {
            setSpinning(false);
            resolveGame(winNum, [...bets]);
        }, SPIN_DURATION);
    };

    const resolveGame = (winNum, playedBets) => {
        let totalWin = 0;
        playedBets.forEach(bet => {
            if (bet.numbers.includes(winNum)) totalWin += bet.amount * bet.multiplier;
        });

        setBets([]);

        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winNum);
        const winColor = winNum === 0 ? 'green' : isRed ? 'red' : 'black';

        if (totalWin > 0) {
            setVisualBalance(prev => prev + totalWin);
            setShowRain(true);
            setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);
            confetti();
            api.post('/users/reward', { gameCoins: totalWin })
                .then(res => syncUserWithServer(res.data.user))
                .catch(console.error);
        } else {
            api.get('/auth/me').then(res => syncUserWithServer(res.data)).catch(() => { });
        }

        setResultModal({ won: totalWin > 0, num: winNum, color: winColor, payout: totalWin });
    };

    // --- ESTILOS ---
    const getNumColor = (n) => {
        if (n === 0) return 'bg-green-700 border-green-500';
        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n);
        return isRed ? 'bg-red-700 border-red-500' : 'bg-zinc-800 border-zinc-600';
    };

    const getChipColorStyle = (val) => {
        if (val === 10) return 'bg-red-600 border-red-400 text-white';
        if (val === 20) return 'bg-blue-600 border-blue-400 text-white';
        if (val === 50) return 'bg-green-600 border-green-400 text-white';
        if (val === 100) return 'bg-zinc-900 border-zinc-500 text-white';
        if (val === 500) return 'bg-yellow-500 border-yellow-300 text-black';
        return 'bg-zinc-700';
    };

    const getConsolidatedChipBgColor = (totalValue) => {
        if (totalValue >= 500) return 'bg-yellow-500 text-black';
        if (totalValue >= 100) return 'bg-zinc-900 text-white';
        if (totalValue >= 50) return 'bg-green-600 text-white';
        if (totalValue >= 20) return 'bg-blue-600 text-white';
        return 'bg-red-600 text-white';
    };

    const renderBoardChip = (filterFn) => {
        const chipsOnSpot = bets.filter(filterFn);
        if (chipsOnSpot.length === 0) return null;
        const totalOnSpot = chipsOnSpot.reduce((acc, bet) => acc + bet.amount, 0);
        return (
            <div className={`absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-white shadow-lg flex items-center justify-center text-[8px] font-black leading-none ${getConsolidatedChipBgColor(totalOnSpot)} pointer-events-none animate-in zoom-in duration-200`}>
                {totalOnSpot}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 bg-black flex flex-col items-center pt-20 overflow-hidden select-none font-sans"
            onMouseUp={handleInteractionEnd}
            onMouseLeave={handleInteractionEnd}
            onTouchEnd={handleInteractionEnd}
            onTouchMove={handleInteractionMove}
        >
            {showRain && <ChipRain isFading={isRainFading} />}

            {/* HEADER */}
            <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-20">
                <button onClick={() => navigate('/games')} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><ChevronLeft /></button>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-yellow-500/50 backdrop-blur-md shadow-2xl transition-all duration-200">
                    <span className="text-yellow-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <button onClick={() => setShowInfo(true)} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
            </div>

            {/* RUEDA (CENTRADA ARRIBA) */}
            <div className="flex-1 w-full flex flex-col items-center justify-start py-6 relative z-10 transition-all duration-500" style={{ opacity: isTableOpen ? 0.3 : 1, transform: isTableOpen ? 'scale(0.9) translateY(-20px)' : 'scale(1) translateY(0)' }}>
                <div className="relative w-72 h-72 md:w-80 md:h-80">
                    <div className="w-full h-full rounded-full border-[6px] border-zinc-800 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden"
                        style={{ transform: `rotate(-${wheelRotation}deg)`, transition: spinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1)` : 'none' }}>
                        <div className="absolute inset-0" style={{ background: `conic-gradient(${WHEEL_NUMBERS.map((n, i) => { const color = n === 0 ? '#15803d' : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n) ? '#b91c1c' : '#18181b'; return `${color} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`; }).join(', ')})` }}></div>
                        {WHEEL_NUMBERS.map((num, i) => (
                            <div key={i} className="absolute top-0 left-1/2 -ml-[1px] w-[2px] h-[50%] flex flex-col items-center pt-2 origin-bottom" style={{ transform: `rotate(${i * SEGMENT_ANGLE + (SEGMENT_ANGLE / 2)}deg)` }}>
                                <span className="text-[9px] font-black text-white drop-shadow-md transform rotate-180 w-6 text-center">{num}</span>
                            </div>
                        ))}
                        <div className="absolute inset-20 rounded-full border-[6px] border-zinc-800 bg-black flex items-center justify-center z-10 shadow-2xl">
                            <div className="w-2 h-2 bg-yellow-600/50 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    <div className="absolute inset-0 z-20 pointer-events-none" style={{ transform: `rotate(-${ballRotation}deg)`, transition: spinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.1, 0, 0.1, 1)` : 'none' }}>
                        <div className="absolute top-0 left-1/2 -ml-1 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_8px_white]" style={{ marginTop: `${(100 - ballDistance) / 2}%`, transition: spinning ? `margin-top 1s ease-in-out ${SPIN_DURATION - 1000}ms` : 'none' }}></div>
                    </div>
                </div>
            </div>

            {/* --- PANEL DESLIZANTE (BOTTOM SHEET) --- */}
            <div
                className={`fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-[2rem] border-t border-white/10 shadow-[0_-10px_60px_rgba(0,0,0,0.9)] z-30 flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)`}
                style={{ height: isTableOpen ? '65%' : '140px' }}
            >
                {/* 1. BARRA CONTROL (Siempre visible) */}
                <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-white/5 bg-zinc-900 rounded-t-[2rem]">
                    <button onClick={() => setPaintMode(!paintMode)} disabled={spinning} className={`p-2 rounded-xl border transition-all ${paintMode ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-zinc-800 border-zinc-600 text-zinc-400'}`}>
                        <Paintbrush size={18} />
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
                        {CHIP_VALUES.map((val) => (
                            <button key={val} onClick={() => setSelectedChip(val)} disabled={spinning || visualBalance < val} className={`w-8 h-8 rounded-full border shadow-md flex items-center justify-center font-bold text-[8px] shrink-0 transition-all ${getChipColorStyle(val)} ${selectedChip === val ? 'scale-110 ring-2 ring-white z-10' : 'opacity-70'} ${visualBalance < val ? 'opacity-20 grayscale' : ''}`}>{val}</button>
                        ))}
                    </div>
                    <button onClick={() => setIsTableOpen(!isTableOpen)} disabled={spinning} className="p-2 text-zinc-400 hover:text-white">
                        {isTableOpen ? <ChevronDown size={24} /> : <ChevronUp size={24} className="animate-bounce" />}
                    </button>
                </div>

                {/* 2. MESA (Visible solo abierta) */}
                <div className={`flex-1 overflow-hidden relative flex items-center justify-center bg-zinc-950/50 transition-opacity duration-300 ${isTableOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="transform scale-[0.65] origin-center w-full flex flex-col items-center">
                        {/* TABLERO */}
                        <div className="grid grid-cols-[50px_1fr_40px] gap-1 select-none min-w-[600px]">
                            <button onMouseDown={() => !paintMode && placeBet('number', 0, [0], 36)} onPointerDown={() => paintMode && handleInteractionStart(0)} onMouseEnter={(e) => paintMode && isPointerDown && handleInteractionMove(e)} data-number="0" className="rounded-l-lg border border-green-700 bg-green-900/60 flex items-center justify-center text-white font-black text-xl hover:bg-green-800 relative touch-none" style={{ gridRow: '1 / span 3' }}>
                                <span className="-rotate-90">0</span>
                                {renderBoardChip(b => b.value === 0)}
                            </button>
                            <div className="grid grid-cols-12 grid-rows-3 gap-[1px]">
                                {TABLE_ROWS.map((row) => row.map((num) => (
                                    <button key={num} onMouseDown={() => !paintMode && handleNumberClick(num)} onPointerDown={() => paintMode && handleInteractionStart(num)} onMouseEnter={(e) => paintMode && isPointerDown && handleInteractionMove(e)} data-number={num} className={`h-12 border flex items-center justify-center text-white font-bold text-lg relative ${getNumColor(num)} hover:brightness-125 touch-none`}>
                                        {num}
                                        {renderBoardChip(b => b.type === 'number' && b.value === num)}
                                    </button>
                                )))}
                            </div>
                            <div className="grid grid-rows-3 gap-[1px]">
                                {[3, 2, 1].map((colNum, i) => (
                                    <button key={i} onClick={() => placeBet('column', colNum, TABLE_ROWS[i], 3)} className="border border-zinc-600 bg-zinc-800/50 text-[10px] text-zinc-300 font-bold hover:bg-zinc-700 flex items-center justify-center relative rounded-r-lg">
                                        <span className="-rotate-90">2:1</span>
                                        {renderBoardChip(b => b.type === 'column' && b.value === colNum)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* EXTERNAS */}
                        <div className="mt-1 grid grid-cols-[50px_1fr_40px] gap-1 min-w-[600px]">
                            <div></div>
                            <div className="grid grid-rows-2 gap-1">
                                <div className="grid grid-cols-3 gap-1">
                                    {[1, 2, 3].map((d) => (
                                        <button key={d} onClick={() => placeBet('dozen', d, Array.from({ length: 12 }, (_, i) => i + 1 + (d - 1) * 12), 3)} className="h-10 bg-zinc-800 border border-zinc-600 rounded text-xs font-bold text-white hover:bg-zinc-700 relative">{d === 1 ? '1st 12' : d === 2 ? '2nd 12' : '3rd 12'} {renderBoardChip(b => b.type === 'dozen' && b.value === d)}</button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-6 gap-1">
                                    <button onClick={() => placeBet('low', 'low', Array.from({ length: 18 }, (_, i) => i + 1), 2)} className="h-10 bg-zinc-800 border border-zinc-600 rounded text-[10px] font-bold text-white relative">1-18 {renderBoardChip(b => b.type === 'low')}</button>
                                    <button onClick={() => placeBet('even', 'even', WHEEL_NUMBERS.filter(n => n !== 0 && n % 2 === 0), 2)} className="h-10 bg-zinc-800 border border-zinc-600 rounded text-[10px] font-bold text-white relative">PAR {renderBoardChip(b => b.type === 'even')}</button>
                                    <button onClick={() => placeBet('color', 'red', [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36], 2)} className="h-10 bg-red-700 border border-red-500 rounded text-[10px] font-bold text-white relative">ROJO {renderBoardChip(b => b.type === 'color' && b.value === 'red')}</button>
                                    <button onClick={() => placeBet('color', 'black', [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35], 2)} className="h-10 bg-black border border-zinc-600 rounded text-[10px] font-bold text-white relative">NEGRO {renderBoardChip(b => b.type === 'color' && b.value === 'black')}</button>
                                    <button onClick={() => placeBet('odd', 'odd', WHEEL_NUMBERS.filter(n => n !== 0 && n % 2 !== 0), 2)} className="h-10 bg-zinc-800 border border-zinc-600 rounded text-[10px] font-bold text-white relative">IMPAR {renderBoardChip(b => b.type === 'odd')}</button>
                                    <button onClick={() => placeBet('high', 'high', Array.from({ length: 18 }, (_, i) => i + 19), 2)} className="h-10 bg-zinc-800 border border-zinc-600 rounded text-[10px] font-bold text-white relative">19-36 {renderBoardChip(b => b.type === 'high')}</button>
                                </div>
                            </div>
                            <div></div>
                        </div>
                    </div>
                </div>

                {/* 3. FOOTER (Botones siempre visibles) */}
                <div className="px-4 pb-6 pt-2 flex gap-3 items-center border-t border-white/5 bg-zinc-900 mt-auto">
                    <div className="flex gap-1">
                        <button onClick={undoLastBet} disabled={spinning || bets.length === 0} className="p-3 bg-zinc-800 rounded-xl border border-zinc-600 text-zinc-400 disabled:opacity-30"><Undo2 size={20} /></button>
                        <button onClick={clearBets} disabled={spinning || bets.length === 0} className="p-3 bg-zinc-800 rounded-xl border border-zinc-600 text-red-400 disabled:opacity-30"><Trash2 size={20} /></button>
                    </div>

                    <button
                        onClick={() => {
                            if (bets.length === 0 && !isTableOpen) setIsTableOpen(true);
                            else spin();
                        }}
                        disabled={spinning}
                        className={`flex-1 font-black py-4 rounded-xl text-xl uppercase tracking-widest shadow-xl border-b-4 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${bets.length === 0 && !isTableOpen ? 'bg-zinc-700 text-white border-zinc-900' : 'bg-gradient-to-r from-yellow-500 to-yellow-700 text-black border-yellow-900'}`}
                    >
                        {spinning ? 'GIRANDO...' : (bets.length === 0 && !isTableOpen) ? 'APOSTAR' : 'GIRAR'}
                        {bets.length > 0 && <span className="text-sm font-bold bg-black/20 px-2 py-0.5 rounded text-yellow-900">{currentBetTotal}</span>}
                    </button>
                </div>
            </div>

            {/* MODAL RESULTADO */}
            {resultModal && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95 duration-200" onClick={() => setResultModal(null)}>
                    <div className={`w-full max-w-xs rounded-[32px] p-8 text-center border-2 shadow-2xl relative ${resultModal.won ? 'bg-green-900/40 border-green-500' : 'bg-red-900/40 border-red-500'}`} onClick={e => e.stopPropagation()}>
                        <div className="mb-4 flex justify-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-xl border-4 ${resultModal.color === 'red' ? 'bg-red-600 border-red-400' : resultModal.color === 'black' ? 'bg-black border-zinc-500' : 'bg-green-600 border-green-400'}`}>
                                {resultModal.num}
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">{resultModal.won ? '¡VICTORIA!' : 'SUERTE LA PRÓXIMA'}</h2>
                        {resultModal.won && (
                            <div className="flex items-center justify-center gap-2 mb-6 bg-black/40 py-2 rounded-xl">
                                <span className="text-3xl font-black text-green-400">+{resultModal.payout}</span>
                                <img src="/assets/icons/ficha.png" className="w-8 h-8" alt="f" />
                            </div>
                        )}
                        <button onClick={() => setResultModal(null)} className="w-full py-4 bg-white text-black font-black rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-transform hover:bg-zinc-200">CONTINUAR</button>
                    </div>
                </div>
            )}

            {/* MODAL INFO */}
            {showInfo && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-900 w-full max-w-xs rounded-3xl border border-white/10 p-6 relative shadow-2xl">
                        <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                        <h3 className="text-xl font-black text-white text-center mb-6 uppercase italic">Pagos</h3>
                        <div className="space-y-2 text-xs text-zinc-300">
                            <div className="flex justify-between bg-black/50 p-2 rounded border border-white/5"><span>Pleno (1 Núm)</span><span className="text-yellow-400 font-bold">x36</span></div>
                            <div className="flex justify-between bg-black/50 p-2 rounded border border-white/5"><span>Columna / Docena</span><span className="text-yellow-400 font-bold">x3</span></div>
                            <div className="flex justify-between bg-black/50 p-2 rounded border border-white/5"><span>Color / Par / Impar</span><span className="text-yellow-400 font-bold">x2</span></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}