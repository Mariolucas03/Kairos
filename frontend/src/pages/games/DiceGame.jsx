import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import BackButton from '../../components/common/BackButton';
import api from '../../services/api';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../../store/useAuthStore';
import SelectorApuesta from '../../components/games/SelectorApuesta';
import Dado3D from '../../components/games/Dado3D';
import { trayectoriaDado, ORIENTACION } from '../../utils/fisicaDados';
import { crearSintetizador, melodias, haySonidoJuegos, cambiarSonidoJuegos } from '../../utils/sintetizador';

// El segundo dado sale un pelin despues del primero: dos dados que caen
// exactamente a la vez se ven como uno duplicado.
const RETRASO_SEGUNDO = 140;
const ChipRain = ({ isFading }) => { /* Mantén tu ChipRain original aquí (lo abrevio por espacio) */
    return <div className={`fixed inset-0 pointer-events-none z-[9999] overflow-hidden transition-opacity duration-1000 ${isFading ? 'opacity-0' : 'opacity-100'}`}><style>{`@keyframes fall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(120vh) rotate(360deg); } }`}</style>{Array.from({ length: 50 }).map((_, i) => <img key={i} src="/assets/icons/ficha.png" className="absolute will-change-transform" style={{ left: `${Math.random() * 100}%`, top: `-${Math.random() * 50}vh`, width: '30px', animation: `fall ${1 + Math.random()}s linear ${Math.random()}s infinite` }} alt="" />)}</div>;
};

/**
 * UN DADO SOBRE LA MESA, con su sombra.
 *
 * El cubo va dentro de un contenedor que sube y baja (la altura) y la sombra
 * se queda en la mesa, encogiendo y aclarandose cuanto mas alto esta el dado.
 * Es la sombra lo que hace que el ojo lea "esta en el aire": sin ella, un
 * cubo que se mueve hacia arriba parece que crece.
 */
const DadoEnMesa = ({ cara, refs, tamaño }) => (
    <div className="relative" style={{ width: tamaño, height: tamaño }}>
        <div
            ref={el => { refs.sombra = el; }}
            className="absolute left-1/2 rounded-full bg-black/70 pointer-events-none"
            style={{ width: tamaño * 0.95, height: tamaño * 0.35, bottom: -tamaño * 0.22, transform: 'translateX(-50%)', filter: 'blur(6px)', willChange: 'transform, opacity' }}
        />
        {/* ⚠️ La `perspective` va AQUI, en el padre directo del cubo. Estaba en
            el abuelo, y un div intermedio sin `transform-style: preserve-3d`
            aplana: el cubo se veia en proyeccion plana, con sus caras pero sin
            la profundidad de un dado de verdad. */}
        <div ref={el => { refs.altura = el; }} style={{ willChange: 'transform', perspective: 520 }}>
            <Dado3D ref={el => { refs.cubo = el; }} tamaño={tamaño} rotX={ORIENTACION[cara].x} rotY={ORIENTACION[cara].y} rotZ={refs.zFinal || 0} />
        </div>
    </div>
);

export default function Dice() {
    // 🔥 CONECTAMOS CON ZUSTAND
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);

    useEffect(() => { setIsUiHidden(true); return () => setIsUiHidden(false); }, [setIsUiHidden]);

    const [dices, setDices] = useState([1, 1]);
    const [bet, setBet] = useState(20);
    const [selectedOption, setSelectedOption] = useState(null);
    const [rolling, setRolling] = useState(false);
    const [resultModal, setResultModal] = useState(null);
    const [showRain, setShowRain] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // ⚠️ LA TIRADA NO PASA POR REACT. Cada frame escribe los transforms de los
    // dos cubos y sus sombras directamente en el DOM (ver handleRoll).
    const dadosRef = useRef([{}, {}]);
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
            // 1. Las caras las decide el servidor. Lo de abajo es el camino.
            const res = await api.post('/games/dice', { bet, prediction: selectedOption });
            const caras = res.data.dices;

            const trayectorias = caras.map((cara, i) => trayectoriaDado({ cara, retraso: i * RETRASO_SEGUNDO }));
            const duracion = Math.max(...trayectorias.map(t => t.duracion));

            const sonido = crearSintetizador();
            sonidoRef.current = sonido;
            // El cubilete: un traqueteo de golpes cortos justo antes de soltar.
            for (let i = 0; i < 7; i++) {
                setTimeout(() => sonido.golpe({ frecuencia: 1400 + Math.random() * 600, duracion: 0.03, volumen: 0.16, q: 5 }), i * 45);
            }
            const aterrizado = trayectorias.map(() => [false, false, false]);

            let terminado = false;
            const terminar = () => {
                if (terminado) return;
                terminado = true;
                clearTimeout(salvavidas);
                if (animacionRef.current) cancelAnimationFrame(animacionRef.current);
                sonido.parar();
                sonidoRef.current = null;

                // Se deja cada cubo EXACTAMENTE en su orientacion final y en la
                // mesa, por si el ultimo frame no llego a pintarse. Y se guarda
                // el giro en Z con el que se quedo, para que al repintar React
                // no lo enderece de golpe.
                trayectorias.forEach((tr, i) => {
                    const r = dadosRef.current[i];
                    r.zFinal = ((tr.finZ % 360) + 360) % 360;
                    if (r.cubo) r.cubo.style.transform = `rotateZ(${tr.finZ}deg) rotateX(${tr.finX}deg) rotateY(${tr.finY}deg)`;
                    if (r.altura) r.altura.style.transform = 'translateY(0px)';
                    if (r.sombra) { r.sombra.style.transform = 'translateX(-50%) scale(1)'; r.sombra.style.opacity = '1'; }
                });

                setDices(caras);
                setRolling(false);
                if (res.data.won) { setShowRain(true); setTimeout(() => setShowRain(false), 3000); }
                setResultModal({ won: res.data.won, amount: res.data.payout, sum: res.data.sum });
                setUser(res.data.user);

                const fin = crearSintetizador();
                (res.data.won ? melodias.ganar : melodias.perder)(fin);
                setTimeout(fin.parar, 1500);
            };

            const t0 = performance.now();
            const frame = (ahora) => {
                const ms = ahora - t0;
                trayectorias.forEach((tr, i) => {
                    const r = dadosRef.current[i];
                    if (!r.cubo || !r.altura || !r.sombra) return;
                    const e = tr.estado(ms);
                    r.cubo.style.transform = `rotateZ(${e.rotZ}deg) rotateX(${e.rotX}deg) rotateY(${e.rotY}deg)`;
                    r.altura.style.transform = `translateY(${e.altura}px)`;
                    // La sombra: mas pequeña y mas clara cuanto mas alto.
                    const lejos = Math.min(-e.altura / 150, 1);
                    r.sombra.style.transform = `translateX(-50%) scale(${1 - 0.45 * lejos})`;
                    r.sombra.style.opacity = String(1 - 0.6 * lejos);

                    // Cada vez que toca la mesa, un golpe de madera. Mas flojo
                    // cada bote, que cae de mas bajo.
                    tr.aterrizajes.forEach((cuando, k) => {
                        if (!aterrizado[i][k] && ms >= cuando) {
                            aterrizado[i][k] = true;
                            sonido.golpe({ frecuencia: 380 - k * 60, duracion: 0.09 - k * 0.02, volumen: 0.5 - k * 0.15, q: 3 });
                        }
                    });
                });

                if (ms < duracion) {
                    animacionRef.current = requestAnimationFrame(frame);
                } else {
                    terminar();
                }
            };

            // El salvavidas: rAF no dispara en segundo plano. Sin esto, cambiar
            // de app a mitad de tirada la dejaba colgada.
            const salvavidas = setTimeout(terminar, duracion + 600);
            animacionRef.current = requestAnimationFrame(frame);
        } catch (e) {
            setErrorMsg(e.response?.data?.message || 'No se pudo tirar. Inténtalo otra vez.');
            if (animacionRef.current) cancelAnimationFrame(animacionRef.current);
            sonidoRef.current?.parar();
            setRolling(false);
        }
    };

    // ⚠️ El contenedor era `justify-center` + `overflow-hidden`. En un movil con
    // la barra del navegador (unos 700px de alto) el contenido no cabia y,
    // centrado, se salia POR ARRIBA y POR ABAJO a la vez: el titulo se metia
    // debajo de la cabecera y el boton de jugar quedaba cortado sin poder
    // llegar a el. Ahora el contenido se centra con `my-auto` —que nunca se
    // hace negativo— y si no cabe, se hace scroll.
    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center pt-28 pb-4 overflow-y-auto overflow-x-hidden select-none font-sans">
            {showRain && <ChipRain isFading={false} />}
            {/* Tres columnas de verdad: la de la izquierda y la de la derecha pesan
                lo mismo, y asi la caja de fichas queda CENTRADA aunque a un lado
                haya un boton y al otro dos. Con `justify-between` se iba hacia
                el lado que menos ocupaba. */}
            <div className="fixed top-12 left-4 right-4 flex items-center z-50">
                <div className="flex-1 flex"><BackButton to="/games" /></div>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-blue-500/50"><span className="text-blue-400 font-black text-xl">{visualBalance}</span><img src="/assets/icons/ficha.png" className="w-6 h-6" alt="f" /></div>
                <div className="flex-1 flex items-center justify-end gap-2">
                    <button
                        onClick={alternarSonido}
                        aria-label={conSonido ? 'Silenciar' : 'Activar el sonido'}
                        className={`p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 active:scale-95 transition-transform ${conSonido ? 'text-zinc-300' : 'text-zinc-600'}`}
                    >
                        {conSonido ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                </div>
            </div>
            <div className="my-auto flex flex-col items-center w-full max-w-sm px-4 gap-5 z-10">
                {/* El titulo iba en `absolute top-28` y la mesa, que ahora es
                    mas alta para que los dados tengan de donde caer, le pasaba
                    por encima. En el flujo no lo pisa nada. */}
                <div className="w-full text-center">
                    <h1 className="text-4xl font-black not-italic text-cyan-400">NEON DICE</h1>
                    {errorMsg && (
                        <div onClick={() => setErrorMsg(null)} className="mx-2 mt-3 bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase tracking-wide px-4 py-2.5 rounded-2xl cursor-pointer">
                            {errorMsg}
                        </div>
                    )}
                </div>
                {/* LA MESA. Fieltro con luz cenital, y los dos dados encima con
                    sitio arriba para caer desde el aire. */}
                <div
                    className="relative w-full rounded-[2rem] border border-white/[0.07] flex items-end justify-center gap-10 pb-9 pt-28 overflow-visible"
                    style={{ background: 'radial-gradient(ellipse at 50% 30%, #123c2e 0%, #0b2a20 55%, #061a14 100%)', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.7), 0 20px 40px rgba(0,0,0,0.6)' }}
                >
                    {/* El borde de madera de la mesa */}
                    <div className="absolute inset-0 rounded-[2rem] pointer-events-none" style={{ boxShadow: 'inset 0 0 0 6px #3b2416, inset 0 0 0 7px #1a0e08' }} />
                    <DadoEnMesa cara={dices[0]} refs={dadosRef.current[0]} tamaño={84} />
                    <DadoEnMesa cara={dices[1]} refs={dadosRef.current[1]} tamaño={84} />
                </div>
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
                    <div className="bg-zinc-900 w-full max-w-xs rounded-4xl p-8 text-center border-2 border-zinc-700">
                        <h2 className="text-3xl font-black text-white mb-4">{resultModal.won ? '¡GANASTE!' : 'PIERDES'}</h2>
                        {resultModal.won && <div className="text-green-400 text-4xl font-black">+{resultModal.amount}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}