import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, X, Trophy, Frown } from 'lucide-react';
import BackButton from '../../components/common/BackButton';
import api from '../../services/api';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../../store/useAuthStore';
import SelectorApuesta from '../../components/games/SelectorApuesta';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const ChipRain = ({ isFading }) => { /* Mantén tu ChipRain original aquí (lo abrevio por espacio) */
    return <div className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-1000 ${isFading ? 'opacity-0' : 'opacity-100'}`}><style>{`@keyframes fall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(120vh) rotate(360deg); } }`}</style>{Array.from({ length: 50 }).map((_, i) => <img key={i} src="/assets/icons/ficha.png" className="absolute will-change-transform" style={{ left: `${Math.random() * 100}%`, top: `-${Math.random() * 50}vh`, width: '30px', animation: `fall ${1 + Math.random()}s linear ${Math.random()}s infinite` }} alt="" />)}</div>;
};

const DigitalDie = ({ value, rolling }) => {
    const [displayNum, setDisplayNum] = useState(value);
    useEffect(() => {
        let int; if (rolling) int = setInterval(() => setDisplayNum(Math.floor(Math.random() * 6) + 1), 80); else setDisplayNum(value);
        return () => clearInterval(int);
    }, [rolling, value]);
    return <div className={`w-32 h-32 md:w-40 md:h-40 bg-black/80 backdrop-blur-xl border-4 rounded-[2rem] flex items-center justify-center relative overflow-hidden transition-all duration-300 ${rolling ? 'scale-95 border-cyan-500/20' : 'scale-100 border-cyan-400'}`}><span className={`text-8xl md:text-9xl font-black text-white transition-all ${rolling ? 'blur-sm opacity-50' : 'blur-0 opacity-100'}`}>{displayNum}</span></div>;
};

export default function Dice() {
    // 🔥 CONECTAMOS CON ZUSTAND
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);
    const navigate = useNavigate();

    useEffect(() => { setIsUiHidden(true); return () => setIsUiHidden(false); }, [setIsUiHidden]);

    const [dices, setDices] = useState([1, 1]);
    const [bet, setBet] = useState(20);
    const [selectedOption, setSelectedOption] = useState(null);
    const [rolling, setRolling] = useState(false);
    const [resultModal, setResultModal] = useState(null);
    const [showRain, setShowRain] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // SALDO DERIVADO, no un estado paralelo.
    // Antes era un useState que además NO se resincronizaba con el usuario (los
    // otros juegos sí lo hacen), y al fallar la tirada hacía
    // `setVisualBalance(user?.stats?.gameCoins ?? 0)`: si `stats` no venía,
    // el marcador se quedaba a CERO aunque tuvieras fichas de sobra.
    const fichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const visualBalance = rolling ? Math.max(0, fichas - bet) : fichas;

    const handleRoll = async () => {
        if (!selectedOption || visualBalance < bet || rolling) return;
        setResultModal(null); setRolling(true); setShowRain(false); setErrorMsg(null);

        try {
            const res = await api.post('/games/dice', { bet, prediction: selectedOption });
            await sleep(1500);
            setDices(res.data.dices);
            setRolling(false);
            if (res.data.won) { setShowRain(true); setTimeout(() => setShowRain(false), 3000); }
            setResultModal({ won: res.data.won, amount: res.data.payout, sum: res.data.sum });
            setUser(res.data.user);
        } catch (e) {
            setErrorMsg(e.response?.data?.message || 'No se pudo tirar. Inténtalo otra vez.');
            setRolling(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-40 pb-4 overflow-hidden select-none font-sans">
            {showRain && <ChipRain isFading={false} />}
            <div className="absolute top-12 left-4 right-4 flex justify-between z-50"><BackButton to="/games" /><div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-blue-500/50"><span className="text-blue-400 font-black text-xl">{visualBalance}</span><img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" /></div><div></div></div>
            <div className="absolute top-28 w-full text-center z-10">
                <h1 className="text-4xl font-black not-italic text-cyan-400">NEON DICE</h1>
                {errorMsg && (
                    <div onClick={() => setErrorMsg(null)} className="mx-6 mt-3 bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase tracking-wide px-4 py-2.5 rounded-2xl cursor-pointer">
                        {errorMsg}
                    </div>
                )}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-4 gap-8 z-10">
                <div className="relative w-full flex justify-center gap-6"><DigitalDie value={dices[0]} rolling={rolling} /><DigitalDie value={dices[1]} rolling={rolling} /></div>
                <div className="bg-black/60 px-8 py-3 rounded-full border border-white/10"><span className="text-5xl font-black text-white">{rolling ? '?' : dices[0] + dices[1]}</span></div>
                <div className="w-full grid grid-cols-3 gap-2.5">
                    {[
                        { id: 'under', texto: '2 - 6', paga: 2, activo: 'bg-cyan-500 border-cyan-800 text-black', color: 'text-cyan-400' },
                        { id: 'seven', texto: '7', paga: 5, activo: 'bg-purple-500 border-purple-800 text-black', color: 'text-purple-400' },
                        { id: 'over', texto: '8 - 12', paga: 2, activo: 'bg-pink-500 border-pink-800 text-black', color: 'text-pink-400' }
                    ].map(o => {
                        const puesto = selectedOption === o.id;
                        return (
                            <button
                                key={o.id}
                                onClick={() => setSelectedOption(o.id)}
                                disabled={rolling}
                                className={`py-3 rounded-2xl border-b-4 flex flex-col items-center gap-0.5 transition-all active:scale-95 disabled:opacity-50 ${puesto ? o.activo + ' scale-[1.03]' : 'bg-zinc-800 border-zinc-900 text-zinc-400'}`}
                            >
                                <span className="font-black text-lg leading-none">{o.texto}</span>
                                <span className={`text-[10px] font-black tabular-nums ${puesto ? 'opacity-70' : o.color}`}>×{o.paga}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="w-full bg-zinc-900/90 rounded-[2rem] p-4 space-y-3">
                    <SelectorApuesta valor={bet} onChange={setBet} saldo={fichas} minimo={10} deshabilitado={rolling} />
                    <button
                        onClick={handleRoll}
                        disabled={rolling || !selectedOption || bet > fichas}
                        className="w-full h-14 rounded-2xl font-black text-lg uppercase tracking-widest bg-cyan-500 text-black border-b-4 border-cyan-800 active:scale-95 transition-transform disabled:opacity-40 disabled:grayscale flex items-center justify-center gap-2"
                    >
                        {rolling ? 'Rodando…' : !selectedOption ? 'Elige una opción' : (
                            <>Tirar
                                <span className="text-[11px] font-black bg-black/20 px-2 py-0.5 rounded-lg tabular-nums">
                                    ganas {(bet * (selectedOption === 'seven' ? 5 : 2)).toLocaleString('es-ES')}
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>
            {resultModal && (
                <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6" onClick={() => setResultModal(null)}>
                    <div className="bg-zinc-900 w-full max-w-xs rounded-[32px] p-8 text-center border-2 border-zinc-700">
                        <h2 className="text-3xl font-black text-white mb-4">{resultModal.won ? '¡GANASTE!' : 'PIERDES'}</h2>
                        {resultModal.won && <div className="text-green-400 text-4xl font-black">+{resultModal.amount}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}