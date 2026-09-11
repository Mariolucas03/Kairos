import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Zap, Cherry, Gem, Star, Crown, Clover, Info, X, Skull, Ghost, Volume2, VolumeX } from 'lucide-react';
import BackButton from '../../components/common/BackButton';
import api from '../../services/api';

// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../../store/useAuthStore';
import SelectorApuesta from '../../components/games/SelectorApuesta';
import { trayectoriaRodillo, montarTira, PARADAS, RELLENO } from '../../utils/fisicaRodillos';
import { crearSintetizador, melodias, haySonidoJuegos, cambiarSonidoJuegos } from '../../utils/sintetizador';

// Filas que se ven en la ventana de cada rodillo.
const FILAS = 4;
// A esta velocidad (simbolos/ms) la estela se satura. Sale de la fisica.
const VELOCIDAD_MAXIMA = 0.045;

// --- IMAGEN DE PORTADA ---
const SLOT_COVER_IMG = '/assets/images/neon-cover.png';

// --- LLUVIA DE FICHAS ---
const ChipRain = ({ isFading }) => {
    const [drops] = useState(() => Array.from({ length: 150 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        startTop: -(Math.random() * 100 + 10),
        delay: Math.random() * 0.5,
        duration: 1 + Math.random(),
        size: 15 + Math.random() * 40,
        opacity: 0.4 + Math.random() * 0.6
    })));

    return (
        <div className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-1000 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
            <style>{`@keyframes slotFall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(120vh) rotate(360deg); } }`}</style>
            {drops.map((d) => (
                <img key={d.id} src="/assets/icons/ficha.png" className="absolute will-change-transform"
                    style={{ left: `${d.left}%`, top: `${d.startTop}vh`, width: `${d.size}px`, opacity: d.opacity, animation: `slotFall ${d.duration}s linear ${d.delay}s infinite` }} alt="" />
            ))}
        </div>
    );
};

// --- ICONOS PARA EL FRONTEND ---
const ICONS = {
    cherry: <Cherry size={32} className="text-red-500" />,
    clover: <Clover size={32} className="text-green-500" />,
    zap: <Zap size={32} className="text-yellow-400" />,
    star: <Star size={32} className="text-purple-400" />,
    gem: <Gem size={32} className="text-cyan-400" />,
    crown: <Crown size={32} className="text-yellow-600" />,
    skull: <Skull size={32} className="text-zinc-600" />,
    ghost: <Ghost size={32} className="text-zinc-500" />
};

// --- VISUALES DE PAGO (Solo para Info Modal) ---
const PAYTABLE = [
    { id: 'crown', icon: <Crown size={24} className="text-yellow-600" />, val: 50 },
    { id: 'gem', icon: <Gem size={24} className="text-cyan-400" />, val: 20 },
    { id: 'star', icon: <Star size={24} className="text-purple-400" />, val: 10 },
    { id: 'zap', icon: <Zap size={24} className="text-yellow-400" />, val: 5 },
    { id: 'clover', icon: <Clover size={24} className="text-green-500" />, val: 3 },
    { id: 'cherry', icon: <Cherry size={24} className="text-red-500" />, val: 1.5 },
];

export default function Slots() {
    // 🔥 CONECTAMOS CON ZUSTAND
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);

    const navigate = useNavigate();

    // Estados Juego
    const [gameStarted, setGameStarted] = useState(false);
    const [bet, setBet] = useState(20);
    // Grid inicial visual para que no esté vacío
    const [cols, setCols] = useState(Array(4).fill(Array(4).fill({ id: 'cherry' })));

    // ⚠️ LOS RODILLOS NO PASAN POR REACT MIENTRAS GIRAN.
    //
    // Cada uno es una tira larga de simbolos, y en cada frame se le escribe el
    // transform directamente al DOM. Meter la posicion en estado seria repintar
    // los cuatro rodillos con sus decenas de simbolos sesenta veces por
    // segundo, que en un movil se ve como tirones.
    //
    // `tiras` solo cambia dos veces por tirada: al arrancar (se monta la tira
    // con el resultado del servidor al final) y al terminar (se deja solo lo
    // visible, en la misma posicion, asi que no se nota el cambio).
    const [tiras, setTiras] = useState(() => cols.map(c => c.map(s => s.id)));
    const rodillosRef = useRef([]);        // los <div> que se desplazan
    const ventanaRef = useRef(null);       // para medir la altura de una fila
    const animationRef = useRef(null);
    const sonidoRef = useRef(null);

    // ⚠️ LA ALTURA DE UNA FILA SE MIDE UNA VEZ Y VALE PARA TODO.
    //
    // Los simbolos se pintan con esta altura y el bucle desplaza la tira en
    // multiplos de ella. Si se pintaran con un % y se midiera aparte, cualquier
    // diferencia —el padding, un redondeo— se multiplicaria por las decenas de
    // simbolos que pasan y el rodillo acabaria media fila fuera de sitio,
    // enseñando un premio que no se paga.
    const [filaPx, setFilaPx] = useState(0);
    useLayoutEffect(() => {
        const medir = () => {
            const v = ventanaRef.current;
            if (!v) return;
            const estilo = getComputedStyle(v);
            const alto = v.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom);
            setFilaPx(alto / FILAS);
        };
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    const [conSonido, setConSonido] = useState(haySonidoJuegos);
    const alternarSonido = () => {
        const nuevo = !conSonido;
        cambiarSonidoJuegos(nuevo);
        setConSonido(nuevo);
        if (!nuevo) sonidoRef.current?.parar();
    };

    // Si el usuario se va a mitad de tirada, se para el bucle y el sonido.
    useEffect(() => () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        sonidoRef.current?.parar();
    }, []);

    const [isGameActive, setIsGameActive] = useState(false);

    // SALDO DERIVADO, no un estado paralelo que haya que ir resincronizando a mano:
    // mientras giran los rodillos se descuenta la apuesta y, en cuanto responde el
    // servidor, el saldo real del usuario manda. Así no puede descuadrarse nunca.
    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const visualBalance = isGameActive ? Math.max(0, currentFichas - bet) : currentFichas;

    // RESULTADO
    const [result, setResult] = useState({ won: false, payout: 0, winningCells: [] });
    const [msg, setMsg] = useState("¡Consigue 3 en línea!");

    // UI
    const [showInfo, setShowInfo] = useState(false);
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);

    useEffect(() => {
        setIsUiHidden(true);
        return () => setIsUiHidden(false);
    }, [setIsUiHidden]);

    // --- JUGAR (CONEXIÓN AL BACKEND) ---
    const handleSpin = async () => {
        if (!gameStarted) { setGameStarted(true); return; }
        if (isGameActive) return;
        if (visualBalance < bet) { setMsg("No te llegan las fichas"); return; }

        setIsGameActive(true);
        setMsg("Girando...");
        setResult({ won: false, payout: 0, winningCells: [] });
        setShowRain(false);
        setIsRainFading(false);

        try {
            // 1. El resultado lo decide el servidor. Todo lo de abajo es el
            //    camino hasta el.
            const res = await api.post('/games/slots', { bet });
            const gridFinal = res.data.grid;   // 4 columnas de 4 {id}

            // 2. Montar las tiras: lo que se ve ahora, luego relleno, y al final
            //    lo que dijo el servidor. Empezar por lo visible es lo que evita
            //    el salto al arrancar: el rodillo sale de donde esta.
            const catalogo = Object.keys(ICONS);
            const visiblesAhora = cols.map(c => c.map(s => s.id));
            const definitivos = gridFinal.map(c => c.map(s => s.id));
            const nuevasTiras = definitivos.map((finales, i) =>
                visiblesAhora[i].concat(montarTira({ relleno: RELLENO[i], definitivos: finales, catalogo }))
            );
            // ⚠️ `flushSync` y no un `await requestAnimationFrame`.
            //
            // Hace falta que las tiras nuevas esten en el DOM antes de empezar a
            // moverlas. Esperar un frame para eso parecia lo natural, pero rAF
            // NO dispara con la pestaña en segundo plano: la tirada se quedaba
            // esperando ese frame para siempre, ANTES de armar el salvavidas.
            // flushSync obliga a React a pintar aqui mismo, sin frames.
            flushSync(() => setTiras(nuevasTiras));

            // Cada rodillo tiene su trayectoria: la posicion final es la que
            // deja los 4 ultimos simbolos en la ventana.
            const trayectorias = nuevasTiras.map((tira, i) =>
                trayectoriaRodillo({ relleno: tira.length - FILAS, duracion: PARADAS[i] })
            );

            const sonido = crearSintetizador();
            sonidoRef.current = sonido;
            const ronroneo = sonido.continuo({ frecuenciaBase: 180, frecuenciaExtra: 320, volumenMax: 0.14 });
            const parado = [false, false, false, false];
            const duracionTotal = Math.max(...PARADAS);

            let terminado = false;
            const terminar = () => {
                if (terminado) return;
                terminado = true;
                clearTimeout(salvavidas);
                if (animationRef.current) cancelAnimationFrame(animationRef.current);
                sonido.parar();
                sonidoRef.current = null;

                // Se deja en cada rodillo solo lo visible, en la posicion 0. Es
                // lo mismo que se veia, asi que el cambio no se nota, y la
                // siguiente tirada arranca de aqui.
                setCols(gridFinal);
                setTiras(definitivos);
                rodillosRef.current.forEach(r => { if (r) { r.style.transform = 'translateY(0px)'; r.style.filter = 'none'; } });

                setResult({ won: res.data.won, payout: res.data.payout, winningCells: res.data.winningCells });

                if (res.data.won) {
                    setMsg("¡PREMIO!");
                    setShowRain(true);
                    setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);
                    // La melodia va en un sintetizador nuevo: el de la tirada ya
                    // se esta apagando.
                    const fanfarria = crearSintetizador();
                    (res.data.payout >= bet * 10 ? melodias.granPremio : melodias.ganar)(fanfarria);
                    setTimeout(fanfarria.parar, 2500);
                } else {
                    setMsg("Inténtalo de nuevo");
                    const s2 = crearSintetizador();
                    melodias.perder(s2);
                    setTimeout(s2.parar, 1000);
                }

                if (res.data.user) {
                    setUser(res.data.user);
                    localStorage.setItem('user', JSON.stringify(res.data.user));
                }
                setIsGameActive(false);
            };

            const t0 = performance.now();
            const frame = (ahora) => {
                const ms = ahora - t0;
                let vMax = 0;

                trayectorias.forEach((tr, i) => {
                    const el = rodillosRef.current[i];
                    if (!el) return;
                    const pos = tr.posicion(ms);
                    const v = Math.min(tr.velocidad(ms) / VELOCIDAD_MAXIMA, 1);
                    vMax = Math.max(vMax, v);
                    el.style.transform = `translateY(${-pos * filaPx}px)`;
                    // La estela: a mucha velocidad los simbolos se emborronan en
                    // vertical. Es lo que hace el ojo con una tira rapida.
                    //
                    // ⚠️ Con umbral alto y sin volver a 'none' hasta parar. Un
                    // `filter` es una capa que se rasteriza entera cada vez que
                    // cambia; alternar entre blur y 'none' frame si, frame no
                    // alrededor de un umbral bajo era rehacer la capa sin parar,
                    // y en un movil eso son tirones. Ademas el desenfoque va
                    // acotado: mas de 1.8px ya no es estela, es niebla.
                    if (v > 0.18) {
                        el.style.filter = `blur(${Math.min(v * 2, 1.8).toFixed(1)}px)`;
                    } else if (el.style.filter !== 'none') {
                        el.style.filter = 'none';
                    }

                    // El "clonc" de encajar, una vez por rodillo, cuando llega.
                    if (!parado[i] && ms >= tr.msLlegada) {
                        parado[i] = true;
                        sonido.golpe({ frecuencia: 220 + i * 25, duracion: 0.11, volumen: 0.5, q: 3 });
                        sonido.golpe({ frecuencia: 1800, duracion: 0.03, volumen: 0.18 });
                    }
                });

                ronroneo(vMax);

                if (ms < duracionTotal) {
                    animationRef.current = requestAnimationFrame(frame);
                } else {
                    terminar();
                }
            };

            // El salvavidas: rAF no dispara con la pestaña en segundo plano.
            // Sin esto, cambiar de app a mitad de tirada la dejaba colgada.
            const salvavidas = setTimeout(terminar, duracionTotal + 600);
            animationRef.current = requestAnimationFrame(frame);

        } catch (error) {
            console.error("Error en Slots:", error);
            // El saldo se recalcula solo: no hace falta deshacer nada a mano
            setMsg(error.response?.data?.message || "No se pudo tirar");
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            sonidoRef.current?.parar();
            setIsGameActive(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center pt-32 pb-10 overflow-hidden select-none font-sans">
            {showRain && <ChipRain isFading={isRainFading} />}


            {/* HEADER */}
            <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-50">
                <BackButton to="/games" />
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-purple-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-purple-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={alternarSonido}
                        aria-label={conSonido ? 'Silenciar' : 'Activar el sonido'}
                        className={`p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 active:scale-95 transition-transform ${conSonido ? 'text-zinc-300' : 'text-zinc-600'}`}
                    >
                        {conSonido ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                    <button onClick={() => setShowInfo(true)} className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
                </div>
            </div>

            {/* MÁQUINA */}
            <div className="w-full max-w-sm px-4 relative z-10 flex flex-col items-center gap-4">

                {/* ⚠️ El titulo iba en `absolute top-28` mientras la maquina va
                    en el flujo y centrada. En cuanto la pantalla no era lo
                    bastante alta, la maquina subia y le pasaba por encima: se
                    veia "NEON SLOTS" cortado por la mitad. En el flujo, encima de
                    la maquina, no puede pisarlo nada. */}
                <h1 className="text-4xl font-black text-fuchsia-400 tracking-[-0.045em] leading-none pb-1 not-italic text-center">
                    NEON SLOTS
                </h1>
                <div className="w-full aspect-[4/3.5] bg-zinc-900 rounded-[2rem] border-[6px] border-zinc-800 shadow-2xl relative overflow-hidden ring-4 ring-purple-900/20">

                    {/* PORTADA LIMPIA */}
                    <div className={`absolute inset-0 z-50 bg-black flex flex-col items-center justify-center transition-transform duration-500 ${gameStarted ? '-translate-y-full' : 'translate-y-0'}`}>
                        <img src={SLOT_COVER_IMG} alt="Cover" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]"></div>
                    </div>

                    {/* LOS RODILLOS.
                        Cada columna es una ventana con una tira larga dentro que
                        se desplaza hacia arriba. Solo se ven cuatro filas; el
                        resto de la tira queda escondido por el overflow. Durante
                        la tirada el transform lo escribe el bucle de frames, no
                        React (ver handleSpin). */}
                    <div ref={ventanaRef} className="absolute inset-0 bg-[#0a0a0c] grid grid-cols-4 gap-1 p-2">
                        {tiras.map((tira, colIdx) => (
                            <div key={colIdx} className="relative rounded-lg overflow-hidden bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-800">
                                {/* La tira. Cada simbolo mide exactamente una fila
                                    de la ventana (100% / FILAS), para que la posicion
                                    en simbolos se convierta en pixeles sin error. */}
                                <div
                                    ref={el => { rodillosRef.current[colIdx] = el; }}
                                    className="absolute inset-x-0 top-0"
                                    style={{ willChange: 'transform, filter' }}
                                >
                                    {tira.map((id, rowIdx) => {
                                        // Solo pueden ganar los 4 ultimos (los visibles al terminar).
                                        const filaVisible = rowIdx - (tira.length - FILAS);
                                        const isWinCell = result.won && filaVisible >= 0
                                            && result.winningCells?.includes(`${colIdx}-${filaVisible}`);
                                        return (
                                            <div
                                                key={rowIdx}
                                                className={`flex items-center justify-center transition-colors duration-300 ${isWinCell ? 'bg-yellow-500/30 shadow-[inset_0_0_20px_rgba(234,179,8,0.5)]' : ''}`}
                                                style={{ height: filaPx ? `${filaPx}px` : `${100 / FILAS}%` }}
                                            >
                                                <div className={`drop-shadow-md transition-transform ${isWinCell ? 'scale-125 brightness-125' : 'scale-100'}`}>
                                                    {ICONS[id]}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* El rodillo es un cilindro: arriba y abajo se
                                    curvan hacia la sombra. Es lo que lo despega de
                                    una lista de iconos. */}
                                <div className="absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10" />
                                <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10" />
                                {/* Y el reflejo del cristal, fijo, que no gira. */}
                                <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'linear-gradient(105deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 35%, transparent 55%)' }} />
                            </div>
                        ))}
                    </div>

                </div>

                {/* CONTROLES */}
                <div className="w-full bg-zinc-900/80 backdrop-blur-md rounded-3xl border border-white/10 p-5 flex flex-col gap-4 shadow-xl">
                    <div className="bg-black/60 rounded-xl py-3 border border-white/[0.07] text-center h-12 flex items-center justify-center">
                        {result.won ? (
                            <span className="text-green-400 font-black text-xl animate-pulse">+{result.payout} FICHAS</span>
                        ) : (
                            <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest">{msg}</span>
                        )}
                    </div>

                    <div className="space-y-3">
                        <SelectorApuesta valor={bet} onChange={setBet} saldo={currentFichas} minimo={10} deshabilitado={isGameActive} />

                        <button
                            onClick={handleSpin}
                            disabled={isGameActive || (gameStarted && visualBalance < bet)}
                            className={`w-full h-14 rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg active:scale-95 transition-all border-b-4 
                                ${isGameActive
                                    ? 'bg-zinc-800 border-zinc-900 text-zinc-600'
                                    : 'bg-fuchsia-600 border-fuchsia-800 text-white hover:brightness-110'
                                }`}
                        >
                            {isGameActive ? '...' : (gameStarted ? 'GIRAR' : 'JUGAR')}
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL INFO */}
            {showInfo && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-900 w-full max-w-xs rounded-3xl border border-white/10 p-6 relative shadow-2xl">
                        <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                        <h3 className="text-xl font-black text-white text-center mb-6 uppercase not-italic">Tabla de Pagos</h3>
                        <div className="space-y-2 text-xs text-zinc-300">
                            {PAYTABLE.map(s => (
                                <div key={s.id} className="flex items-center justify-between bg-black/50 p-2 rounded-lg border border-white/[0.07]">
                                    <div className="flex items-center gap-2">{s.icon} <span className="font-bold text-sm text-zinc-300">3x</span></div>
                                    <span className="font-mono font-black text-white text-lg">x{s.val}</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-center text-[10px] text-zinc-400 mt-4 bg-purple-900/20 p-2 rounded-lg border border-purple-500/20">
                            Calaveras y Fantasmas no dan premio.<br />
                            ¡Consigue <strong>3 o 4 iguales</strong> en línea!
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}