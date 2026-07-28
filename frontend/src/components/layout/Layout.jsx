import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { preload, mutate } from 'swr';
import Header from './Header';
import Footer from './Footer';
import api from '../../services/api';
import RedemptionScreen from './RedemptionScreen';
import IosInstallPrompt from '../common/IosInstallPrompt';

const fetcher = (url) => api.get(url).then(res => res.data);

// Endpoints de las secciones principales. Se piden en segundo plano nada más
// entrar, así que cuando el usuario pulsa "Gym" o "Comida" los datos ya están
// en caché. Antes solo se precargaban los de Home, y por eso era la única
// sección que se sentía instantánea.
const SECTION_ENDPOINTS = [
    '/gym/routines',
    '/food/log',
    '/missions',
    '/social/feed?page=1',
    '/social/friends'
];

// Rutas que traen su propia cabecera y no necesitan la barra global encima
const CHROME_LESS_ROUTES = [/^\/social\/user\//, /^\/settings/];

// IMPORTS DEL NUEVO SISTEMA DE ENTRENO
import { WorkoutProvider, useWorkout } from '../../context/WorkoutContext';
import ActiveWorkout from '../../components/gym/ActiveWorkout';

// 🔥 IMPORTAMOS ZUSTAND
import { useAuthStore } from '../../store/useAuthStore';

function LayoutContent() {
    const navigate = useNavigate();
    const location = useLocation();
    const { activeRoutine, endWorkout } = useWorkout();

    // ⚡ Conexión directa al motor Zustand (Ultra rápido)
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const isUiHidden = useAuthStore(state => state.isUiHidden);
    const setIsUiHidden = useAuthStore(state => state.setIsUiHidden);
    const logout = useAuthStore(state => state.logout);

    // Sincronización con Backend
    // 🔥 Solo al montar el shell autenticado (login / recarga de página), NO en cada
    // cambio de sección. `navigate` de react-router cambia de identidad en cada
    // navegación, así que ponerlo en deps aquí causaba refetch de /daily y /users
    // (y por tanto una espera perceptible) cada vez que se cambiaba de pestaña.
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const [dailyRes, userRes] = await Promise.all([
                    api.get('/daily'),
                    api.get('/users/')
                ]);

                // Sembramos la caché de SWR con lo que acabamos de traer: así las
                // páginas que hacen useSWR('/daily') lo tienen ya listo en vez de
                // volver a pedirlo (antes /daily se pedía dos veces al entrar).
                mutate('/daily', dailyRes.data, false);

                // Actualizamos el estado global (Zustand lo guarda en localStorage en 2º plano)
                setUser({
                    ...user,
                    ...(dailyRes.data.user || {}),
                    ...userRes.data,
                    dailyLog: dailyRes.data
                });

                // Precarga en segundo plano del resto de secciones (sin bloquear nada)
                SECTION_ENDPOINTS.forEach(url => { preload(url, fetcher); });
            } catch (error) {
                if (error.response?.status === 401) {
                    logout();
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            }
        };
        if (localStorage.getItem('token')) fetchUserData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // MANEJADOR DE FIN DE RUTINA GLOBAL
    const handleWorkoutFinish = (data) => {
        if (data.user) {
            setUser(data.user);
        }
        endWorkout();
        if (location.pathname === '/gym') {
            window.location.reload();
        }
    };

    // 🛡️ Mantenemos el contextValue por compatibilidad para no romper páginas existentes (Gym, Social, etc)
    const contextValue = useMemo(() => ({
        user,
        setUser,
        setIsUiHidden
    }), [user, setUser, setIsUiHidden]);

    // Pantalla de Muerte
    if (user?.stats?.hp <= 0 || user?.hp <= 0) {
        return <RedemptionScreen user={user} setUser={setUser} />;
    }

    // La cabecera se oculta si una pantalla inmersiva la ha pedido (juegos, modales
    // a pantalla completa) o si la ruta ya trae su propia cabecera (perfil, ajustes).
    const routeHidesChrome = CHROME_LESS_ROUTES.some(re => re.test(location.pathname));
    const hideChrome = isUiHidden || routeHidesChrome;

    return (
        <div className="h-[100dvh] w-full bg-black text-zinc-200 font-sans relative flex flex-col overflow-hidden">

            {/* Ya no le pasamos el user como prop, el Header lo lee de Zustand */}
            {!hideChrome && <Header />}

            <main className={`flex-1 overflow-y-auto no-scrollbar w-full max-w-md mx-auto relative z-0 overscroll-contain ${isUiHidden ? 'pt-0 pb-0' : routeHidesChrome ? 'pt-0 pb-safe-content px-4' : 'pt-28 pb-safe-content px-4'}`}>
                {/* Pasamos el contexto memoizado a las páginas temporalmente */}
                <Outlet context={contextValue} />
            </main>

            {/* EL ENTRENO GLOBAL SE RENDERIZA AQUÍ */}
            {activeRoutine && (
                <ActiveWorkout
                    routine={activeRoutine}
                    onFinish={handleWorkoutFinish}
                />
            )}

            {/* El menú inferior sí se mantiene en el perfil: permite seguir navegando */}
            {!isUiHidden && <Footer />}
            <IosInstallPrompt />
        </div>
    );
}

export default function Layout() {
    return (
        <WorkoutProvider>
            <LayoutContent />
        </WorkoutProvider>
    );
}