import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, User, Mail, Lock, ArrowRight, FilePlus, ChevronLeft, Check } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import PantallaAuth from '../components/auth/PantallaAuth';
import { CampoAuth } from '../components/auth/CampoAuth';
import BarraDeAcceso from '../components/auth/BarraDeAcceso';
import BodyMap from '../components/body/BodyMap';

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

    const [formData, setFormData] = useState({ username: '', email: '', password: '', gender: '' });
    // CREAR EL PERSONAJE, EN TRES PASOS: el nombre, el cuerpo, la llave.
    // Un formulario de tres campos y un boton es dar de alta un expediente;
    // esto es empezar un juego.
    const [paso, setPaso] = useState(0);
    const [pulso, setPulso] = useState(0);
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

    const siguiente = () => {
        setError(null);
        if (paso === 0) {
            if (formData.username.trim().length < 3) { setError('El nombre tiene que tener al menos 3 letras.'); return; }
            setPaso(1);
        } else if (paso === 1) {
            if (!formData.gender) { setError('Elige tu cuerpo: es el que se va a ir pintando.'); return; }
            setPaso(2);
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        if (paso < 2) { siguiente(); return false; }
        if (loading) return false;
        if (!formData.email.trim() || !formData.password) { setError('Falta el correo o la contraseña.'); return false; }
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
            subtitulo="Nuevo personaje"
            tarjetaIcono={UserPlus}
            tarjetaTitulo={paso === 0 ? 'Tu nombre' : paso === 1 ? 'Tu cuerpo' : 'Tu llave'}
            error={error}
            exito={exito}
            pulso={pulso}
            nombre={formData.username}
            mujer={formData.gender || null}
            construido={(formData.username.trim().length >= 3 ? 0.34 : 0) + (formData.gender ? 0.33 : 0) + (formData.email && formData.password ? 0.33 : 0)}
            etiquetaAvatar="Construyendo"
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
                {/* Donde estas: tres marcas */}
                <div className="flex items-center gap-1.5 mb-1">
                    {['Nombre', 'Cuerpo', 'Llave'].map((t, i) => (
                        <div key={t} className="flex-1">
                            <div className="h-[3px] rounded-full transition-colors" style={{ background: i <= paso ? ACENTO : '#27272a' }} />
                            <p className="text-[8px] font-black uppercase tracking-[0.14em] mt-1 not-italic" style={{ color: i === paso ? ACENTO : '#52525b' }}>{t}</p>
                        </div>
                    ))}
                </div>

                {paso === 0 && (
                    <div className="auth-entra">
                        <p className="text-[12px] text-zinc-400 font-medium mb-4 leading-snug">Empieza por lo primero: ¿cómo te van a conocer en Kairos?</p>
                        <CampoAuth
                            etiqueta="Tu nombre de personaje"
                            icono={User}
                            acento={ACENTO}
                            nombre="username"
                            valor={formData.username}
                            onChange={handleChange}
                            placeholder="Guerrero"
                            maxLength={MAX_ALIAS}
                            autoComplete="username"
                            onEnfocar={() => setPulso(p => p + 1)}
                            contador={
                                <span
                                    className="text-[9px] font-black uppercase tracking-[0.1em] not-italic transition-colors"
                                    style={{ color: letrasRestantes === 0 ? ACENTO : '#3f3f46' }}
                                >
                                    {letrasRestantes === 0 ? 'Al límite' : `Máx. ${MAX_ALIAS}`}
                                </span>
                            }
                        />
                    </div>
                )}

                {paso === 1 && (
                    <div className="auth-entra">
                        <p className="text-[12px] text-zinc-400 font-medium mb-3 leading-snug">
                            Este es el cuerpo que se va a ir pintando músculo a músculo según entrenes. Elige el tuyo.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {[['male', 'Hombre'], ['female', 'Mujer']].map(([valor, nombre]) => {
                                const elegido = formData.gender === valor;
                                return (
                                    <button
                                        key={valor}
                                        type="button"
                                        onClick={() => { setFormData({ ...formData, gender: valor }); setError(null); }}
                                        className="relative rounded-2xl border p-2 pt-3 transition-all active:scale-[0.98]"
                                        style={{ borderColor: elegido ? ACENTO : 'rgba(255,255,255,0.09)', background: elegido ? ACENTO + '14' : 'rgba(0,0,0,0.5)' }}
                                    >
                                        <div className="h-40 pointer-events-none">
                                            <BodyMap mujer={valor === 'female'} showToggle={false} labels={false} highlight={elegido ? ['Pecho', 'Pierna', 'Hombro', 'Bíceps', 'Abdomen'] : []} accent={ACENTO} />
                                        </div>
                                        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.14em] not-italic" style={{ color: elegido ? ACENTO : '#a1a1aa' }}>{nombre}</p>
                                        {elegido && (
                                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: ACENTO }}>
                                                <Check size={12} strokeWidth={3.5} className="text-black" />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {paso === 2 && (
                    <div className="auth-entra space-y-4">
                        <p className="text-[12px] text-zinc-400 font-medium leading-snug">
                            Lo último: la llave de <span className="text-white font-black">{formData.username}</span>.
                        </p>
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
                            onEnfocar={() => setPulso(p => p + 1)}
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
                            onEnfocar={() => setPulso(p => p + 1)}
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
                    </div>
                )}

                {paso < 2 ? (
                    <div className="flex items-center gap-2 pt-2">
                        {paso > 0 && (
                            <button type="button" onClick={() => { setPaso(paso - 1); setError(null); }} aria-label="Atrás" className="w-12 h-12 rounded-2xl border border-white/[0.09] bg-black/60 text-zinc-400 flex items-center justify-center active:scale-95 transition-transform">
                                <ChevronLeft size={18} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={siguiente}
                            className="flex-1 h-12 rounded-2xl font-black uppercase tracking-[0.16em] text-[12px] text-white flex items-center justify-center gap-2 active:scale-[0.985] transition-transform not-italic textura-metal"
                            style={{ backgroundColor: ACENTO, boxShadow: '0 6px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)' }}
                        >
                            Siguiente <ArrowRight size={16} strokeWidth={3} />
                        </button>
                    </div>
                ) : (
                    <>
                        <BarraDeAcceso
                            acento={ACENTO}
                            cargando={loading}
                            etiqueta="Levanta para forjar"
                            textoCargando="Forjando…"
                            onCompletar={() => handleSubmit()}
                        />
                        <button type="button" onClick={() => { setPaso(1); setError(null); }} className="w-full text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 mt-1 not-italic flex items-center justify-center gap-1">
                            <ChevronLeft size={12} /> Cambiar el cuerpo
                        </button>
                    </>
                )}
            </form>
        </PantallaAuth>
    );
}
