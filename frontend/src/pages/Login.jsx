import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, Swords, UserCheck } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import PantallaAuth from '../components/auth/PantallaAuth';
import { CampoAuth, BotonAuth } from '../components/auth/CampoAuth';

const ACENTO = '#eab308'; // oro

export default function Login() {
    const navigate = useNavigate();
    const setUser = useAuthStore(state => state.setUser);

    const [formData, setFormData] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [exito, setExito] = useState(null);

    // Para poder cancelar el salto si la pantalla se desmonta antes de tiempo
    const temporizador = useRef(null);

    // Si ya hay sesión, salta el login
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

    useEffect(() => () => clearTimeout(temporizador.current), []);

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
                setUser(response.data);

                // Medio segundo de confirmación antes de saltar. Acertar la
                // contraseña y fallarla se sentían igual: la pantalla se quedaba
                // quieta hasta que cargaba la siguiente, que con el servidor
                // dormido son treinta segundos mirando un botón.
                setExito('Acceso concedido');
                temporizador.current = setTimeout(
                    () => navigate('/home', { replace: true }),
                    650
                );
                return;
            }

            setError('El servidor no devolvió las credenciales correctas.');
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Error de conexión. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PantallaAuth
            acento={ACENTO}
            icono={Swords}
            titulo="KAIROS"
            subtitulo="Sistema de acceso"
            tarjetaIcono={UserCheck}
            tarjetaTitulo="Identificarse"
            error={error}
            exito={exito}
            pie={
                <>
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.08em] not-italic">
                        ¿Aún no tienes expediente?
                    </p>
                    <Link
                        to="/register"
                        className="mt-2 inline-flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] hover:brightness-125 transition-all group not-italic"
                        style={{ color: ACENTO }}
                    >
                        Solicitar acceso
                        <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <CampoAuth
                    etiqueta="Usuario o alias"
                    icono={User}
                    acento={ACENTO}
                    nombre="username"
                    valor={formData.username}
                    onChange={handleChange}
                    placeholder="Guerrero01"
                    autoComplete="username"
                />

                <CampoAuth
                    etiqueta="Contraseña"
                    icono={Lock}
                    acento={ACENTO}
                    nombre="password"
                    valor={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    esClave
                    autoComplete="current-password"
                />

                <BotonAuth cargando={loading} acento={ACENTO} textoCargando="Autenticando...">
                    Entrar
                </BotonAuth>
            </form>
        </PantallaAuth>
    );
}
