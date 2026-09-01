import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    ArrowLeft, Spade, UserPlus, Loader2, X, Play, LogOut, UserMinus,
    Crown, Coins, ChevronsRight, Trophy
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import CartaPoker from '../../components/games/CartaPoker';

const fetcher = (url) => api.get(url).then(r => r.data);

const ACENTO = '#2f8f5b';

const FASES = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown', entremanos: 'Mano terminada' };

/**
 * PÓQUER TEXAS HOLD'EM — mesa entre amigos.
 *
 * ⚠️ CÓMO SE MANTIENE VIVA LA MESA SIN WEBSOCKETS.
 *
 * Un póquer donde la jugada del otro tarda quince segundos en aparecer es
 * insufrible: te pasas la partida mirando una pantalla quieta sin saber si el
 * otro está pensando o se ha ido.
 *
 * No hay websockets porque el servidor (Render gratuito) se duerme a los quince
 * minutos y una conexión abierta no sobrevive a eso. Lo que sí se puede hacer es
 * preguntar más o menos a menudo SEGÚN LO QUE ESTÉ PASANDO:
 *
 *   - No es tu turno y hay partida  -> cada 2 s. Es cuando necesitas ver lo que
 *     hacen los demás, y es donde se nota la diferencia.
 *   - Es TU turno                   -> cada 10 s. La mesa está esperándote a ti:
 *     no va a cambiar nada hasta que actúes, así que preguntar es tirar datos.
 *   - En la sala o terminada        -> cada 8 s. No corre prisa.
 *
 * Y SWR deja de preguntar solo cuando la pestaña no está a la vista, así que la
 * app en segundo plano no gasta nada.
 */
const cadaCuanto = (mesa) => {
    if (!mesa || mesa.estado !== 'jugando') return 8000;
    if (mesa.meToca) return 10000;
    return 2000;
};

export default function Poker() {
    const navigate = useNavigate();

    const { data: mesas, mutate: recargarLista } = useSWR('/poker', fetcher);
    const { data: amigos } = useSWR('/social/friends', fetcher);

    const [abiertaId, setAbiertaId] = useState(null);

    // La mesa abierta se pide aparte y a su propio ritmo. Esto es lo que hace
    // que la partida se sienta viva.
    const { data: mesa, mutate: recargarMesa } = useSWR(
        abiertaId ? `/poker/${abiertaId}` : null,
        fetcher,
        { refreshInterval: cadaCuanto, dedupingInterval: 500 }
    );

    const [creando, setCreando] = useState(false);
    const [ciega, setCiega] = useState(20);
    const [subida, setSubida] = useState(0);
    const [enVuelo, setEnVuelo] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmar, setConfirmar] = useState(null);
    const [invitando, setInvitando] = useState(false);

    const avisar = (message, type = 'success') => setToast({ message, type });
    const listaAmigos = Array.isArray(amigos) ? amigos : (amigos?.friends || []);

    const accion = async (fn, mensajeError = 'No se pudo') => {
        if (enVuelo) return null;
        setEnVuelo(true);
        try {
            const r = await fn();
            await Promise.all([recargarLista(), abiertaId ? recargarMesa() : null]);
            return r;
        } catch (e) {
            avisar(e.response?.data?.message || mensajeError, 'error');
            return null;
        } finally { setEnVuelo(false); }
    };

    const crear = () => accion(async () => {
        const r = await api.post('/poker', { ciegaGrande: Number(ciega) });
        setCreando(false);
        setAbiertaId(r.data._id);
        avisar('Mesa montada. Invita a quien quieras.');
        return r;
    });

    const invitar = (amigoId) => accion(async () => {
        const r = await api.post(`/poker/${abiertaId}/invitar`, { amigoId });
        avisar('Invitación enviada');
        return r;
    });

    const responder = (id, respuesta) => accion(async () => {
        const r = await api.post(`/poker/${id}/responder`, { respuesta });
        if (respuesta === 'aceptar') { setAbiertaId(id); avisar('Sentado a la mesa'); }
        return r;
    });

    const expulsar = (jugadorId) => accion(async () => {
        const r = await api.post(`/poker/${abiertaId}/expulsar`, { jugadorId });
        avisar('Fuera de la mesa');
        return r;
    });

    const empezar = () => accion(async () => {
        const r = await api.post(`/poker/${abiertaId}/empezar`);
        avisar('¡A jugar!');
        return r;
    });

    const actuar = (accionNombre, cantidad) => accion(async () => {
        const r = await api.post(`/poker/${abiertaId}/actuar`, { accion: accionNombre, cantidad });
        setSubida(0);
        return r;
    }, 'No se pudo');

    const siguiente = () => accion(() => api.post(`/poker/${abiertaId}/siguiente`));

    const levantarse = (id) => accion(async () => {
        const r = await api.post(`/poker/${id}/levantarse`);
        setAbiertaId(null);
        avisar('Te has levantado');
        return r;
    });

    // ── LISTA ──────────────────────────────────────────────────────────────
    if (!abiertaId || !mesa) {
        const salas = (mesas || []).filter(m => m.estado === 'sala');
        const jugando = (mesas || []).filter(m => m.estado === 'jugando');
        const cerradas = (mesas || []).filter(m => m.estado === 'terminada');

        return (
            <div className="min-h-screen bg-black pb-28 px-4 pt-4 select-none animate-in fade-in">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigate('/games')} className="p-2.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 active:scale-95 transition-transform">
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                        <Spade size={20} style={{ color: ACENTO }} /> Póquer
                    </h1>
                </div>

                <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5 mb-5">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Texas Hold'em</p>
                    <p className="text-[12px] text-zinc-400 leading-relaxed">
                        Dos cartas tuyas y cinco en la mesa: la mejor jugada de cinco se lleva el bote.
                        Se apuesta en cuatro rondas, y quien no quiera seguir se retira.
                    </p>
                    <p className="text-[12px] text-zinc-400 leading-relaxed mt-2">
                        Te sientas con <strong className="text-white">20 ciegas grandes</strong>, y cuando te
                        levantas te llevas lo que te quede. Lo que pierdes lo gana alguien de la mesa:
                        aquí no hay casa.
                    </p>
                </div>

                {!creando ? (
                    <button
                        onClick={() => setCreando(true)}
                        className="w-full py-4 rounded-[20px] font-black uppercase tracking-widest text-xs text-black active:scale-95 transition-transform flex items-center justify-center gap-2 mb-6"
                        style={{ background: ACENTO }}
                    >
                        <Spade size={16} /> Montar una mesa
                    </button>
                ) : (
                    <div className="bg-[#0a0a0c] border rounded-[24px] p-5 mb-6 space-y-4" style={{ borderColor: ACENTO + '55' }}>
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nueva mesa</p>
                            <button onClick={() => setCreando(false)} className="text-zinc-600 hover:text-white"><X size={16} /></button>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Ciega grande</label>
                            <div className="flex gap-2 mt-2">
                                {[10, 20, 50, 100].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setCiega(v)}
                                        className="flex-1 min-w-0 py-2.5 rounded-xl border text-xs font-black transition-colors"
                                        style={ciega === v
                                            ? { background: ACENTO + '22', borderColor: ACENTO, color: ACENTO }
                                            : { background: '#000', borderColor: 'rgba(255,255,255,0.09)', color: '#71717a' }}
                                    >{v}</button>
                                ))}
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-2">
                                Cada uno se sienta con <strong className="text-zinc-400">{ciega * 20} fichas</strong>. Ciega pequeña: {Math.floor(ciega / 2)}.
                            </p>
                        </div>
                        <button
                            onClick={crear}
                            disabled={enVuelo}
                            className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-xs text-black active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ background: ACENTO }}
                        >
                            {enVuelo ? <Loader2 size={15} className="animate-spin" /> : <Spade size={15} />} Montar
                        </button>
                    </div>
                )}

                {[['Mesas', salas], ['En juego', jugando], ['Terminadas', cerradas.slice(0, 3)]].map(([titulo, lista]) =>
                    lista.length > 0 && (
                        <section key={titulo} className="mb-6">
                            <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">{titulo}</h2>
                            <div className="space-y-2">
                                {lista.map(m => {
                                    const yo = m.jugadores.find(j => j.soyYo);
                                    return (
                                        <button
                                            key={m._id}
                                            onClick={() => setAbiertaId(m._id)}
                                            className="w-full text-left bg-[#0a0a0c] border border-white/[0.07] rounded-[20px] p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-bold text-sm truncate">
                                                    {m.jugadores.map(j => j.soyYo ? 'tú' : j.nombre).join(', ')}
                                                </p>
                                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                                    Ciegas {m.ciegaPequena}/{m.ciegaGrande}
                                                    {m.estado === 'jugando' && ` · mano ${m.manoNumero} · ${FASES[m.fase]}`}
                                                </p>
                                            </div>
                                            {yo && (
                                                <span className="text-sm font-black shrink-0 tabular-nums" style={{ color: yo.ganancia >= 0 ? '#22c55e' : '#ef4444' }}>
                                                    {yo.ganancia >= 0 ? '+' : ''}{yo.ganancia}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )
                )}

                {mesas && mesas.length === 0 && !creando && (
                    <p className="text-center text-zinc-600 text-sm py-10">Todavía no te has sentado a ninguna mesa.</p>
                )}
            </div>
        );
    }

    // ── LA MESA ────────────────────────────────────────────────────────────
    const m = mesa;
    const esSala = m.estado === 'sala';
    const terminada = m.estado === 'terminada';
    const yo = m.jugadores.find(j => j.soyYo);
    const invitables = listaAmigos.filter(a => !m.jugadores.some(j => j._id === a._id));
    const res = m.ultimoResultado;

    return (
        <div className="min-h-screen bg-black pb-28 px-4 pt-4 select-none animate-in fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmar && (
                <ConfirmDialog
                    title={confirmar.title} message={confirmar.message} confirmLabel={confirmar.confirmLabel}
                    onCancel={() => setConfirmar(null)}
                    onConfirm={() => { const f = confirmar.accion; setConfirmar(null); f(); }}
                />
            )}

            <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setAbiertaId(null)} className="p-2.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 active:scale-95 transition-transform">
                    <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="text-lg font-black text-white uppercase tracking-tight truncate">
                        {esSala ? 'Mesa' : terminada ? 'Mesa cerrada' : `Mano ${m.manoNumero} · ${FASES[m.fase]}`}
                    </h1>
                    <p className="text-[10px] text-zinc-500">Ciegas {m.ciegaPequena}/{m.ciegaGrande}</p>
                </div>
                <button
                    onClick={() => setConfirmar({
                        title: m.soyLider ? 'Cerrar la mesa' : 'Levantarte',
                        message: m.soyLider
                            ? 'Se cierra para todos y cada uno recupera sus fichas.'
                            : 'Te llevas lo que te quede. Lo que hayas puesto en la mano en curso se queda en el bote.',
                        confirmLabel: m.soyLider ? 'Cerrar' : 'Levantarme',
                        accion: () => levantarse(m._id)
                    })}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-red-400 active:scale-95 shrink-0"
                >
                    <LogOut size={15} />
                </button>
            </div>

            {/* Los jugadores */}
            <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-4 mb-4">
                <div className="flex items-baseline justify-between mb-3">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        {esSala ? 'En la mesa' : 'Jugadores'}
                    </p>
                    <span className="text-[10px] text-zinc-600 font-bold">
                        {m.jugadores.filter(j => j.sentado).length}/{m.maxJugadores}
                        {m.invitadosPendientes > 0 && ` · ${m.invitadosPendientes} sin contestar`}
                    </span>
                </div>

                <div className="space-y-1.5">
                    {m.jugadores.map(j => (
                        <div
                            key={j.puesto}
                            className={`flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${!j.sentado ? 'opacity-30 bg-black border-white/[0.03]'
                                : j.leToca ? 'bg-black' : 'bg-black border-white/[0.06]'}`}
                            style={j.leToca ? { borderColor: ACENTO } : undefined}
                        >
                            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                                {j.avatar
                                    ? <img src={j.avatar} alt="" className="w-full h-full object-cover" />
                                    : <span className="text-[10px] font-black text-zinc-500">{j.nombre?.charAt(0)}</span>}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-white truncate flex items-center gap-1.5">
                                    {j.nombre}
                                    {j.esLider && <Crown size={10} style={{ color: ACENTO }} />}
                                    {j.esBoton && !esSala && <span className="text-[8px] font-black text-black bg-zinc-400 rounded-full w-3.5 h-3.5 flex items-center justify-center">D</span>}
                                </p>
                                {!esSala && (
                                    <p className="text-[10px] text-zinc-600">
                                        {j.retirado ? 'se retiró' : j.allIn ? 'all-in' : j.leToca ? 'le toca…' : `${j.fichas} fichas`}
                                        {j.apostadoRonda > 0 && ` · puso ${j.apostadoRonda}`}
                                    </p>
                                )}
                            </div>

                            {!esSala && (
                                <div className="flex gap-1 shrink-0">
                                    {j.soyYo
                                        ? j.cartas.map((c, i) => <CartaPoker key={i} carta={c} tamano="xs" />)
                                        : j.tieneCartas && !j.retirado
                                            ? <><CartaPoker carta={null} tamano="xs" /><CartaPoker carta={null} tamano="xs" /></>
                                            : null}
                                </div>
                            )}

                            {esSala && m.soyLider && !j.soyYo && (
                                <button
                                    onClick={() => expulsar(j._id)}
                                    disabled={enVuelo}
                                    className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-red-400 active:scale-95 shrink-0"
                                ><UserMinus size={13} /></button>
                            )}
                        </div>
                    ))}
                </div>

                {esSala && m.soyLider && (
                    <>
                        {invitando ? (
                            <div className="mt-3 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">A quién invitas</p>
                                    <button onClick={() => setInvitando(false)} className="text-zinc-600 hover:text-white"><X size={14} /></button>
                                </div>
                                {invitables.length === 0 && <p className="text-[11px] text-zinc-600">No te queda nadie a quien invitar.</p>}
                                {invitables.map(a => (
                                    <button
                                        key={a._id}
                                        onClick={() => invitar(a._id)}
                                        disabled={enVuelo || m.plazasLibres <= 0}
                                        className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-black border border-white/[0.06] active:scale-[0.99] transition-transform disabled:opacity-40"
                                    >
                                        <span className="text-[13px] text-white font-bold truncate flex-1 text-left">{a.username}</span>
                                        <UserPlus size={13} style={{ color: ACENTO }} />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <button
                                onClick={() => setInvitando(true)}
                                className="w-full mt-3 py-2.5 rounded-xl bg-black border border-white/[0.08] text-zinc-300 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform flex items-center justify-center gap-2"
                            ><UserPlus size={13} /> Invitar amigos</button>
                        )}

                        <button
                            onClick={empezar}
                            disabled={enVuelo || m.jugadores.length < 2}
                            className="w-full mt-2 py-3 rounded-xl font-black uppercase tracking-widest text-xs text-black active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ background: ACENTO }}
                        >
                            {enVuelo ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                            {m.jugadores.length < 2 ? 'Hacen falta dos' : 'Repartir'}
                        </button>
                    </>
                )}

                {esSala && !m.soyLider && (
                    <p className="text-[11px] text-zinc-600 mt-3 text-center">Esperando a que el líder reparta.</p>
                )}
            </div>

            {!esSala && (
                <>
                    {/* La mesa: comunitarias y bote */}
                    <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5 mb-4">
                        <div className="flex items-center justify-center gap-1.5 mb-4">
                            {[0, 1, 2, 3, 4].map(i => (
                                <CartaPoker key={i} carta={m.comunitarias[i] || null} tamano="md" />
                            ))}
                        </div>

                        <div className="flex items-center justify-center gap-2">
                            <Coins size={15} style={{ color: ACENTO }} />
                            <span className="text-lg font-black tabular-nums" style={{ color: ACENTO }}>{m.bote}</span>
                            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">en el bote</span>
                        </div>

                        {m.miJugada && !res && (
                            <p className="text-center text-[11px] text-zinc-400 mt-2">
                                Tienes <strong className="text-white">{m.miJugada}</strong>
                            </p>
                        )}
                    </div>

                    {/* Resultado de la mano */}
                    {res && (
                        <div className="bg-[#0a0a0c] border rounded-[24px] p-5 mb-4" style={{ borderColor: ACENTO + '55' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <Trophy size={16} style={{ color: ACENTO }} />
                                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: ACENTO }}>
                                    {res.porRetirada ? 'Todos se retiraron' : 'Showdown'}
                                </p>
                            </div>

                            {res.ganadores.map(g => (
                                <p key={g.puesto} className="text-sm text-white">
                                    <strong>{g.nombre}</strong> se lleva {g.fichas}
                                    {g.jugada && <span className="text-zinc-400"> con {g.jugada}</span>}
                                </p>
                            ))}

                            {res.manos.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                    {res.manos.map(mano => (
                                        <div key={mano.puesto} className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 w-16 truncate">{mano.nombre}</span>
                                            {mano.cartas.map((c, i) => <CartaPoker key={i} carta={c} tamano="xs" />)}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!terminada && (
                                <button
                                    onClick={siguiente}
                                    disabled={enVuelo}
                                    className="w-full mt-4 py-3 rounded-xl font-black uppercase tracking-widest text-xs text-black active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                                    style={{ background: ACENTO }}
                                >
                                    {enVuelo ? <Loader2 size={14} className="animate-spin" /> : <ChevronsRight size={14} />} Siguiente mano
                                </button>
                            )}
                        </div>
                    )}

                    {/* Mis acciones */}
                    {!terminada && !res && (
                        <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-4">
                            {!m.meToca ? (
                                <p className="text-center text-[12px] text-zinc-500 py-3">
                                    {yo?.retirado ? 'Te retiraste en esta mano.'
                                        : yo?.allIn ? 'Estás all-in: a esperar.'
                                            : `Le toca a ${m.jugadores.find(j => j.leToca)?.nombre || 'alguien'}…`}
                                </p>
                            ) : (
                                <>
                                    <div className="flex gap-2 mb-2">
                                        <button
                                            onClick={() => actuar('retirarse')}
                                            disabled={enVuelo}
                                            className="flex-1 min-w-0 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-black uppercase tracking-wider text-[11px] active:scale-95 transition-transform disabled:opacity-40"
                                        >Retirarse</button>

                                        {m.puedoPasar ? (
                                            <button
                                                onClick={() => actuar('pasar')}
                                                disabled={enVuelo}
                                                className="flex-1 min-w-0 py-3 rounded-xl bg-zinc-800 text-white font-black uppercase tracking-wider text-[11px] active:scale-95 transition-transform disabled:opacity-40"
                                            >Pasar</button>
                                        ) : (
                                            <button
                                                onClick={() => actuar('igualar')}
                                                disabled={enVuelo}
                                                className="flex-1 min-w-0 py-3 rounded-xl bg-zinc-800 text-white font-black uppercase tracking-wider text-[11px] active:scale-95 transition-transform disabled:opacity-40"
                                            >Igualar {m.porIgualar}</button>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        {[m.subidaMinima, m.subidaMinima * 2, m.subidaMinima * 4].map((v, i) => (
                                            <button
                                                key={i}
                                                onClick={() => actuar('subir', v)}
                                                disabled={enVuelo || v + m.porIgualar > m.subidaMaxima}
                                                className="flex-1 min-w-0 py-2.5 rounded-xl border text-[11px] font-black transition-colors disabled:opacity-30"
                                                style={{ background: '#000', borderColor: ACENTO + '55', color: ACENTO }}
                                            >+{v}</button>
                                        ))}
                                        <button
                                            onClick={() => actuar('subir', m.subidaMaxima - m.porIgualar)}
                                            disabled={enVuelo || m.subidaMaxima <= 0}
                                            className="flex-1 min-w-0 py-2.5 rounded-xl font-black text-[11px] text-black active:scale-95 transition-transform disabled:opacity-30"
                                            style={{ background: ACENTO }}
                                        >All-in</button>
                                    </div>

                                    <p className="text-[10px] text-zinc-600 text-center mt-2">
                                        Tienes {yo?.fichas} fichas · subida mínima {m.subidaMinima}
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
