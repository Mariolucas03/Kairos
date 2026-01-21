import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Lock, User, ArrowRight } from 'lucide-react'; // Usamos icono User
import api from '../services/api';

export default function Login() {
    const navigate = useNavigate();

    // 1. Estado inicial con USERNAME
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data));
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

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">

            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 z-20"></div>
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-yellow-600/10 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="w-full max-w-sm relative z-10 animate-in fade-in zoom-in duration-500">

                <div className="text-center mb-10">
                    <h1 className="text-5xl font-black italic text-white tracking-tighter mb-1">
                        KAIROS
                    </h1>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">
                        Sistema de Acceso
                    </p>
                </div>

                <div className="bg-zinc-950 border border-white/10 rounded-[32px] p-6 shadow-2xl relative overflow-hidden">

                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-yellow-500 blur-sm"></div>

                    <h2 className="text-xl font-black text-white uppercase italic mb-6 flex items-center gap-2">
                        <Lock size={20} className="text-yellow-500" /> Identificarse
                    </h2>

                    {error && (
                        <div className="mb-6 p-3 bg-red-900/20 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold text-center animate-pulse">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 2. CAMPO USUARIO (En vez de Email) */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-wide">Usuario / Alias</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-3.5 text-zinc-600 group-focus-within:text-yellow-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    name="username"
                                    placeholder="Guerrero01"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-white font-bold text-sm focus:border-yellow-500 outline-none transition-all placeholder:text-zinc-700"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-wide">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-3.5 text-zinc-600 group-focus-within:text-yellow-500 transition-colors" size={18} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-12 text-white font-bold text-sm focus:border-yellow-500 outline-none transition-all placeholder:text-zinc-700"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-3.5 text-zinc-600 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-2xl mt-6 uppercase tracking-widest shadow-lg shadow-yellow-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="animate-pulse">Autenticando...</span>
                            ) : (
                                <>Entrar <LogIn size={20} /></>
                            )}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-zinc-500 text-xs font-medium">
                        ¿No tienes credenciales?
                    </p>
                    <Link to="/register" className="text-yellow-500 text-xs font-black uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-1 mt-2 group">
                        Solicitar Acceso <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
}