import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import Header from './Header';
import Footer from './Footer';
import api from '../../services/api';
import RedemptionScreen from './RedemptionScreen';
import IosInstallPrompt from '../common/IosInstallPrompt';

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
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const [dailyRes, userRes] = await Promise.all([
                    api.get('/daily'),
                    api.get('/users/')
                ]);

                // Actualizamos el estado global (Zustand lo guarda en localStorage en 2º plano)
                setUser({
                    ...user,
                    ...(dailyRes.data.user || {}),
                    ...userRes.data,
                    dailyLog: dailyRes.data
                });
            } catch (error) {
                if (error.response?.status === 401) {
                    logout();
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            }
        };
        if (localStorage.getItem('token')) fetchUserData();
    }, [navigate]);

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

    return (
        <div className="h-[100dvh] w-full bg-black text-zinc-200 font-sans relative flex flex-col overflow-hidden">

            {/* Ya no le pasamos el user como prop, el Header lo lee de Zustand */}
            {!isUiHidden && <Header />}

            <main className={`flex-1 overflow-y-auto no-scrollbar w-full max-w-md mx-auto relative z-0 overscroll-contain ${isUiHidden ? 'pt-0 pb-0' : 'pt-28 pb-safe-content px-4'}`}>
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

            {/* Ya no le pasamos el user como prop */}
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