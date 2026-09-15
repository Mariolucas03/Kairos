import { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, VolumeX, Info, X } from 'lucide-react';
import BackButton from '../../components/common/BackButton';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import SelectorApuesta from '../../components/games/SelectorApuesta';
import { Ficha } from '../../components/games/Ficha';
import { trayectoriaPlinko, clavo, casilla, FILAS, PASO, ALTO, ARRIBA } from '../../utils/fisicaPlinko';
import { crearSintetizador, haySonidoJuegos, cambiarSonidoJuegos, melodias } from '../../utils/sintetizador';

/**
 * PLINKO: la bola que cae por el triangulo de clavos.
 *
 * Tiras una o varias bolas desde arriba. En cada fila de clavos rebotan a un
 * lado o a otro y abajo caen en una casilla. Aqui es AL REVES que en el
 * plinko de siempre, porque asi se pidio: por los bordes se pierde y hacia
 * el centro se gana (hasta x1,8).
 *
 * ⚠️ EL CAMINO DE CADA BOLA LO DECIDE EL SERVIDOR. Doce izquierdas/derechas,
 * y aqui solo se dibuja la caida (fisicaPlinko.js). La casilla donde cae, el
 * multiplicador y el premio vienen ya decididos: lo de abajo es el camino.
 *
 * ⚠️ LA CAIDA NO PASA POR REACT. Cada frame escribe la posicion de cada bola
 * directamente en su <circle> del SVG. Con diez bolas a la vez, repintar el
 * tablero (78 clavos, 13 casillas) por React sesenta veces por segundo se
 * notaria como tirones.
 */

const ENTRE_BOLAS = 260;                 // ms entre una bola y la siguiente
const OPCIONES_BOLAS = [1, 3, 5, 10];
const ANCHO = 340;
const ALTURA = ARRIBA + FILAS * ALTO + 44;
// Sin el servidor aun (la primera vez), para pintar el tablero. Se sustituye
// por lo que mande el servidor en cuanto se tira.
const MULTIPLICADORES_DE_PARTIDA = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.8, 0.7, 0.5, 0.4, 0.3, 0.2, 0.1];

/** El color de una casilla segun lo que paga: rojo pierde, dorado gana. */
const colorDeCasilla = (m) => {
    if (m >= 1) return { fondo: '#c9a33f', tinta: '#1a1200' };
    if (m >= 0.5) return { fondo: '#b45309', tinta: '#fff' };
    if (m >= 0.3) return { fondo: '#9a3412', tinta: '#fff' };
    return { fondo: '#7f1d1d', tinta: '#fecaca' };
};

/** El tablero: los clavos y las casillas. No cambia durante la caida. */
const Tablero = ({ multiplicadores, iluminadas }) => {
    const clavos = useMemo(() => {
        const lista = [];
        for (let r = 0; r < FILAS; r++) for (let i = 0; i < r + 3; i++) lista.push({ r, i, ...clavo(r, i) });
        return lista;
    }, []);
    return (
        <>
            <defs>
                <radialGradient id="pk-clavo" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#f4f4f5" />
                    <stop offset="60%" stopColor="#a1a1aa" />
                    <stop offset="100%" stopColor="#3f3f46" />
                </radialGradient>
                <radialGradient id="pk-bola" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#fff7d6" />
                    <stop offset="55%" stopColor="#facc15" />
                    <stop offset="100%" stopColor="#a16207" />
                </radialGradient>
                <linearGradient id="pk-fondo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#101014" />
                    <stop offset="100%" stopColor="#050507" />
                </linearGradient>
            </defs>
            <rect x="0" y="0" width={ANCHO} height={ALTURA} rx="18" fill="url(#pk-fondo)" />
            {/* El embudo de arriba, por donde entra la bola */}
            <path d={`M ${ANCHO / 2 - 34} 0 L ${ANCHO / 2 - 10} ${ARRIBA - 14} L ${ANCHO / 2 + 10} ${ARRIBA - 14} L ${ANCHO / 2 + 34} 0`} fill="none" stroke="#3f3f46" strokeWidth="2" />
            {clavos.map(c => (
                <circle key={`${c.r}-${c.i}`} cx={c.x} cy={c.y} r="3.2" fill="url(#pk-clavo)" stroke="#18181b" strokeWidth="0.6" />
            ))}
            {multiplicadores.map((m, k) => {
                const c = casilla(k);
                const col = colorDeCasilla(m);
                const encendida = iluminadas[k] > 0;
                return (
                    <g key={k}>
                        <rect
                            x={c.x - PASO / 2 + 1.5} y={c.y - 4} width={PASO - 3} height="30" rx="5"
                            fill={col.fondo} stroke={encendida ? '#fff' : 'rgba(0,0,0,0.5)'} strokeWidth={encendida ? 2 : 1}
                            style={{ transition: 'stroke 200ms' }}
                        />
                        <text x={c.x} y={c.y + 12} textAnchor="middle" dominantBaseline="middle" fill={col.tinta}
                            style={{ font: `900 ${m >= 1 ? 11 : 9}px ui-sans-serif, system-ui, sans-serif` }}>
                            x{String(m).replace('.', ',')}
                        </text>
                        {encendida && (
                            <text x={c.x} y={c.y - 10} textAnchor="middle" fill="#fff" style={{ font: '900 9px ui-sans-serif, system-ui, sans-serif' }}>
                                {iluminadas[k]}
                            </text>
                        )}
                    </g>
                );
            })}
        </>
    );
};

export default function Plinko() {
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);
    useEffect(() => { setIsUiHidden(true); return () => setIsUiHidden(false); }, [setIsUiHidden]);

    const [bet, setBet] = useState(100);
    const [bolas, setBolas] = useState(1);
    const [tirando, setTirando] = useState(false);
    const [multiplicadores, setMultiplicadores] = useState(MULTIPLICADORES_DE_PARTIDA);
    // Cuantas bolas han caido ya en cada casilla, en esta tirada.
    const [caidas, setCaidas] = useState({});
    const [resultado, setResultado] = useState(null);   // { total, apuesta, bolas }
    const [errorMsg, setErrorMsg] = useState(null);
    const [showInfo, setShowInfo] = useState(false);

    const bolasRef = useRef([]);          // los <circle> de las bolas en vuelo
    const animacionRef = useRef(null);
    const sonidoRef = useRef(null);
    const [enVuelo, setEnVuelo] = useState([]);   // ids de las bolas dibujadas

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

    const fichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;
    const coste = bet * bolas;
    const visualBalance = tirando ? Math.max(0, fichas - coste) : fichas;

    const tirar = async () => {
        if (tirando || coste > fichas) return;
        setTirando(true); setErrorMsg(null); setResultado(null); setCaidas({});
        try {
            const res = await api.post('/games/plinko', { bet, balls: bolas });
            const { bolas: resultados, total, apuesta, multiplicadores: mults, user: updatedUser } = res.data;
            if (mults) setMultiplicadores(mults);

            const trayectorias = resultados.map((b, i) => ({ ...trayectoriaPlinko({ camino: b.camino }), retraso: i * ENTRE_BOLAS, casilla: b.casilla }));
            const duracion = Math.max(...trayectorias.map(t => t.retraso + t.duracion));
            setEnVuelo(trayectorias.map((_, i) => i));

            const sonido = crearSintetizador();
            sonidoRef.current = sonido;
            const golpesDados = trayectorias.map(() => 0);
            const aterrizadas = trayectorias.map(() => false);

            let terminado = false;
            const terminar = () => {
                if (terminado) return;
                terminado = true;
                clearTimeout(salvavidas);
                if (animacionRef.current) cancelAnimationFrame(animacionRef.current);
                sonido.parar();
                sonidoRef.current = null;

                setEnVuelo([]);
                const porCasilla = {};
                resultados.forEach(b => { porCasilla[b.casilla] = (porCasilla[b.casilla] || 0) + 1; });
                setCaidas(porCasilla);
                setTirando(false);
                setResultado({ total, apuesta, bolas: resultados });
                if (updatedUser) {
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }
                const fin = crearSintetizador();
                if (total > apuesta * resultados.length) (total >= apuesta * resultados.length * 1.5 ? melodias.granPremio : melodias.ganar)(fin);
                else melodias.perder(fin);
                setTimeout(fin.parar, 2500);
            };

            const t0 = performance.now();
            const frame = (ahora) => {
                const ms = ahora - t0;
                trayectorias.forEach((tr, i) => {
                    const el = bolasRef.current[i];
                    if (!el) return;
                    const propio = ms - tr.retraso;
                    if (propio < 0) { el.style.opacity = '0'; return; }
                    el.style.opacity = '1';
                    const p = tr.posicion(propio);
                    el.setAttribute('cx', p.x.toFixed(2));
                    el.setAttribute('cy', p.y.toFixed(2));

                    // Un tic por clavo golpeado: mas agudo cuanto mas abajo.
                    const golpes = tr.golpesHasta(propio);
                    for (let g = golpesDados[i]; g < golpes; g++) {
                        sonido.golpe({ frecuencia: 1800 + g * 90 + Math.random() * 200, duracion: 0.03, volumen: 0.14, q: 7 });
                    }
                    golpesDados[i] = golpes;

                    if (!aterrizadas[i] && propio >= tr.duracion) {
                        aterrizadas[i] = true;
                        const m = multiplicadores[tr.casilla] ?? mults?.[tr.casilla] ?? 0;
                        sonido.nota({ frecuencia: m >= 1 ? 1320 : m >= 0.5 ? 880 : 330, duracion: 0.16, volumen: 0.16, tipo: m >= 1 ? 'sine' : 'triangle' });
                        // Se enciende la casilla segun van cayendo, sin esperar al final
                        setCaidas(prev => ({ ...prev, [tr.casilla]: (prev[tr.casilla] || 0) + 1 }));
                    }
                });
                if (ms < duracion) animacionRef.current = requestAnimationFrame(frame);
                else terminar();
            };

            // El salvavidas: rAF no dispara con la pestaña en segundo plano.
            const salvavidas = setTimeout(terminar, duracion + 600);
            animacionRef.current = requestAnimationFrame(frame);
        } catch (error) {
            setErrorMsg(error.response?.data?.message || 'No se pudo tirar');
            setTirando(false);
            setEnVuelo([]);
        }
    };

    const gano = resultado && resultado.total > resultado.apuesta * resultado.bolas.length;

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center pt-28 pb-4 overflow-y-auto overflow-x-hidden select-none font-sans">
            <div className="fixed top-12 left-4 right-4 flex items-center z-50">
                <div className="flex-1 flex"><BackButton to="/games" /></div>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-amber-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-amber-400 font-black text-xl tabular-nums">{visualBalance.toLocaleString()}</span>
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
                    <button onClick={() => setShowInfo(true)} aria-label="Cómo se juega" className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-transform"><Info /></button>
                </div>
            </div>

            <div className="my-auto flex flex-col items-center w-full max-w-sm px-4 gap-4">
                <div className="w-full text-center">
                    <h1 className="text-4xl font-black not-italic text-amber-400 tracking-[-0.045em] leading-none">PLINKO</h1>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Por los bordes se pierde · al centro se gana</p>
                    {errorMsg && (
                        <div onClick={() => setErrorMsg(null)} className="mt-3 bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase tracking-wide px-4 py-2.5 rounded-2xl cursor-pointer">
                            {errorMsg}
                        </div>
                    )}
                </div>

                {/* EL TABLERO */}
                <div className="w-full rounded-[1.4rem] border border-white/[0.07] overflow-hidden" style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.7), 0 12px 30px rgba(0,0,0,0.6)' }}>
                    <svg viewBox={`0 0 ${ANCHO} ${ALTURA}`} className="w-full h-auto block">
                        <Tablero multiplicadores={multiplicadores} iluminadas={caidas} />
                        {enVuelo.map(i => (
                            <circle
                                key={i}
                                ref={el => { bolasRef.current[i] = el; }}
                                r="6" cx={ANCHO / 2} cy="0"
                                fill="url(#pk-bola)" stroke="#713f12" strokeWidth="0.8"
                                style={{ opacity: 0 }}
                            />
                        ))}
                    </svg>
                </div>

                {/* EL RESULTADO */}
                {resultado && (
                    <div className={`w-full rounded-2xl border px-4 py-3 text-center animate-in zoom-in-95 ${gano ? 'bg-amber-950/40 border-amber-500/40' : 'bg-zinc-900 border-white/[0.07]'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${gano ? 'text-amber-400' : 'text-zinc-500'}`}>
                            {resultado.bolas.length} {resultado.bolas.length === 1 ? 'bola' : 'bolas'} · apostado {(resultado.apuesta * resultado.bolas.length).toLocaleString('es-ES')}
                        </p>
                        <p className={`text-3xl font-black tabular-nums mt-1 ${gano ? 'text-amber-300' : 'text-white'}`}>
                            {gano ? '+' : ''}{(resultado.total - resultado.apuesta * resultado.bolas.length).toLocaleString('es-ES')}
                        </p>
                        <p className="text-[11px] text-zinc-400 font-bold mt-1">Vuelven {resultado.total.toLocaleString('es-ES')} fichas</p>
                    </div>
                )}

                {/* LOS CONTROLES */}
                <div className="w-full bg-zinc-900/80 backdrop-blur-md rounded-[2rem] border border-white/[0.07] p-4 shadow-2xl">
                    <div className={tirando ? 'opacity-40 pointer-events-none' : ''}>
                        <SelectorApuesta valor={bet} onChange={setBet} saldo={fichas} minimo={10} deshabilitado={tirando} etiqueta="Por bola" />
                    </div>

                    <div className="flex items-center justify-between mt-3 mb-3">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.12em]">Bolas</span>
                        <div className="flex items-center gap-1.5">
                            {OPCIONES_BOLAS.map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setBolas(n)}
                                    disabled={tirando}
                                    className={`w-11 h-9 rounded-xl border text-sm font-black tabular-nums transition-colors ${bolas === n
                                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                                        : 'bg-black border-white/[0.07] text-zinc-400'}`}
                                >{n}</button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={tirar}
                        disabled={tirando || coste > fichas}
                        className="w-full h-14 rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg transition-all active:scale-95 border-b-4 bg-amber-400 text-black border-amber-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-zinc-900 flex items-center justify-center gap-2"
                    >
                        {tirando ? 'Cayendo...' : (
                            <>
                                <span>Tirar {bolas === 1 ? 'una bola' : `${bolas} bolas`}</span>
                                <span className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded text-sm"><Ficha valor={bet} tamano={16} />{coste.toLocaleString('es-ES')}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {showInfo && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-zinc-900 w-full max-w-xs rounded-3xl border border-white/10 p-6 relative shadow-2xl">
                        <button onClick={() => setShowInfo(false)} aria-label="Cerrar" className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                        <h3 className="text-xl font-black text-white text-center mb-4 uppercase not-italic">Cómo va</h3>
                        <p className="text-xs text-zinc-300 leading-relaxed">
                            Cada bola cae por doce filas de clavos y rebota a un lado o a otro. Abajo, cada casilla multiplica lo que
                            apostaste por esa bola: <span className="text-amber-400 font-bold">al centro x1,8</span>, y cuanto más al borde, menos.
                            Eliges cuánto vale cada bola y cuántas tiras.
                        </p>
                        <div className="mt-4 grid grid-cols-7 gap-1">
                            {multiplicadores.slice(0, 7).map((m, k) => {
                                const col = colorDeCasilla(m);
                                return <div key={k} className="rounded-md py-1.5 text-center text-[10px] font-black" style={{ background: col.fondo, color: col.tinta }}>x{String(m).replace('.', ',')}</div>;
                            })}
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-2 text-center">…y simétrico hacia el otro lado.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
