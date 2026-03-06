import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, X, Trophy, Frown } from 'lucide-react';
import api from '../../services/api';

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
    return <div className={`w-32 h-32 md:w-40 md:h-40 bg-black/80 backdrop-blur-xl border-4 rounded-[2rem] flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden transition-all duration-300 ${rolling ? 'scale-95 border-cyan-500/20' : 'scale-100 border-cyan-400'}`}><span className={`text-8xl md:text-9xl font-black text-white transition-all ${rolling ? 'blur-sm opacity-50' : 'blur-0 opacity-100'}`}>{displayNum}</span></div>;
};

export default function Dice() {
    const { user, setUser, setIsUiHidden } = useOutletContext();
    const navigate = useNavigate();
    const [visualBalance, setVisualBalance] = useState(user?.stats?.gameCoins ?? user?.gameCoins ?? 0);
    useEffect(() => { setIsUiHidden(true); return () => setIsUiHidden(false); }, [setIsUiHidden]);

    const [dices, setDices] = useState([1, 1]);
    const [bet, setBet] = useState(20);
    const [selectedOption, setSelectedOption] = useState(null);
    const [rolling, setRolling] = useState(false);
    const [resultModal, setResultModal] = useState(null);
    const [showRain, setShowRain] = useState(false);

    const handleRoll = async () => {
        if (!selectedOption || visualBalance < bet || rolling) return;
        setResultModal(null); setRolling(true); setShowRain(false);
        setVisualBalance(prev => Math.max(0, prev - bet)); // Optimista

        try {
            const res = await api.post('/games/dice', { bet, prediction: selectedOption });
            await sleep(1500);
            setDices(res.data.dices);
            setRolling(false);
            if (res.data.won) { setShowRain(true); setTimeout(() => setShowRain(false), 3000); }
            setResultModal({ won: res.data.won, amount: res.data.payout, sum: res.data.sum });
            setUser(res.data.user); setVisualBalance(res.data.user.gameCoins);
        } catch (e) { alert("Error"); setRolling(false); setVisualBalance(user?.stats?.gameCoins ?? 0); }
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-40 pb-4 overflow-hidden select-none font-sans">
            {showRain && <ChipRain isFading={false} />}
            <div className="absolute top-12 left-4 right-4 flex justify-between z-50"><button onClick={() => navigate('/games')} className="bg-zinc-900/80 p-2 rounded-xl text-zinc-400"><ChevronLeft /></button><div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-blue-500/50"><span className="text-blue-400 font-black text-xl">{visualBalance}</span><img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" /></div><div></div></div>
            <div className="absolute top-28 w-full text-center z-10"><h1 className="text-4xl font-black italic text-cyan-400">NEON DICE</h1></div>
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm px-4 gap-8 z-10">
                <div className="relative w-full flex justify-center gap-6"><DigitalDie value={dices[0]} rolling={rolling} /><DigitalDie value={dices[1]} rolling={rolling} /></div>
                <div className="bg-black/60 px-8 py-3 rounded-full border border-white/10"><span className="text-5xl font-black text-white">{rolling ? '?' : dices[0] + dices[1]}</span></div>
                <div className="w-full grid grid-cols-3 gap-3">
                    <button onClick={() => setSelectedOption('under')} className={`py-4 rounded-2xl border-b-4 ${selectedOption === 'under' ? 'bg-cyan-600 border-cyan-800 text-white' : 'bg-zinc-800 border-zinc-900 text-zinc-400'}`}><span className="font-black text-lg">2 - 6</span></button>
                    <button onClick={() => setSelectedOption('seven')} className={`py-4 rounded-2xl border-b-4 ${selectedOption === 'seven' ? 'bg-purple-600 border-purple-800 text-white' : 'bg-zinc-800 border-zinc-900 text-zinc-400'}`}><span className="font-black text-2xl">7</span></button>
                    <button onClick={() => setSelectedOption('over')} className={`py-4 rounded-2xl border-b-4 ${selectedOption === 'over' ? 'bg-pink-600 border-pink-800 text-white' : 'bg-zinc-800 border-zinc-900 text-zinc-400'}`}><span className="font-black text-lg">8-12</span></button>
                </div>
                <div className="w-full bg-zinc-900/90 rounded-[2rem] p-4 flex items-center gap-3">
                    <div className="bg-black rounded-xl flex items-center p-1"><button onClick={() => setBet(Math.max(10, bet - 10))} className="w-12 h-12 bg-zinc-800 text-white font-bold">-</button><div className="min-w-[80px] text-center font-black text-yellow-500 text-xl">{bet}</div><button onClick={() => setBet(bet + 10)} className="w-12 h-12 bg-zinc-800 text-white font-bold">+</button></div>
                    <button onClick={handleRoll} disabled={rolling || !selectedOption} className="flex-1 h-14 rounded-xl font-black text-xl bg-cyan-600 text-white">TIRAR</button>
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