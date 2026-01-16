import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Gamepad2 } from 'lucide-react';
import api from '../services/api';

export default function Login() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
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
            // 1. Petición al Backend
            const response = await api.post('/auth/login', formData);

            console.log('Login exitoso:', response.data);

            // 2. Guardar Token y Datos del Usuario en LocalStorage
            // Esto es CRUCIAL para que el Header sepa tu nivel y XP luego
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data));

            // 3. Redirigir al Dashboard principal
            navigate('/home');

        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || 'Error al iniciar sesión';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-950">

            {/* Logo / Header */}
            <div className="text-center mb-8">
                <div className="bg-blue-600 p-4 rounded-full inline-block mb-4 shadow-lg shadow-blue-500/30">
                    <Gamepad2 size={40} className="text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">NoteGymk</h1>
                <p className="text-gray-400 text-sm mt-1">Continúa tu progreso</p>
            </div>

            {/* Tarjeta de Login */}
            <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-6 text-center">Iniciar Sesión</h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-800 text-red-200 text-sm rounded-lg text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Email */}
                    <div>
                        <label className="block text-gray-400 text-xs uppercase font-bold mb-1 ml-1">Correo Electrónico</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="tu@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-600"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-gray-400 text-xs uppercase font-bold mb-1 ml-1">Contraseña</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-600"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-3.5 text-gray-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Botón Login */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all transform active:scale-95 shadow-lg shadow-blue-900/20 mt-2 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Entrando...
                            </span>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Entrar
                            </>
                        )}
                    </button>
                </form>

                {/* Footer Link */}
                <p className="mt-8 text-center text-gray-500 text-sm">
                    ¿No tienes cuenta?{' '}
                    <Link to="/register" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                        Crea una aquí
                    </Link>
                </p>
            </div>
        </div>
    );
}