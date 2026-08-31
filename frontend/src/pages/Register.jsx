import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, User, Mail, Lock, ArrowRight, FilePlus } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import PantallaAuth from '../components/auth/PantallaAuth';
import { CampoAuth, BotonAuth } from '../components/auth/CampoAuth';

const ACENTO = '#3b82f6'; // azul: diferencia el registro del login (oro)
const MAX_ALIAS = 8;      // el límite real que valida el backend

/**
 * Fuerza de la contraseña, para poder pintarla mientras se escribe.
 *
 * No bloquea nada —el backend es quien decide qué acepta—, pero decirlo AHORA
 * evita la única versión mala de esto: enterarte de que no vale después de
 * enviar el formulario y esperar al servidor.
 */
const fuerzaDe = (clave) => {
    if (!clave) return { nivel: 0, texto: '', color: '#3f3f46' };

    let puntos = 0;
    if (clave.length >= 6) puntos++;
    if (clave.length >= 10) puntos++;
    if (/[A-Z]/.test(clave) && /[a-z]/.test(clave)) puntos++;
    if (/\d/.test(clave)) puntos++;
    if (/[^A-Za-z0-9]/.test(clave)) puntos++;

    if (puntos <= 1) return { nivel: 1, texto: 'Muy débil', color: '#ef4444' };
    if (puntos === 2) return { nivel: 2, texto: 'Floja', color: '#f97316' };
    if (puntos === 3) return { nivel: 3, texto: 'Aceptable', color: '#eab308' };
    if (puntos === 4) return { nivel: 4, texto: 'Buena', color: '#84cc16' };
    return { nivel: 5, texto: 'Muy buena', color: '#22c55e' };
};

export default function Register() {
    const navigate = useNavigate();
    const setUser = useAuthStore(state => state.setUser);

    const [formData, setFormData] = useState({ username: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [exito, setExito] = useState(null);

    const temporizador = useRef(null);

    useEffect(() => {
        if (localStorage.getItem('token')) {
            navigate('/home', { replace: true });
        }
    }, [navigate]);

    useEffect(() => () => clearTimeout(temporizador.current), []);

    const fuerza = useMemo(() => fuerzaDe(formData.password), [formData.password]);

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
            setUser(response.data);

            setExito('Expediente creado');
            temporizador.current = setTimeout(
                () => navigate('/home', { replace: true }),
                750
            );
        } catch (err) {
            setError(err.response?.data?.message || 'Error al conectar con el servidor');
            setLoading(false);
        }
    };

    const letrasRestantes = MAX_ALIAS - formData.username.length;

    return (
        <PantallaAuth
            acento={ACENTO}
            icono={FilePlus}
            titulo="KAIROS"
            subtitulo="Alta de expediente"
            tarjetaIcono={UserPlus}
            tarjetaTitulo="Crear cuenta"
            error={error}
            exito={exito}
            pie={
                <>
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.08em] not-italic">
                        ¿Ya tienes expediente?
                    </p>
                    <Link
                        to="/login"
                        className="mt-2 inline-flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] hover:brightness-125 transition-all group not-italic"
                        style={{ color: ACENTO }}
                    >
                        Iniciar sesión
                        <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <CampoAuth
                    etiqueta="Alias"
                    icono={User}
                    acento={ACENTO}
                    nombre="username"
                    valor={formData.username}
                    onChange={handleChange}
                    placeholder="Guerrero"
                    maxLength={MAX_ALIAS}
                    autoComplete="username"
                    contador={
                        <span
                            className="text-[9px] font-black uppercase tracking-[0.1em] not-italic transition-colors"
                            style={{ color: letrasRestantes === 0 ? ACENTO : '#3f3f46' }}
                        >
                            {letrasRestantes === 0 ? 'Al límite' : `Máx. ${MAX_ALIAS}`}
                        </span>
                    }
                />

                <CampoAuth
                    etiqueta="Correo"
                    icono={Mail}
                    acento={ACENTO}
                    tipo="email"
                    nombre="email"
                    valor={formData.email}
                    onChange={handleChange}
                    placeholder="tu@email.com"
                    autoComplete="email"
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
                    autoComplete="new-password"
                >
                    {/* Medidor de fuerza. Aparece solo al empezar a escribir:
                        cinco rayas grises antes de tocar nada son ruido. */}
                    {formData.password && (
                        <div className="flex items-center gap-2 mt-2.5 px-1">
                            <div className="flex gap-1 flex-1">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <span
                                        key={n}
                                        className="h-[3px] flex-1 rounded-full transition-all duration-300"
                                        style={{
                                            background: n <= fuerza.nivel ? fuerza.color : '#27272a',
                                            transform: `scaleY(${n <= fuerza.nivel ? 1 : 0.6})`
                                        }}
                                    />
                                ))}
                            </div>
                            <span
                                className="text-[9px] font-black uppercase tracking-[0.1em] not-italic w-[68px] text-right transition-colors"
                                style={{ color: fuerza.color }}
                            >
                                {fuerza.texto}
                            </span>
                        </div>
                    )}
                </CampoAuth>

                <BotonAuth
                    cargando={loading}
                    acento={ACENTO}
                    colorTexto="#fff"
                    textoCargando="Creando..."
                >
                    Confirmar
                </BotonAuth>
            </form>
        </PantallaAuth>
    );
}
