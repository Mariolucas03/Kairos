import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Ban, Undo2, Trash2, Send, Loader2, Users, MessageSquare } from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';
import BackButton from '../components/common/BackButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuthStore } from '../store/useAuthStore';

const PESTANAS = [
    { key: 'usuarios', label: 'Usuarios', icon: Users },
    { key: 'avisos', label: 'Avisos', icon: Send },
    { key: 'moderar', label: 'Moderar', icon: MessageSquare }
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

    // Formulario de aviso
    const [destino, setDestino] = useState('todos');
    const [titulo, setTitulo] = useState('');
    const [texto, setTexto] = useState('');

    const avisar = (message, type = 'success') => setToast({ message, type });

    const cargar = async () => {
        setCargando(true);
        try {
            const [u, c] = await Promise.all([
                api.get('/admin/usuarios'),
                api.get('/admin/comentarios')
            ]);
            setUsuarios(u.data);
            setComentarios(c.data);
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
