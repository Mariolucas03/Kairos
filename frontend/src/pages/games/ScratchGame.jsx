import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Info, X, Volume2, VolumeX } from 'lucide-react';
import BackButton from '../../components/common/BackButton';
import SelectorApuesta from '../../components/games/SelectorApuesta';
import CapaRasca from '../../components/games/CapaRasca';
import { crearSintetizador, melodias, haySonidoJuegos, cambiarSonidoJuegos } from '../../utils/sintetizador';

// La cuadricula es 3x3 con un hueco de 12 px (gap-3). La capa de rascar
// necesita saber donde esta cada casilla, y esto es la unica fuente.
const HUECO = 12;
const celdaDelRasca = (i, ancho, alto) => {
    const w = (ancho - 2 * HUECO) / 3;
    const h = (alto - 2 * HUECO) / 3;
    return { x: (i % 3) * (w + HUECO), y: Math.floor(i / 3) * (h + HUECO), ancho: w, alto: h };
};
import api from '../../services/api';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../../store/useAuthStore';

// --- RUTA DE LA IMAGEN DEL REVERSO ---
const CARD_BACK_IMG = '/assets/images/reverso-carta.png';

/**
 * LA TABLA DE PREMIOS.
 *
 * ⚠️ ENSEÑABA 3,3 VECES LO QUE EL SERVIDOR PAGABA.
 *
 * Decia 500 / 200 XP / 100 / 50. El servidor pagaba 150 / 75 / 30 / 15: los
 * premios se bajaron alli porque el rasca regalaba dinero, y esta tabla se
 * quedo como estaba. Nadie se entero, porque una tabla que miente no da error
 * —solo hace que el juego decepcione y no sepas por que—.
 *
 * Es el mismo fallo de siempre: el mismo numero escrito en dos sitios.
 *
 * Ahora se enseñan MULTIPLOS de lo apostado, que es lo que el servidor calcula
 * de verdad y ademas no depende de cuanto apuestes. Y en el backend hay una
 * prueba (pruebas/economia.test.js, "LOS MULTIPLOS ESTAN TAMBIEN EN EL MOVIL")
 * que fija estos valores para que cambiarlos alli obligue a mirar aqui.
 */
const SYMBOLS = {
    DIAMOND: { id: 'd', icon: '💎', type: 'coins', label: '×15' },
    XP: { id: 'x', icon: '⚡', type: 'xp', label: '75 XP' },
    COIN: { id: 'c', icon: '🪙', type: 'coins', label: '×3' },
    LEMON: { id: 'l', icon: '🍋', type: 'coins', label: '×1,5' },
    SKULL: { id: 's', icon: '💀', type: 'none', label: '' },
    POOP: { id: 'p', icon: '💩', type: 'none', label: '' }
};

// --- COMPONENTE DE CATARATA DE FICHAS ---
const ChipRain = ({ isFading }) => {
    const [drops] = useState(() => Array.from({ length: 250 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        startTop: -(Math.random() * 150 + 10),
        delay: Math.random() * 1,
        duration: 1.2 + Math.random(),
        size: 15 + Math.random() * 40,
        opacity: 0.3 + Math.random() * 0.7
    })));

    return (
        <div className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-1000 ease-out ${isFading ? 'opacity-0' : 'opacity-100'}`}>
            <style>{`@keyframes cascadeFall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(200vh) rotate(720deg); } }`}</style>
            {drops.map((d) => (
                <img key={d.id} src="/assets/icons/ficha.png" className="absolute will-change-transform"
                    style={{ left: `${d.left}%`, top: `${d.startTop}vh`, width: `${d.size}px`, animation: `cascadeFall ${d.duration}s linear ${d.delay}s infinite`, opacity: d.opacity }} alt="" />
            ))}
        </div>
    );
};

export default function ScratchGame() {
    // 🔥 CONECTAMOS CON ZUSTAND
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);
    const navigate = useNavigate();

    // Ocultar UI global
    useEffect(() => {
        setIsUiHidden(true);
        return () => setIsUiHidden(false);
    }, [setIsUiHidden]);

    // Estados
    const [isPlaying, setIsPlaying] = useState(false);
    const [grid, setGrid] = useState(Array(9).fill(null));
    const [revealed, setRevealed] = useState(Array(9).fill(false));
    const [result, setResult] = useState(null); // Guardaremos el resultado del backend aquí

    // UI
    const [showInfo, setShowInfo] = useState(false);
    const [showRain, setShowRain] = useState(false);
    const [isRainFading, setIsRainFading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // ⚠️ EL RASCA ERA EL ULTIMO JUEGO CON LA APUESTA CLAVADA.
    //
    // Costaba 10 fichas y no habia forma de apostar otra cosa: con saldos de
    // miles, comprar cartones de 10 en 10 era un peaje. Ahora se elige, y el
    // premio sale de lo apostado (el servidor multiplica; ver SYMBOLS arriba).
    const APUESTA_MINIMA = 10;
    const [apuesta, setApuesta] = useState(APUESTA_MINIMA);

    // SALDO DERIVADO: mientras rascas se descuenta el cartón y, al terminar,
    // manda el saldo real que devolvió el servidor. Antes era un estado aparte
    // que había que ir sincronizando a mano en cuatro sitios distintos.
    const currentFichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const visualBalance = isPlaying ? Math.max(0, currentFichas - apuesta) : currentFichas;

    // --- JUGAR (CONEXIÓN AL BACKEND) ---
    const play = async () => {
        if (currentFichas < apuesta) { setErrorMsg("No te llegan las fichas"); return; }

        setErrorMsg(null);
        setIsPlaying(true);
        setRevealed(Array(9).fill(false));
        setResult(null);
        setShowRain(false);
        setIsRainFading(false);

        try {
            // 2. Pedir resultado al backend (Inhackeable)
            const res = await api.post('/games/scratch', { bet: apuesta });

            // 3. Cargar la matriz devuelta por el servidor (oculta hasta rascar)
            setGrid(res.data.grid);

            // 4. Guardar el resultado en memoria para cuando termine de rascar
            setResult({
                won: res.data.won,
                prize: res.data.prize,
                type: res.data.prizeType,
                user: res.data.user // Usuario actualizado con el premio (si lo hubo)
            });

        } catch (error) {
            console.error("Error comprando cartón:", error);
            // Sin rollback manual: al salir de isPlaying el saldo vuelve solo al real
            setErrorMsg(error.response?.data?.message || "No se pudo comprar el cartón");
            setIsPlaying(false);
        }
    };

    // ⚠️ EL SONIDO DE RASCAR, y de cuando asoma una casilla.
    const sonidoRef = useRef(null);
    const roceRef = useRef(null);
    useEffect(() => {
        sonidoRef.current = crearSintetizador();
        // Un roce: ruido con un filtro alto, que sigue a la velocidad del dedo.
        roceRef.current = sonidoRef.current.continuo({ frecuenciaBase: 1800, frecuenciaExtra: 1600, volumenMax: 0.12 });
        return () => sonidoRef.current?.parar();
    }, []);
    const [conSonido, setConSonido] = useState(haySonidoJuegos);
    const alternarSonido = () => {
        const nuevo = !conSonido;
        cambiarSonidoJuegos(nuevo);
        setConSonido(nuevo);
        sonidoRef.current?.parar();
        sonidoRef.current = crearSintetizador();
        roceRef.current = sonidoRef.current.continuo({ frecuenciaBase: 1800, frecuenciaExtra: 1600, volumenMax: 0.12 });
    };

    // Se leen por ref porque `reveal` lo llama el canvas desde eventos del
    // puntero, fuera de un pintado de React, y varias veces seguidas.
    const resultRef = useRef(result);
    resultRef.current = result;
    const reveladasRef = useRef(revealed);
    reveladasRef.current = revealed;

    const reveal = (i) => {
        // ⚠️ LA VERDAD ESTA EN EL REF, Y LOS EFECTOS FUERA DEL ESTADO.
        //
        // Las casillas las destapa el dedo, y en una sola pasada pueden caer
        // dos seguidas antes de que React repinte: con el `revealed` del cierre
        // la segunda pisaba a la primera. Y meter el sonido y el fin de partida
        // dentro del actualizador de `setRevealed` tampoco vale: React puede
        // ejecutar un actualizador dos veces (lo hace en modo estricto), y
        // entonces sonaba doble y el premio se disparaba dos veces.
        if (reveladasRef.current[i]) return;
        const nuevo = [...reveladasRef.current];
        nuevo[i] = true;
        reveladasRef.current = nuevo;
        setRevealed(nuevo);

        // Un "ding" al asomar la casilla, mas agudo cuantas mas lleves.
        const cuantas = nuevo.filter(Boolean).length;
        sonidoRef.current?.nota({ frecuencia: 660 * Math.pow(2, cuantas / 12), duracion: 0.14, volumen: 0.12 });

        // Si es la ultima, el resultado.
        const res = resultRef.current;
        if (nuevo.every(Boolean) && res) {
            setIsPlaying(false);
            roceRef.current?.(0);
            if (res.won) {
                setShowRain(true);
                setTimeout(() => { setIsRainFading(true); setTimeout(() => setShowRain(false), 1000); }, 3000);
                const s = sonidoRef.current;
                setTimeout(() => (res.prize >= 200 ? melodias.granPremio : melodias.ganar)(s), 250);
            } else {
                setTimeout(() => melodias.perder(sonidoRef.current), 250);
            }
            if (res.user) {
                setUser(res.user);
                localStorage.setItem('user', JSON.stringify(res.user));
            }
        }
    };

    const winningSymbols = Object.values(SYMBOLS).filter(s => s.type !== 'none').sort((a, b) => b.prize - a.prize);

    // ⚠️ El contenedor era `justify-center` + `overflow-hidden`. En un movil con
    // la barra del navegador (unos 700px de alto) el contenido no cabia y,
    // centrado, se salia POR ARRIBA y POR ABAJO a la vez: el titulo se metia
    // debajo de la cabecera y el boton de jugar quedaba cortado sin poder
    // llegar a el. Ahora el contenido se centra con `my-auto` —que nunca se
    // hace negativo— y si no cabe, se hace scroll.
    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center pt-28 pb-4 overflow-y-auto overflow-x-hidden select-none font-sans">

            {showRain && <ChipRain isFading={isRainFading} />}

            {/* HEADER */}
            {/* Tres columnas de verdad: la de la izquierda y la de la derecha pesan
                lo mismo, y asi la caja de fichas queda CENTRADA aunque a un lado
                haya un boton y al otro dos. Con `justify-between` se iba hacia
                el lado que menos ocupaba. */}
            <div className="fixed top-12 left-4 right-4 flex items-center z-50">
                <div className="flex-1 flex"><BackButton to="/games" /></div>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-yellow-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-yellow-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" />
                </div>
                <div className="flex-1 flex items-center justify-end gap-2">
                    <button
                        onClick={alternarSonido}
                        aria-label={conSonido ? 'Silenciar' : 'Activar el sonido'}
                        className={`p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 active:scale-95 transition-transform ${conSonido ? 'text-zinc-300' : 'text-zinc-600'}`}
                    >
                        {conSonido ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                    <button onClick={() => setShowInfo(true)} aria-label="Ver la tabla de premios" className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
                </div>
            </div>

            {/* ZONA DE JUEGO */}
            <div className="my-auto flex flex-col items-center w-full max-w-sm px-4 relative z-10 gap-4">

                {/* El titulo iba en `absolute top-28`, fuera del flujo: en cuanto
                    la pantalla era corta, el carton subia y le pasaba por encima. */}
                <div className="w-full text-center">
                    <h1 className="text-4xl font-black text-yellow-400 tracking-[-0.045em] uppercase not-italic pointer-events-none">
                        RASCA Y GANA
                    </h1>
                    {errorMsg && (
                        <div onClick={() => setErrorMsg(null)} className="mx-2 mt-3 bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase tracking-wide px-4 py-2.5 rounded-2xl cursor-pointer">
                            {errorMsg}
                        </div>
                    )}
                </div>

                <div className="bg-[#18181b] border border-white/[0.07] p-1 rounded-3xl w-full transform transition-all">
                    <div className="bg-black/90 rounded-[1.8rem] p-6 border border-white/[0.07] relative overflow-hidden flex flex-col gap-6">

                        {/* CUADRICULA. Debajo, los simbolos; encima, la capa de plata
                            que se rasca con el dedo. Antes de comprar carton, el reverso. */}
                        <div className="grid grid-cols-3 gap-3 aspect-square relative z-10 w-full mx-auto">
                            {grid.map((item, i) => (
                                <div
                                    key={i}
                                    className={`relative w-full h-full rounded-xl overflow-hidden flex items-center justify-center border ${revealed[i] ? 'bg-zinc-900 shadow-[inset_0_0_12px_black] border-white/[0.07]' : 'bg-[#0d0d10] border-white/[0.05]'}`}
                                >
                                    {isPlaying || revealed[i] ? (
                                        item && (
                                            <span className={`text-5xl drop-shadow-md filter leading-none select-none transition-transform duration-300 ${revealed[i] ? 'scale-100' : 'scale-90 opacity-80'}`}>
                                                {item.icon}
                                            </span>
                                        )
                                    ) : (
                                        <img src={CARD_BACK_IMG} alt="reverso" className="absolute inset-0 w-full h-full object-cover opacity-100" draggable="false" />
                                    )}
                                </div>
                            ))}

                            {/* LA PLATA. Un solo canvas sobre las nueve: el dedo cruza
                                de una a otra sin levantarse. */}
                            <CapaRasca
                                activa={isPlaying}
                                reveladas={revealed}
                                celda={celdaDelRasca}
                                onRevelar={reveal}
                                onRascar={(v) => roceRef.current?.(v)}
                            />
                        </div>

                        {/* CONTROLES / RESULTADO. ⚠️ En COLUMNA: era `flex` a secas
                            (fila) y, al comprar carton, el selector de apuesta y el
                            boton salian uno AL LADO del otro, el selector saliendose
                            por la izquierda y el boton cortado por la derecha. */}
                        <div className="relative z-10 min-h-[60px] flex flex-col justify-center">
                            {revealed.every(Boolean) && result ? (
                                <div className="text-center w-full animate-in zoom-in">
                                    <div className="mb-4">
                                        {result.won ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="font-black text-2xl uppercase tracking-widest text-green-400 animate-pulse">¡PREMIO!</span>
                                                <div className="flex items-center gap-2 bg-green-900/40 px-4 py-1 rounded-full border border-green-500/50">
                                                    <span className="font-black text-white text-xl">+{result.prize}</span>
                                                    {result.type === 'xp' ? <Zap size={20} className="text-blue-400" /> : <img src="/assets/icons/ficha.png" alt="f" className="w-5 h-5 object-contain" />}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="font-black text-xl uppercase tracking-widest text-zinc-500">Sin Premio</span>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <SelectorApuesta
                                            valor={apuesta}
                                            onChange={setApuesta}
                                            saldo={currentFichas}
                                            minimo={APUESTA_MINIMA}
                                            etiqueta="Tu cartón"
                                        />
                                    </div>

                                    <button
                                        onClick={play}
                                        disabled={currentFichas < apuesta}
                                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl uppercase transition-all shadow-lg shadow-yellow-900/20 active:scale-95 text-lg border-b-4 border-yellow-700 flex items-center justify-center gap-2 disabled:grayscale disabled:opacity-50"
                                    >
                                        <span>Jugar de nuevo</span>
                                        <div className="flex items-center bg-black/20 px-2 py-0.5 rounded text-sm">
                                            {apuesta} <img src="/assets/icons/ficha.png" className="w-4 h-4 ml-1" alt="c" />
                                        </div>
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full">
                                {/* Mientras rascas NO se puede cambiar: la apuesta
                                    de este carton ya esta cobrada. */}
                                <div className={`mb-3 transition-opacity ${isPlaying ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <SelectorApuesta
                                        valor={apuesta}
                                        onChange={setApuesta}
                                        saldo={currentFichas}
                                        minimo={APUESTA_MINIMA}
                                        deshabilitado={isPlaying}
                                        etiqueta="Tu cartón"
                                    />
                                </div>

                                <button
                                    onClick={play}
                                    disabled={isPlaying || currentFichas < apuesta}
                                    className={`
                                        w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest shadow-lg transition-all active:scale-95 border-b-4
                                        ${isPlaying
                                            ? 'bg-zinc-800 text-zinc-500 border-zinc-900 cursor-default'
                                            : currentFichas < apuesta
                                                ? 'bg-zinc-800 text-zinc-500 border-zinc-900 cursor-not-allowed'
                                                : 'bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-700'
                                        }
                                    `}
                                >
                                    {isPlaying ? '¡RASCA LAS CASILLAS!' : (
                                        <div className="flex items-center justify-center gap-2">
                                            <span>COMPRAR CARTÓN</span>
                                            <div className="flex items-center bg-black/20 px-2 py-0.5 rounded text-sm">
                                                {apuesta} <img src="/assets/icons/ficha.png" className="w-4 h-4 ml-1" alt="c" />
                                            </div>
                                        </div>
                                    )}
                                </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

            </div>

            {/* MODAL INFO */}
            {showInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-zinc-900 border border-white/10 rounded-[2rem] p-6 w-full max-w-xs relative shadow-2xl">
                        <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={24} /></button>
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter not-italic">Tabla de Premios</h3>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Encuentra 3 iguales para ganar</p>
                        </div>
                        <div className="space-y-2 mb-4">
                            {winningSymbols.map((s) => (
                                <div key={s.id} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/[0.07]">
                                    <div className="text-2xl filter drop-shadow-sm">{s.icon}</div>
                                    <div className="flex items-center gap-1">
                                        <span className={`font-black text-lg ${s.type === 'xp' ? 'text-blue-400' : 'text-yellow-400'}`}>{s.label}</span>
                                        {s.type === 'xp' ? <Zap size={16} className="text-blue-400" /> : <img src="/assets/icons/ficha.png" alt="Ficha" className="w-5 h-5 object-contain" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] text-zinc-600 uppercase font-bold">Calaveras y cacas no tienen premio.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}