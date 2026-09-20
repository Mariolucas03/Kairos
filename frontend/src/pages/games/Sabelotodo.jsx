import { useState, useEffect, useRef } from 'react';
import useSWR, { mutate as mutarGlobal } from 'swr';
import {
    Globe, ScrollText, Lightbulb, Trophy, Palette, Gamepad2, Crown, Heart, HeartCrack, Check, X, Plus,
    Loader2, UserPlus, ChevronLeft, LogOut, Clock
} from '../../iconos';
import api from '../../services/api';
import Toast from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import BackButton from '../../components/common/BackButton';
import MarcoPerfil from '../../components/common/MarcoPerfil';
import { BADGE_KEY } from '../../hooks/useSocialBadge';

const fetcher = (url) => api.get(url).then(res => res.data);

/**
 * SABELOTODO — el trivial en pareja.
 *
 * Como el Preguntados, pero los dos en el mismo bando: se turnan, cada turno
 * se gira la ruleta y sale una pregunta de esa categoria. Acertar da la
 * corona; fallar quita una vida al equipo. Seis coronas: ganais los dos.
 * Tres fallos: perdeis los dos. Y como los duelos, tantas partidas a la vez
 * como amigos tengas.
 *
 * El servidor manda las opciones sin la correcta y tiene la cuenta del
 * tiempo: aqui solo se pinta el reloj. Si el reloj llega a cero se contesta
 * sola con -1, que es fallo.
 */

const ACENTO = '#a855f7';
const SEGUNDOS = 20;

export const CATEGORIAS = {
    geografia: { nombre: 'Geografía', color: '#3b82f6', Icon: Globe },
    historia: { nombre: 'Historia', color: '#eab308', Icon: ScrollText },
    ciencia: { nombre: 'Ciencia', color: '#22c55e', Icon: Lightbulb },
    deporte: { nombre: 'Deporte', color: '#f97316', Icon: Trophy },
    arte: { nombre: 'Arte y Letras', color: '#ef4444', Icon: Palette },
    ocio: { nombre: 'Entretenimiento', color: '#a855f7', Icon: Gamepad2 }
};
const CLAVES = Object.keys(CATEGORIAS);

const Avatar = ({ persona, tamano = 40 }) => (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
        <div className="w-full h-full rounded-full bg-zinc-900 border border-white/10 overflow-hidden flex items-center justify-center text-sm font-black text-zinc-500">
            {persona?.avatar
                ? <img src={persona.avatar} alt="" className="w-full h-full object-cover" />
                : (persona?.nombre || '?').charAt(0).toUpperCase()}
        </div>
        {persona?.frame && <MarcoPerfil marco={persona.frame} tamano={tamano * 1.3} desborde={tamano * 0.15} />}
    </div>
);

/** Las seis coronas: encendida la ganada, apagada la que falta. */
const Coronas = ({ coronas = [], tamano = 34 }) => (
    <div className="flex items-center justify-between gap-1.5">
        {CLAVES.map(c => {
            const { color, Icon, nombre } = CATEGORIAS[c];
            const ganada = coronas.includes(c);
            return (
                <div key={c} className="flex flex-col items-center gap-1 flex-1" title={nombre}>
                    <div
                        className="rounded-full flex items-center justify-center border transition-colors"
                        style={{
                            width: tamano, height: tamano,
                            background: ganada ? color : '#0f0f12',
                            borderColor: ganada ? color : 'rgba(255,255,255,0.08)',
                            color: ganada ? '#000' : '#3f3f46'
                        }}
                    >
                        {ganada ? <Crown size={tamano * 0.45} /> : <Icon size={tamano * 0.42} />}
                    </div>
                </div>
            );
        })}
    </div>
);

const Vidas = ({ vidas, max = 3 }) => (
    <div className="flex items-center gap-1">
        {Array.from({ length: max }).map((_, i) => (
            i < vidas
                ? <Heart key={i} size={16} className="text-red-500" />
                : <HeartCrack key={i} size={16} className="text-zinc-700" />
        ))}
    </div>
);

/** La ruleta: seis gajos, y gira hasta caer en la categoria que diga el servidor. */
const Ruleta = ({ girando, categoria, onGirar, cargando }) => {
    const gajo = 360 / CLAVES.length;
    const fondo = `conic-gradient(${CLAVES.map((c, i) => `${CATEGORIAS[c].color} ${i * gajo}deg ${(i + 1) * gajo}deg`).join(', ')})`;
    // La flecha esta arriba (0deg). Para que el gajo `i` quede arriba hay que
    // girar la rueda -(centro del gajo), y se le suman vueltas enteras.
    const idx = categoria ? CLAVES.indexOf(categoria) : 0;
    const destino = 360 * 4 - (idx * gajo + gajo / 2);

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-56 h-56">
                <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-white" />
                <div
                    className="w-full h-full rounded-full border-4 border-zinc-800"
                    style={{
                        background: fondo,
                        transform: `rotate(${girando ? destino : 0}deg)`,
                        transition: girando ? 'transform 2.2s cubic-bezier(0.15, 0.85, 0.2, 1)' : 'none',
                        boxShadow: 'inset 0 0 0 6px rgba(0,0,0,0.35), 0 10px 30px rgba(0,0,0,0.6)'
                    }}
                >
                    {CLAVES.map((c, i) => {
                        const { Icon } = CATEGORIAS[c];
                        const ang = i * gajo + gajo / 2;
                        return (
                            <div key={c} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${ang}deg) translateY(-78px) rotate(-${ang}deg)` }}>
                                <div className="-translate-x-1/2 -translate-y-1/2 text-black/80"><Icon size={22} /></div>
                            </div>
                        );
                    })}
                </div>
                <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-[#0a0a0c] border-4 border-zinc-800 flex items-center justify-center">
                    <Crown size={24} style={{ color: ACENTO }} />
                </div>
            </div>
            {!girando && (
                <button
                    onClick={onGirar}
                    disabled={cargando}
                    className="mt-6 w-full max-w-xs h-14 rounded-2xl font-black uppercase tracking-[0.16em] text-[13px] text-white active:scale-[0.985] transition-transform disabled:opacity-60 flex items-center justify-center gap-2 not-italic"
                    style={{ background: ACENTO }}
                >
                    {cargando ? <Loader2 size={18} className="animate-spin" /> : 'Girar la ruleta'}
                </button>
            )}
        </div>
    );
};

/** La pregunta con su reloj. */
const Pregunta = ({ enCurso, onContestar, resultado, enviando }) => {
    const { color, nombre, Icon } = CATEGORIAS[enCurso.categoria] || CATEGORIAS.ocio;
    const [restan, setRestan] = useState(Math.min(SEGUNDOS, enCurso.segundos ?? SEGUNDOS));
    const disparado = useRef(false);

    useEffect(() => {
        if (resultado) return;
        const fin = Date.now() + restan * 1000;
        const id = setInterval(() => {
            const r = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
            setRestan(r);
            if (r <= 0 && !disparado.current) { disparado.current = true; clearInterval(id); onContestar(-1); }
        }, 250);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enCurso.preguntaId, resultado]);

    const pct = (restan / SEGUNDOS) * 100;

    return (
        <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-3xl border overflow-hidden bg-[#0a0a0c]" style={{ borderColor: color + '55' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: color + '22' }}>
                    <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] not-italic" style={{ color }}>
                        <Icon size={15} /> {nombre}
                    </span>
                    <span className={`flex items-center gap-1 text-[12px] font-black tabular-nums not-italic ${restan <= 5 ? 'text-red-400' : 'text-zinc-300'}`}>
                        <Clock size={13} /> {restan}s
                    </span>
                </div>
                <div className="h-1 bg-white/[0.06]">
                    <div className="h-full transition-[width] duration-200 ease-linear" style={{ width: `${pct}%`, background: restan <= 5 ? '#ef4444' : color }} />
                </div>
                <p className="px-5 pt-5 pb-4 text-[17px] font-black text-white leading-snug not-italic">{enCurso.texto}</p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 mt-3">
                {enCurso.opciones.map((op, i) => {
                    let estilo = { background: '#0f0f12', borderColor: 'rgba(255,255,255,0.09)', color: '#e4e4e7' };
                    if (resultado) {
                        if (op === resultado.correcta) estilo = { background: 'rgba(34,197,94,0.18)', borderColor: '#22c55e', color: '#fff' };
                        else if (op === resultado.elegida) estilo = { background: 'rgba(239,68,68,0.18)', borderColor: '#ef4444', color: '#fff' };
                        else estilo = { ...estilo, opacity: 0.4 };
                    }
                    return (
                        <button
                            key={i}
                            disabled={!!resultado || enviando}
                            onClick={() => onContestar(i)}
                            className="w-full text-left px-4 py-3.5 rounded-2xl border font-bold text-[14px] transition-colors active:scale-[0.99] flex items-center gap-3 not-italic"
                            style={estilo}
                        >
                            <span className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-[11px] font-black shrink-0">{'ABCD'[i]}</span>
                            <span className="flex-1">{op}</span>
                            {resultado && op === resultado.correcta && <Check size={16} className="text-green-400 shrink-0" />}
                            {resultado && op === resultado.elegida && op !== resultado.correcta && <X size={16} className="text-red-400 shrink-0" />}
                        </button>
                    );
                })}
            </div>

            {resultado && (
                <p className={`mt-3 text-center text-[12px] font-black uppercase tracking-[0.12em] not-italic ${resultado.acierto ? 'text-green-400' : 'text-red-400'}`}>
                    {resultado.acierto ? '¡Correcto! Corona ganada' : resultado.aTiempo === false ? 'Se acabó el tiempo: una vida menos' : 'Fallo: una vida menos'}
                </p>
            )}
        </div>
    );
};

/** Una partida abierta. */
const Partida = ({ id, onVolver, avisar }) => {
    const { data: partida, mutate } = useSWR(`/sabelotodo/${id}`, fetcher, {
        // Mientras le toca al otro se pregunta cada pocos segundos
        refreshInterval: (d) => (d && d.estado === 'activa' && !d.meToca) || d?.estado === 'invitacion' ? 6000 : 0
    });
    const [girando, setGirando] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [confirmarSalir, setConfirmarSalir] = useState(false);
    // Tras girar, la pregunta llega antes de que la rueda pare: se guarda y
    // se enseña cuando la rueda se detiene.
    const [pendiente, setPendiente] = useState(null);

    const refrescarTodo = () => { mutate(); mutarGlobal('/sabelotodo'); mutarGlobal(BADGE_KEY); };

    const girar = async () => {
        if (cargando) return;
        setCargando(true);
        try {
            const r = await api.post(`/sabelotodo/${id}/girar`);
            setPendiente(r.data);
            setGirando(true);
            setTimeout(() => { mutate(r.data, false); setGirando(false); setPendiente(null); }, 2400);
        } catch (e) {
            avisar(e.response?.data?.message || 'No se pudo girar', 'error');
            mutate();
        } finally { setCargando(false); }
    };

    const contestar = async (opcion) => {
        if (cargando || resultado) return;
        setCargando(true);
        try {
            const r = await api.post(`/sabelotodo/${id}/contestar`, { opcion });
            setResultado(r.data.resultado);
            setTimeout(() => { setResultado(null); mutate(r.data, false); refrescarTodo(); }, 2200);
        } catch (e) {
            avisar(e.response?.data?.message || 'No se pudo contestar', 'error');
            mutate();
        } finally { setCargando(false); }
    };

    const responder = async (respuesta) => {
        try {
            const r = await api.post(`/sabelotodo/${id}/responder`, { respuesta });
            mutate(r.data, false); refrescarTodo();
            if (respuesta === 'rechazar') onVolver();
        } catch (e) { avisar(e.response?.data?.message || 'No se pudo contestar', 'error'); }
    };

    const abandonar = async () => {
        try { await api.post(`/sabelotodo/${id}/abandonar`); refrescarTodo(); onVolver(); }
        catch (e) { avisar(e.response?.data?.message || 'No se pudo salir', 'error'); }
    };

    if (!partida) return <div className="py-20 text-center text-zinc-600 text-xs font-bold uppercase animate-pulse">Cargando la partida...</div>;

    const p = partida;
    const otro = p.companero;
    const enJuego = p.estado === 'activa';
    // Mientras la rueda gira se ensena la categoria a la que va a caer
    const categoriaRuleta = pendiente?.enCurso?.categoria || null;
    const preguntaVisible = enJuego && p.meToca && p.enCurso && p.enCurso.texto && !girando;

    return (
        <div className="animate-in fade-in">
            {confirmarSalir && (
                <ConfirmDialog
                    message="¿Dejar la partida? Se termina para los dos y nadie cobra."
                    confirmLabel="Dejarla"
                    onCancel={() => setConfirmarSalir(false)}
                    onConfirm={() => { setConfirmarSalir(false); abandonar(); }}
                />
            )}

            <div className="flex items-center gap-3 mb-4">
                <button onClick={onVolver} aria-label="Volver" className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-2xl text-zinc-400 active:scale-95 shrink-0"><ChevronLeft size={18} /></button>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <Avatar persona={p.yo} tamano={36} />
                    <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest not-italic">y</span>
                    <Avatar persona={otro} tamano={36} />
                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-black text-white truncate not-italic">{otro?.nombre || 'Esperando…'}</p>
                        <p className="text-[10px] text-zinc-500 font-bold not-italic">{p.coronas.length} de 6 coronas</p>
                    </div>
                </div>
                <Vidas vidas={p.vidas} max={p.vidasMax} />
            </div>

            <div className="rounded-3xl border border-white/[0.07] bg-[#0a0a0c] p-4 mb-4">
                <Coronas coronas={p.coronas} />
            </div>

            {/* ── LO QUE TOCA ─────────────────────────────────────────── */}
            {p.estado === 'invitacion' && p.soyInvitado && (
                <div className="rounded-3xl border p-5 text-center" style={{ borderColor: ACENTO + '55', background: ACENTO + '14' }}>
                    <p className="text-sm font-black text-white not-italic">{otro?.nombre || 'Alguien'} te invita a jugar en pareja</p>
                    <p className="text-[11px] text-zinc-400 mt-1">Seis coronas, tres vidas, los dos juntos. Os turnáis.</p>
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => responder('rechazar')} className="flex-1 h-12 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-300 font-black text-[12px] uppercase tracking-widest">Paso</button>
                        <button onClick={() => responder('aceptar')} className="flex-1 h-12 rounded-2xl text-white font-black text-[12px] uppercase tracking-widest" style={{ background: ACENTO }}>Jugar</button>
                    </div>
                </div>
            )}

            {p.estado === 'invitacion' && !p.soyInvitado && (
                <div className="rounded-3xl border border-white/[0.07] bg-[#0a0a0c] p-6 text-center">
                    <Loader2 size={22} className="animate-spin mx-auto" style={{ color: ACENTO }} />
                    <p className="text-sm font-black text-white mt-3 not-italic">Esperando a que acepte</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Le ha llegado un aviso. En cuanto entre, empezáis.</p>
                    <button onClick={() => setConfirmarSalir(true)} className="mt-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">Cancelar la invitación</button>
                </div>
            )}

            {enJuego && p.meToca && !preguntaVisible && (
                <div className="rounded-3xl border border-white/[0.07] bg-[#0a0a0c] p-5">
                    <p className="text-center text-[11px] font-black uppercase tracking-[0.18em] mb-4 not-italic" style={{ color: ACENTO }}>
                        {girando ? 'Girando…' : p.racha > 0 ? `Te toca · llevas ${p.racha} seguida${p.racha > 1 ? 's' : ''}` : 'Te toca'}
                    </p>
                    <Ruleta girando={girando} categoria={categoriaRuleta} onGirar={girar} cargando={cargando} />
                    {p.enCurso && !girando && !p.enCurso.texto && (
                        <p className="text-center text-[10px] text-zinc-500 mt-3">Recargando la pregunta…</p>
                    )}
                </div>
            )}

            {preguntaVisible && (
                <Pregunta key={p.enCurso.preguntaId} enCurso={p.enCurso} onContestar={contestar} resultado={resultado} enviando={cargando} />
            )}

            {enJuego && !p.meToca && (
                <div className="rounded-3xl border border-white/[0.07] bg-[#0a0a0c] p-6 text-center">
                    <Avatar persona={otro} tamano={56} />
                    <p className="text-sm font-black text-white mt-3 not-italic">Le toca a {otro?.nombre}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                        {p.enCurso?.categoria ? `Está con una de ${CATEGORIAS[p.enCurso.categoria]?.nombre}.` : 'Te avisamos cuando te toque.'}
                    </p>
                </div>
            )}

            {(p.estado === 'ganada' || p.estado === 'perdida') && (
                <div className="rounded-3xl border p-6 text-center" style={{ borderColor: (p.estado === 'ganada' ? '#22c55e' : '#ef4444') + '55', background: (p.estado === 'ganada' ? '#22c55e' : '#ef4444') + '14' }}>
                    <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: p.estado === 'ganada' ? '#22c55e' : '#ef4444' }}>
                        {p.estado === 'ganada' ? <Crown size={26} className="text-black" /> : <HeartCrack size={26} className="text-white" />}
                    </div>
                    <p className="text-lg font-black text-white mt-3 uppercase not-italic">{p.estado === 'ganada' ? '¡Seis coronas!' : 'Sin vidas'}</p>
                    <p className="text-[12px] text-zinc-400 mt-1">
                        {p.estado === 'ganada'
                            ? `Los dos os lleváis ${p.premio?.fichas || 0} fichas y ${p.premio?.xp || 0} XP.`
                            : `Os quedasteis en ${p.coronas.length} coronas. ${p.premio?.xp || 0} XP de consuelo para cada uno.`}
                    </p>
                </div>
            )}

            {(p.estado === 'rechazada' || p.estado === 'abandonada') && (
                <div className="rounded-3xl border border-white/[0.07] bg-[#0a0a0c] p-6 text-center">
                    <p className="text-sm font-black text-zinc-300 not-italic">{p.estado === 'rechazada' ? 'No aceptó la invitación' : 'La partida se dejó a medias'}</p>
                </div>
            )}

            {/* ── LO QUE HA PASADO ────────────────────────────────────── */}
            {p.historial.length > 0 && (
                <div className="mt-5">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em] mb-2 not-italic">Últimas preguntas</p>
                    <div className="space-y-1.5">
                        {p.historial.map((h, i) => {
                            const cat = CATEGORIAS[h.categoria] || CATEGORIAS.ocio;
                            return (
                                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#0a0a0c] border border-white/[0.06]">
                                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: cat.color + '22', color: cat.color }}><cat.Icon size={13} /></span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-zinc-300 truncate">{h.texto}</p>
                                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">{h.fuiYo ? 'Tú' : h.nombre} · {h.acierto ? 'acertó' : `falló · era ${h.correcta}`}</p>
                                    </div>
                                    {h.acierto ? <Check size={14} className="text-green-500 shrink-0" /> : <X size={14} className="text-red-500 shrink-0" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {enJuego && (
                <button onClick={() => setConfirmarSalir(true)} className="mt-6 w-full text-[10px] font-black uppercase tracking-widest text-zinc-600 flex items-center justify-center gap-1.5">
                    <LogOut size={12} /> Dejar la partida
                </button>
            )}
        </div>
    );
};

/** Una fila de la lista de partidas. */
const FilaPartida = ({ p, onAbrir }) => {
    const otro = p.companero;
    let estado, color = '#71717a';
    if (p.estado === 'invitacion') { estado = p.soyInvitado ? 'Te invita' : 'Invitación enviada'; color = p.soyInvitado ? ACENTO : '#71717a'; }
    else if (p.estado === 'activa') { estado = p.meToca ? 'Te toca' : `Le toca a ${otro?.nombre || '…'}`; color = p.meToca ? '#22c55e' : '#71717a'; }
    else if (p.estado === 'ganada') { estado = 'Ganada'; color = '#22c55e'; }
    else if (p.estado === 'perdida') { estado = 'Perdida'; color = '#ef4444'; }
    else estado = p.estado === 'rechazada' ? 'Rechazada' : 'Abandonada';
    const pide = (p.estado === 'activa' && p.meToca) || (p.estado === 'invitacion' && p.soyInvitado);

    return (
        <button onClick={onAbrir} className="w-full text-left rounded-3xl border p-4 bg-[#0a0a0c] active:scale-[0.99] transition-transform" style={{ borderColor: pide ? color + '66' : 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3">
                <Avatar persona={otro || { nombre: '?' }} tamano={42} />
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black text-white truncate not-italic">{otro?.nombre || 'Sin compañero'}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] mt-0.5 not-italic" style={{ color }}>{estado}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Vidas vidas={p.vidas} max={p.vidasMax} />
                </div>
            </div>
            <div className="mt-3">
                <Coronas coronas={p.coronas} tamano={26} />
            </div>
        </button>
    );
};

export default function Sabelotodo() {
    const [toast, setToast] = useState(null);
    const [abierta, setAbierta] = useState(null);
    const [eligiendo, setEligiendo] = useState(false);
    const [creando, setCreando] = useState(null);

    const { data: partidas, mutate } = useSWR('/sabelotodo', fetcher, { refreshInterval: 15000 });
    const { data: amigosData } = useSWR('/social/friends', fetcher);
    const amigos = Array.isArray(amigosData) ? amigosData : (amigosData?.friends || []);

    const avisar = (message, type = 'success') => setToast({ message, type });

    // Con quien ya hay partida viva no se puede abrir otra
    const vivasCon = new Set();
    (partidas || []).forEach(p => {
        if (!['invitacion', 'activa'].includes(p.estado)) return;
        if (p.companero?._id) vivasCon.add(p.companero._id);
    });

    const crear = async (amigo) => {
        if (creando) return;
        setCreando(amigo._id);
        try {
            const r = await api.post('/sabelotodo', { amigoId: amigo._id });
            await mutate();
            setEligiendo(false);
            setAbierta(r.data._id);
            avisar(`Invitación enviada a ${amigo.username}`);
        } catch (e) {
            avisar(e.response?.data?.message || 'No se pudo crear la partida', 'error');
        } finally { setCreando(null); }
    };

    const orden = (p) => {
        if (p.estado === 'activa' && p.meToca) return 0;
        if (p.estado === 'invitacion' && p.soyInvitado) return 1;
        if (p.estado === 'activa') return 2;
        if (p.estado === 'invitacion') return 3;
        return 4;
    };
    const lista = [...(partidas || [])].sort((a, b) => orden(a) - orden(b) || new Date(b.actualizada) - new Date(a.actualizada));
    const vivas = lista.filter(p => ['invitacion', 'activa'].includes(p.estado));
    const acabadas = lista.filter(p => !['invitacion', 'activa'].includes(p.estado));

    return (
        <div className="min-h-screen bg-black pb-28 px-4 pt-4 select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {abierta ? (
                <Partida id={abierta} onVolver={() => { setAbierta(null); mutate(); }} avisar={avisar} />
            ) : (
                <>
                    <div className="flex items-center gap-3 mb-5">
                        <BackButton to="/games" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none not-italic">En pareja</p>
                            <h1 className="mt-1.5 text-[24px] font-black text-white uppercase tracking-[-0.04em] leading-none not-italic">Sabelotodo</h1>
                        </div>
                        <button onClick={() => setEligiendo(true)} className="h-11 px-4 rounded-2xl text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-transform not-italic" style={{ background: ACENTO }}>
                            <Plus size={15} /> Nueva
                        </button>
                    </div>

                    <div className="rounded-3xl border border-white/[0.07] bg-[#0a0a0c] p-4 mb-5">
                        <p className="text-[12px] text-zinc-300 leading-snug">
                            Tú y un amigo, <span className="text-white font-black">en el mismo bando</span>. Os turnáis: ruleta, pregunta, y si aciertas te quedas la corona. Fallar quita una vida al equipo. <span className="text-white font-black">Seis coronas</span> y ganáis los dos; <span className="text-white font-black">tres fallos</span> y perdéis los dos.
                        </p>
                        <div className="mt-3"><Coronas coronas={CLAVES} tamano={26} /></div>
                    </div>

                    {eligiendo && (
                        <div className="fixed inset-0 z-[100] bg-black/90 flex items-end sm:items-center justify-center p-4" onClick={() => setEligiendo(false)}>
                            <div className="w-full max-w-sm bg-[#0a0a0c] border border-white/10 rounded-3xl p-5 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 not-italic"><UserPlus size={16} style={{ color: ACENTO }} /> ¿Con quién?</h2>
                                    <button onClick={() => setEligiendo(false)} className="p-2 rounded-full bg-zinc-900 text-zinc-400"><X size={14} /></button>
                                </div>
                                <div className="overflow-y-auto no-scrollbar space-y-2 flex-1">
                                    {amigos.length === 0 && <p className="text-[11px] text-zinc-500 text-center py-6">Añade amigos en la pestaña IG para poder jugar en pareja.</p>}
                                    {amigos.map(a => {
                                        const ocupado = vivasCon.has(a._id);
                                        return (
                                            <button key={a._id} disabled={ocupado || !!creando} onClick={() => crear(a)} className="w-full flex items-center gap-3 p-3 rounded-2xl border border-white/[0.07] bg-black disabled:opacity-40 active:scale-[0.99]">
                                                <Avatar persona={{ nombre: a.username, avatar: a.avatar, frame: a.frame }} tamano={36} />
                                                <span className="flex-1 text-left text-[13px] font-black text-white truncate not-italic">{a.username}</span>
                                                {ocupado ? <span className="text-[9px] font-black uppercase text-zinc-500">En partida</span> : creando === a._id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} style={{ color: ACENTO }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {!partidas && <div className="py-16 text-center text-zinc-600 text-xs font-bold uppercase animate-pulse">Cargando partidas...</div>}

                    {partidas && vivas.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
                            <Crown size={28} className="mx-auto text-zinc-700" />
                            <p className="mt-3 text-[12px] font-black text-zinc-400 uppercase tracking-widest not-italic">Ninguna partida en marcha</p>
                            <p className="text-[11px] text-zinc-600 mt-1">Invita a un amigo y empezad una.</p>
                        </div>
                    )}

                    {vivas.length > 0 && (
                        <div className="space-y-2.5">
                            {vivas.map(p => <FilaPartida key={p._id} p={p} onAbrir={() => setAbierta(p._id)} />)}
                        </div>
                    )}

                    {acabadas.length > 0 && (
                        <div className="mt-6">
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em] mb-2 not-italic">Terminadas</p>
                            <div className="space-y-2.5">
                                {acabadas.slice(0, 8).map(p => <FilaPartida key={p._id} p={p} onAbrir={() => setAbierta(p._id)} />)}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
