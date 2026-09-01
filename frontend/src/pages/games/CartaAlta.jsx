import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    ArrowLeft, Swords, UserPlus, Coins, Loader2, Check, X, Play, Layers,
    Trophy, Crown, Bot, LogOut, UserMinus
} from 'lucide-react';
import api from '../../services/api';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import CartaEspanola, { NOMBRES } from '../../components/games/CartaEspanola';

const fetcher = (url) => api.get(url).then(r => r.data);

const ACENTO = '#c9822b';

// La escalera de fuerza, de la más floja a la que manda. Es la de la brisca:
// hay que enseñarla, porque quien no la conozca no puede calcular nada.
const ESCALERA = [2, 4, 5, 6, 7, 10, 11, 12, 3, 1];

/**
 * CARTA ALTA — salas de juego con baraja española.
 *
 * Montas una sala, invitas a quien quieras y empiezas cuando te dé la gana. Si
 * no invitas a nadie, juegas contra la máquina.
 *
 * Lo que lo separa de tirar una moneda es que la baraja es una baraja: 40
 * cartas que salen y no vuelven. Por eso el panel de cartas salidas no es un
 * adorno, es la mitad del juego — y no calcula las probabilidades por ti a
 * propósito, que sería jugar en tu lugar.
 */
export default function CartaAlta() {
    const navigate = useNavigate();

    const { data: salas, mutate: recargar } = useSWR('/carta-alta', fetcher, { refreshInterval: 15000 });
    const { data: amigos } = useSWR('/social/friends', fetcher);

    const [abiertaId, setAbiertaId] = useState(null);
    const [creando, setCreando] = useState(false);
    const [apuesta, setApuesta] = useState(50);
    const [enVuelo, setEnVuelo] = useState(false);
    const [toast, setToast] = useState(null);
    const [resultado, setResultado] = useState(null);
    const [confirmar, setConfirmar] = useState(null);
    const [invitando, setInvitando] = useState(false);

    const avisar = (message, type = 'success') => setToast({ message, type });

    const listaAmigos = Array.isArray(amigos) ? amigos : (amigos?.friends || []);
    const abierta = (salas || []).find(s => s._id === abiertaId) || null;

    const accion = async (fn, mensajeError = 'No se pudo') => {
        if (enVuelo) return null;
        setEnVuelo(true);
        try {
            const r = await fn();
            await recargar();
            return r;
        } catch (e) {
            avisar(e.response?.data?.message || mensajeError, 'error');
            return null;
        } finally { setEnVuelo(false); }
    };

    const crear = () => accion(async () => {
        const r = await api.post('/carta-alta', { apuesta: Number(apuesta) });
        setCreando(false);
        setAbiertaId(r.data._id);
        avisar('Sala creada. Invita a quien quieras.');
        return r;
    }, 'No se pudo crear la sala');

    const invitar = (amigoId) => accion(async () => {
        const r = await api.post(`/carta-alta/${abiertaId}/invitar`, { amigoId });
        avisar('Invitación enviada');
        return r;
    });

    const responder = (id, respuesta) => accion(async () => {
        const r = await api.post(`/carta-alta/${id}/responder`, { respuesta });
        if (respuesta === 'aceptar') { setAbiertaId(id); avisar('Estás dentro'); }
        return r;
    });

    const expulsar = (jugadorId) => accion(async () => {
        const r = await api.post(`/carta-alta/${abiertaId}/expulsar`, { jugadorId });
        avisar('Fuera de la sala');
        return r;
    });

    const cambiarApuesta = (v) => accion(async () => {
        const r = await api.post(`/carta-alta/${abiertaId}/apuesta`, { apuesta: v });
        avisar(`Ahora se juega a ${v}`);
        return r;
    }, 'No se pudo cambiar la apuesta');

    const empezar = () => accion(async () => {
        const r = await api.post(`/carta-alta/${abiertaId}/empezar`);
        setResultado(null);
        avisar(r.data.contraMaquina ? 'Nadie más: juegas contra la máquina' : '¡Empieza la partida!');
        return r;
    });

    const levantar = () => accion(async () => {
        const r = await api.post(`/carta-alta/${abiertaId}/levantar`);
        setResultado(r.data.resultado || null);
        if (r.data.resultado) {
            const res = r.data.resultado;
            avisar(res.texto, res.empate ? 'success' : res.ganeYo ? 'success' : 'error');
        }
        return r;
    }, 'No se pudo levantar la carta');

    const salir = (id) => accion(async () => {
        const r = await api.post(`/carta-alta/${id}/salir`);
        setAbiertaId(null);
        avisar('Has salido');
        return r;
    });

    // ── LISTA ──────────────────────────────────────────────────────────────
    if (!abierta) {
        const mias = (salas || []).filter(s => s.estado === 'sala');
        const activas = (salas || []).filter(s => s.estado === 'activa');
        const cerradas = (salas || []).filter(s => s.estado === 'terminada');

        return (
            <div className="min-h-screen bg-black pb-28 px-4 pt-4 select-none animate-in fade-in">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                <Cabecera onBack={() => navigate('/games')} titulo="Carta Alta" />

                <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5 mb-5">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Cómo va</p>
                    <p className="text-[12px] text-zinc-400 leading-relaxed">
                        Montas una sala e invitas a quien quieras. Cuando tú digas, empieza la
                        partida. <strong className="text-white">Si no invitas a nadie, juegas contra la máquina.</strong>
                    </p>
                    <p className="text-[12px] text-zinc-400 leading-relaxed mt-2">
                        Son <strong className="text-white">40 cartas</strong> y lo que sale no vuelve: si te
                        acuerdas de lo que ha caído, sabes lo que queda.{' '}
                        Cada mano ponéis lo mismo y levantáis una carta: la más alta se lleva el bote.
                        <strong className="text-white"> Si hay empate, la apuesta se dobla</strong> y quien gane
                        la siguiente se lo lleva todo.
                    </p>
                    <div className="flex items-center gap-1 mt-3 flex-wrap">
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mr-1">Manda</span>
                        {[...ESCALERA].reverse().map((n, i) => (
                            <span key={n} className="text-[10px] font-black" style={{ color: i === 0 ? ACENTO : '#52525b' }}>
                                {NOMBRES[n]}{i < ESCALERA.length - 1 && <span className="text-zinc-800 mx-0.5">›</span>}
                            </span>
                        ))}
                    </div>
                </div>

                {!creando ? (
                    <button
                        onClick={() => setCreando(true)}
                        className="w-full py-4 rounded-[20px] font-black uppercase tracking-widest text-xs text-black active:scale-95 transition-transform flex items-center justify-center gap-2 mb-6"
                        style={{ background: ACENTO }}
                    >
                        <Swords size={16} /> Montar una sala
                    </button>
                ) : (
                    <div className="bg-[#0a0a0c] border rounded-[24px] p-5 mb-6 space-y-4" style={{ borderColor: ACENTO + '55' }}>
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nueva sala</p>
                            <button onClick={() => setCreando(false)} className="text-zinc-600 hover:text-white"><X size={16} /></button>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Fichas por mano</label>
                            <div className="flex gap-2 mt-2">
                                {[10, 50, 100, 250].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setApuesta(v)}
                                        className="flex-1 min-w-0 py-2.5 rounded-xl border text-xs font-black transition-colors"
                                        style={apuesta === v
                                            ? { background: ACENTO + '22', borderColor: ACENTO, color: ACENTO }
                                            : { background: '#000', borderColor: 'rgba(255,255,255,0.09)', color: '#71717a' }}
                                    >{v}</button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={crear}
                            disabled={enVuelo}
                            className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-xs text-black active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ background: ACENTO }}
                        >
                            {enVuelo ? <Loader2 size={15} className="animate-spin" /> : <Swords size={15} />} Crear
                        </button>
                    </div>
                )}

                {mias.length > 0 && (
                    <Seccion titulo="Salas">
                        {mias.map(s => (
                            <FilaSala key={s._id} sala={s} onAbrir={() => setAbiertaId(s._id)} />
                        ))}
                    </Seccion>
                )}

                {activas.length > 0 && (
                    <Seccion titulo="En juego">
                        {activas.map(s => (
                            <FilaSala key={s._id} sala={s} onAbrir={() => { setAbiertaId(s._id); setResultado(null); }} />
                        ))}
                    </Seccion>
                )}

                {cerradas.length > 0 && (
                    <Seccion titulo="Terminadas">
                        {cerradas.slice(0, 5).map(s => (
                            <FilaSala key={s._id} sala={s} onAbrir={() => { setAbiertaId(s._id); setResultado(null); }} apagada />
                        ))}
                    </Seccion>
                )}

                {salas && salas.length === 0 && !creando && (
                    <p className="text-center text-zinc-600 text-sm py-10">
                        Todavía no has jugado ninguna partida.
                    </p>
                )}
            </div>
        );
    }

    // ── SALA / PARTIDA ─────────────────────────────────────────────────────
    const s = abierta;
    const esSala = s.estado === 'sala';
    const terminada = s.estado === 'terminada';
    const yaTire = !!s.enCurso?.yaTire;
    const yo = s.jugadores.find(j => j.soyYo);

    // Amigos a los que aún puedo invitar
    const invitables = listaAmigos.filter(a => !s.jugadores.some(j => j._id === a._id));

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

            <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setAbiertaId(null)} className="p-2.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 active:scale-95 transition-transform">
                    <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                    <h1 className="text-lg font-black text-white uppercase tracking-tight truncate">
                        {esSala ? 'Sala' : terminada ? 'Partida terminada' : 'En juego'}
                    </h1>
                    <p className="text-[10px] text-zinc-500">
                        {s.apuesta} fichas por mano{s.contraMaquina && ' · contra la máquina'}
                    </p>
                </div>
                {!terminada && (
                    <button
                        onClick={() => setConfirmar({
                            title: esSala ? (s.soyLider ? 'Cerrar la sala' : 'Salir de la sala') : 'Abandonar la partida',
                            message: esSala
                                ? (s.soyLider ? 'La sala se cierra para todos.' : 'Podrás volver si te invitan otra vez.')
                                : 'Te quedas fuera y no puedes volver a entrar.',
                            confirmLabel: esSala && s.soyLider ? 'Cerrar' : 'Salir',
                            accion: () => salir(s._id)
                        })}
                        className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-red-400 active:scale-95 shrink-0"
                    >
                        <LogOut size={15} />
                    </button>
                )}
            </div>

            {/* ── LOS JUGADORES ────────────────────────────────────────────── */}
            <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5 mb-5">
                <div className="flex items-baseline justify-between mb-3">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        {esSala ? 'En la sala' : 'Jugadores'}
                    </p>
                    <span className="text-[10px] text-zinc-600 font-bold">
                        {s.jugadores.length}/{s.maxJugadores}
                        {s.invitadosPendientes > 0 && ` · ${s.invitadosPendientes} sin contestar`}
                    </span>
                </div>

                <div className="space-y-2">
                    {s.jugadores.map(j => (
                        <div
                            key={j.puesto}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border ${j.activo ? 'bg-black border-white/[0.06]' : 'bg-black/40 border-white/[0.03] opacity-40'}`}
                        >
                            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                                {j.esMaquina
                                    ? <Bot size={15} className="text-zinc-500" />
                                    : j.avatar
                                        ? <img src={j.avatar} alt="" className="w-full h-full object-cover" />
                                        : <span className="text-[10px] font-black text-zinc-500">{j.nombre?.charAt(0)}</span>}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                                    {j.nombre}
                                    {j.esLider && <Crown size={11} style={{ color: ACENTO }} />}
                                    {j.soyYo && <span className="text-[9px] text-zinc-600 font-black uppercase">tú</span>}
                                </p>
                                {!esSala && (
                                    <p className="text-[10px] text-zinc-600">
                                        {j.haTirado ? 'ha levantado' : 'esperando'}
                                    </p>
                                )}
                            </div>

                            {!esSala && (
                                <span className="text-sm font-black shrink-0 tabular-nums" style={{ color: j.saldo > 0 ? '#22c55e' : j.saldo < 0 ? '#ef4444' : '#52525b' }}>
                                    {j.saldo > 0 ? '+' : ''}{j.saldo}
                                </span>
                            )}

                            {esSala && s.soyLider && !j.soyYo && (
                                <button
                                    onClick={() => expulsar(j._id)}
                                    disabled={enVuelo}
                                    title={`Sacar a ${j.nombre}`}
                                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-red-400 active:scale-95 shrink-0"
                                >
                                    <UserMinus size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {esSala && s.soyLider && (
                    <>
                        {invitando ? (
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">A quién invitas</p>
                                    <button onClick={() => setInvitando(false)} className="text-zinc-600 hover:text-white"><X size={14} /></button>
                                </div>
                                {invitables.length === 0 && (
                                    <p className="text-[11px] text-zinc-600">
                                        No te queda nadie a quien invitar. Puedes empezar igual: jugarás contra la máquina.
                                    </p>
                                )}
                                {invitables.map(a => (
                                    <button
                                        key={a._id}
                                        onClick={() => invitar(a._id)}
                                        disabled={enVuelo || s.plazasLibres <= 0}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-black border border-white/[0.06] active:scale-[0.99] transition-transform disabled:opacity-40"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                                            {a.avatar ? <img src={a.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-zinc-500">{a.username?.charAt(0)}</span>}
                                        </div>
                                        <span className="text-sm text-white font-bold truncate flex-1 text-left">{a.username}</span>
                                        <UserPlus size={14} style={{ color: ACENTO }} />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <button
                                onClick={() => setInvitando(true)}
                                className="w-full mt-4 py-3 rounded-xl bg-black border border-white/[0.08] text-zinc-300 font-black uppercase tracking-widest text-[10px] active:scale-95 transition-transform flex items-center justify-center gap-2"
                            >
                                <UserPlus size={14} /> Invitar amigos
                            </button>
                        )}

                        <button
                            onClick={empezar}
                            disabled={enVuelo}
                            className="w-full mt-2 py-3.5 rounded-xl font-black uppercase tracking-widest text-xs text-black active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ background: ACENTO }}
                        >
                            {enVuelo ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                            {s.jugadores.length > 1 ? 'Empezar partida' : 'Empezar contra la máquina'}
                        </button>
                    </>
                )}

                {esSala && !s.soyLider && (
                    <p className="text-[11px] text-zinc-600 mt-4 text-center">
                        Esperando a que el líder empiece la partida.
                    </p>
                )}
            </div>

            {!esSala && (
                <>
                    <div className="grid grid-cols-3 gap-2 mb-5">
                        <Dato etiqueta="Tu saldo" valor={`${yo?.saldo >= 0 ? '+' : ''}${yo?.saldo ?? 0}`} color={yo?.saldo >= 0 ? '#22c55e' : '#ef4444'} />
                        <Dato etiqueta="Mano" valor={`${Math.min(s.manosJugadas + 1, s.manosTotales)}/${s.manosTotales}`} />
                        <Dato etiqueta="Quedan" valor={s.cartasRestantes} color={ACENTO} />
                    </div>

                    {s.bote > 0 && (
                        <div className="rounded-[20px] p-4 mb-5 flex items-center gap-3 border animate-in fade-in" style={{ background: ACENTO + '18', borderColor: ACENTO + '66' }}>
                            <Coins size={20} style={{ color: ACENTO }} className="shrink-0" />
                            <div className="min-w-0">
                                <p className="text-base font-black" style={{ color: ACENTO }}>{s.bote} fichas en la mesa</p>
                                <p className="text-[11px] text-zinc-300 leading-tight mt-0.5">
                                    Empate: la mano ahora cuesta <strong className="text-white">{s.apuesta}</strong> y
                                    quien gane <strong className="text-white">se lo lleva todo</strong>.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* La mesa */}
                    <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[28px] p-6 mb-5">
                        {resultado ? (
                            <div className="flex flex-wrap items-end justify-center gap-4">
                                {resultado.tiradas.map((t, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2">
                                        <CartaEspanola carta={t.carta} tamano="md" />
                                        <span className="text-[9px] font-black uppercase tracking-widest truncate max-w-[92px]"
                                            style={{ color: t.nombre === resultado.ganador ? ACENTO : '#52525b' }}>
                                            {t.soyYo ? 'Tú' : t.nombre}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex justify-center">
                                <CartaEspanola carta={s.enCurso?.miCarta} tamano="lg" />
                            </div>
                        )}

                        {resultado && (
                            <p className="text-center text-xs font-bold mt-5" style={{
                                color: resultado.empate ? ACENTO : resultado.ganeYo ? '#22c55e' : '#ef4444'
                            }}>
                                {resultado.texto}
                            </p>
                        )}

                        {/* El líder decide lo que cuesta la mano siguiente. Solo
                            entre manos: en mitad de una, alguien ya habría pagado
                            el precio viejo. */}
                        {!terminada && s.soyLider && !yaTire && s.bote === 0 && (
                            <div className="mt-5">
                                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2 text-center">
                                    Lo que cuesta la mano
                                </p>
                                <div className="flex gap-2">
                                    {[10, 50, 100, 250].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => cambiarApuesta(v)}
                                            disabled={enVuelo}
                                            className="flex-1 min-w-0 py-2 rounded-xl border text-[11px] font-black transition-colors disabled:opacity-40"
                                            style={s.apuesta === v
                                                ? { background: ACENTO + '22', borderColor: ACENTO, color: ACENTO }
                                                : { background: '#000', borderColor: 'rgba(255,255,255,0.09)', color: '#71717a' }}
                                        >{v}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!terminada && (
                            <button
                                onClick={() => { setResultado(null); levantar(); }}
                                disabled={enVuelo || yaTire || s.cartasRestantes < 1}
                                className="w-full mt-6 py-4 rounded-[18px] font-black uppercase tracking-widest text-xs text-black active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
                                style={{ background: ACENTO }}
                            >
                                {enVuelo ? <Loader2 size={15} className="animate-spin" />
                                    : yaTire ? 'Esperando a los demás'
                                        : <><Layers size={15} /> Levantar carta · {s.apuesta}</>}
                            </button>
                        )}

                        {terminada && (
                            <div className="mt-6 text-center">
                                <Trophy size={22} className="mx-auto mb-2" style={{ color: (yo?.saldo ?? 0) >= 0 ? '#22c55e' : '#3f3f46' }} />
                                <p className="text-sm font-black text-white">
                                    {(yo?.saldo ?? 0) > 0 ? '¡Ganaste!' : (yo?.saldo ?? 0) < 0 ? 'Perdiste' : 'Empate a fichas'}
                                </p>
                                <p className="text-[11px] text-zinc-500 mt-1">
                                    {(yo?.saldo ?? 0) >= 0 ? '+' : ''}{yo?.saldo ?? 0} fichas en {s.manosJugadas} manos
                                </p>
                            </div>
                        )}
                    </div>

                    {s.historial.length > 0 && (
                        <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Manos jugadas</p>
                            <div className="space-y-3">
                                {s.historial.map(m => (
                                    <div key={m.numero} className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black text-zinc-700 w-5 shrink-0 tabular-nums">{m.numero}</span>
                                        {m.tiradas.map((t, i) => (
                                            <CartaEspanola key={i} carta={t.carta} tamano="sm" apagada={!m.empate && t.nombre !== m.ganador} />
                                        ))}
                                        <span className="text-[10px] font-black uppercase tracking-wide ml-auto shrink-0"
                                            style={{ color: m.empate ? ACENTO : m.ganeYo ? '#22c55e' : '#71717a' }}>
                                            {m.empate ? 'Empate' : m.ganeYo ? `+${m.premio}` : m.ganador}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Piezas ─────────────────────────────────────────────────────────────────

const Cabecera = ({ onBack, titulo }) => (
    <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 active:scale-95 transition-transform">
            <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Swords size={20} style={{ color: ACENTO }} /> {titulo}
        </h1>
    </div>
);

const Seccion = ({ titulo, children }) => (
    <section className="mb-6">
        <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">{titulo}</h2>
        <div className="space-y-2">{children}</div>
    </section>
);

const FilaSala = ({ sala, onAbrir, apagada = false }) => {
    const yo = sala.jugadores.find(j => j.soyYo);
    return (
        <button
            onClick={onAbrir}
            className={`w-full text-left bg-[#0a0a0c] border border-white/[0.07] rounded-[20px] p-4 flex items-center gap-3 active:scale-[0.99] transition-transform ${apagada ? 'opacity-60' : ''}`}
        >
            <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">
                    {sala.jugadores.map(j => j.soyYo ? 'tú' : j.nombre).join(', ')}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                    {sala.estado === 'sala'
                        ? `${sala.apuesta} por mano · sin empezar`
                        : `Mano ${Math.min(sala.manosJugadas + 1, sala.manosTotales)} de ${sala.manosTotales} · ${sala.cartasRestantes} cartas`}
                    {sala.bote > 0 && <span style={{ color: ACENTO }}> · bote {sala.bote}</span>}
                </p>
            </div>
            {sala.estado !== 'sala' && (
                <span className="text-sm font-black shrink-0 tabular-nums" style={{ color: (yo?.saldo ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                    {(yo?.saldo ?? 0) >= 0 ? '+' : ''}{yo?.saldo ?? 0}
                </span>
            )}
        </button>
    );
};

const Dato = ({ etiqueta, valor, color = '#fff' }) => (
    <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[18px] p-3 text-center">
        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{etiqueta}</p>
        <p className="text-lg font-black mt-0.5 tabular-nums" style={{ color }}>{valor}</p>
    </div>
);
