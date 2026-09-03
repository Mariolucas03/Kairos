import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Info, X, Trash2, Undo2, RotateCw, ChevronDown, ChevronUp, Trophy, Frown, Paintbrush, Handshake, Pencil, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import BackButton from '../../components/common/BackButton';
import api from '../../services/api';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../../store/useAuthStore';
import RuedaRuleta, { RADIO_PISTA, RADIO_CASILLA } from '../../components/games/RuedaRuleta';

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
    // 🔥 CONECTAMOS CON ZUSTAND
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);
    const navigate = useNavigate();

    useEffect(() => { setIsUiHidden(true); return () => setIsUiHidden(false); }, [setIsUiHidden]);

    // Estados Juego
    const [selectedChip, setSelectedChip] = useState(10);

    // LA FICHA DE CANTIDAD LIBRE.
    //
    // Habia cinco valores y ninguno mas: 10, 20, 50, 100 y 500. Con mil fichas
    // en el bolsillo, apostar 250 a un color significaba colocar cinco fichas de
    // 50 una encima de otra, y deshacerlo eran cinco toques en la flecha. Ahora
    // se escribe la cantidad y la ficha vale eso.
    const [fichaLibre, setFichaLibre] = useState(null);
    const [editandoFicha, setEditandoFicha] = useState(false);
    const [textoFicha, setTextoFicha] = useState('');

    const confirmarFichaLibre = () => {
        const n = Math.floor(Number(textoFicha));
        if (Number.isFinite(n) && n > 0) {
            setFichaLibre(n);
            setSelectedChip(n);
        }
        setEditandoFicha(false);
    };
    const [bets, setBets] = useState([]);
    const [lastBets, setLastBets] = useState([]);   // para "repetir apuesta"
    const [errorMsg, setErrorMsg] = useState(null);
    const currentBetTotal = useMemo(() => bets.reduce((acc, b) => acc + b.amount, 0), [bets]);

    // SALDO VISUAL — derivado, nunca un estado paralelo.
    // Antes era un useState que se resincronizaba con el usuario global: si el
    // usuario se refrescaba con apuestas puestas, el saldo volvía a subir y se
    // podía apostar más de lo que había (el servidor lo rechazaba después).
    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const visualBalance = Math.max(0, currentFichas - currentBetTotal);

    // UI Modos
    const [paintMode, setPaintMode] = useState(false);
    const [isPointerDown, setIsPointerDown] = useState(false);
    const lastPaintedNumber = useRef(null);
    const [isTableOpen, setIsTableOpen] = useState(false);

    // Animación
    const [spinning, setSpinning] = useState(false);
    const [wheelRotation, setWheelRotation] = useState(0);
    const [ballRotation, setBallRotation] = useState(0);
    // En tanto por ciento del radio: la pista por fuera, la casilla al parar.
    const [ballDistance, setBallDistance] = useState(RADIO_PISTA);

    const [resultModal, setResultModal] = useState(null);
    const [showInfo, setShowInfo] = useState(false);
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);

    // --- APUESTAS ---
    const placeBet = (type, value, numbersCovered, multiplier) => {
        if (spinning) return;
        if (visualBalance < selectedChip) {
            setErrorMsg('No te quedan fichas para esa apuesta');
            return;
        }
        const newBet = { id: Math.random(), amount: selectedChip, type, value, numbers: numbersCovered, multiplier };
        setBets(prev => [...prev, newBet]);
    };

    const undoLastBet = () => {
        if (!spinning && bets.length > 0) setBets(prev => prev.slice(0, -1));
    };

    const clearBets = () => {
        if (!spinning && bets.length > 0) setBets([]);
    };

    // Repetir la apuesta de la ronda anterior (clásico de cualquier ruleta)
    const repeatBets = () => {
        if (spinning || lastBets.length === 0) return;
        const total = lastBets.reduce((a, b) => a + b.amount, 0);
        if (total > currentFichas) { setErrorMsg('No te llegan las fichas para repetir'); return; }
        setBets(lastBets.map(b => ({ ...b, id: Math.random() })));
    };

    // --- PINTAR ---
    const handleInteractionStart = (num) => {
        setIsPointerDown(true);
        if (paintMode || !isPointerDown) { placeBet('number', num, [num], 36); lastPaintedNumber.current = num; }
    };
    const handleInteractionMove = (e) => {
        if (!paintMode || !isPointerDown) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const element = document.elementFromPoint(clientX, clientY);
        if (element && element.dataset.number) {
            const num = parseInt(element.dataset.number);
            if (num !== lastPaintedNumber.current) { placeBet('number', num, [num], 36); lastPaintedNumber.current = num; }
        }
    };
    const handleInteractionEnd = () => { setIsPointerDown(false); lastPaintedNumber.current = null; };
    const handleNumberClick = (num) => !paintMode && placeBet('number', num, [num], 36);

    // --- JUGAR (BACKEND CONECTADO) ---
    const spin = async () => {
        if (bets.length === 0) { if (!isTableOpen) setIsTableOpen(true); return; }
        if (spinning) return;

        setIsTableOpen(false);
        setSpinning(true);
        setResultModal(null);
        setErrorMsg(null);
        setShowRain(false);
        setIsRainFading(false);
        setBallDistance(RADIO_PISTA);

        const apuestaDeEstaRonda = bets;

        try {
            // 1. Pedir resultado al servidor
            const res = await api.post('/games/roulette', { bets });
            const { winNum, totalWin, user: updatedUser } = res.data;

            // 2. Calcular animación exacta para que caiga en winNum
            //
            // ⚠️ Los números se dibujan en el CENTRO de su casilla
            // (i * SEGMENT_ANGLE + SEGMENT_ANGLE/2), pero aquí se giraba solo
            // hasta el BORDE de la casilla. Faltaba medio segmento, así que la
            // bola caía siempre en la raya entre el número premiado y el de al
            // lado, y parecía que la ruleta pagaba un número distinto del que
            // salía.
            const winIndex = WHEEL_NUMBERS.indexOf(winNum);
            const wheelSpins = 5;
            const currentRotationNormalized = wheelRotation % 360;
            const targetAngle = winIndex * SEGMENT_ANGLE + (SEGMENT_ANGLE / 2);
            const newWheelRotation = wheelRotation + (360 * wheelSpins) + (targetAngle - currentRotationNormalized);

            setWheelRotation(newWheelRotation);
            setBallRotation(ballRotation + (8 * 360));
            setTimeout(() => setBallDistance(RADIO_CASILLA), SPIN_DURATION - 800);

            // 3. Finalizar y mostrar premios
            setTimeout(() => {
                setSpinning(false);
                setLastBets(apuestaDeEstaRonda);
                setBets([]);

                const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winNum);
                const winColor = winNum === 0 ? 'green' : isRed ? 'red' : 'black';

                setResultModal({ won: totalWin > 0, num: winNum, color: winColor, payout: totalWin });

                if (totalWin > 0) {
                    setShowRain(true);
                    setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);
                    confetti();
                }

                // Sincronizar el saldo devuelto por el servidor
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));

            }, SPIN_DURATION);

        } catch (error) {
            console.error(error);
            // El saldo se recalcula solo al vaciar las apuestas: no hay rollback manual.
            setErrorMsg(error.response?.data?.message || 'No se pudo tirar. Inténtalo otra vez.');
            setSpinning(false);
            setBets([]);
        }
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
        <div className="fixed inset-0 bg-black flex flex-col items-center pt-20 overflow-hidden select-none font-sans" onMouseUp={handleInteractionEnd} onMouseLeave={handleInteractionEnd} onTouchEnd={handleInteractionEnd} onTouchMove={handleInteractionMove}>
            {showRain && <ChipRain isFading={isRainFading} />}

            {/* HEADER */}
            <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-20">
                <BackButton to="/games" />
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-yellow-500/50 backdrop-blur-md shadow-2xl transition-all duration-200">
                    <span className="text-yellow-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <button onClick={() => setShowInfo(true)} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
            </div>

            {/* RUEDA */}
            <div className="flex-1 w-full flex flex-col items-center justify-center pb-32 relative z-10 transition-all duration-500" style={{ opacity: isTableOpen ? 0.3 : 1, transform: isTableOpen ? 'scale(0.9) translateY(-20px)' : 'scale(1) translateY(0)' }}>
                <div className="relative w-[86vw] h-[86vw] max-w-[340px] max-h-[340px] drop-shadow-[0_18px_40px_rgba(0,0,0,0.9)]">
                    <RuedaRuleta
                        numeros={WHEEL_NUMBERS}
                        anguloSegmento={SEGMENT_ANGLE}
                        rotacion={wheelRotation}
                        girando={spinning}
                        duracion={SPIN_DURATION}
                    />

                    {/* LA BOLA. Va fuera del SVG y en su propia capa porque gira
                        a otro ritmo que la rueda: es lo que hace que parezca que
                        rueda de verdad y no que esté pegada a una casilla. */}
                    <div className="absolute inset-0 z-20 pointer-events-none" style={{ transform: `rotate(-${ballRotation}deg)`, transition: spinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.1, 0, 0.1, 1)` : 'none' }}>
                        <div
                            className="absolute top-0 left-1/2 -ml-[7px] w-3.5 h-3.5 rounded-full"
                            style={{
                                marginTop: `${(100 - ballDistance) / 2}%`,
                                transition: spinning ? `margin-top 1s ease-in-out ${SPIN_DURATION - 1000}ms` : 'none',
                                background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #e9ecf0 45%, #9aa1a8 100%)',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.85), inset 0 -1px 2px rgba(0,0,0,0.35)'
                            }}
                        />
                    </div>

                    {/* Marcador fijo: deja claro qué casilla es la ganadora */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                        <div className="w-0 h-0 border-l-[9px] border-r-[9px] border-t-[14px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                    </div>
                </div>

                {/* Aviso de error, en vez del alert() del navegador */}
                {errorMsg && (
                    <div onClick={() => setErrorMsg(null)} className="mt-4 mx-6 bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase tracking-wide px-4 py-2.5 rounded-2xl text-center animate-in fade-in cursor-pointer">
                        {errorMsg}
                    </div>
                )}
            </div>

            {/* PANEL DESLIZANTE MESA */}
            <div className={`fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-[2rem] border-t border-white/10 shadow-[0_-10px_60px_rgba(0,0,0,0.9)] z-30 flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)`} style={{ height: isTableOpen ? '65%' : '140px' }}>
                <div className="px-3 pt-3 pb-2 border-b border-white/5 bg-zinc-900 rounded-t-[2rem]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <button onClick={() => setPaintMode(!paintMode)} disabled={spinning} aria-label="Pintar apuestas arrastrando" className={`p-2 rounded-xl border transition-all ${paintMode ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-zinc-800 border-zinc-600 text-zinc-400'}`}>
                        <Paintbrush size={18} />
                    </button>

                    {/* Lo puesto y lo que queda. Estaba solo dentro del botón de
                        girar, en letra pequeña. */}
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.08em] not-italic">
                        <span className="text-zinc-500">Mesa <span className="text-yellow-500 tabular-nums text-xs">{currentBetTotal.toLocaleString('es-ES')}</span></span>
                        <span className="text-zinc-700">·</span>
                        <span className="text-zinc-500">Quedan <span className="text-zinc-200 tabular-nums text-xs">{visualBalance.toLocaleString('es-ES')}</span></span>
                    </div>

                    <button onClick={() => setIsTableOpen(!isTableOpen)} disabled={spinning} aria-label={isTableOpen ? 'Cerrar la mesa' : 'Abrir la mesa'} className="p-2 text-zinc-400 hover:text-white">
                        {isTableOpen ? <ChevronDown size={24} /> : <ChevronUp size={24} className="animate-bounce" />}
                    </button>
                  </div>
                    {editandoFicha ? (
                        /* Escribiendo la cantidad: ocupa toda la fila, que en una
                           barra de 375 px no caben un campo y seis fichas. */
                        <div className="flex-1 flex items-center gap-2">
                            <input
                                type="text"
                                inputMode="numeric"
                                autoFocus
                                value={textoFicha}
                                onChange={(e) => setTextoFicha(e.target.value.replace(/[^\d]/g, '').slice(0, 7))}
                                onKeyDown={(e) => e.key === 'Enter' && confirmarFichaLibre()}
                                placeholder="Cantidad"
                                className="flex-1 min-w-0 bg-black border border-yellow-500/50 rounded-xl px-3 py-2 text-center text-lg font-black text-yellow-500 tabular-nums outline-none placeholder:text-zinc-700 placeholder:text-sm"
                            />
                            <button onClick={confirmarFichaLibre} className="p-2 rounded-xl bg-yellow-500 text-black active:scale-90 transition-transform"><Check size={18} /></button>
                            <button onClick={() => setEditandoFicha(false)} className="p-2 rounded-xl bg-zinc-800 border border-zinc-600 text-zinc-400"><X size={18} /></button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
                            {CHIP_VALUES.map((val) => (
                                <button
                                    key={val}
                                    onClick={() => setSelectedChip(val)}
                                    disabled={spinning || visualBalance < val}
                                    aria-label={`Ficha de ${val}`}
                                    className={`w-11 h-11 rounded-full border-2 shadow-md flex items-center justify-center font-black text-[11px] shrink-0 transition-all ${getChipColorStyle(val)} ${selectedChip === val ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900 z-10' : 'opacity-60'} ${visualBalance < val ? 'opacity-20 grayscale' : ''}`}
                                >{val}</button>
                            ))}

                            {/* La de cantidad libre. Enseña su valor cuando ya lo
                                tiene, para no perder de vista con cuánto juegas. */}
                            <button
                                onClick={() => { setTextoFicha(fichaLibre ? String(fichaLibre) : ''); setEditandoFicha(true); }}
                                disabled={spinning}
                                aria-label="Ficha de cantidad libre"
                                className={`w-11 h-11 rounded-full border-2 border-dashed shadow-md flex items-center justify-center shrink-0 transition-all ${fichaLibre && selectedChip === fichaLibre
                                    ? 'bg-yellow-500 border-yellow-200 text-black scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900 z-10'
                                    : 'bg-zinc-800 border-zinc-500 text-zinc-300 opacity-70'}`}
                            >
                                {fichaLibre
                                    ? <span className="font-black text-[10px] tabular-nums leading-none px-0.5">{fichaLibre >= 1000 ? `${Math.round(fichaLibre / 100) / 10}k` : fichaLibre}</span>
                                    : <Pencil size={15} />}
                            </button>
                        </div>
                    )}
                </div>

                <div className={`flex-1 overflow-hidden relative flex items-center justify-center bg-zinc-950/50 transition-opacity duration-300 ${isTableOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="transform scale-[0.65] origin-center w-full flex flex-col items-center">
                        <div className="grid grid-cols-[50px_1fr_40px] gap-1 select-none min-w-[600px]">
                            <button onMouseDown={() => !paintMode && placeBet('number', 0, [0], 36)} onPointerDown={() => paintMode && handleInteractionStart(0)} onMouseEnter={(e) => paintMode && isPointerDown && handleInteractionMove(e)} data-number="0" className="rounded-l-lg border border-green-700 bg-green-900/60 flex items-center justify-center text-white font-black text-xl hover:bg-green-800 relative touch-none" style={{ gridRow: '1 / span 3' }}>
                                <span className="-rotate-90">0</span>{renderBoardChip(b => b.value === 0)}
                            </button>
                            <div className="grid grid-cols-12 grid-rows-3 gap-[1px]">
                                {TABLE_ROWS.map((row) => row.map((num) => (
                                    <button key={num} onMouseDown={() => !paintMode && handleNumberClick(num)} onPointerDown={() => paintMode && handleInteractionStart(num)} onMouseEnter={(e) => paintMode && isPointerDown && handleInteractionMove(e)} data-number={num} className={`h-12 border flex items-center justify-center text-white font-bold text-lg relative ${getNumColor(num)} hover:brightness-125 touch-none`}>
                                        {num}{renderBoardChip(b => b.type === 'number' && b.value === num)}
                                    </button>
                                )))}
                            </div>
                            <div className="grid grid-rows-3 gap-[1px]">
                                {[3, 2, 1].map((colNum, i) => (
                                    <button key={i} onClick={() => placeBet('column', colNum, TABLE_ROWS[i], 3)} className="border border-zinc-600 bg-zinc-800/50 text-[10px] text-zinc-300 font-bold hover:bg-zinc-700 flex items-center justify-center relative rounded-r-lg">
                                        <span className="-rotate-90">2:1</span>{renderBoardChip(b => b.type === 'column' && b.value === colNum)}
                                    </button>
                                ))}
                            </div>
                        </div>
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


                <div className="px-4 pb-6 pt-2 flex gap-3 items-center bg-zinc-900 mt-auto">
                    <div className="flex gap-1">
                        <button onClick={undoLastBet} disabled={spinning || bets.length === 0} className="p-3 bg-zinc-800 rounded-xl border border-zinc-600 text-zinc-400 disabled:opacity-30"><Undo2 size={20} /></button>
                        <button onClick={clearBets} disabled={spinning || bets.length === 0} className="p-3 bg-zinc-800 rounded-xl border border-zinc-600 text-red-400 disabled:opacity-30"><Trash2 size={20} /></button>
                        {/* Repetir la apuesta anterior: lo normal en cualquier ruleta */}
                        <button onClick={repeatBets} disabled={spinning || bets.length > 0 || lastBets.length === 0} title="Repetir apuesta" className="p-3 bg-zinc-800 rounded-xl border border-zinc-600 text-yellow-400 disabled:opacity-30"><RotateCw size={20} /></button>
                    </div>
                    <button onClick={() => { if (bets.length === 0 && !isTableOpen) setIsTableOpen(true); else spin(); }} disabled={spinning} className={`flex-1 font-black py-4 rounded-xl text-xl uppercase tracking-widest shadow-xl border-b-4 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${bets.length === 0 && !isTableOpen ? 'bg-zinc-700 text-white border-zinc-900' : 'bg-yellow-500 text-black border-yellow-700'}`}>
                        {spinning ? 'GIRANDO...' : (bets.length === 0 && !isTableOpen) ? 'APOSTAR' : 'GIRAR'}
                        {bets.length > 0 && <span className="text-sm font-bold bg-black/20 px-2 py-0.5 rounded text-yellow-900">{currentBetTotal}</span>}
                    </button>
                </div>
            </div>

            {/* MODAL RESULTADO */}
            {resultModal && (
                <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
                    <div className={`w-full max-w-xs rounded-[32px] p-8 text-center border-2 shadow-2xl relative ${resultModal.won ? 'bg-green-900/40 border-green-500' : 'bg-red-900/40 border-red-500'}`}>
                        <div className="mb-4 flex justify-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-xl border-4 ${resultModal.color === 'red' ? 'bg-red-600 border-red-400' : resultModal.color === 'black' ? 'bg-black border-zinc-500' : 'bg-green-600 border-green-400'}`}>
                                {resultModal.num}
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase not-italic tracking-tighter mb-2">{resultModal.won ? '¡VICTORIA!' : 'SUERTE LA PRÓXIMA'}</h2>
                        {resultModal.won && (
                            <div className="flex items-center justify-center gap-2 mb-6 bg-black/40 py-2 rounded-xl">
                                <span className="text-3xl font-black text-green-400">+{resultModal.payout}</span>
                                <img src="/assets/icons/ficha.png" className="w-8 h-8" alt="f" />
                            </div>
                        )}
                        <button onClick={() => setResultModal(null)} className="w-full mt-4 py-4 bg-white text-black font-black rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-transform hover:bg-zinc-200">CONTINUAR</button>
                    </div>
                </div>
            )}

            {/* MODAL INFO */}
            {showInfo && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-900 w-full max-w-xs rounded-3xl border border-white/10 p-6 relative shadow-2xl">
                        <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                        <h3 className="text-xl font-black text-white text-center mb-6 uppercase not-italic">Pagos</h3>
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