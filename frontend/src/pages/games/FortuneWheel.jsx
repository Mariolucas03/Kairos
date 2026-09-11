import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { Gift, Flame, Diamond, Lock, X, Volume2, VolumeX, Coins, Star, Crown, Zap, Loader2 } from 'lucide-react';
import BackButton from '../../components/common/BackButton';
import api from '../../services/api';
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

/**
 * ⚠️ AQUI HABIA UNA COPIA DE LAS RUEDAS, Y MENTIA.
 *
 * Coste, premios y etiquetas estaban escritos aqui, y los premios de verdad en
 * el servidor. Cuando se reequilibro la economia solo se toco el servidor: la
 * rueda enseñaba "1K" y pagaba 200. Ahora el catalogo entero viene de
 * `GET /games/fortune` —nombre, coste, color, premios— y aqui solo se decide
 * como pintarlo. No queda nada que pueda quedarse viejo.
 */
const ICONOS = { daily: Gift, bronce: Coins, hardcore: Flame, plata: Star, oro: Crown, jackpot: Diamond, xp: Zap };

/** "1K", "2.4K", "250", o un punto para el cero. */
const etiquetaDe = (v) => {
    if (!v) return '·';
    if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}K`;
    return String(v);
};

/** Aclara u oscurece un #rrggbb. */
const tono = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (x) => Math.max(0, Math.min(255, Math.round(x)));
    const r = c(((n >> 16) & 255) * f), g = c(((n >> 8) & 255) * f), b = c((n & 255) * f);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

/**
 * Los colores de las cuñas salen del acento de la rueda: se alternan con dos
 * grises para que se distingan, los vacios van oscuros para que se vea que
 * son vacios, y el premio mas gordo va en dorado para que se vea a que
 * apuntas. Asi una rueda nueva en el servidor sale ya con su aspecto.
 */
const cunasDe = (rueda) => {
    const maximo = Math.max(...rueda.premios.map(p => p.v));
    const base = [rueda.acento, '#1f1f24', tono(rueda.acento, 0.65), '#2a2a31'];
    return rueda.premios.map((p, i) => ({
        label: etiquetaDe(p.v),
        color: p.v === 0 ? '#111114' : p.v === maximo && maximo > 0 ? '#c9a33f' : base[i % base.length]
    }));
};

/** Lo que el juego usa de una rueda, montado a partir del catalogo. */
const configDe = (rueda) => {
    const Icono = ICONOS[rueda.id] || Star;
    return {
        id: rueda.id,
        title: rueda.nombre,
        cost: rueda.coste,
        desc: rueda.descripcion,
        acento: rueda.acento,
        icon: <Icono size={24} />,
        prizes: cunasDe(rueda)
    };
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
                        <p className="text-sm text-zinc-400 mb-8 font-medium">{winData.v > 0 ? `Has conseguido ${winData.v.toLocaleString('es-ES')} ${winData.t === 'xp' ? 'XP' : 'fichas'}.` : 'No has ganado nada esta vez.'}</p>
                        <button onClick={() => { setWinData(null); if (config.cost === 0) onBack(); }} className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest hover:bg-zinc-200 shadow-lg">
                            {winData.v > 0 ? 'RECOGER' : 'CONTINUAR'}
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

    // El catalogo y si la gratis de hoy ya esta usada, los dos del servidor.
    // Antes el "una al dia" vivia en localStorage y bloqueaba TODAS las ruedas
    // (una tirada diaria en total). Las de pago devuelven el 85%, como los
    // dados: girarlas sin limite es seguro para la economia y es lo que se
    // espera de una rueda de feria. La unica que se limita es la gratis, y
    // eso lo decide el servidor, que es quien la cobra.
    const { data, mutate } = useSWR('/games/fortune', (url) => api.get(url).then(r => r.data));
    const ruedas = data?.ruedas || [];
    const diariaUsadaHoy = !!data?.diariaUsadaHoy;
    const ruedaAbierta = ruedas.find(r => r.id === selectedMode);
    // Memorizada: `configDe` crea el icono y las cuñas nuevos cada vez, y con
    // eso `RuedaFortuna` (que es `memo`) se repintaba en cada pintado de la
    // pagina aunque no hubiera cambiado nada.
    const config = useMemo(() => (ruedaAbierta ? configDe(ruedaAbierta) : null), [ruedaAbierta]);

    useEffect(() => { if (selectedMode) setIsUiHidden(true); else setIsUiHidden(false); return () => setIsUiHidden(false); }, [selectedMode, setIsUiHidden]);

    // Tras un giro se vuelve a preguntar: si era la gratis, ahora esta usada.
    const handleSpinComplete = () => { mutate(); };

    return (
        <div className={`flex flex-col h-full animate-in fade-in select-none px-4 pb-20 ${selectedMode ? 'pt-24' : 'pt-4'}`}>
            <div className="flex items-center mb-6">
                <BackButton onClick={() => selectedMode ? setSelectedMode(null) : navigate('/games')} />
                <h1 className="ml-4 text-xl font-black not-italic uppercase text-white tracking-tight">{ruedaAbierta ? ruedaAbierta.nombre : 'Ruleta de la Fortuna'}</h1>
            </div>

            {ruedaAbierta ? (
                // `key` por rueda: sin ella, al cambiar de rueda el componente se
                // reutiliza y hereda el angulo y el modal de la anterior.
                <ActiveWheel key={ruedaAbierta.id} config={config} user={user} setUser={setUser} onBack={() => setSelectedMode(null)} onSpinComplete={handleSpinComplete} />
            ) : (
                <div className="flex flex-col gap-3">
                    {!data && (
                        <div className="flex justify-center py-16 text-zinc-600"><Loader2 size={22} className="animate-spin" /></div>
                    )}
                    {ruedas.map((rueda) => {
                        const Icono = ICONOS[rueda.id] || Star;
                        const esGratis = rueda.coste === 0;
                        // Solo la gratis se bloquea, y solo si ya se uso hoy.
                        const bloqueada = esGratis && diariaUsadaHoy;
                        const maximo = Math.max(...rueda.premios.map(p => p.v));
                        const enXp = rueda.premios[0]?.t === 'xp';
                        return (
                            <button
                                key={rueda.id}
                                onClick={() => !bloqueada && setSelectedMode(rueda.id)}
                                disabled={bloqueada}
                                // Todas de la MISMA altura: con la altura al gusto del texto,
                                // cada tarjeta salia distinta y la caja del coste bailaba.
                                className={`w-full h-[104px] px-4 rounded-3xl border flex items-center justify-between transition-all relative overflow-hidden ${bloqueada ? 'bg-zinc-900 border-zinc-800 opacity-50 cursor-not-allowed grayscale' : 'active:scale-[0.98]'}`}
                                style={bloqueada ? undefined : { background: `${rueda.acento}14`, borderColor: `${rueda.acento}55` }}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="p-3 rounded-2xl bg-black border border-white/[0.07] shadow-lg shrink-0" style={{ color: rueda.acento }}>
                                        {bloqueada ? <Lock size={24} /> : <Icono size={24} />}
                                    </div>
                                    <div className="text-left min-w-0">
                                        <h3 className="text-lg font-black uppercase leading-none truncate" style={{ color: bloqueada ? '#71717a' : rueda.acento }}>{rueda.nombre}</h3>
                                        <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-wide leading-tight line-clamp-2">
                                            {bloqueada ? 'Ya usada hoy. Vuelve mañana.' : rueda.descripcion}
                                        </p>
                                        {/* Lo maximo que puede salir, para decidir con datos. Sale del
                                            mismo catalogo que paga, asi que no puede mentir. */}
                                        {!bloqueada && maximo > 0 && (
                                            <p className="text-[10px] font-black mt-1 tabular-nums" style={{ color: rueda.acento }}>
                                                hasta {maximo.toLocaleString('es-ES')} {enXp ? 'XP' : 'fichas'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end shrink-0 pl-2">
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Coste</span>
                                    <div className="bg-black px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-1.5">
                                        <span className={`text-sm font-black ${bloqueada ? 'text-zinc-600' : 'text-white'}`}>{esGratis ? 'GRATIS' : rueda.coste}</span>
                                        {!esGratis && <img src="/assets/icons/ficha.png" className="w-3.5 h-3.5" alt="F" />}
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