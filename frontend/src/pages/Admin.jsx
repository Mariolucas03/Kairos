import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Ban, Undo2, Trash2, Send, Loader2, Users, MessageSquare, KeyRound, Copy, Activity, Coins, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';
import BackButton from '../components/common/BackButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuthStore } from '../store/useAuthStore';

const PESTANAS = [
    { key: 'usuarios', label: 'Usuarios', icon: Users },
    { key: 'avisos', label: 'Avisos', icon: Send },
    { key: 'moderar', label: 'Moderar', icon: MessageSquare },
    { key: 'sistema', label: 'Sistema', icon: Activity }
];

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
    if (minutos < 60) return 'hace ' + minutos + ' min';
    if (minutos < 1440) return 'hace ' + Math.floor(minutos / 60) + ' h';
    return 'hace ' + Math.floor(minutos / 1440) + ' d';
};

export default function Admin() {
    const user = useAuthStore(state => state.user);

    const [pestana, setPestana] = useState('usuarios');
    const [usuarios, setUsuarios] = useState([]);
    const [comentarios, setComentarios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [toast, setToast] = useState(null);
    const [enVuelo, setEnVuelo] = useState(false);
    const [confirmar, setConfirmar] = useState(null);

    // Clave temporal recien generada. Se ensena UNA vez: el servidor no la
    // guarda en claro y no hay forma de volver a consultarla.
    const [claveNueva, setClaveNueva] = useState(null);

    const [estado, setEstado] = useState(null);
    const [ajuste, setAjuste] = useState({ userId: '', coins: '', gameCoins: '' });

    // Formulario de aviso
    const [destino, setDestino] = useState('todos');
    const [titulo, setTitulo] = useState('');
    const [texto, setTexto] = useState('');

    const avisar = (message, type = 'success') => setToast({ message, type });

    const cargar = async () => {
        setCargando(true);
        try {
            const [u, c, e] = await Promise.all([
                api.get('/admin/usuarios'),
                api.get('/admin/comentarios'),
                api.get('/admin/estado')
            ]);
            setUsuarios(u.data);
            setComentarios(c.data);
            setEstado(e.data);
        } catch (e) {
            avisar(e.response?.data?.message || 'No se pudo cargar', 'error');
        } finally { setCargando(false); }
    };

    useEffect(() => { if (user?.isAdmin) cargar(); }, [user?.isAdmin]);

    // La pantalla no existe para quien no es administrador. La comprobación de
    // verdad está en el servidor (el router entero exige isAdmin); esto solo
    // evita enseñar una pantalla que no va a funcionar.
    if (user && !user.isAdmin) return <Navigate to="/home" replace />;

    const accion = async (fn, mensajeError = 'No se pudo') => {
        if (enVuelo) return;
        setEnVuelo(true);
        try {
            const res = await fn();
            avisar(res?.data?.message || res?.data?.mensaje || 'Hecho');
            await cargar();
        } catch (e) {
            avisar(e.response?.data?.message || e.response?.data?.mensaje || mensajeError, 'error');
        } finally { setEnVuelo(false); }
    };

    const restablecerClave = async (u) => {
        if (enVuelo) return;
        setEnVuelo(true);
        try {
            const r = await api.post('/admin/restablecer-clave', { userId: u._id });
            setClaveNueva({ usuario: r.data.usuario, clave: r.data.temporal });
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
        }, 'No se pudo enviar');
    };

    return (
        <div className="min-h-screen bg-black pb-28 safe-top px-4 animate-in fade-in select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {confirmar && (
                <ConfirmDialog
                    title={confirmar.title}
                    message={confirmar.message}
                    confirmLabel={confirmar.confirmLabel}
                    onCancel={() => setConfirmar(null)}
                    onConfirm={() => { const f = confirmar.accion; setConfirmar(null); accion(f); }}
                />
            )}

            {/* La clave temporal se ensena aqui y en ningun sitio mas */}
            {claveNueva && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setClaveNueva(null)} />
                    <div className="relative z-10 w-full max-w-xs bg-[#0a0a0c] border border-yellow-500/40 rounded-[24px] p-6 text-center">
                        <KeyRound size={32} className="text-yellow-500 mx-auto mb-3" />
                        <p className="text-white font-bold text-sm mb-1">Clave nueva de {claveNueva.usuario}</p>
                        <p className="text-[10px] text-zinc-500 mb-4">
                            Apúntala ahora: no se puede volver a ver. Pásasela y que la cambie él.
                        </p>
                        <p className="text-yellow-500 text-2xl font-black tracking-[0.2em] bg-black rounded-xl py-3 mb-4 select-all">
                            {claveNueva.clave}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { navigator.clipboard?.writeText(claveNueva.clave); avisar('Copiada'); }}
                                className="flex-1 py-3 bg-zinc-800 text-zinc-200 rounded-xl font-bold text-xs active:scale-95 transition-transform flex items-center justify-center gap-2"
                            >
                                <Copy size={14} /> Copiar
                            </button>
                            <button
                                onClick={() => setClaveNueva(null)}
                                className="flex-1 py-3 bg-yellow-500 text-black rounded-xl font-black text-xs active:scale-95 transition-transform"
                            >
                                Hecho
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3 mb-6">
                <BackButton />
                <h1 className="text-2xl font-black text-white uppercase not-italic tracking-tighter flex items-center gap-2">
                    <Shield size={20} className="text-yellow-500" /> Admin
                </h1>
            </div>

            {/* --- PESTAÑAS --- */}
            <div className="flex gap-2 mb-6">
                {PESTANAS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setPestana(key)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[20px] border text-[11px] font-black uppercase tracking-wider transition-colors ${
                            pestana === key
                                ? 'bg-[#0a0a0c] border-yellow-500/40 text-yellow-500'
                                : 'bg-[#0a0a0c] border-white/[0.07] text-zinc-600'
                        }`}
                    >
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {cargando && (
                <div className="flex justify-center py-12 text-zinc-600">
                    <Loader2 className="animate-spin" size={24} />
                </div>
            )}

            {/* --- USUARIOS --- */}
            {!cargando && pestana === 'usuarios' && (
                <div className="space-y-2">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest ml-1 mb-3">
                        {usuarios.length} cuentas
                    </p>

                    {usuarios.map(u => (
                        <div key={u._id} className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-sm flex items-center gap-2">
                                        {u.username}
                                        {u.isAdmin && <span className="text-[9px] bg-yellow-500/15 text-yellow-500 px-2 py-0.5 rounded-full font-black uppercase">admin</span>}
                                        {u.baneado && <span className="text-[9px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-black uppercase">baneado</span>}
                                    </p>
                                    <p className="text-[10px] text-zinc-600 truncate mt-0.5">{u.email}</p>
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        Nivel {u.level} · {u.hp} HP · {u.coins} monedas · {u.dispositivos} disp. · activo {cuandoFue(u.lastActive)}
                                    </p>
                                    {u.baneado?.motivo && (
                                        <p className="text-[10px] text-red-400/80 mt-1 italic">"{u.baneado.motivo}"</p>
                                    )}
                                </div>

                                <button
                                    onClick={() => setConfirmar({
                                        title: 'Nueva clave para ' + u.username,
                                        message: 'Se genera una contraseña temporal. La actual dejará de funcionar.',
                                        confirmLabel: 'Generar',
                                        accion: async () => { await restablecerClave(u); return { data: {} }; }
                                    })}
                                    disabled={enVuelo}
                                    className="shrink-0 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-yellow-500 active:scale-95 transition-transform"
                                    title="Restablecer contraseña"
                                >
                                    <KeyRound size={16} />
                                </button>

                                {!u.isAdmin && (
                                    u.baneado ? (
                                        <button
                                            onClick={() => accion(() => api.post('/admin/desbanear', { userId: u._id }))}
                                            disabled={enVuelo}
                                            className="shrink-0 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 active:scale-95 transition-transform"
                                            title="Levantar la suspensión"
                                        >
                                            <Undo2 size={16} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmar({
                                                title: 'Suspender a ' + u.username,
                                                message: 'No podrá entrar y dejará de recibir notificaciones. Se puede deshacer.',
                                                confirmLabel: 'Suspender',
                                                accion: () => api.post('/admin/banear', { userId: u._id, motivo: 'Suspendido por un administrador' })
                                            })}
                                            disabled={enVuelo}
                                            className="shrink-0 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400 active:scale-95 transition-transform"
                                            title="Suspender"
                                        >
                                            <Ban size={16} />
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- AVISOS --- */}
            {!cargando && pestana === 'avisos' && (
                <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Para quién</label>
                        <select
                            value={destino}
                            onChange={e => setDestino(e.target.value)}
                            className="w-full mt-2 bg-black border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40"
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
                            className="w-full mt-2 bg-black border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40"
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
                            className="w-full mt-2 bg-black border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40 resize-none"
                        />
                    </div>

                    {/* Vista previa: el nombre de la app lo pone el móvil encima,
                        así que repetirlo en el título sale duplicado. */}
                    <div className="bg-black border border-white/[0.07] rounded-2xl p-4">
                        <p className="text-[9px] text-zinc-600 uppercase tracking-widest mb-2">Así se verá</p>
                        <p className="text-[10px] text-zinc-500">Kairos</p>
                        <p className="text-white text-sm font-bold">{titulo || 'Título'}</p>
                        <p className="text-zinc-400 text-xs">{texto || 'Texto del aviso'}</p>
                    </div>

                    <button
                        onClick={mandarAviso}
                        disabled={enVuelo}
                        className="w-full bg-yellow-500 text-black py-3 rounded-xl font-black uppercase tracking-wider text-xs active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {enVuelo ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Enviar
                    </button>
                </div>
            )}

            {/* --- SISTEMA --- */}
            {!cargando && pestana === 'sistema' && estado && (
                <div className="space-y-3">

                    {/* Números del día */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { etiqueta: 'Usuarios', valor: estado.usuarios.total, pie: estado.usuarios.activos7dias + ' activos (7 días)' },
                            { etiqueta: 'Con avisos', valor: estado.usuarios.conNotificaciones, pie: 'reciben notificaciones' },
                            { etiqueta: 'Entrenos hoy', valor: estado.actividad.entrenosHoy, pie: 'registrados' },
                            { etiqueta: 'IA usada hoy', valor: estado.ia.usadasHoy, pie: 'de ' + estado.ia.tope + ' (' + estado.ia.porcentaje + '%)' }
                        ].map(({ etiqueta, valor, pie }) => (
                            <div key={etiqueta} className="bg-[#0a0a0c] border border-white/[0.07] rounded-[20px] p-4">
                                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{etiqueta}</p>
                                <p className="text-2xl font-black text-white mt-1">{valor}</p>
                                <p className="text-[9px] text-zinc-600 mt-0.5">{pie}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tareas automáticas: lo que falla EN SILENCIO */}
                    <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Tareas automáticas</p>

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
                                    <p className="text-[10px] text-zinc-500">
                                        {ok ? 'Al día' : 'Pendiente de ' + cuando} · última vez: {dia || 'nunca'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Lanzarlas a mano */}
                    <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5 space-y-2">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Lanzar a mano</p>
                        <p className="text-[10px] text-zinc-600 mb-3 leading-tight">
                            Las tres se pueden repetir sin miedo: no castigan, ni pagan, ni avisan dos veces.
                        </p>

                        {TAREAS.map(({ key, texto, aviso }) => (
                            <button
                                key={key}
                                onClick={() => setConfirmar({
                                    title: texto,
                                    message: aviso,
                                    confirmLabel: 'Ejecutar',
                                    accion: () => api.post('/admin/mantenimiento', { tarea: key })
                                })}
                                disabled={enVuelo}
                                className="w-full flex items-center gap-3 p-3 rounded-xl bg-black border border-zinc-800 text-left active:scale-[0.99] transition-transform disabled:opacity-50"
                            >
                                <Play size={14} className="text-yellow-500 shrink-0" />
                                <span className="text-xs text-zinc-300 font-bold">{texto}</span>
                            </button>
                        ))}
                    </div>

                    {/* Ajustar saldo */}
                    <div className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-5 space-y-3">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ajustar saldo</p>
                        <p className="text-[10px] text-zinc-600 leading-tight">
                            Para compensar cuando algo falla. Se SUMA a lo que ya tiene; en negativo, resta.
                        </p>

                        <select
                            value={ajuste.userId}
                            onChange={e => setAjuste(a => ({ ...a, userId: e.target.value }))}
                            className="w-full bg-black border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40"
                        >
                            <option value="">Elige a quién...</option>
                            {usuarios.map(u => (
                                <option key={u._id} value={u._id}>{u.username} ({u.coins} monedas)</option>
                            ))}
                        </select>

                        <div className="flex gap-2">
                            <input
                                type="number" placeholder="Monedas" value={ajuste.coins}
                                onChange={e => setAjuste(a => ({ ...a, coins: e.target.value }))}
                                className="flex-1 bg-black border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40"
                            />
                            <input
                                type="number" placeholder="Fichas" value={ajuste.gameCoins}
                                onChange={e => setAjuste(a => ({ ...a, gameCoins: e.target.value }))}
                                className="flex-1 bg-black border border-white/[0.07] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-yellow-500/40"
                            />
                        </div>

                        <button
                            onClick={() => accion(async () => {
                                const r = await api.post('/admin/ajustar-saldo', {
                                    userId: ajuste.userId,
                                    coins: Number(ajuste.coins) || 0,
                                    gameCoins: Number(ajuste.gameCoins) || 0
                                });
                                setAjuste({ userId: '', coins: '', gameCoins: '' });
                                return r;
                            }, 'No se pudo ajustar')}
                            disabled={enVuelo || !ajuste.userId}
                            className="w-full bg-yellow-500 text-black py-3 rounded-xl font-black uppercase tracking-wider text-xs active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                            <Coins size={14} /> Aplicar ajuste
                        </button>
                    </div>
                </div>
            )}

            {/* --- MODERAR --- */}
            {!cargando && pestana === 'moderar' && (
                <div className="space-y-2">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest ml-1 mb-3">
                        Últimos {comentarios.length} comentarios
                    </p>

                    {comentarios.length === 0 && (
                        <p className="text-zinc-600 text-sm text-center py-12">Todavía no hay comentarios.</p>
                    )}

                    {comentarios.map(c => (
                        <div key={c.comentarioId} className="bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-4 flex items-start gap-3">
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
                                    accion: () => api.delete('/admin/comentario/' + c.entreno + '/' + c.comentarioId)
                                })}
                                disabled={enVuelo}
                                className="shrink-0 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400 active:scale-95 transition-transform"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
