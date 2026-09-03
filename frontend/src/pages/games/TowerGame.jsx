import { useState, useEffect } from 'react';
import { Bomb, Coins, Loader2, TrendingUp, Trophy } from 'lucide-react';
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
        setBusy(true); setError(null); setResult(null); setRevealed({});
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
        try {
            const res = await api.post('/games/tower', { action: 'pick', token, choice: tile });
            const d = res.data;
            setRevealed(prev => ({ ...prev, [plantaActual]: d.trapTile }));

            if (d.status === 'playing') {
                setToken(d.token);
                setFloor(d.floor);
            } else {
                setToken(null);
                setFloor(d.floor);
                sincronizar(d.user);
                setResult({ status: d.status, payout: d.payout });
                if (d.status === 'won') confetti();
            }
        } catch (e) {
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
            <div className="absolute top-12 left-4 right-4 flex justify-between items-center z-20">
                <BackButton to="/games" />
                <div className="flex items-center gap-2 bg-black/80 px-5 py-2 rounded-full border border-emerald-500/50 backdrop-blur-md shadow-2xl">
                    <span className="text-emerald-400 font-black text-xl tabular-nums">{fichas.toLocaleString()}</span>
                    <img src="/assets/icons/ficha.png" className="w-6 h-6" alt="fichas" />
                </div>
                <div className="w-10" />
            </div>

            <div className="w-full max-w-sm px-5 flex-1 flex flex-col min-h-0">
                <h1 className="text-3xl font-black text-white not-italic uppercase tracking-tighter text-center">LA TORRE</h1>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center mt-1 mb-3">
                    Sube sin pisar la trampa · retírate cuando quieras
                </p>

                {/* TORRE: de la planta más alta a la más baja */}
                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col-reverse gap-1.5 pb-3">
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

                                        let clase = 'bg-zinc-900 border-zinc-800 text-zinc-700';
                                        if (esTrampaRevelada) clase = 'bg-red-900/60 border-red-500 text-red-400';
                                        else if (esSegura && superada) clase = 'bg-emerald-900/40 border-emerald-500/50 text-emerald-400';
                                        else if (esActual) clase = 'bg-zinc-800 border-emerald-500/40 text-white active:scale-95';

                                        return (
                                            <button
                                                key={tile}
                                                disabled={!esActual || busy}
                                                onClick={() => pisar(tile)}
                                                className={`h-11 rounded-xl border font-black text-sm flex items-center justify-center transition-all disabled:cursor-default ${clase}`}
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
