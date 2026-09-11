import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Flame, Diamond, Lock, X, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import BackButton from '../../components/common/BackButton';
import api from '../../services/api';
import { getMadridDateString } from '../../utils/dateHelpers';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../../store/useAuthStore';
import RuedaFortuna from '../../components/games/RuedaFortuna';
import { trayectoriaRueda } from '../../utils/fisicaRuedaFortuna';
import { crearSintetizador, melodias, haySonidoJuegos, cambiarSonidoJuegos } from '../../utils/sintetizador';

// A esta velocidad (grados/ms) el zumbido se satura. Sale de la fisica.
const VELOCIDAD_MAXIMA = 0.9;

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

        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.addEventListener('resize', resize); resize();
        for (let i = 0; i < 50; i++) coins.push(createCoin());

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            coins.forEach(coin => {
                coin.y += coin.speed; coin.rotation += 2;
                if (coin.y > canvas.height) Object.assign(coin, createCoin());
                ctx.save(); ctx.translate(coin.x, coin.y); ctx.rotate((coin.rotation * Math.PI) / 180);
                if (coinImage.complete) ctx.drawImage(coinImage, -coin.size / 2, -coin.size / 2, coin.size, coin.size);
                ctx.restore();
            });
            animationFrameId = requestAnimationFrame(render);
        };

        coinImage.onload = render;
        return () => { cancelAnimationFrame(animationFrameId); window.removeEventListener('resize', resize); };
    }, []);
    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[100]" />;
};

// --- CONFIGURACIÓN DE RULETAS ---
const WHEEL_CONFIG = {
    daily: {
        id: 'daily', title: "Diaria", cost: 0, color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-900/10", icon: <Gift size={24} />, desc: "Gratis. Riesgo Cero.",
        prizes: [{ label: '10', color: '#1d4ed8' }, { label: '50', color: '#eab308' }, { label: '5', color: '#3f3f46' }, { label: '25', color: '#16a34a' }, { label: '100', color: '#9333ea' }, { label: '5', color: '#3f3f46' }]
    },
    hardcore: {
        id: 'hardcore', title: "Hardcore", cost: 50, color: "text-red-500", border: "border-red-500/30", bg: "bg-red-900/10", icon: <Flame size={24} />, desc: "Todo o nada.",
        prizes: [{ label: '0', color: '#09090b' }, { label: '0', color: '#27272a' }, { label: '1K', color: '#dc2626' }, { label: '0', color: '#09090b' }, { label: '0', color: '#27272a' }, { label: '200', color: '#ea580c' }]
    },
    premium: {
        id: 'premium', title: "Premium", cost: 200, color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-900/10", icon: <Diamond size={24} />, desc: "Premios altos.",
        prizes: [{ label: '250', color: '#7e22ce' }, { label: '300', color: '#c026d3' }, { label: '500', color: '#ca8a04' }, { label: '210', color: '#4338ca' }, { label: '400', color: '#be185d' }, { label: '1K', color: '#0f766e' }]
    }
};

// --- RULETA ACTIVA ---
function ActiveWheel({ config, user, setUser, onBack, onSpinComplete }) {
    const [spinning, setSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [winData, setWinData] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

    // ⚠️ EL GIRO NO PASA POR REACT. Cada frame escribe el transform del disco
    // y el de la lengüeta directamente en el DOM (ver handleSpin).
    const ruedaRef = useRef(null);
    const animacionRef = useRef(null);
    const sonidoRef = useRef(null);

    const [conSonido, setConSonido] = useState(haySonidoJuegos);
    const alternarSonido = () => {
        const nuevo = !conSonido;
        cambiarSonidoJuegos(nuevo);
        setConSonido(nuevo);
        if (!nuevo) sonidoRef.current?.parar();
    };

    useEffect(() => () => {
        if (animacionRef.current) cancelAnimationFrame(animacionRef.current);
        sonidoRef.current?.parar();
    }, []);

    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const prizes = config.prizes;
    const numSegments = prizes.length;

    const handleSpin = async () => {
        if (spinning) return;
        const cost = config.cost || 0;

        if (cost > 0 && currentFichas < cost) {
            setErrorMsg(`Necesitas ${cost} fichas`); return;
        }

        // ⚠️ Aquí se restaba el coste al usuario a mano ANTES de llamar al servidor
        // y no se deshacía nunca si la petición fallaba: te quedabas viendo menos
        // fichas de las que tenías hasta recargar la app. El saldo bueno lo manda
        // el servidor al terminar el giro, así que no hace falta tocarlo.
        setErrorMsg(null);
        setSpinning(true); setWinData(null);

        try {
            // Llamada al Backend Inhackeable
            const res = await api.post('/games/fortune', { type: config.id });
            const { winIndex, prize: serverPrize, user: updatedUser } = res.data;

            // El tiro diario solo se marca como gastado si el servidor lo aceptó
            onSpinComplete();

            // EL GIRO, FRAME A FRAME. El premio ya esta decidido; `trayectoriaRueda`
            // dice donde esta la rueda y cuanto esta doblada la lengueta en cada
            // instante, y aqui solo se pintan y se hacen sonar.
            const tr = trayectoriaRueda({ giroAlEmpezar: rotation, indiceGanador: winIndex, segmentos: numSegments });

            const sonido = crearSintetizador();
            sonidoRef.current = sonido;
            const zumbido = sonido.continuo({ frecuenciaBase: 200, frecuenciaExtra: 350, volumenMax: 0.10 });

            let terminado = false;
            const terminar = () => {
                if (terminado) return;
                terminado = true;
                clearTimeout(salvavidas);
                if (animacionRef.current) cancelAnimationFrame(animacionRef.current);
                sonido.parar();
                sonidoRef.current = null;

                // El disco se deja EXACTAMENTE en su sitio y la lengueta recta,
                // por si el ultimo frame no llego a pintarse.
                if (ruedaRef.current?.disco) ruedaRef.current.disco.style.transform = `rotate(${tr.giroFinal}deg)`;
                if (ruedaRef.current?.lengueta) ruedaRef.current.lengueta.style.transform = 'rotate(0deg)';
                setRotation(tr.giroFinal);

                setSpinning(false);
                setWinData(serverPrize);
                // Se sincroniza SIEMPRE, gane o no: si el premio era 0 antes no se
                // actualizaba y el saldo se quedaba sin reflejar el coste del tiro.
                if (updatedUser) {
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }

                const fin = crearSintetizador();
                if (serverPrize?.v > 0) (serverPrize.v >= 500 ? melodias.granPremio : melodias.ganar)(fin);
                else melodias.perder(fin);
                setTimeout(fin.parar, 2500);
            };

            const t0 = performance.now();
            let msAnterior = 0;
            const frame = (ahora) => {
                const ms = Math.min(ahora - t0, tr.duracion);
                const disco = ruedaRef.current?.disco;
                const lengueta = ruedaRef.current?.lengueta;
                if (!disco || !lengueta) { sonido.parar(); return; }

                disco.style.transform = `rotate(${tr.rueda(ms)}deg)`;
                // La lengueta se dobla EN CONTRA del giro: la rueda va hacia
                // positivo y la empuja hacia el otro lado.
                lengueta.style.transform = `rotate(${tr.lengueta(ms)}deg)`;

                const v = Math.min(tr.velocidad(ms) / VELOCIDAD_MAXIMA, 1);
                zumbido(v);

                // Un tic por cada pivote que pasa. La cadencia sale de la fisica:
                // al frenar pasan menos por segundo.
                const tics = tr.pivotesEntre(msAnterior, ms);
                for (let i = 0; i < tics; i++) {
                    sonido.golpe({ frecuencia: 2800 + Math.random() * 600, duracion: 0.035, volumen: 0.14 + 0.2 * v, q: 6 });
                }
                msAnterior = ms;

                if (ms < tr.duracion) {
                    animacionRef.current = requestAnimationFrame(frame);
                } else {
                    terminar();
                }
            };

            // El salvavidas: rAF no dispara con la pestana en segundo plano.
            // Sin esto, cambiar de app a mitad de giro lo dejaba colgado.
            const salvavidas = setTimeout(terminar, tr.duracion + 600);
            animacionRef.current = requestAnimationFrame(frame);

        } catch (error) {
            console.error("Error ruleta:", error);
            setErrorMsg(error.response?.data?.message || "No se pudo tirar");
            if (animacionRef.current) cancelAnimationFrame(animacionRef.current);
            sonidoRef.current?.parar();
            setSpinning(false);
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-sm mx-auto">
            {winData && winData.v > 0 && winData.t !== 'xp' && <CoinsRain />}
            {errorMsg && (
                <div onClick={() => setErrorMsg(null)} className="w-full mb-4 bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase tracking-wide px-4 py-2.5 rounded-2xl text-center cursor-pointer">
                    {errorMsg}
                </div>
            )}
            <div className="relative w-[330px] h-[340px] mb-6 drop-shadow-[0_18px_40px_rgba(0,0,0,0.9)]">
                <RuedaFortuna ref={ruedaRef} premios={prizes} rotacion={rotation} iconoCentro={config.icon} />
            </div>
            <div className="w-full flex items-center gap-2">
                <button onClick={handleSpin} disabled={spinning} className={`flex-1 py-5 rounded-2xl font-black text-lg uppercase tracking-widest transition-all active:scale-95 shadow-xl ${spinning ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200'}`}>
                    {spinning ? 'Girando...' : `GIRAR (${config.cost === 0 ? 'GRATIS' : config.cost})`}
                </button>
                <button
                    onClick={alternarSonido}
                    aria-label={conSonido ? 'Silenciar' : 'Activar el sonido'}
                    className={`w-14 h-[68px] rounded-2xl border border-zinc-800 bg-zinc-900 flex items-center justify-center active:scale-95 transition-transform ${conSonido ? 'text-zinc-300' : 'text-zinc-600'}`}
                >
                    {conSonido ? <Volume2 size={22} /> : <VolumeX size={22} />}
                </button>
            </div>

            {winData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in zoom-in-95 duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-4xl p-8 text-center shadow-2xl">
                        <div className="mb-6 flex justify-center">
                            {winData.v > 0 ? (
                                <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center animate-bounce border border-yellow-500/30">
                                    <img src="/assets/icons/ficha.png" className="w-14 h-14 object-contain" alt="Win" />
                                </div>
                            ) : (
                                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20"><X className="w-10 h-10 text-red-500" /></div>
                            )}
                        </div>
                        <h2 className={`text-3xl font-black uppercase not-italic mb-2 ${winData.v > 0 ? 'text-yellow-400' : 'text-white'}`}>{winData.v > 0 ? '¡GANASTE!' : 'MALA SUERTE'}</h2>
                        <p className="text-sm text-zinc-400 mb-8 font-medium">{winData.v > 0 ? `Has conseguido ${winData.v} fichas.` : 'No has ganado nada esta vez.'}</p>
                        <button onClick={() => { setWinData(null); onBack(); }} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest hover:bg-zinc-200 shadow-lg">
                            {winData.v > 0 ? 'RECOGER Y SALIR' : 'CONTINUAR'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function FortuneWheel() {
    // 🔥 CONECTAMOS CON ZUSTAND
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);
    const navigate = useNavigate();

    const [selectedMode, setSelectedMode] = useState(null);
    const [lastSpinDate, setLastSpinDate] = useState(() => localStorage.getItem('last_wheel_spin_date'));
    // Hora de Madrid (no UTC): así el giro diario se renueva a medianoche real
    const getTodayStr = () => getMadridDateString();
    const hasSpunToday = lastSpinDate === getTodayStr();

    useEffect(() => { if (selectedMode) setIsUiHidden(true); else setIsUiHidden(false); return () => setIsUiHidden(false); }, [selectedMode, setIsUiHidden]);

    const handleSpinComplete = () => { const today = getTodayStr(); localStorage.setItem('last_wheel_spin_date', today); setLastSpinDate(today); };

    return (
        <div className={`flex flex-col h-full animate-in fade-in select-none px-4 pb-20 ${selectedMode ? 'pt-24' : 'pt-4'}`}>
            <div className="flex items-center mb-6">
                <BackButton onClick={() => selectedMode ? setSelectedMode(null) : navigate('/games')} />
                <h1 className="ml-4 text-xl font-black not-italic uppercase text-white tracking-tight">{selectedMode ? WHEEL_CONFIG[selectedMode].title : 'Ruleta de la Fortuna'}</h1>
            </div>

            {selectedMode ? (
                <ActiveWheel config={WHEEL_CONFIG[selectedMode]} user={user} setUser={setUser} onBack={() => setSelectedMode(null)} onSpinComplete={handleSpinComplete} />
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-2xl flex items-center gap-3 mb-2">
                        <AlertTriangle className="text-yellow-500 shrink-0" size={24} />
                        <div><h3 className="text-white font-bold text-xs uppercase tracking-wider">Límite Diario Global</h3><p className="text-[10px] text-zinc-400">Solo puedes tirar <strong>una vez al día</strong>, sin importar qué ruleta elijas.</p></div>
                    </div>
                    {hasSpunToday && (
                        <div className="bg-zinc-800/80 border border-zinc-700 p-4 rounded-2xl text-center animate-pulse">
                            <Lock className="mx-auto text-zinc-500 mb-2" size={32} /><h3 className="text-zinc-400 font-black text-lg uppercase">Vuelve Mañana</h3><p className="text-zinc-600 text-xs font-bold">Ya has gastado tu tiro de hoy.</p>
                        </div>
                    )}
                    {Object.values(WHEEL_CONFIG).map((config) => {
                        const isDisabled = hasSpunToday;
                        return (
                            <button key={config.id} onClick={() => !isDisabled && setSelectedMode(config.id)} disabled={isDisabled} className={`w-full p-5 rounded-3xl border flex items-center justify-between group transition-all relative overflow-hidden ${isDisabled ? 'bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed grayscale' : `${config.bg} ${config.border} active:scale-[0.98]`}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl bg-black border border-white/[0.07] ${config.color} shadow-lg`}>{isDisabled ? <Lock size={24} /> : config.icon}</div>
                                    <div className="text-left"><h3 className={`text-lg font-black uppercase leading-none ${isDisabled ? 'text-zinc-500' : config.color}`}>{config.title}</h3><p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-wide">{config.desc}</p></div>
                                </div>
                                <div className="flex flex-col items-end"><span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Coste</span><div className="bg-black px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-1.5"><span className={`text-sm font-black ${isDisabled ? 'text-zinc-600' : 'text-white'}`}>{config.cost === 0 ? "GRATIS" : config.cost}</span>{config.cost > 0 && <img src="/assets/icons/ficha.png" className={`w-3.5 h-3.5 ${isDisabled ? 'grayscale opacity-50' : ''}`} alt="F" />}</div></div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}