import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Settings as SettingsIcon, Lock, Globe, LogOut, Save, Loader2,
    Dumbbell, User as UserIcon, ChevronRight, Utensils, ScrollText, PersonStanding, Eye, EyeOff
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';
import BackButton from '../components/common/BackButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuthStore } from '../store/useAuthStore';

const BIO_MAX = 150;

// Secciones que puedes enseñar u ocultar por separado
const SECCIONES = [
    { key: 'workouts', label: 'Entrenos', icon: Dumbbell, desc: 'Tus sesiones de gym y deporte' },
    { key: 'body', label: 'Cuerpo', icon: PersonStanding, desc: 'El nivel de cada músculo' },
    { key: 'food', label: 'Comida', icon: Utensils, desc: 'Lo que comes y tus calorías' },
    { key: 'missions', label: 'Misiones', icon: ScrollText, desc: 'Las misiones que completas' }
];

const VISIBILIDAD_POR_DEFECTO = { workouts: true, body: true, food: true, missions: true };

export default function Settings() {
    const navigate = useNavigate();
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const logout = useAuthStore(state => state.logout);

    const [bio, setBio] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [visibility, setVisibility] = useState(VISIBILIDAD_POR_DEFECTO);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmLogout, setConfirmLogout] = useState(false);

    // Cargamos los valores actuales del usuario al entrar
    useEffect(() => {
        if (!user) return;
        setBio(user.bio || '');
        setIsPrivate(!!user.isPrivate);
        setVisibility({ ...VISIBILIDAD_POR_DEFECTO, ...(user.visibility || {}) });
    }, [user]);

    const visActual = { ...VISIBILIDAD_POR_DEFECTO, ...(user?.visibility || {}) };
    const dirty = user && (
        (user.bio || '') !== bio ||
        !!user.isPrivate !== isPrivate ||
        SECCIONES.some(s => visActual[s.key] !== visibility[s.key])
    );

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const res = await api.put('/users/profile', { bio, isPrivate, visibility });
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
        // safe-top: Ajustes tampoco lleva la cabecera global, así que el título
        // se metía bajo el reloj del móvil.
        <div className="min-h-screen bg-black pb-28 safe-top px-4 animate-in fade-in select-none">
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

            {/* --- PRIVACIDAD ---
                Dos decisiones encadenadas y explicadas por separado, que es lo
                que costaba entender: 1) QUIÉN puede entrar en tu perfil,
                2) QUÉ le enseñas una vez dentro. */}
            <section className="mb-6">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 ml-1">
                    1 · Quién puede ver tu perfil
                </h2>
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
                                    ? 'Solo tus amigos pueden entrar en tu perfil.'
                                    : 'Cualquiera puede entrar en tu perfil.'}
                            </p>
                        </div>
                        <div className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${isPrivate ? 'bg-yellow-500' : 'bg-zinc-700'}`}>
                            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </button>
                    <p className="text-[10px] text-zinc-600 px-4 pb-3 leading-tight">
                        Tu foto, nombre, descripción y contadores se ven siempre, tengas la cuenta como la tengas.
                    </p>
                </div>
            </section>

            {/* --- QUÉ ENSEÑAS --- */}
            <section className="mb-6">
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 ml-1">
                    2 · Qué enseñas de ti
                </h2>
                <p className="text-[10px] text-zinc-600 mb-3 ml-1 leading-tight">
                    Puedes apagar una sección aunque tengas la cuenta pública. Tú siempre la ves.
                </p>
                <div className="bg-zinc-950 border border-white/5 rounded-[24px] overflow-hidden divide-y divide-white/5">
                    {SECCIONES.map(({ key, label, icon: Icon, desc }) => {
                        const visible = visibility[key] !== false;
                        return (
                            <button
                                key={key}
                                onClick={() => setVisibility(v => ({ ...v, [key]: !visible }))}
                                className="w-full p-4 flex items-center gap-4 active:bg-white/5 transition-colors"
                            >
                                <div className={`p-2.5 rounded-xl border ${visible ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className={`font-bold text-sm ${visible ? 'text-white' : 'text-zinc-500'}`}>{label}</p>
                                    <p className="text-[10px] text-zinc-500 leading-tight mt-0.5 flex items-center gap-1">
                                        {visible ? <Eye size={10} /> : <EyeOff size={10} />} {desc}
                                    </p>
                                </div>
                                <div className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${visible ? 'bg-yellow-500' : 'bg-zinc-700'}`}>
                                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${visible ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                            </button>
                        );
                    })}
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
