import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, User, Mail, Lock, ArrowRight, FilePlus, Check } from 'lucide-react';
import api from '../services/api';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../store/useAuthStore';

const ACENTO = '#3b82f6'; // azul: diferencia el registro del login (oro)
const MAX_ALIAS = 8;      // el límite real que valida el backend

export default function Register() {
    const navigate = useNavigate();
    // 🔥 CONECTAMOS CON ZUSTAND
    const setUser = useAuthStore(state => state.setUser);

    const [formData, setFormData] = useState({ username: '', email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [campoActivo, setCampoActivo] = useState(null);

    // 🔥 AUTO-REDIRECCIÓN
    useEffect(() => {
        if (localStorage.getItem('token')) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await api.post('/auth/register', formData);

            localStorage.setItem('token', response.data.token);
            // 🔥 GUARDAMOS EN ZUSTAND
            setUser(response.data);

            navigate('/home', { replace: true });
        } catch (err) {
            const msg = err.response?.data?.message || 'Error al conectar con el servidor';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const claseCampo = (nombre) =>
        `w-full bg-black border rounded-[16px] py-[14px] text-white font-semibold text-sm outline-none transition-colors placeholder:text-zinc-700 ${campoActivo === nombre ? 'border-blue-500/45' : 'border-white/[0.09]'}`;

    const colorIcono = (nombre) => (campoActivo === nombre ? ACENTO : '#52525b');

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-10 select-none">
            <div className="w-full max-w-sm animate-in fade-in duration-300">

                {/* MARCA */}
                <div className="flex flex-col items-center mb-9">
                    <div
                        className="w-16 h-16 rounded-[20px] flex items-center justify-center border"
                        style={{ background: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.3)' }}
                    >
                        <UserPlus size={30} style={{ color: ACENTO }} />
                    </div>
                    <h1 className="mt-5 text-[30px] font-black text-white uppercase tracking-[-0.05em] leading-none text-center not-italic">
                        Nuevo recluta
                    </h1>
                    <p className="mt-3 text-[9px] font-black text-zinc-600 uppercase tracking-[0.24em] not-italic">
                        Empieza tu partida
                    </p>
                </div>

                {/* TARJETA DE REGISTRO */}
                <div className="relative bg-[#0a0a0c] border border-white/[0.07] rounded-[28px] p-6 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${ACENTO}, transparent)` }} />
                    <div className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] opacity-[0.11] pointer-events-none" style={{ background: ACENTO }} />

                    <h2 className="relative z-10 text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] flex items-center gap-2 mb-6 not-italic">
                        <FilePlus size={16} style={{ color: ACENTO }} /> Crear expediente
                    </h2>

                    {error && (
                        <div className="relative z-10 mb-5 p-3 bg-red-950/40 border border-red-500/30 rounded-2xl text-red-400 text-[11px] font-bold text-center not-italic">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
                        {/* Alias */}
                        <div>
                            <div className="flex items-baseline justify-between mb-2">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.14em] not-italic">Alias</label>
                                <span className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.1em] not-italic">Máx. {MAX_ALIAS}</span>
                            </div>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={17} style={{ color: colorIcono('username') }} />
                                <input
                                    type="text"
                                    name="username"
                                    placeholder="Guerrero"
                                    maxLength={MAX_ALIAS}
                                    value={formData.username}
                                    onChange={handleChange}
                                    onFocus={() => setCampoActivo('username')}
                                    onBlur={() => setCampoActivo(null)}
                                    required
                                    className={`${claseCampo('username')} pl-12 pr-4`}
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.14em] mb-2 not-italic">Correo</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={17} style={{ color: colorIcono('email') }} />
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="tu@email.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    onFocus={() => setCampoActivo('email')}
                                    onBlur={() => setCampoActivo(null)}
                                    required
                                    className={`${claseCampo('email')} pl-12 pr-4`}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.14em] mb-2 not-italic">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={17} style={{ color: colorIcono('password') }} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    onFocus={() => setCampoActivo('password')}
                                    onBlur={() => setCampoActivo(null)}
                                    required
                                    className={`${claseCampo('password')} pl-12 pr-12`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-[18px] py-4 mt-6 font-black uppercase tracking-[0.16em] text-[12px] text-white active:scale-[0.985] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 not-italic"
                            style={{ background: ACENTO }}
                        >
                            {loading ? 'Creando...' : <>Confirmar <Check size={18} strokeWidth={3} /></>}
                        </button>
                    </form>
                </div>

                {/* PIE */}
                <div className="mt-7 text-center">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.08em] not-italic">
                        ¿Ya tienes expediente?
                    </p>
                    <Link
                        to="/login"
                        className="mt-2 inline-flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] hover:brightness-125 transition-all group not-italic"
                        style={{ color: ACENTO }}
                    >
                        Iniciar sesión <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
