import { useState, useEffect, useRef } from 'react';
import { Bomb, Coins, Loader2, TrendingUp, Trophy, Volume2, VolumeX } from 'lucide-react';
import { crearSonidoTorre } from '../../utils/sonidoTorre';
import { haySonidoJuegos, cambiarSonidoJuegos } from '../../utils/sintetizador';

// Lo que tarda en saberse si la losa aguanta, como MINIMO. El servidor
// contesta en el acto, y eso mata la tension: pisas y ya. Medio segundo con la
// losa hundida bajo el pie, sin saber, es el juego entero.
const SUSPENSE = 520;
import confetti from 'canvas-confetti';
import BackButton from '../../components/common/BackButton';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import SelectorApuesta from '../../components/games/SelectorApuesta';

/**
 * LA TORRE
 * Ocho plantas, tres losas por planta y una trampa en cada una. Cada planta que
 * subes multiplica el premio; puedes retirarte cuando quieras. Si pisas la
 * trampa lo pierdes todo.
 *
 * El servidor guarda dónde están las trampas (estado cifrado): aquí no hay nada
 * que se pueda mirar ni tocar para hacer trampas.
 */
const TILES = 3;

export default function TowerGame() {
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);

    useEffect(() => { setIsUiHidden(true); return () => setIsUiHidden(false); }, [setIsUiHidden]);

    const fichas = user?.stats?.gameCoins ?? user?.gameCoins ?? 0;

    const [bet, setBet] = useState(10);
    const [token, setToken] = useState(null);
    const [multipliers, setMultipliers] = useState([]);
    const [floor, setFloor] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);       // { status, payout }
    const [revealed, setRevealed] = useState({});      // { [planta]: losaTrampa }
    // La losa que se esta pisando ahora mismo, hundida y sin resolver.
    const [pisando, setPisando] = useState(null);      // { planta, tile }
    // Que losa pisaste en cada planta superada. `revealed` solo guarda donde
    // estaba la trampa, y con eso las DOS losas seguras rebotaban al aguantar:
    // el rebote es del pie, y el pie estuvo en una sola.
    const [pisadas, setPisadas] = useState({});        // { [planta]: tile }
    // La planta cuya trampa acaba de romperse: para el temblor y la caida.
    const [rota, setRota] = useState(null);

    const sonidoRef = useRef(null);
    useEffect(() => {
        sonidoRef.current = crearSonidoTorre();
        return () => sonidoRef.current?.parar();
    }, []);
    const [conSonido, setConSonido] = useState(haySonidoJuegos);
    const alternarSonido = () => {
        const nuevo = !conSonido;
        cambiarSonidoJuegos(nuevo);
        setConSonido(nuevo);
        sonidoRef.current?.parar();
        sonidoRef.current = crearSonidoTorre();
    };

    const jugando = !!token;
    const acumulado = floor > 0 && multipliers.length ? Math.round(bet * multipliers[floor - 1]) : 0;
    const siguiente = multipliers.length ? Math.round(bet * multipliers[Math.min(floor, multipliers.length - 1)]) : 0;

    const sincronizar = (u) => {
        if (!u) return;
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
    };

    const empezar = async () => {
        if (busy) return;
        if (bet > fichas) { setError('No te llegan las fichas'); return; }
        setBusy(true); setError(null); setResult(null); setRevealed({}); setRota(null); setPisando(null); setPisadas({});
        try {
            const res = await api.post('/games/tower', { action: 'start', bet });
            setToken(res.data.token);
            setMultipliers(res.data.multipliers);
            setFloor(0);
            // El cobro lo hace el servidor: reflejamos el saldo al momento
            setUser(prev => {
                const saldo = Math.max(0, (prev.stats?.gameCoins ?? prev.gameCoins ?? 0) - bet);
                const actualizado = { ...prev, gameCoins: saldo, stats: { ...prev.stats, gameCoins: saldo } };
                localStorage.setItem('user', JSON.stringify(actualizado));
                return actualizado;
            });
        } catch (e) {
            setError(e.response?.data?.message || 'No se pudo empezar');
        } finally { setBusy(false); }
    };

    const pisar = async (tile) => {
        if (busy || !token) return;
        setBusy(true); setError(null);
        const plantaActual = floor;

        // El pie sobre la losa: se hunde YA, antes de saber nada.
        setPisando({ planta: plantaActual, tile });
        sonidoRef.current?.pisar();
        const pisadaEn = performance.now();

        try {
            const res = await api.post('/games/tower', { action: 'pick', token, choice: tile });
            const d = res.data;

            // Se espera lo que falte hasta el suspense minimo: la losa hundida
            // bajo el pie, sin saber si aguanta.
            const falta = SUSPENSE - (performance.now() - pisadaEn);
            if (falta > 0) await new Promise(r => setTimeout(r, falta));

            setPisando(null);
            setRevealed(prev => ({ ...prev, [plantaActual]: d.trapTile }));
            setPisadas(prev => ({ ...prev, [plantaActual]: tile }));

            if (d.status === 'playing') {
                sonidoRef.current?.aguanta(plantaActual);
                setToken(d.token);
                setFloor(d.floor);
            } else {
                setToken(null);
                setFloor(d.floor);
                sincronizar(d.user);
                if (d.status === 'won') {
                    sonidoRef.current?.cobrar(true);
                    confetti();
                } else {
                    // Se rompe: cruje, cae, y la torre entera tiembla.
                    setRota(plantaActual);
                    sonidoRef.current?.romper();
                }
                setResult({ status: d.status, payout: d.payout });
            }
        } catch (e) {
            setPisando(null);
            setError(e.response?.data?.message || 'Error de conexión');
            setToken(null);
        } finally { setBusy(false); }
    };

    const retirarse = async () => {
        if (busy || !token || floor === 0) return;
        setBusy(true); setError(null);
        try {
            const res = await api.post('/games/tower', { action: 'cashout', token });
            setToken(null);
            sincronizar(res.data.user);
            sonidoRef.current?.cobrar(floor >= 5);
            setResult({ status: 'cashed', payout: res.data.payout });
            confetti();
        } catch (e) {
            setError(e.response?.data?.message || 'Error de conexión');
        } finally { setBusy(false); }
    };

    const plantas = multipliers.length ? multipliers : [1.4, 2.0, 2.8, 3.9, 5.5, 7.7, 10.8, 15.0];

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center pt-28 overflow-hidden select-none">
            {/* CABECERA */}
            {/* Tres columnas de verdad: la de la izquierda y la de la derecha pesan
                lo mismo, y asi la caja de fichas queda CENTRADA aunque a un lado
                haya un boton y al otro dos. Con `justify-between` se iba hacia
                el lado que menos ocupaba. */}
            <div className="absolute top-12 left-4 right-4 flex items-center z-20">
                <div className="flex-1 flex"><BackButton to="/games" /></div>
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-emerald-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-emerald-400 font-black text-xl tabular-nums">{fichas.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="fichas" />
                </div>
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

            <div className="w-full max-w-sm px-5 flex-1 flex flex-col min-h-0">
                <h1 className="text-3xl font-black text-white not-italic uppercase tracking-tighter text-center">LA TORRE</h1>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center mt-1 mb-3">
                    Sube sin pisar la trampa · retírate cuando quieras
                </p>

                <style>{`
                    /* La losa que se hunde bajo el pie, sin saber si aguanta. */
                    @keyframes torreHundir { to { transform: translateY(4px); box-shadow: 0 1px 0 #0a0a0c, inset 0 2px 6px rgba(0,0,0,0.6); } }
                    /* Aguanta: vuelve arriba con un pelin de rebote y se enciende. */
                    @keyframes torreAguanta {
                        0%   { transform: translateY(4px); }
                        60%  { transform: translateY(-2px); }
                        100% { transform: translateY(0); }
                    }
                    /* Se rompe: se raja, se ladea y cae. */
                    @keyframes torreRomper {
                        0%   { transform: translateY(4px) rotateX(0deg); opacity: 1; }
                        25%  { transform: translateY(6px) rotateX(-8deg) rotateZ(2deg); }
                        100% { transform: translateY(70px) rotateX(-70deg) rotateZ(-6deg); opacity: 0.18; }
                    }
                    /* Y la torre entera tiembla. */
                    @keyframes torreTemblor {
                        0%, 100% { transform: translate(0, 0); }
                        20% { transform: translate(-3px, 2px); }
                        40% { transform: translate(3px, -2px); }
                        60% { transform: translate(-2px, 1px); }
                        80% { transform: translate(2px, -1px); }
                    }
                    .torre-hundida  { animation: torreHundir 140ms ease-out forwards; }
                    .torre-aguanta  { animation: torreAguanta 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
                    .torre-rota     { animation: torreRomper 650ms cubic-bezier(0.55, 0, 1, 0.45) forwards; transform-origin: 50% 100%; }
                    .torre-tiembla  { animation: torreTemblor 450ms ease-out; }
                    @media (prefers-reduced-motion: reduce) {
                        .torre-hundida, .torre-aguanta, .torre-rota, .torre-tiembla { animation: none !important; }
                    }
                `}</style>

                {/* TORRE: de la planta más alta a la más baja */}
                <div className={`flex-1 overflow-y-auto no-scrollbar flex flex-col-reverse gap-1.5 pb-3 ${rota !== null ? 'torre-tiembla' : ''}`} style={{ perspective: 700 }}>
                    {plantas.map((mult, planta) => {
                        const esActual = jugando && planta === floor;
                        const superada = planta < floor;
                        const trampa = revealed[planta];

                        return (
                            <div key={planta} className={`flex items-center gap-2 transition-opacity ${esActual || superada || result ? 'opacity-100' : 'opacity-35'}`}>
                                <span className={`w-12 shrink-0 text-right text-[10px] font-black tabular-nums ${esActual ? 'text-emerald-400' : 'text-zinc-600'}`}>
                                    x{mult}
                                </span>
                                <div className="flex-1 grid grid-cols-3 gap-1.5">
                                    {Array.from({ length: TILES }).map((_, tile) => {
                                        const esTrampaRevelada = trampa !== undefined && tile === trampa;
                                        const esSegura = trampa !== undefined && tile !== trampa;
                                        const laPisada = superada && pisadas[planta] === tile && !pisando;
                                        const hundida = pisando?.planta === planta && pisando?.tile === tile;
                                        const seRompe = esTrampaRevelada && rota === planta;

                                        // Losas de piedra con su canto: la cara de arriba mas clara,
                                        // el borde de abajo mas oscuro. Es lo que las hace pisables.
                                        let clase = 'text-zinc-700';
                                        let estilo = { background: 'linear-gradient(180deg, #26262b 0%, #18181c 100%)', boxShadow: '0 4px 0 #0a0a0c, 0 5px 8px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)' };
                                        if (esTrampaRevelada) {
                                            clase = 'text-red-400';
                                            estilo = { background: 'linear-gradient(180deg, #5a1a1a 0%, #3a0f0f 100%)', boxShadow: '0 4px 0 #1a0505, 0 0 18px rgba(239,68,68,0.35)', border: '1px solid rgba(239,68,68,0.6)' };
                                        } else if (esSegura && superada) {
                                            clase = 'text-emerald-300';
                                            estilo = { background: 'linear-gradient(180deg, #14532d 0%, #0b3b20 100%)', boxShadow: '0 4px 0 #052e16, 0 0 14px rgba(16,185,129,0.25)', border: '1px solid rgba(16,185,129,0.5)' };
                                        } else if (esActual) {
                                            clase = 'text-white';
                                            estilo = { background: 'linear-gradient(180deg, #3a3a42 0%, #232328 100%)', boxShadow: '0 4px 0 #0a0a0c, 0 5px 10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)', border: '1px solid rgba(16,185,129,0.4)' };
                                        }

                                        const animacion = seRompe ? 'torre-rota' : hundida ? 'torre-hundida' : (laPisada && planta === floor - 1) ? 'torre-aguanta' : '';

                                        return (
                                            <button
                                                key={tile}
                                                disabled={!esActual || busy}
                                                onClick={() => pisar(tile)}
                                                className={`h-11 rounded-xl font-black text-sm flex items-center justify-center disabled:cursor-default ${clase} ${animacion}`}
                                                style={{ ...estilo, willChange: 'transform' }}
                                            >
                                                {esTrampaRevelada ? <Bomb size={16} /> : esSegura && superada ? <Coins size={16} /> : esActual ? '?' : ''}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {error && (
                    <div onClick={() => setError(null)} className="mb-3 bg-red-950/70 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase tracking-wide px-4 py-2.5 rounded-2xl text-center cursor-pointer">
                        {error}
                    </div>
                )}
            </div>

            {/* PANEL INFERIOR */}
            <div className="w-full bg-zinc-900 border-t border-white/10 rounded-t-[2rem] px-5 pt-4 pb-8 shrink-0">
                {jugando ? (
                    <>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Acumulado</p>
                                <p className="text-2xl font-black text-emerald-400 leading-none mt-1">{acumulado}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1 justify-end">
                                    <TrendingUp size={11} /> Si subes
                                </p>
                                <p className="text-2xl font-black text-white leading-none mt-1">{siguiente}</p>
                            </div>
                        </div>
                        <button
                            onClick={retirarse}
                            disabled={busy || floor === 0}
                            className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-widest text-sm border-b-4 border-emerald-800 active:scale-95 transition-transform disabled:opacity-40 disabled:grayscale flex items-center justify-center gap-2"
                        >
                            {busy ? <Loader2 className="animate-spin" size={18} /> : <>Retirarme con {acumulado}</>}
                        </button>
                    </>
                ) : (
                    <>
                        {result && (
                            <div className={`mb-3 p-3 rounded-2xl border text-center ${result.status === 'lost' ? 'bg-red-950/50 border-red-500/40' : 'bg-emerald-950/50 border-emerald-500/40'}`}>
                                <p className={`text-sm font-black uppercase tracking-tight ${result.status === 'lost' ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {result.status === 'lost'
                                        ? '💣 Has pisado la trampa'
                                        : result.status === 'won'
                                            ? '🏆 ¡Torre completada!'
                                            : '✅ Te has retirado a tiempo'}
                                </p>
                                {result.payout > 0 && (
                                    <p className="text-2xl font-black text-white mt-1 flex items-center justify-center gap-2">
                                        <Trophy size={18} className="text-yellow-400" /> +{result.payout}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="mb-3">
                            <SelectorApuesta valor={bet} onChange={setBet} saldo={fichas} minimo={10} deshabilitado={busy} />
                        </div>
                        <button
                            onClick={empezar}
                            disabled={busy || bet > fichas}
                            className="w-full py-4 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-widest text-sm border-b-4 border-emerald-900 active:scale-95 transition-transform disabled:opacity-40 disabled:grayscale flex items-center justify-center gap-2"
                        >
                            {busy ? <Loader2 className="animate-spin" size={18} /> : 'Empezar a subir'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
