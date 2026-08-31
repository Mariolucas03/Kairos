import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
    Shield, Ban, Undo2, Trash2, Send, Loader2, Users, MessageSquare, KeyRound, Copy,
    Activity, Coins, Play, CheckCircle2, AlertTriangle, Search, X, ChevronRight,
    Heart, Flame, Dumbbell, ScrollText, Server, Database, Image, Zap, Bug, EyeOff, RotateCcw
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';
import BackButton from '../components/common/BackButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuthStore } from '../store/useAuthStore';
import { Z } from '../utils/zLayers';

/**
 * PANEL DE ADMINISTRACIÓN.
 *
 * Seis pestañas, en rejilla de 3×2 y no en una fila.
 *
 * ⚠️ La fila era el motivo de que la app se moviera de lado: cuatro botones ya
 * se salían 18 px de la pantalla, y `main` permitía arrastrar en horizontal. Con
 * seis, la fila sería imposible. La rejilla nunca se sale, sea cual sea el
 * número de pestañas.
 */

const PESTANAS = [
    { key: 'usuarios', label: 'Usuarios', icon: Users },
    { key: 'contenido', label: 'Contenido', icon: MessageSquare },
    { key: 'avisos', label: 'Avisos', icon: Send },
    { key: 'fallos', label: 'Fallos', icon: Bug },
    { key: 'economia', label: 'Economía', icon: Coins },
    { key: 'sistema', label: 'Sistema', icon: Activity },
    { key: 'registro', label: 'Registro', icon: ScrollText }
];

/** Hace legible una fecha suelta: "14 sep, 18:42". */
const cuando = (f) => f
    ? new Date(f).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

// Las tres tareas que dependen de que un cron externo las llame a su hora. Si
// ese día falló, esto es la forma de arreglarlo sin abrir un ordenador.
const TAREAS = [
    { key: 'aviso', texto: 'Mandar el aviso de las 20:00', aviso: 'Manda la notificación de misiones pendientes a todo el mundo AHORA.' },
    { key: 'castigo', texto: 'Ejecutar el castigo nocturno', aviso: 'Resta vida por las misiones no cumplidas ayer. No castiga dos veces si ya se hizo.' },
    { key: 'premios', texto: 'Repartir premios del ranking', aviso: 'Reparte las fichas del ranking del mes cerrado. No paga dos veces.' }
];

const cuandoFue = (fecha) => {
    if (!fecha) return 'nunca';
    const minutos = Math.floor((Date.now() - new Date(fecha)) / 60000);
    if (minutos < 1) return 'ahora';
    if (minutos < 60) return 'hace ' + minutos + ' min';
    if (minutos < 1440) return 'hace ' + Math.floor(minutos / 60) + ' h';
    return 'hace ' + Math.floor(minutos / 1440) + ' d';
};

const fechaCorta = (f) => f ? new Date(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

// ─── Piezas comunes ──────────────────────────────────────────────────────────

const Tarjeta = ({ children, className = '' }) => (
    <div className={`bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] ${className}`}>{children}</div>
);

const Titulo = ({ children }) => (
    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{children}</p>
);

const Dato = ({ etiqueta, valor, pie, color = 'text-white' }) => (
    <Tarjeta className="p-4">
        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{etiqueta}</p>
        <p className={`text-2xl font-black mt-1 ${color}`}>{valor}</p>
        {pie && <p className="text-[9px] text-zinc-600 mt-0.5">{pie}</p>}
    </Tarjeta>
);

const Vacio = ({ children }) => (
    <p className="text-zinc-600 text-sm text-center py-12">{children}</p>
);

// Campo numérico. El `min-w-0` NO sobra: dentro de un flex, los <input> traen un
// ancho mínimo propio que no se encoge, y dos de estos en fila se salían 184 px
// de la pantalla — que es lo que hacía que la app se pudiera arrastrar de lado.
const Numero = ({ etiqueta, valor, onChange, placeholder }) => (
    <div className="flex-1 min-w-0">
        {etiqueta && <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">{etiqueta}</p>}
        <input
            type="number"
            inputMode="numeric"
            value={valor}
            placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
            className="w-full min-w-0 bg-black border border-white/[0.07] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-yellow-500/40"
        />
    </div>
);

export default function Admin() {
    const user = useAuthStore(state => state.user);

    const [pestana, setPestana] = useState('usuarios');
    const [cargando, setCargando] = useState(true);
    const [toast, setToast] = useState(null);
    const [enVuelo, setEnVuelo] = useState(false);
    const [confirmar, setConfirmar] = useState(null);

    // Datos por pestaña. Cada una se pide la PRIMERA vez que se abre y no antes:
    // en el plan gratuito, cargar seis consultas de golpe para enseñar una sola
    // pestaña es pagar cinco de más en cada visita.
    const [usuarios, setUsuarios] = useState([]);
    const [estado, setEstado] = useState(null);
    const [comentarios, setComentarios] = useState(null);
    const [entrenos, setEntrenos] = useState(null);
    const [eco, setEco] = useState(null);
    const [registro, setRegistro] = useState(null);
    const [fallos, setFallos] = useState(null);
    const [falloAbierto, setFalloAbierto] = useState(null);

    const [busqueda, setBusqueda] = useState('');
    const [verEntrenos, setVerEntrenos] = useState(true);

    // Ficha de un usuario
    const [ficha, setFicha] = useState(null);
    const [cargandoFicha, setCargandoFicha] = useState(false);
    const [saldo, setSaldo] = useState({ coins: '', gameCoins: '' });
    const [stats, setStats] = useState({ hp: '', level: '', racha: '', lives: '' });

    // Clave temporal recién generada. Se enseña UNA vez: el servidor no la
    // guarda en claro y no hay forma de volver a consultarla.
    const [claveNueva, setClaveNueva] = useState(null);

    // Formulario de aviso
    const [destino, setDestino] = useState('todos');
    const [titulo, setTitulo] = useState('');
    const [texto, setTexto] = useState('');

    const avisar = (message, type = 'success') => setToast({ message, type });

    const cargarBase = async () => {
        setCargando(true);
        try {
            const [u, e] = await Promise.all([
                api.get('/admin/usuarios'),
                api.get('/admin/estado')
            ]);
            setUsuarios(u.data);
            setEstado(e.data);
        } catch (e) {
            avisar(e.response?.data?.message || 'No se pudo cargar', 'error');
        } finally { setCargando(false); }
    };

    useEffect(() => { if (user?.isAdmin) cargarBase(); }, [user?.isAdmin]);

    // Carga perezosa de cada pestaña
    useEffect(() => {
        if (!user?.isAdmin) return;
        const pedir = async (url, guardar) => {
            try { guardar((await api.get(url)).data); }
            catch (e) { avisar(e.response?.data?.message || 'No se pudo cargar', 'error'); }
        };
        if (pestana === 'contenido' && comentarios === null) {
            pedir('/admin/comentarios', setComentarios);
            pedir('/admin/entrenos', setEntrenos);
        }
        if (pestana === 'fallos' && fallos === null) pedir('/admin/errores', setFallos);
        if (pestana === 'economia' && eco === null) pedir('/admin/economia', setEco);
        if (pestana === 'registro' && registro === null) pedir('/admin/registro', setRegistro);
    }, [pestana, user?.isAdmin]);

    const listaFiltrada = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return usuarios;
        return usuarios.filter(u =>
            u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }, [usuarios, busqueda]);

    // ⚠️ TODOS los hooks van ARRIBA, antes de cualquier return.
    //
    // Este useMemo estaba debajo del return de aqui abajo, y eso tumbaba la
    // pantalla entera: en el render en que se cumple la condicion, React cuenta
    // un hook menos que en el anterior y aborta con "rendered fewer hooks than
    // expected". No redirige: peta. Basta con que el usuario guardado en el
    // movil llegue un instante sin isAdmin —una sesion abierta de antes, o el
    // primer pintado antes de refrescar el perfil— para que salte.
    //
    // La comprobacion de verdad esta en el servidor (el router entero exige
    // isAdmin); esto solo evita ensenar una pantalla que no va a funcionar.
    // La pantalla no existe para quien no es administrador. La comprobación de
    // verdad está en el servidor (el router entero exige isAdmin); esto solo
    // evita enseñar una pantalla que no va a funcionar.
    if (user && !user.isAdmin) return <Navigate to="/home" replace />;

    /** Lanza una acción, enseña el resultado y refresca lo que toque. */
    const accion = async (fn, { mensajeError = 'No se pudo', recargar = [] } = {}) => {
        if (enVuelo) return;
        setEnVuelo(true);
        try {
            const res = await fn();
            avisar(res?.data?.message || res?.data?.mensaje || 'Hecho');
            await cargarBase();
            // Lo que se toca deja de valer: se vuelve a pedir la próxima vez
            if (recargar.includes('contenido')) { setComentarios(null); setEntrenos(null); }
            if (recargar.includes('economia')) setEco(null);
            if (recargar.includes('fallos')) setFallos(null);
            // El registro cambia con CUALQUIER acción, así que se invalida siempre
            setRegistro(null);
            if (ficha) await abrirFicha(ficha._id, { silencioso: true });
        } catch (e) {
            avisar(e.response?.data?.message || e.response?.data?.mensaje || mensajeError, 'error');
        } finally { setEnVuelo(false); }
    };

    const abrirFicha = async (id, { silencioso = false } = {}) => {
        if (!silencioso) { setCargandoFicha(true); setFicha({ _id: id, cargando: true }); }
        try {
            const r = await api.get('/admin/usuario/' + id);
            setFicha(r.data);
            setSaldo({ coins: '', gameCoins: '' });
            setStats({ hp: '', level: '', racha: '', lives: '' });
        } catch (e) {
            avisar(e.response?.data?.message || 'No se pudo abrir la ficha', 'error');
            setFicha(null);
        } finally { setCargandoFicha(false); }
    };

    const restablecerClave = async (u) => {
        if (enVuelo) return;
        setEnVuelo(true);
        try {
            const r = await api.post('/admin/restablecer-clave', { userId: u._id });
            setClaveNueva({ usuario: r.data.usuario, clave: r.data.temporal });
            setRegistro(null);
        } catch (e) {
            avisar(e.response?.data?.message || 'No se pudo restablecer', 'error');
        } finally { setEnVuelo(false); }
    };

    const mandarAviso = () => {
        if (!titulo.trim() || !texto.trim()) return avisar('Ponle título y texto', 'error');
        const cuerpo = destino === 'todos'
            ? { todos: true, title: titulo.trim(), body: texto.trim() }
            : { username: destino, title: titulo.trim(), body: texto.trim() };

        accion(async () => {
            const r = await api.post('/admin/notificar', cuerpo);
            setTitulo(''); setTexto('');
            return r;
        }, { mensajeError: 'No se pudo enviar' });
    };

    return (
        <div className="min-h-screen bg-black pb-28 safe-top animate-in fade-in select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {confirmar && (
                <ConfirmDialog
                    title={confirmar.title}
                    message={confirmar.message}
                    confirmLabel={confirmar.confirmLabel}
                    onCancel={() => setConfirmar(null)}
                    onConfirm={() => { const f = confirmar.accion; setConfirmar(null); accion(f, confirmar.opciones); }}
                />
            )}

            {/* La clave temporal se enseña aquí y en ningún sitio más */}
            {claveNueva && (
                <div className="fixed inset-0 flex items-center justify-center p-6" style={{ zIndex: Z.confirm }}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setClaveNueva(null)} />
                    <div className="relative z-10 w-full max-w-xs bg-[#0a0a0c] border border-yellow-500/40 rounded-[24px] p-6 text-center">
                        <KeyRound size={32} className="text-yellow-500 mx-auto mb-3" />
                        <p className="text-white font-bold text-sm mb-1">Clave nueva de {claveNueva.usuario}</p>
                        <p className="text-[10px] text-zinc-500 mb-4">
                            Apúntala ahora: no se puede volver a ver. Pásasela y que la cambie él.
                        </p>
                        <p className="text-yellow-500 text-2xl font-black tracking-[0.2em] bg-black rounded-xl py-3 mb-4 select-all break-all">
                            {claveNueva.clave}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { navigator.clipboard?.writeText(claveNueva.clave); avisar('Copiada'); }}
                                className="flex-1 min-w-0 py-3 bg-zinc-800 text-zinc-200 rounded-xl font-bold text-xs active:scale-95 transition-transform flex items-center justify-center gap-2"
                            >
                                <Copy size={14} /> Copiar
                            </button>
                            <button
                                onClick={() => setClaveNueva(null)}
                                className="flex-1 min-w-0 py-3 bg-yellow-500 text-black rounded-xl font-black text-xs active:scale-95 transition-transform"
                            >
                                Hecho
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── FICHA DE USUARIO ─────────────────────────────────────── */}
            {ficha && (
                <div className="fixed inset-0 flex items-end sm:items-center justify-center" style={{ zIndex: Z.modal }}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setFicha(null)} />
                    <div className="relative z-10 w-full max-w-md bg-[#09090b] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[32px] max-h-[88vh] overflow-y-auto custom-scrollbar">

                        {ficha.cargando || cargandoFicha ? (
                            <div className="flex justify-center py-20 text-zinc-600"><Loader2 className="animate-spin" size={24} /></div>
                        ) : (
                            <div className="p-5 space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2 flex-wrap">
                                            {ficha.username}
                                            {ficha.isAdmin && <span className="text-[9px] bg-yellow-500/15 text-yellow-500 px-2 py-0.5 rounded-full font-black uppercase">admin</span>}
                                            {ficha.baneado && <span className="text-[9px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-black uppercase">baneado</span>}
                                        </h2>
                                        <p className="text-[10px] text-zinc-500 truncate mt-1">{ficha.email}</p>
                                        <p className="text-[10px] text-zinc-600 mt-0.5">
                                            Alta {fechaCorta(ficha.alta)} · visto {cuandoFue(ficha.ultimoAcceso)} · {ficha.dispositivos} disp.
                                        </p>
                                    </div>
                                    <button onClick={() => setFicha(null)} className="shrink-0 p-2 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 active:scale-95 transition-transform">
                                        <X size={18} />
                                    </button>
                                </div>

                                {ficha.baneado?.motivo && (
                                    <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-3">
                                        <p className="text-[10px] text-red-400/90 italic">"{ficha.baneado.motivo}"</p>
                                    </div>
                                )}

                                {/* Estadísticas */}
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { i: Zap, v: ficha.stats.level, t: 'Nivel', c: 'text-yellow-500' },
                                        { i: Heart, v: ficha.stats.hp + '/' + ficha.stats.maxHp, t: 'Vida', c: ficha.stats.hp === 0 ? 'text-red-500' : 'text-green-500' },
                                        { i: Flame, v: ficha.stats.racha, t: 'Racha', c: 'text-orange-500' },
                                        { i: Dumbbell, v: ficha.actividad.entrenos, t: 'Entrenos', c: 'text-zinc-300' }
                                    ].map(({ i: Icono, v, t, c }) => (
                                        <div key={t} className="bg-black border border-white/[0.07] rounded-2xl p-2.5 text-center">
                                            <Icono size={13} className={`${c} mx-auto`} />
                                            <p className="text-sm font-black text-white mt-1 leading-none">{v}</p>
                                            <p className="text-[8px] text-zinc-600 uppercase tracking-wide mt-1">{t}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-black border border-white/[0.07] rounded-2xl p-3">
                                        <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Monedas</p>
                                        <p className="text-lg font-black text-yellow-500">{ficha.stats.coins}</p>
                                    </div>
                                    <div className="bg-black border border-white/[0.07] rounded-2xl p-3">
                                        <p className="text-[9px] text-zinc-600 uppercase tracking-widest">Fichas</p>
                                        <p className="text-lg font-black text-violet-400">{ficha.stats.gameCoins}</p>
                                    </div>
                                </div>

                                {/* Actividad */}
                                <Tarjeta className="p-4">
                                    <Titulo>Actividad</Titulo>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3">
                                        {[
                                            ['Rutinas', ficha.actividad.rutinas],
                                            ['Misiones', ficha.actividad.misionesHechas + '/' + ficha.actividad.misiones],
                                            ['Días con registro (30)', ficha.actividad.diasConRegistro30],
                                            ['Días con comida', ficha.actividad.diasConComida]
                                        ].map(([k, v]) => (
                                            <div key={k} className="flex items-baseline justify-between gap-2">
                                                <span className="text-[10px] text-zinc-500 truncate">{k}</span>
                                                <span className="text-xs font-bold text-white shrink-0">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Tarjeta>

                                {/* Últimos entrenos */}
                                {ficha.ultimosEntrenos?.length > 0 && (
                                    <Tarjeta className="p-4">
                                        <Titulo>Últimos entrenos</Titulo>
                                        <div className="mt-2 space-y-1.5">
                                            {ficha.ultimosEntrenos.map(e => (
                                                <div key={e._id} className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-zinc-300 truncate">{e.routineName || 'Entreno'}</span>
                                                    <span className="text-[10px] text-zinc-600 shrink-0">
                                                        {e.date} · {Math.round((e.duration || 0) / 60)} min
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </Tarjeta>
                                )}

                                {/* Ajustar saldo */}
                                <Tarjeta className="p-4 space-y-3">
                                    <div>
                                        <Titulo>Ajustar saldo</Titulo>
                                        <p className="text-[10px] text-zinc-600 mt-1 leading-tight">
                                            Se SUMA a lo que ya tiene. En negativo, resta.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Numero etiqueta="Monedas" valor={saldo.coins} placeholder="0" onChange={v => setSaldo(s => ({ ...s, coins: v }))} />
                                        <Numero etiqueta="Fichas" valor={saldo.gameCoins} placeholder="0" onChange={v => setSaldo(s => ({ ...s, gameCoins: v }))} />
                                    </div>
                                    <button
                                        onClick={() => accion(async () => {
                                            const r = await api.post('/admin/ajustar-saldo', {
                                                userId: ficha._id,
                                                coins: Number(saldo.coins) || 0,
                                                gameCoins: Number(saldo.gameCoins) || 0
                                            });
                                            setSaldo({ coins: '', gameCoins: '' });
                                            return r;
                                        }, { mensajeError: 'No se pudo ajustar', recargar: ['economia'] })}
                                        disabled={enVuelo || (!saldo.coins && !saldo.gameCoins)}
                                        className="w-full bg-yellow-500 text-black py-2.5 rounded-xl font-black uppercase tracking-wider text-[11px] active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                                    >
                                        <Coins size={13} /> Aplicar
                                    </button>
                                </Tarjeta>

                                {/* Ajustar estadísticas */}
                                <Tarjeta className="p-4 space-y-3">
                                    <div>
                                        <Titulo>Ajustar estadísticas</Titulo>
                                        <p className="text-[10px] text-zinc-600 mt-1 leading-tight">
                                            Aquí se FIJA el valor, no se suma. Deja en blanco lo que no quieras tocar.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Numero etiqueta="Vida" valor={stats.hp} placeholder={String(ficha.stats.hp)} onChange={v => setStats(s => ({ ...s, hp: v }))} />
                                        <Numero etiqueta="Nivel" valor={stats.level} placeholder={String(ficha.stats.level)} onChange={v => setStats(s => ({ ...s, level: v }))} />
                                    </div>
                                    <div className="flex gap-2">
                                        <Numero etiqueta="Racha" valor={stats.racha} placeholder={String(ficha.stats.racha)} onChange={v => setStats(s => ({ ...s, racha: v }))} />
                                        <Numero etiqueta="Vidas" valor={stats.lives} placeholder={String(ficha.stats.lives)} onChange={v => setStats(s => ({ ...s, lives: v }))} />
                                    </div>
                                    <button
                                        onClick={() => accion(async () => {
                                            const r = await api.post('/admin/ajustar-stats', { userId: ficha._id, ...stats });
                                            setStats({ hp: '', level: '', racha: '', lives: '' });
                                            return r;
                                        }, { mensajeError: 'No se pudo ajustar' })}
                                        disabled={enVuelo || (!stats.hp && !stats.level && !stats.racha && !stats.lives)}
                                        className="w-full bg-zinc-800 text-white py-2.5 rounded-xl font-black uppercase tracking-wider text-[11px] active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                                    >
                                        <Heart size={13} /> Aplicar
                                    </button>
                                </Tarjeta>

                                {/* Acciones sobre la cuenta */}
                                <Tarjeta className="p-4 space-y-2">
                                    <Titulo>La cuenta</Titulo>

                                    <button
                                        onClick={() => setConfirmar({
                                            title: 'Nueva clave para ' + ficha.username,
                                            message: 'Se genera una contraseña temporal. La actual dejará de funcionar.',
                                            confirmLabel: 'Generar',
                                            accion: async () => { await restablecerClave(ficha); return { data: {} }; }
                                        })}
                                        disabled={enVuelo}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-black border border-zinc-800 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
                                    >
                                        <KeyRound size={14} className="text-zinc-500 shrink-0" />
                                        <span className="text-xs text-zinc-300 font-bold">Restablecer la contraseña</span>
                                    </button>

                                    {!ficha.isAdmin && (ficha.baneado ? (
                                        <button
                                            onClick={() => accion(() => api.post('/admin/desbanear', { userId: ficha._id }))}
                                            disabled={enVuelo}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-black border border-zinc-800 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
                                        >
                                            <Undo2 size={14} className="text-green-500 shrink-0" />
                                            <span className="text-xs text-zinc-300 font-bold">Levantar la suspensión</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmar({
                                                title: 'Suspender a ' + ficha.username,
                                                message: 'No podrá entrar y dejará de recibir notificaciones. Se puede deshacer.',
                                                confirmLabel: 'Suspender',
                                                accion: () => api.post('/admin/banear', { userId: ficha._id, motivo: 'Suspendido por un administrador' })
                                            })}
                                            disabled={enVuelo}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-black border border-zinc-800 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
                                        >
                                            <Ban size={14} className="text-orange-500 shrink-0" />
                                            <span className="text-xs text-zinc-300 font-bold">Suspender la cuenta</span>
                                        </button>
                                    ))}

                                    {!ficha.isAdmin && (
                                        <button
                                            onClick={() => setConfirmar({
                                                title: 'Borrar a ' + ficha.username,
                                                message: 'Se va TODO: entrenos, rutinas, misiones, comida, comentarios y amistades. No se puede deshacer.',
                                                confirmLabel: 'Borrar del todo',
                                                accion: async () => {
                                                    const r = await api.delete('/admin/usuario/' + ficha._id);
                                                    setFicha(null);
                                                    return r;
                                                },
                                                opciones: { recargar: ['contenido', 'economia'] }
                                            })}
                                            disabled={enVuelo}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-950/30 border border-red-500/20 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
                                        >
                                            <Trash2 size={14} className="text-red-500 shrink-0" />
                                            <span className="text-xs text-red-400 font-bold">Borrar la cuenta y todos sus datos</span>
                                        </button>
                                    )}

                                    {/* Por qué no hay un botón de "hacer admin": porque un endpoint
                                        que reparte permisos de administrador es justo el que no debe
                                        existir. Se da desde el servidor, a mano, y con eso basta. */}
                                    <p className="text-[9px] text-zinc-700 leading-tight pt-1">
                                        El rango de administrador no se da desde aquí a propósito: se pone
                                        en el servidor con <span className="text-zinc-600">scripts/hacer-admin.js</span>.
                                    </p>
                                </Tarjeta>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── CABECERA ─────────────────────────────────────────────── */}
            <div className="px-4">
                <div className="flex items-center gap-3 mb-5">
                    <BackButton />
                    <h1 className="text-2xl font-black text-white uppercase not-italic tracking-tighter flex items-center gap-2">
                        <Shield size={20} className="text-yellow-500" /> Admin
                    </h1>
                </div>

                {/* Rejilla 3×2: nunca se sale de la pantalla, haya las pestañas que haya */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                    {PESTANAS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setPestana(key)}
                            className={`min-w-0 flex flex-col items-center justify-center gap-1.5 py-3 rounded-[20px] border text-[9px] font-black uppercase tracking-wider transition-colors ${
                                pestana === key
                                    ? 'bg-[#0a0a0c] border-yellow-500/40 text-yellow-500'
                                    : 'bg-[#0a0a0c] border-white/[0.07] text-zinc-600'
                            }`}
                        >
                            <Icon size={15} />
                            <span className="truncate max-w-full px-1">{label}</span>
                        </button>
                    ))}
                </div>

                {cargando && (
                    <div className="flex justify-center py-12 text-zinc-600">
                        <Loader2 className="animate-spin" size={24} />
                    </div>
                )}

                {/* ─── USUARIOS ─────────────────────────────────────────── */}
                {!cargando && pestana === 'usuarios' && (
                    <div className="space-y-2">
                        <div className="relative mb-3">
                            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                            <input
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                placeholder={'Buscar entre ' + usuarios.length + ' cuentas...'}
                                className="w-full min-w-0 bg-[#0a0a0c] border border-white/[0.07] rounded-[20px] pl-11 pr-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40"
                            />
                        </div>

                        {listaFiltrada.length === 0 && <Vacio>Nadie con ese nombre.</Vacio>}

                        {listaFiltrada.map(u => (
                            <button
                                key={u._id}
                                onClick={() => abrirFicha(u._id)}
                                className="w-full text-left bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                                        {u.username}
                                        {u.isAdmin && <span className="text-[9px] bg-yellow-500/15 text-yellow-500 px-2 py-0.5 rounded-full font-black uppercase">admin</span>}
                                        {u.baneado && <span className="text-[9px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-black uppercase">baneado</span>}
                                    </p>
                                    <p className="text-[10px] text-zinc-600 truncate mt-0.5">{u.email}</p>
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        Nivel {u.level} · {u.hp} HP · {u.coins} monedas · activo {cuandoFue(u.lastActive)}
                                    </p>
                                </div>
                                <ChevronRight size={16} className="text-zinc-700 shrink-0" />
                            </button>
                        ))}
                    </div>
                )}

                {/* ─── CONTENIDO ────────────────────────────────────────── */}
                {!cargando && pestana === 'contenido' && (
                    <div className="space-y-2">
                        <div className="flex gap-2 mb-3">
                            {[
                                { k: true, t: 'Entrenos', n: entrenos?.length },
                                { k: false, t: 'Comentarios', n: comentarios?.length }
                            ].map(({ k, t, n }) => (
                                <button
                                    key={t}
                                    onClick={() => setVerEntrenos(k)}
                                    className={`flex-1 min-w-0 py-2.5 rounded-[16px] border text-[10px] font-black uppercase tracking-wider transition-colors ${
                                        verEntrenos === k ? 'bg-zinc-900 border-yellow-500/40 text-yellow-500' : 'bg-[#0a0a0c] border-white/[0.07] text-zinc-600'
                                    }`}
                                >
                                    {t}{n !== undefined && n !== null ? ' (' + n + ')' : ''}
                                </button>
                            ))}
                        </div>

                        {verEntrenos && entrenos === null && <div className="flex justify-center py-10 text-zinc-600"><Loader2 className="animate-spin" size={20} /></div>}
                        {verEntrenos && entrenos?.length === 0 && <Vacio>Todavía no hay entrenos.</Vacio>}

                        {verEntrenos && entrenos?.map(e => (
                            <Tarjeta key={e._id} className="p-4 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-zinc-600">
                                        <span className="text-zinc-400 font-bold">{e.autor}</span> · {e.fecha} · {cuandoFue(e.cuando)}
                                    </p>
                                    <p className="text-white text-sm font-bold mt-0.5 truncate">{e.nombre}</p>
                                    {e.texto && <p className="text-zinc-400 text-xs mt-1 break-words">{e.texto}</p>}
                                    <p className="text-[10px] text-zinc-600 mt-1 flex items-center gap-2 flex-wrap">
                                        {Math.round(e.duracion / 60)} min · {e.calorias} kcal · {e.comentarios} coment.
                                        {e.tieneFoto && <span className="flex items-center gap-1 text-zinc-500"><Image size={10} /> foto</span>}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setConfirmar({
                                        title: 'Borrar el entreno',
                                        message: '"' + e.nombre + '" de ' + e.autor + '. Desaparece del feed y del historial.',
                                        confirmLabel: 'Borrar',
                                        accion: () => api.delete('/admin/entreno/' + e._id),
                                        opciones: { recargar: ['contenido'] }
                                    })}
                                    disabled={enVuelo}
                                    className="shrink-0 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400 active:scale-95 transition-transform"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </Tarjeta>
                        ))}

                        {!verEntrenos && comentarios === null && <div className="flex justify-center py-10 text-zinc-600"><Loader2 className="animate-spin" size={20} /></div>}
                        {!verEntrenos && comentarios?.length === 0 && <Vacio>Todavía no hay comentarios.</Vacio>}

                        {!verEntrenos && comentarios?.map(c => (
                            <Tarjeta key={c.comentarioId} className="p-4 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-zinc-600">
                                        <span className="text-zinc-400 font-bold">{c.autor}</span> en "{c.nombreEntreno || 'entreno'}" · {cuandoFue(c.fecha)}
                                    </p>
                                    <p className="text-white text-sm mt-1 break-words">{c.texto}</p>
                                </div>
                                <button
                                    onClick={() => setConfirmar({
                                        title: 'Borrar comentario',
                                        message: '"' + c.texto + '"',
                                        confirmLabel: 'Borrar',
                                        accion: () => api.delete('/admin/comentario/' + c.entreno + '/' + c.comentarioId),
                                        opciones: { recargar: ['contenido'] }
                                    })}
                                    disabled={enVuelo}
                                    className="shrink-0 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400 active:scale-95 transition-transform"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </Tarjeta>
                        ))}
                    </div>
                )}

                {/* ─── AVISOS ───────────────────────────────────────────── */}
                {!cargando && pestana === 'avisos' && (
                    <Tarjeta className="p-5 space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Para quién</label>
                            <select
                                value={destino}
                                onChange={e => setDestino(e.target.value)}
                                className="w-full min-w-0 mt-2 bg-black border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40"
                            >
                                <option value="todos">Todos ({usuarios.filter(u => u.dispositivos > 0 && !u.baneado).length} con avisos activos)</option>
                                {usuarios.filter(u => u.dispositivos > 0 && !u.baneado).map(u => (
                                    <option key={u._id} value={u.username}>{u.username} ({u.dispositivos} disp.)</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Título</label>
                            <input
                                value={titulo}
                                onChange={e => setTitulo(e.target.value)}
                                maxLength={50}
                                placeholder="Nueva temporada"
                                className="w-full min-w-0 mt-2 bg-black border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Texto</label>
                            <textarea
                                value={texto}
                                onChange={e => setTexto(e.target.value)}
                                maxLength={140}
                                rows={3}
                                placeholder="Ya puedes reclamar la recompensa mensual"
                                className="w-full min-w-0 mt-2 bg-black border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40 resize-none"
                            />
                        </div>

                        {/* Vista previa: el nombre de la app lo pone el móvil encima,
                            así que repetirlo en el título sale duplicado. */}
                        <div className="bg-black border border-white/[0.07] rounded-2xl p-4">
                            <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">Así se verá</p>
                            <p className="text-[10px] text-zinc-500">Kairos</p>
                            <p className="text-white text-sm font-bold break-words">{titulo || 'Título'}</p>
                            <p className="text-zinc-400 text-xs break-words">{texto || 'Texto del aviso'}</p>
                        </div>

                        <button
                            onClick={mandarAviso}
                            disabled={enVuelo}
                            className="w-full bg-yellow-500 text-black py-3 rounded-xl font-black uppercase tracking-wider text-xs active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {enVuelo ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Enviar
                        </button>
                    </Tarjeta>
                )}

                {/* ─── FALLOS ───────────────────────────────────────────── */}
                {!cargando && pestana === 'fallos' && (
                    fallos === null ? (
                        <div className="flex justify-center py-12 text-zinc-600"><Loader2 className="animate-spin" size={24} /></div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-[10px] text-zinc-600 leading-tight ml-1 mb-3">
                                Pantallas que se han roto en el móvil de alguien. Van agrupadas: el mismo
                                fallo en la misma pantalla es una línea con su contador, aunque haya
                                pasado cien veces. Se caducan solas al mes.
                            </p>

                            {fallos.errores.length === 0 && (
                                <div className="py-14 text-center">
                                    <Bug size={26} className="text-zinc-800 mx-auto mb-3" />
                                    <p className="text-zinc-600 text-sm">No se ha roto nada.</p>
                                    <p className="text-[10px] text-zinc-700 mt-1">Es la pantalla que quieres ver vacía.</p>
                                </div>
                            )}

                            {fallos.errores.map(f => (
                                <Tarjeta key={f._id} className={`p-4 ${f.resuelto ? 'opacity-45' : ''}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${
                                                    f.origen === 'render' ? 'bg-red-500/15 text-red-400'
                                                        : f.origen === 'promesa' ? 'bg-violet-500/15 text-violet-400'
                                                            : 'bg-orange-500/15 text-orange-400'
                                                }`}>
                                                    {f.origen === 'render' ? 'pantalla' : f.origen === 'promesa' ? 'promesa' : 'suelto'}
                                                </span>
                                                {f.veces > 1 && (
                                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">
                                                        ×{f.veces}
                                                    </span>
                                                )}
                                                {f.ruta && (
                                                    <span className="text-[9px] text-zinc-600 font-mono truncate">{f.ruta}</span>
                                                )}
                                            </div>

                                            <p className="text-white text-sm font-bold mt-1.5 break-words">{f.mensaje}</p>

                                            <p className="text-[10px] text-zinc-600 mt-1">
                                                {/* A cuanta gente le pasa: a uno puede ser su movil; a los tres, es la app */}
                                                {f.aQuien.length > 0 && <>A {f.aQuien.join(', ')} · </>}
                                                última {cuandoFue(f.ultimaVez)}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => accion(
                                                () => api.post('/admin/error-visto', { errorId: f._id, resuelto: !f.resuelto }),
                                                { recargar: ['fallos'] }
                                            )}
                                            disabled={enVuelo}
                                            title={f.resuelto ? 'Devolver a la lista' : 'Marcar como visto'}
                                            className="shrink-0 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white active:scale-95 transition-transform"
                                        >
                                            {f.resuelto ? <RotateCcw size={15} /> : <EyeOff size={15} />}
                                        </button>
                                    </div>

                                    {/* El detalle, plegado: la pila ocupa mucho y solo hace falta
                                        cuando te pones a arreglarlo. */}
                                    {f.pila && (
                                        <>
                                            <button
                                                onClick={() => setFalloAbierto(falloAbierto === f._id ? null : f._id)}
                                                className="mt-2 text-[9px] font-black text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors"
                                            >
                                                {falloAbierto === f._id ? 'Ocultar detalle' : 'Ver detalle'}
                                            </button>
                                            {falloAbierto === f._id && (
                                                <div className="mt-2 bg-black border border-white/[0.06] rounded-xl p-3 overflow-x-auto">
                                                    <pre className="text-[9px] text-zinc-500 font-mono whitespace-pre-wrap break-words">{f.pila}</pre>
                                                    <p className="text-[9px] text-zinc-700 mt-2 pt-2 border-t border-white/[0.05]">
                                                        Primera vez: {cuando(f.primeraVez)}
                                                        {f.navegador && <><br />{f.navegador}</>}
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </Tarjeta>
                            ))}
                        </div>
                    )
                )}

                {/* ─── ECONOMÍA ─────────────────────────────────────────── */}
                {!cargando && pestana === 'economia' && (
                    eco === null ? (
                        <div className="flex justify-center py-12 text-zinc-600"><Loader2 className="animate-spin" size={24} /></div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <Dato etiqueta="Monedas" valor={eco.circulacion.monedas.toLocaleString('es-ES')} pie="en circulación" color="text-yellow-500" />
                                <Dato etiqueta="Fichas" valor={eco.circulacion.fichas.toLocaleString('es-ES')} pie={eco.circulacion.fichasPorCuenta.toLocaleString('es-ES') + ' por cuenta'} color="text-violet-400" />
                            </div>

                            {/* Lo que devuelve cada juego */}
                            <Tarjeta className="p-5">
                                <Titulo>Lo que devuelve cada juego</Titulo>
                                <p className="text-[10px] text-zinc-600 mt-1 mb-3 leading-tight">
                                    Por encima de {eco.limites.techo}% el juego regala dinero. Por debajo de {eco.limites.suelo}% es
                                    tan duro que nadie vuelve. Se calcula ahora mismo desde las tablas que usa el juego.
                                </p>

                                <div className="space-y-2">
                                    {eco.juegos.map(j => {
                                        const regala = j.devuelve >= eco.limites.techo;
                                        const duro = j.devuelve < eco.limites.suelo;
                                        const color = regala ? 'text-red-500' : duro ? 'text-orange-500' : 'text-green-500';
                                        const fondo = regala ? 'bg-red-500' : duro ? 'bg-orange-500' : 'bg-green-500';
                                        return (
                                            <div key={j.juego}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs text-zinc-300 font-bold truncate">{j.juego}</span>
                                                    <span className={`text-sm font-black shrink-0 ${color}`}>{j.devuelve}%</span>
                                                </div>
                                                <div className="h-1 w-full bg-[#18181b] rounded-full overflow-hidden mt-1">
                                                    <div className={`h-full rounded-full ${fondo}`} style={{ width: Math.min(j.devuelve, 130) / 1.3 + '%' }} />
                                                </div>
                                                {regala && (
                                                    <p className="text-[9px] text-red-400 font-bold uppercase tracking-wide mt-1">
                                                        Está regalando dinero
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 pt-3 border-t border-white/[0.05]">
                                    <p className="text-[10px] text-zinc-500">
                                        Tirada gratis: <span className="text-white font-bold">{eco.tiradaGratis.media}</span> fichas
                                        de media, <span className="text-white font-bold">{eco.tiradaGratis.maximo}</span> como mucho.
                                        Es gratis, así que lo único que la contiene es que sea una al día.
                                    </p>
                                </div>
                            </Tarjeta>

                            {/* Quién tiene el dinero */}
                            <Tarjeta className="p-5">
                                <Titulo>Quién tiene las fichas</Titulo>
                                <div className="mt-3 space-y-1.5">
                                    {eco.ricos.map((u, i) => (
                                        <div key={u.username} className="flex items-center gap-3">
                                            <span className="text-[10px] text-zinc-700 font-black w-4 shrink-0">{i + 1}</span>
                                            <span className="text-xs text-zinc-300 font-bold flex-1 min-w-0 truncate">{u.username}</span>
                                            <span className="text-[10px] text-yellow-500 font-bold shrink-0">{u.coins.toLocaleString('es-ES')}</span>
                                            <span className="text-xs text-violet-400 font-black shrink-0 w-16 text-right">{u.gameCoins.toLocaleString('es-ES')}</span>
                                        </div>
                                    ))}
                                </div>
                            </Tarjeta>
                        </div>
                    )
                )}

                {/* ─── SISTEMA ──────────────────────────────────────────── */}
                {!cargando && pestana === 'sistema' && estado && (
                    <div className="space-y-3">
                        {/* Si algo se esta rompiendo, se dice AQUI. La pestana
                            de Fallos no sirve de nada si hay que acordarse de
                            entrar a mirarla. */}
                        {fallos?.resumen?.sinResolver > 0 && (
                            <button
                                onClick={() => setPestana('fallos')}
                                className="w-full bg-red-950/30 border border-red-500/30 rounded-[24px] p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
                            >
                                <Bug size={18} className="text-red-400 shrink-0" />
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-bold text-red-400">
                                        {fallos.resumen.sinResolver} {fallos.resumen.sinResolver === 1 ? 'fallo sin ver' : 'fallos sin ver'}
                                    </p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">
                                        {fallos.resumen.enLasUltimas24h > 0
                                            ? fallos.resumen.enLasUltimas24h + ' en las últimas 24 h'
                                            : 'ninguno hoy'}
                                    </p>
                                </div>
                                <ChevronRight size={16} className="text-zinc-600 shrink-0" />
                            </button>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            <Dato etiqueta="Usuarios" valor={estado.usuarios.total} pie={estado.usuarios.activos7dias + ' activos (7 días)'} />
                            <Dato etiqueta="Con avisos" valor={estado.usuarios.conNotificaciones} pie="reciben notificaciones" />
                            <Dato etiqueta="Entrenos hoy" valor={estado.actividad.entrenosHoy} pie="registrados" />
                            <Dato
                                etiqueta="IA usada hoy"
                                valor={estado.ia.usadasHoy}
                                pie={'de ' + estado.ia.tope + ' (' + estado.ia.porcentaje + '%)'}
                                color={estado.ia.porcentaje > 80 ? 'text-orange-500' : 'text-white'}
                            />
                        </div>

                        {/* Base de datos y proceso */}
                        {(estado.base || estado.proceso) && (
                            <Tarjeta className="p-5 space-y-3">
                                <Titulo>La máquina</Titulo>

                                {estado.base?.megasUsados !== null && estado.base?.megasUsados !== undefined && (
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs text-zinc-300 font-bold flex items-center gap-2">
                                                <Database size={12} className="text-zinc-500" /> Base de datos
                                            </span>
                                            <span className="text-xs font-black text-white shrink-0">
                                                {estado.base.megasUsados} / {estado.base.topeMegas} MB
                                            </span>
                                        </div>
                                        <div className="h-1 w-full bg-[#18181b] rounded-full overflow-hidden mt-1.5">
                                            <div
                                                className={`h-full rounded-full ${estado.base.megasUsados / estado.base.topeMegas > 0.8 ? 'bg-red-500' : 'bg-green-500'}`}
                                                style={{ width: Math.min(100, (estado.base.megasUsados / estado.base.topeMegas) * 100) + '%' }}
                                            />
                                        </div>
                                        <p className="text-[9px] text-zinc-600 mt-1">
                                            {(estado.base.documentos || 0).toLocaleString('es-ES')} documentos en {estado.base.colecciones} colecciones
                                        </p>
                                    </div>
                                )}

                                {estado.proceso && (
                                    <div className="flex items-center justify-between gap-2 pt-1">
                                        <span className="text-xs text-zinc-300 font-bold flex items-center gap-2">
                                            <Server size={12} className="text-zinc-500" /> Servidor
                                        </span>
                                        <span className="text-[10px] text-zinc-500 shrink-0">
                                            {estado.proceso.minutosEncendido} min encendido · {estado.proceso.memoriaMB} MB
                                        </span>
                                    </div>
                                )}
                            </Tarjeta>
                        )}

                        {/* Tareas automáticas: lo que falla EN SILENCIO */}
                        <Tarjeta className="p-5">
                            <Titulo>Tareas automáticas</Titulo>
                            <div className="mt-2">
                                {[
                                    { nombre: 'Aviso de las 20:00', ok: estado.tareas.avisoDeLas20.enviadoHoy, dia: estado.tareas.avisoDeLas20.ultimoDia, cuando: 'hoy' },
                                    { nombre: 'Castigo nocturno', ok: estado.tareas.castigoNocturno.alDia, dia: estado.tareas.castigoNocturno.ultimoDia, cuando: 'ayer' }
                                ].map(({ nombre, ok, dia, cuando }) => (
                                    <div key={nombre} className="flex items-center gap-3 py-2">
                                        {ok
                                            ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                            : <AlertTriangle size={16} className="text-yellow-500 shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white font-bold">{nombre}</p>
                                            <p className="text-[10px] text-zinc-500 truncate">
                                                {ok ? 'Al día' : 'Pendiente de ' + cuando} · última vez: {dia || 'nunca'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Tarjeta>

                        {/* Lanzarlas a mano */}
                        <Tarjeta className="p-5 space-y-2">
                            <Titulo>Lanzar a mano</Titulo>
                            <p className="text-[10px] text-zinc-600 mb-3 leading-tight">
                                Las tres se pueden repetir sin miedo: no castigan, ni pagan, ni avisan dos veces.
                            </p>

                            {TAREAS.map(({ key, texto: t, aviso }) => (
                                <button
                                    key={key}
                                    onClick={() => setConfirmar({
                                        title: t,
                                        message: aviso,
                                        confirmLabel: 'Ejecutar',
                                        accion: () => api.post('/admin/mantenimiento', { tarea: key })
                                    })}
                                    disabled={enVuelo}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-black border border-zinc-800 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
                                >
                                    <Play size={14} className="text-yellow-500 shrink-0" />
                                    <span className="text-xs text-zinc-300 font-bold">{t}</span>
                                </button>
                            ))}
                        </Tarjeta>
                    </div>
                )}

                {/* ─── REGISTRO ─────────────────────────────────────────── */}
                {!cargando && pestana === 'registro' && (
                    registro === null ? (
                        <div className="flex justify-center py-12 text-zinc-600"><Loader2 className="animate-spin" size={24} /></div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-[10px] text-zinc-600 leading-tight ml-1 mb-3">
                                Todo lo que se hace desde este panel queda aquí. No se puede borrar desde la
                                app a propósito: un registro que el propio administrador puede limpiar no es
                                un registro. Se caduca solo al año.
                            </p>

                            {registro.length === 0 && <Vacio>Todavía no se ha hecho nada desde el panel.</Vacio>}

                            {registro.map(r => (
                                <Tarjeta key={r._id} className="p-4">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-[10px] font-black text-yellow-500/80 uppercase tracking-wide truncate">{r.accion}</span>
                                        <span className="text-[10px] text-zinc-600 shrink-0">{cuandoFue(r.cuando)}</span>
                                    </div>
                                    <p className="text-sm text-white mt-1 break-words">
                                        <span className="font-bold">{r.quien}</span> {r.resumen}
                                    </p>
                                    {r.detalle?.motivo && r.detalle.motivo !== 'sin indicar' && (
                                        <p className="text-[10px] text-zinc-500 italic mt-1 break-words">"{r.detalle.motivo}"</p>
                                    )}
                                </Tarjeta>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
