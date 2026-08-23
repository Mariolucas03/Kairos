import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, ArrowRight, Swords, UserCheck } from 'lucide-react';
import api from '../services/api';
// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../store/useAuthStore';

const ACENTO = '#eab308'; // oro

export default function Login() {
    const navigate = useNavigate();
    // 🔥 CONECTAMOS CON ZUSTAND
    const setUser = useAuthStore(state => state.setUser);

    const [formData, setFormData] = useState({ username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Qué campo está enfocado: el borde y el icono se tiñen del acento
    const [campoActivo, setCampoActivo] = useState(null);

    // 🔥 AUTO-REDIRECCIÓN: Si ya hay sesión, salta el login
    useEffect(() => {
        if (localStorage.getItem('token')) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);

    // Si la sesión se cortó por una suspensión, aquí es donde se dice. Echar a
    // alguien sin explicarle por qué solo genera un mensaje preguntando qué pasó.
    useEffect(() => {
        const motivo = localStorage.getItem('motivoBaneo');
        if (motivo) {
            setError(motivo);
            localStorage.removeItem('motivoBaneo');
        }
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            const response = await api.post('/auth/login', formData);

            if (response.data && response.data.token) {
                // Guardamos Token clásico para Axios
                localStorage.setItem('token', response.data.token);
                // 🔥 GUARDAMOS EN EL NUEVO CEREBRO (ZUSTAND)
                setUser(response.data);

                navigate('/home', { replace: true });
            } else {
                setError("El servidor no devolvió las credenciales correctas.");
            }

        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || 'Error de conexión. Intenta de nuevo.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Caja de campo: misma pieza para usuario y contraseña
    const claseCampo = (nombre) =>
        `w-full bg-black border rounded-[16px] py-[14px] text-white font-semibold text-sm outline-none transition-colors placeholder:text-zinc-700 ${campoActivo === nombre ? 'border-yellow-500/45' : 'border-white/[0.09]'}`;

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-10 select-none">
            <div className="w-full max-w-sm animate-in fade-in duration-300">

                {/* MARCA */}
                <div className="flex flex-col items-center mb-9">
                    <div
                        className="w-16 h-16 rounded-[20px] flex items-center justify-center border"
                        style={{ background: 'rgba(234,179,8,0.12)', borderColor: 'rgba(234,179,8,0.3)' }}
                    >
                        <Swords size={30} style={{ color: ACENTO }} />
                    </div>
                    <h1 className="mt-5 text-[40px] font-black text-white tracking-[-0.055em] leading-none not-italic">
                        KAIROS
                    </h1>
                    <p className="mt-3 text-[9px] font-black text-zinc-600 uppercase tracking-[0.24em] not-italic">
                        Sistema de acceso
                    </p>
                </div>

                {/* TARJETA DE ACCESO */}
                <div className="relative bg-[#0a0a0c] border border-white/[0.07] rounded-[28px] p-6 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${ACENTO}, transparent)` }} />
                    <div className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] opacity-[0.11] pointer-events-none" style={{ background: ACENTO }} />

                    <h2 className="relative z-10 text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] flex items-center gap-2 mb-6 not-italic">
                        <UserCheck size={16} style={{ color: ACENTO }} /> Identificarse
                    </h2>

                    {error && (
                        <div className="relative z-10 mb-5 p-3 bg-red-950/40 border border-red-500/30 rounded-2xl text-red-400 text-[11px] font-bold text-center not-italic">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
                        <div>
                            <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.14em] mb-2 not-italic">Usuario o alias</label>
                            <div className="relative">
                                <User
                                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                                    size={17}
                                    style={{ color: campoActivo === 'username' ? ACENTO : '#52525b' }}
                                />
                                <input
                                    type="text"
                                    name="username"
                                    placeholder="Guerrero01"
                                    value={formData.username}
                                    onChange={handleChange}
                                    onFocus={() => setCampoActivo('username')}
                                    onBlur={() => setCampoActivo(null)}
                                    required
                                    className={`${claseCampo('username')} pl-12 pr-4`}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-600 uppercase tracking-[0.14em] mb-2 not-italic">Contraseña</label>
                            <div className="relative">
                                <Lock
                                    className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                                    size={17}
                                    style={{ color: campoActivo === 'password' ? ACENTO : '#52525b' }}
                                />
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
                            className="w-full rounded-[18px] py-4 mt-6 font-black uppercase tracking-[0.16em] text-[12px] active:scale-[0.985] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed not-italic"
                            style={{ background: ACENTO, color: '#000' }}
                        >
                            {loading ? 'Autenticando...' : <>Entrar <ArrowRight size={18} strokeWidth={3} /></>}
                        </button>
                    </form>
                </div>

                {/* PIE */}
                <div className="mt-7 text-center">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.08em] not-italic">
                        ¿Aún no tienes expediente?
                    </p>
                    <Link
                        to="/register"
                        className="mt-2 inline-flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] hover:brightness-125 transition-all group not-italic"
                        style={{ color: ACENTO }}
                    >
                        Solicitar acceso <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
