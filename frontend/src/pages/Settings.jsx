import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Settings as SettingsIcon, Lock, Globe, LogOut, Save, Loader2,
    Dumbbell, User as UserIcon, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';
import BackButton from '../components/common/BackButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuthStore } from '../store/useAuthStore';

const BIO_MAX = 150;

export default function Settings() {
    const navigate = useNavigate();
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const logout = useAuthStore(state => state.logout);

    const [bio, setBio] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [gymMode, setGymMode] = useState('normal');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmLogout, setConfirmLogout] = useState(false);

    // Cargamos los valores actuales del usuario al entrar
    useEffect(() => {
        if (!user) return;
        setBio(user.bio || '');
        setIsPrivate(!!user.isPrivate);
        setGymMode(user.gymMode || 'normal');
    }, [user]);

    const dirty = user && (
        (user.bio || '') !== bio ||
        !!user.isPrivate !== isPrivate ||
        (user.gymMode || 'normal') !== gymMode
    );

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const res = await api.put('/users/profile', { bio, isPrivate, gymMode });
            setUser(prev => ({ ...prev, ...res.data.user }));
            setToast({ message: 'Ajustes guardados', type: 'success' });
        } catch (e) {
            setToast({ message: e.response?.data?.message || 'No se pudieron guardar los ajustes', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-black pb-28 pt-6 px-4 animate-in fade-in select-none">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex items-center gap-3 mb-8">
                <BackButton />
                <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                    <SettingsIcon size={20} className="text-yellow-500" /> Ajustes
                </h1>
            </div>

            {/* --- TU PERFIL --- */}
            <section className="mb-6">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 ml-1">Tu perfil</h2>

                <button
                    onClick={() => user?._id && navigate(`/social/user/${user._id}`)}
                    className="w-full bg-zinc-950 border border-white/5 rounded-[24px] p-4 flex items-center gap-4 mb-3 active:scale-[0.99] transition-transform hover:border-white/10"
                >
                    <div className="relative shrink-0">
                        <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center text-lg font-black text-zinc-500 border-2 border-zinc-800 overflow-hidden">
                            {user?.avatar
                                ? <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
                                : (user?.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        {user?.frame && <img src={user.frame} className="absolute -top-2 -left-2 w-[72px] h-[72px] max-w-none pointer-events-none z-20" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <p className="text-white font-black uppercase truncate">{user?.username}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">Ver mi perfil público</p>
                    </div>
                    <ChevronRight size={18} className="text-zinc-600 shrink-0" />
                </button>

                {/* Descripción */}
                <div className="bg-zinc-950 border border-white/5 rounded-[24px] p-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <UserIcon size={11} /> Descripción
                    </label>
                    <textarea
                        rows={3}
                        value={bio}
                        maxLength={BIO_MAX}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Cuenta algo sobre ti, tus objetivos, tu deporte..."
                        className="w-full bg-black border border-zinc-800 rounded-2xl p-3 text-white text-sm outline-none focus:border-yellow-500/50 transition-colors resize-none placeholder:text-zinc-700"
                    />
                    <p className={`text-[10px] font-bold text-right mt-1 ${bio.length >= BIO_MAX ? 'text-yellow-500' : 'text-zinc-600'}`}>
                        {bio.length}/{BIO_MAX}
                    </p>
                </div>
            </section>

            {/* --- PRIVACIDAD --- */}
            <section className="mb-6">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 ml-1">Privacidad</h2>
                <div className="bg-zinc-950 border border-white/5 rounded-[24px] overflow-hidden">
                    <button
                        onClick={() => setIsPrivate(!isPrivate)}
                        className="w-full p-4 flex items-center gap-4 active:bg-white/5 transition-colors"
                    >
                        <div className={`p-2.5 rounded-xl border ${isPrivate ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                            {isPrivate ? <Lock size={18} /> : <Globe size={18} />}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-white font-bold text-sm">{isPrivate ? 'Cuenta privada' : 'Cuenta pública'}</p>
                            <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                                {isPrivate
                                    ? 'Solo tus amigos ven tus entrenos, comida y misiones.'
                                    : 'Cualquiera puede ver tus entrenos, comida y misiones.'}
                            </p>
                        </div>
                        {/* Interruptor */}
                        <div className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${isPrivate ? 'bg-yellow-500' : 'bg-zinc-700'}`}>
                            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </button>
                    <p className="text-[10px] text-zinc-600 px-4 pb-3 leading-tight">
                        Tu foto, nombre, descripción y contadores siempre son visibles, aunque tengas la cuenta privada.
                    </p>
                </div>
            </section>

            {/* --- GIMNASIO --- */}
            <section className="mb-6">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 ml-1">Gimnasio</h2>
                <div className="bg-zinc-950 border border-white/5 rounded-[24px] p-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                        <Dumbbell size={11} /> Nivel de detalle
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'normal', titulo: 'Normal', desc: 'Grupos musculares (Pecho, Espalda, Pierna...)' },
                            { id: 'pro', titulo: 'Pro', desc: 'Músculo concreto (Dorsal ancho, Vasto lateral...)' }
                        ].map(m => (
                            <button
                                key={m.id}
                                onClick={() => setGymMode(m.id)}
                                className={`p-3 rounded-2xl border text-left transition-all ${gymMode === m.id
                                    ? 'bg-yellow-500/10 border-yellow-500/50 ring-1 ring-yellow-500/20'
                                    : 'bg-black border-zinc-800 hover:border-zinc-700'}`}
                            >
                                <p className={`font-black text-sm uppercase ${gymMode === m.id ? 'text-yellow-500' : 'text-zinc-300'}`}>{m.titulo}</p>
                                <p className="text-[9px] text-zinc-500 leading-tight mt-1">{m.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- GUARDAR --- */}
            <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black rounded-2xl uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 border-yellow-600 disabled:border-zinc-900 mb-8"
            >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? 'Guardando...' : dirty ? 'Guardar cambios' : 'Todo guardado'}
            </button>

            {/* --- CERRAR SESIÓN --- */}
            <div className="border-t border-zinc-900 pt-6">
                <button
                    onClick={() => setConfirmLogout(true)}
                    className="w-full bg-red-950/20 border border-red-900/30 text-red-500 p-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm hover:bg-red-900/40 transition-all active:scale-95"
                >
                    <LogOut size={18} /> CERRAR SESIÓN
                </button>
                <p className="text-center text-[10px] text-zinc-700 mt-4 font-mono">ID: {user?._id}</p>
            </div>

            {confirmLogout && (
                <ConfirmDialog
                    title="¿Cerrar sesión?"
                    message="Tendrás que volver a introducir tus datos para entrar."
                    confirmLabel="Salir"
                    onCancel={() => setConfirmLogout(false)}
                    onConfirm={handleLogout}
                />
            )}
        </div>
    );
}
