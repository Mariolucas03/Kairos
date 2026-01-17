import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, User, Mail, Lock, ArrowRight } from 'lucide-react';
import api from '../services/api';

export default function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({ username: '', email: '', password: '' });
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
            const response = await api.post('/auth/register', formData);

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data));

            navigate('/home', { replace: true });
        } catch (err) {
            const msg = err.response?.data?.message || 'Error al conectar con el servidor';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">

            {/* Fondo Decorativo (Azul/Cyan para registro) */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-600 via-blue-500 to-cyan-600 z-20"></div>
            <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black italic text-white tracking-tighter mb-1">
                        NUEVO RECLUTA
                    </h1>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">
                        Crear Expediente
                    </p>
                </div>

                <div className="bg-zinc-950 border border-white/10 rounded-[32px] p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-blue-500 blur-sm"></div>

                    <h2 className="text-xl font-black text-white uppercase italic mb-6 flex items-center gap-2">
                        <UserPlus size={20} className="text-blue-500" /> Registro
                    </h2>

                    {error && (
                        <div className="mb-6 p-3 bg-red-900/20 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold text-center animate-pulse">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Usuario */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-wide">Alias / Usuario</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-3.5 text-zinc-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input
                                    type="text"
                                    name="username"
                                    placeholder="Guerrero01"
                                    value={formData.username}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-white font-bold text-sm focus:border-blue-500 outline-none transition-all placeholder:text-zinc-700"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-wide">Correo</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 text-zinc-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="tu@email.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-white font-bold text-sm focus:border-blue-500 outline-none transition-all placeholder:text-zinc-700"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-zinc-500 uppercase ml-2 tracking-wide">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-3.5 text-zinc-600 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-12 text-white font-bold text-sm focus:border-blue-500 outline-none transition-all placeholder:text-zinc-700"
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
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl mt-6 uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? "Creando..." : "CONFIRMAR"}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-zinc-500 text-xs font-medium">
                        ¿Ya tienes cuenta?
                    </p>
                    <Link to="/login" className="text-blue-400 text-xs font-black uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-1 mt-2 group">
                        Inicia Sesión <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
}