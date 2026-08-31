import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronRight as Flecha, MapPin, LogOut, Settings, Flame, Zap, CalendarCheck } from 'lucide-react';
import useSWR from 'swr';
import api from '../services/api';
import LoadingScreen from '../components/common/LoadingScreen';

import RPGBody from '../components/profile/RPGBody';
// Las graficas usan recharts, que son 338 kB: mas que el resto de la app junta.
// Cargandolo aparte, el perfil ABRE al momento y la grafica aparece un instante
// despues, en vez de dejar la pantalla en blanco esperando a la libreria.
const ProfileStats = lazy(() => import('../components/profile/ProfileStats'));
const MapaActividad = lazy(() => import('../components/profile/MapaActividad'));

import { getMadridDateString } from '../utils/dateHelpers';
import { useAuthStore } from '../store/useAuthStore';

const fetcher = url => api.get(url).then(r => r.data);

/**
 * PERFIL — quién eres y cómo vas.
 *
 * Tres bloques y nada más: quién eres, tu progreso, y tu actividad. Al final,
 * la cuenta.
 *
 * ⚠️ Aquí vivía un cuarto bloque, "Registro del día": el calendario elegía una
 * fecha y debajo se pintaban los once widgets de esa fecha. Era una SEGUNDA
 * copia del viaje en el tiempo que ya tiene Inicio (su botón de calendario hace
 * exactamente eso), pero apagada: los widgets se pintaban sin poder tocarlos.
 * Dos sitios para lo mismo, y el bueno era el otro.
 *
 * Ahora el calendario de aquí lleva a Inicio en ese día. Se mira dónde estuviste
 * activo, se toca un día, y se ve donde de verdad se ve. De paso el perfil se
 * queda sin once widgets, sin dnd-kit y sin la consulta del día: abre antes.
 */

const Seccion = ({ titulo, children, className = '' }) => (
    <section className={`mb-7 ${className}`}>
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 pl-2">{titulo}</h3>
        {children}
    </section>
);

const CargandoGrafica = ({ alto = 180 }) => (
    <div className="w-full rounded-[24px] bg-[#0a0a0c] border border-white/[0.07] animate-pulse" style={{ height: alto }} />
);

/** Una cifra de la cabecera. */
const Cifra = ({ icono: Icono, valor, etiqueta, color }) => (
    <div className="flex-1 min-w-0 bg-[#0a0a0c] border border-white/[0.07] rounded-2xl py-2.5 text-center">
        <Icono size={12} className={`${color} mx-auto`} />
        <p className="text-base font-black text-white mt-1 leading-none truncate px-1">{valor}</p>
        <p className="text-[8px] text-zinc-600 uppercase tracking-wide mt-1 truncate px-1">{etiqueta}</p>
    </div>
);

/** Fila que lleva a otro sitio. */
const Enlace = ({ icono: Icono, titulo, pie, onClick, className = '', tono = 'text-zinc-400' }) => (
    <button
        onClick={onClick}
        className={`w-full bg-[#0a0a0c] border border-white/[0.07] rounded-[24px] p-4 flex items-center gap-4 active:scale-[0.99] transition-transform ${className}`}
    >
        <div className={`p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 ${tono} shrink-0`}>
            <Icono size={18} />
        </div>
        <div className="flex-1 min-w-0 text-left">
            <p className="font-bold text-sm text-white truncate">{titulo}</p>
            {pie && <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{pie}</p>}
        </div>
        <Flecha size={18} className="text-zinc-600 shrink-0" />
    </button>
);

export default function Profile() {
    const user = useAuthStore(state => state.user);
    const logout = useAuthStore(state => state.logout);
    const navigate = useNavigate();

    const [calendarViewDate, setCalendarViewDate] = useState(new Date());
    const [openStrength, setOpenStrength] = useState(false);

    // Misma clave que usa el mapa de constancia, así que SWR reaprovecha su
    // respuesta y esto no cuesta ni una petición más.
    const { data: actividad } = useSWR('/daily/actividad?dias=182', fetcher);

    /**
     * ⚠️ TIENE que pasar por logout() del store, no por setUser(null).
     *
     * SWR guarda su cache en localStorage para que la app no abra en blanco
     * mientras Render despierta, y ahi dentro hay datos de verdad: misiones,
     * comida, rutinas, amigos, tienda. El store ya tiene un logout() que la
     * tira, y Ajustes lo usaba... pero AQUI se hacia a mano con setUser(null),
     * asi que salir desde el perfil dejaba trece claves con los datos del
     * anterior en el movil. El siguiente que entrara los veia un instante,
     * antes de que cada pantalla revalidara.
     */
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        logout();
        navigate('/login');
    };

    const renderCalendar = () => {
        const getDaysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const getFirstDay = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), 1).getDay(); return x === 0 ? 6 : x - 1; };
        const daysInMonth = getDaysInMonth(calendarViewDate);
        const firstDay = getFirstDay(calendarViewDate);
        const days = [];
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        // Días en los que hiciste algo, para marcarlos en el calendario. Sin
        // esto hay que ir tocando días a ciegas para encontrar uno con datos.
        const activos = new Set((actividad?.mapa || []).map(d => d.fecha));

        for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} className="h-9 w-9"></div>);
        for (let i = 1; i <= daysInMonth; i++) {
            const dStr = `${calendarViewDate.getFullYear()}-${String(calendarViewDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isToday = getMadridDateString() === dStr;
            const isFuture = new Date(dStr) > new Date();
            const tuvoActividad = activos.has(dStr);

            days.push(
                <button
                    key={i}
                    onClick={() => !isFuture && navigate('/home?dia=' + dStr)}
                    disabled={isFuture}
                    title={isFuture ? '' : 'Ver este día en Inicio'}
                    className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all relative ${
                        isToday
                            ? 'bg-yellow-500 text-black border border-yellow-400'
                            : isFuture
                                ? 'text-zinc-700 cursor-not-allowed'
                                : tuvoActividad
                                    ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/25 hover:bg-yellow-500/20'
                                    : 'text-zinc-600 hover:bg-zinc-800 hover:text-white'
                    }`}
                >
                    {i}
                </button>
            );
        }

        return (
            <div className="bg-[#0a0a0c] border border-white/[0.07] p-5 rounded-[24px] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 bg-yellow-500 blur-3xl rounded-full w-40 h-40 -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex justify-between items-center mb-4 relative z-10">
                    <button onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-zinc-800"><ChevronLeft size={16} /></button>
                    <span className="text-white font-black uppercase tracking-wider text-sm">{monthNames[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}</span>
                    <button onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-zinc-800"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-2">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <span key={d} className="text-[10px] font-bold text-zinc-600">{d}</span>)}</div>
                <div className="grid grid-cols-7 gap-1 place-items-center relative z-10">{days}</div>
                <p className="mt-4 pt-4 border-t border-zinc-800 text-center text-[10px] text-zinc-600 relative z-10">
                    En amarillo, los días que hiciste algo. Toca uno para verlo en Inicio.
                </p>
            </div>
        );
    };

    if (!user) return <LoadingScreen message="Cargando perfil..." />;

    const xpActual = user?.currentXP ?? 0;
    const xpNecesario = user?.nextLevelXP || 100;
    const porcentajeXP = Math.max(0, Math.min(100, (xpActual / xpNecesario) * 100));

    return (
        <div className="pb-24 pt-4 px-4 min-h-screen animate-in fade-in select-none bg-black">

            {/* QUIÉN ERES */}
            <div className="mb-5">
                <div className="flex items-center gap-4 px-1">
                    <div className="w-16 h-16 rounded-full bg-[#0a0a0c] border border-white/[0.07] flex items-center justify-center text-xl font-black text-zinc-500 overflow-hidden shrink-0">
                        {user?.avatar
                            ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                            : (user?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter not-italic truncate leading-none">
                            {user?.username || '—'}
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mt-1.5">
                            {user?.title || 'Novato'}
                        </p>
                        {/* Cuánto te falta para el siguiente nivel. Estaba en la
                            cabecera de la app, pero no en tu propio perfil. */}
                        <div className="mt-2">
                            <div className="h-1 w-full bg-[#18181b] rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500 rounded-full transition-all duration-500" style={{ width: porcentajeXP + '%' }} />
                            </div>
                            <p className="text-[9px] text-zinc-600 mt-1 font-bold">{xpActual} / {xpNecesario} XP</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-4">
                    <Cifra icono={Zap} valor={user?.level ?? 1} etiqueta="Nivel" color="text-yellow-500" />
                    <Cifra icono={Flame} valor={user?.streak?.current ?? 0} etiqueta="Racha" color="text-orange-500" />
                    <Cifra
                        icono={CalendarCheck}
                        valor={actividad?.activos ?? '—'}
                        etiqueta="Días activos"
                        color="text-green-500"
                    />
                </div>
            </div>

            <Seccion titulo="Tu progreso">
                <div className="space-y-3">
                    <Suspense fallback={<CargandoGrafica alto={140} />}><ProfileStats mini={true} onClick={() => setOpenStrength(true)} /></Suspense>
                    <Suspense fallback={<CargandoGrafica alto={190} />}><MapaActividad /></Suspense>

                    {/* El mapa muscular era una tarjeta bloqueada con un candado
                        que decía "se ve en la pestaña Cuerpo del Gym": 160 px
                        que no llevaban a ninguna parte y había que ir a buscarlo
                        a mano. Ahora es el botón que te lleva. */}
                    <button
                        onClick={() => navigate('/gym?tab=body')}
                        className="relative w-full h-[130px] rounded-[24px] overflow-hidden border border-white/[0.07] bg-zinc-950 active:scale-[0.99] transition-transform"
                    >
                        <div className="absolute inset-0 opacity-20 pointer-events-none"><RPGBody mini={true} /></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/30 flex items-center justify-between px-5">
                            <div className="text-left">
                                <span className="text-white font-black text-sm uppercase tracking-wide flex items-center gap-2">
                                    <MapPin size={14} className="text-yellow-500" /> Mapa muscular
                                </span>
                                <span className="block text-[10px] text-zinc-400 mt-1">Qué grupos llevas fuertes y cuáles no</span>
                            </div>
                            <Flecha size={18} className="text-zinc-500 shrink-0" />
                        </div>
                    </button>
                </div>
            </Seccion>

            <Seccion titulo="Tu actividad">
                {renderCalendar()}
            </Seccion>

            <Seccion titulo="Cuenta" className="border-t border-white/[0.07] pt-6">
                <div className="space-y-2">
                    {/* Ajustes solo se alcanzaba tocando tu avatar de la barra de
                        arriba, que no lo parece. Desde el perfil es donde se va
                        a buscar. */}
                    <Enlace
                        icono={Settings}
                        titulo="Ajustes"
                        pie="Privacidad, tu descripción y tus datos"
                        onClick={() => navigate('/settings')}
                    />
                    <button
                        onClick={handleLogout}
                        className="w-full bg-red-950/20 border border-red-900/30 text-red-500 p-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm hover:bg-red-900/40 transition-all active:scale-95"
                    >
                        <LogOut size={18} /> Cerrar sesión
                    </button>
                </div>
                {/* El identificador solo sirve para dar soporte ("mándame tu ID"),
                    así que se queda pero en pequeño y sin gritar. */}
                <p className="text-center text-[9px] text-zinc-800 mt-4 font-mono select-text">{user?._id}</p>
            </Seccion>

            {openStrength && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="w-full max-w-2xl relative z-10">
                        <Suspense fallback={<CargandoGrafica alto={320} />}>
                            <ProfileStats onCloseExternal={() => setOpenStrength(false)} />
                        </Suspense>
                    </div>
                </div>
            )}
        </div>
    );
}
