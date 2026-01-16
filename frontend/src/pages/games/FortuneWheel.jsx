import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft, Gift, Flame, Diamond, Lock, X, Info, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

// --- COMPONENTE DE LLUVIA DE MONEDAS ---
const CoinsRain = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        const coins = [];
        const coinImage = new Image();
        coinImage.src = "/assets/icons/ficha.png";

        const createCoin = () => ({
            x: Math.random() * canvas.width,
            y: -50,
            speed: Math.random() * 5 + 3,
            size: Math.random() * 20 + 20,
            rotation: Math.random() * 360
        });

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        for (let i = 0; i < 50; i++) coins.push(createCoin());

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            coins.forEach(coin => {
                coin.y += coin.speed;
                coin.rotation += 2;
                if (coin.y > canvas.height) Object.assign(coin, createCoin());

                ctx.save();
                ctx.translate(coin.x, coin.y);
                ctx.rotate((coin.rotation * Math.PI) / 180);
                if (coinImage.complete) {
                    ctx.drawImage(coinImage, -coin.size / 2, -coin.size / 2, coin.size, coin.size);
                }
                ctx.restore();
            });
            animationFrameId = requestAnimationFrame(render);
        };

        coinImage.onload = render;
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[100]" />;
};

// --- CONFIGURACIÓN DE RULETAS ---
const WHEEL_CONFIG = {
    daily: {
        id: 'daily',
        title: "Diaria",
        cost: 0,
        color: "text-blue-400",
        border: "border-blue-500/30",
        bg: "bg-blue-900/10",
        icon: <Gift size={24} />,
        desc: "Gratis. Riesgo Cero.",
        prizes: [
            { label: '10', value: 10, color: '#1d4ed8' },
            { label: '50', value: 50, color: '#eab308' },
            { label: '5', value: 5, color: '#3f3f46' },
            { label: '25', value: 25, color: '#16a34a' },
            { label: '100', value: 100, color: '#9333ea' },
            { label: '5', value: 5, color: '#3f3f46' }
        ]
    },
    hardcore: {
        id: 'hardcore',
        title: "Hardcore",
        cost: 50,
        color: "text-red-500",
        border: "border-red-500/30",
        bg: "bg-red-900/10",
        icon: <Flame size={24} />,
        desc: "Todo o nada.",
        prizes: [
            { label: '0', value: 0, color: '#09090b' },
            { label: '0', value: 0, color: '#27272a' },
            { label: '1K', value: 1000, color: '#dc2626' },
            { label: '0', value: 0, color: '#09090b' },
            { label: '0', value: 0, color: '#27272a' },
            { label: '200', value: 200, color: '#ea580c' }
        ]
    },
    premium: {
        id: 'premium',
        title: "Premium",
        cost: 200,
        color: "text-purple-400",
        border: "border-purple-500/30",
        bg: "bg-purple-900/10",
        icon: <Diamond size={24} />,
        desc: "Premios altos asegurados.",
        prizes: [
            { label: '250', value: 250, color: '#7e22ce' },
            { label: '300', value: 300, color: '#c026d3' },
            { label: '500', value: 500, color: '#ca8a04' },
            { label: '210', value: 210, color: '#4338ca' },
            { label: '400', value: 400, color: '#be185d' },
            { label: '1K', value: 1000, color: '#0f766e' }
        ]
    }
};

// --- RULETA ACTIVA (CORREGIDA Y BLINDADA) ---
function ActiveWheel({ config, user, setUser, onBack, onSpinComplete }) {
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [winData, setWinData] = useState(null);

    // 1. Obtener saldo
    const getBalance = () => {
        if (user?.stats?.gameCoins !== undefined) return user.stats.gameCoins;
        if (user?.gameCoins !== undefined) return user.gameCoins;
        return 0;
    };

    const currentFichas = getBalance();

    const prizes = config.prizes;
    const numSegments = prizes.length;
    const segmentAngle = 360 / numSegments;

    // Función auxiliar para actualización optimista
    const updateUserBalance = (newAmount, newXp = 0) => {
        setUser(prev => {
            const currentCoins = prev.stats?.gameCoins || prev.gameCoins || 0;
            const currentXp = prev.currentXP || 0;

            const updatedUser = {
                ...prev,
                gameCoins: currentCoins + newAmount,
                currentXP: currentXp + newXp,
                stats: {
                    ...prev.stats,
                    gameCoins: currentCoins + newAmount,
                    currentXP: currentXp + newXp
                }
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            return updatedUser;
        });
    };

    const handleSpin = async () => {
        if (spinning) return;

        const cost = config.cost || 0;

        if (cost > 0 && currentFichas < cost) {
            alert(`No tienes suficientes fichas. Tienes ${currentFichas} y necesitas ${cost}.`);
            return;
        }

        // --- 1. COBRAR ENTRADA ---
        if (cost > 0) {
            console.log(`[Ruleta] Restando ${cost} fichas...`);
            updateUserBalance(-cost);

            api.post('/users/reward', { gameCoins: -cost })
                .catch(err => {
                    console.error("[Ruleta] Error cobrando entrada", err);
                    updateUserBalance(cost); // Rollback
                    alert("Error de conexión.");
                    setSpinning(false);
                });
        }

        setSpinning(true);
        setWinData(null);

        // 🔥 REGISTRAR QUE SE HA TIRADO HOY (BLOQUEO INMEDIATO)
        onSpinComplete();

        // --- 2. CALCULAR RESULTADO ---
        const randomIndex = Math.floor(Math.random() * numSegments);
        const selectedPrize = prizes[randomIndex];

        // --- 3. ANIMACIÓN ---
        const offset = segmentAngle / 2;
        const targetAngle = 360 - (randomIndex * segmentAngle + offset);
        const extraSpins = 360 * (5 + Math.floor(Math.random() * 3));
        const currentMod = rotation % 360;
        const distToTarget = targetAngle - currentMod;
        const finalRotation = rotation + extraSpins + (distToTarget > 0 ? distToTarget : distToTarget + 360);

        setRotation(finalRotation);

        // --- 4. FINALIZAR ---
        setTimeout(async () => {
            setSpinning(false);
            setWinData(selectedPrize);

            // Si hay premio
            if (selectedPrize.value > 0) {
                const isXp = selectedPrize.type === 'xp';
                const amount = selectedPrize.value;

                if (isXp) updateUserBalance(0, amount);
                else updateUserBalance(amount, 0);

                try {
                    const payload = isXp ? { xp: amount } : { gameCoins: amount };
                    const res = await api.post('/users/reward', payload);

                    if (res.data && res.data.user) {
                        setUser(res.data.user);
                        localStorage.setItem('user', JSON.stringify(res.data.user));
                    }
                } catch (error) {
                    console.error("[Ruleta] Error guardando premio:", error);
                }
            }

        }, 5000);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-sm mx-auto">
            {winData && winData.value > 0 && winData.type !== 'xp' && <CoinsRain />}

            <div className="relative w-[320px] h-[320px] mb-10">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 w-8 h-10 bg-white"
                    style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))' }}>
                </div>

                <div
                    className="w-full h-full rounded-full border-8 border-zinc-900 shadow-2xl overflow-hidden relative bg-zinc-950 transition-transform cubic-bezier(0.15, 0, 0.15, 1)"
                    style={{
                        transform: `rotate(${rotation}deg)`,
                        transitionDuration: spinning ? '5000ms' : '0ms'
                    }}
                >
                    <div className="absolute inset-0 w-full h-full"
                        style={{
                            background: `conic-gradient(${prizes.map((p, i) => `${p.color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`).join(', ')})`
                        }}
                    />

                    {prizes.map((prize, i) => (
                        <div
                            key={i}
                            className="absolute top-0 left-1/2 w-[80px] h-[50%] -ml-[40px] origin-bottom flex flex-col justify-start pt-5 items-center gap-1"
                            style={{
                                transform: `rotate(${i * segmentAngle + segmentAngle / 2}deg)`,
                                transformOrigin: 'bottom center'
                            }}
                        >
                            <span className="text-white font-black text-xl drop-shadow-md leading-none rotate-180 mb-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                {prize.label}
                            </span>
                            {prize.type === 'xp' ? (
                                <Zap size={24} className="text-blue-200 rotate-180 drop-shadow-md" fill="currentColor" />
                            ) : (
                                <img src="/assets/icons/ficha.png" alt="f" className="w-6 h-6 object-contain drop-shadow-md rotate-180" />
                            )}
                        </div>
                    ))}

                    <div className="absolute inset-0 m-auto w-16 h-16 bg-zinc-900 rounded-full border-4 border-zinc-800 shadow-inner flex items-center justify-center text-zinc-400 z-20">
                        {config.icon}
                    </div>
                </div>
            </div>

            <button
                onClick={handleSpin}
                disabled={spinning}
                className={`
                    w-full py-5 rounded-[20px] font-black text-lg uppercase tracking-widest transition-all active:scale-95 shadow-xl
                    ${spinning
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }
                `}
            >
                {spinning ? 'Girando...' : `GIRAR (${config.cost === 0 ? 'GRATIS' : config.cost})`}
            </button>

            {winData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in zoom-in-95 duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl">
                        <div className="mb-6 flex justify-center">
                            {winData.value > 0 ? (
                                <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center animate-bounce border border-yellow-500/30">
                                    <img src="/assets/icons/ficha.png" className="w-14 h-14 object-contain" alt="Win" />
                                </div>
                            ) : (
                                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                                    <X className="w-10 h-10 text-red-500" />
                                </div>
                            )}
                        </div>

                        <h2 className={`text-3xl font-black uppercase italic mb-2 ${winData.value > 0 ? 'text-yellow-400' : 'text-white'}`}>
                            {winData.value > 0 ? '¡GANASTE!' : 'MALA SUERTE'}
                        </h2>

                        <p className="text-sm text-zinc-400 mb-8 font-medium">
                            {winData.value > 0
                                ? `Has conseguido ${winData.label} ${winData.type === 'xp' ? '' : 'fichas'}.`
                                : 'No has ganado nada esta vez.'}
                        </p>

                        <button
                            onClick={() => { setWinData(null); onBack(); }}
                            className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest hover:bg-zinc-200 shadow-lg"
                        >
                            {winData.value > 0 ? 'RECOGER Y SALIR' : 'CONTINUAR'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- COMPONENTE PRINCIPAL ---
export default function FortuneWheel() {
    const { user, setUser, setIsUiHidden } = useOutletContext();
    const navigate = useNavigate();
    const [selectedMode, setSelectedMode] = useState(null);
    const [lastSpinDate, setLastSpinDate] = useState(() => localStorage.getItem('last_wheel_spin_date'));

    // Helper fecha hoy
    const getTodayStr = () => new Date().toISOString().split('T')[0];
    const hasSpunToday = lastSpinDate === getTodayStr();

    useEffect(() => {
        if (selectedMode) setIsUiHidden(true);
        else setIsUiHidden(false);
        return () => setIsUiHidden(false);
    }, [selectedMode, setIsUiHidden]);

    // Función que se ejecuta cuando el usuario tira de la ruleta
    const handleSpinComplete = () => {
        const today = getTodayStr();
        localStorage.setItem('last_wheel_spin_date', today);
        setLastSpinDate(today);
    };

    return (
        <div className={`flex flex-col h-full animate-in fade-in select-none px-4 pb-20 ${selectedMode ? 'pt-24' : 'pt-4'}`}>

            {/* Header Interno */}
            <div className="flex items-center mb-6">
                <button
                    onClick={() => selectedMode ? setSelectedMode(null) : navigate(-1)}
                    className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-95"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="ml-4 text-xl font-black italic uppercase text-white tracking-tight">
                    {selectedMode ? WHEEL_CONFIG[selectedMode].title : 'Ruleta de la Fortuna'}
                </h1>
            </div>

            {selectedMode ? (
                <ActiveWheel
                    config={WHEEL_CONFIG[selectedMode]}
                    user={user}
                    setUser={setUser}
                    onBack={() => setSelectedMode(null)}
                    onSpinComplete={handleSpinComplete}
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {/* AVISO IMPORTANTE DE RESTRICCIÓN */}
                    <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-2xl flex items-center gap-3 mb-2">
                        <AlertTriangle className="text-yellow-500 shrink-0" size={24} />
                        <div>
                            <h3 className="text-white font-bold text-xs uppercase tracking-wider">Límite Diario Global</h3>
                            <p className="text-[10px] text-zinc-400">Solo puedes tirar <strong>una vez al día</strong>, sin importar qué ruleta elijas. ¡Elige sabiamente!</p>
                        </div>
                    </div>

                    {hasSpunToday && (
                        <div className="bg-zinc-800/80 border border-zinc-700 p-4 rounded-2xl text-center animate-pulse">
                            <Lock className="mx-auto text-zinc-500 mb-2" size={32} />
                            <h3 className="text-zinc-400 font-black text-lg uppercase">Vuelve Mañana</h3>
                            <p className="text-zinc-600 text-xs font-bold">Ya has gastado tu tiro de hoy.</p>
                        </div>
                    )}

                    {Object.values(WHEEL_CONFIG).map((config) => {
                        const isDisabled = hasSpunToday;

                        return (
                            <button
                                key={config.id}
                                onClick={() => !isDisabled && setSelectedMode(config.id)}
                                disabled={isDisabled}
                                className={`
                                    w-full p-5 rounded-[24px] border flex items-center justify-between group transition-all relative overflow-hidden
                                    ${isDisabled
                                        ? 'bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed grayscale'
                                        : `${config.bg} ${config.border} active:scale-[0.98]`
                                    }
                                `}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl bg-black border border-white/5 ${config.color} shadow-lg`}>
                                        {isDisabled ? <Lock size={24} /> : config.icon}
                                    </div>
                                    <div className="text-left">
                                        <h3 className={`text-lg font-black uppercase leading-none ${isDisabled ? 'text-zinc-500' : config.color}`}>
                                            {config.title}
                                        </h3>
                                        <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-wide">
                                            {config.desc}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Coste</span>
                                    <div className="bg-black px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-1.5">
                                        <span className={`text-sm font-black ${isDisabled ? 'text-zinc-600' : 'text-white'}`}>
                                            {config.cost === 0 ? "GRATIS" : config.cost}
                                        </span>
                                        {config.cost > 0 && <img src="/assets/icons/ficha.png" className={`w-3.5 h-3.5 ${isDisabled ? 'grayscale opacity-50' : ''}`} alt="F" />}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}