import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './Header';
import Footer from './Footer';
import api from '../../services/api';
import RedemptionScreen from './RedemptionScreen';
import IosInstallPrompt from '../common/IosInstallPrompt';

// IMPORTS DEL NUEVO SISTEMA DE ENTRENO
import { WorkoutProvider, useWorkout } from '../../context/WorkoutContext';
import ActiveWorkout from '../../components/gym/ActiveWorkout';

function LayoutContent() {
    const navigate = useNavigate();
    const location = useLocation();
    const { activeRoutine, endWorkout } = useWorkout();

    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('user');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    const [isUiHidden, setIsUiHidden] = useState(false);

    // 🔥 1. useCallback: Evita que esta función se re-cree en cada render
    const handleUserUpdate = useCallback((newData) => {
        setUser((prev) => {
            const updated = { ...prev, ...newData };
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Sincronización con Backend
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const [dailyRes, userRes] = await Promise.all([
                    api.get('/daily'),
                    api.get('/users/')
                ]);
                setUser((prev) => {
                    const updated = { ...prev, ...(dailyRes.data.user || {}), ...userRes.data, dailyLog: dailyRes.data };
                    localStorage.setItem('user', JSON.stringify(updated));
                    return updated;
                });
            } catch (error) {
                if (error.response?.status === 401) {
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            }
        };
        if (localStorage.getItem('token')) fetchUserData();
    }, [navigate]);

    // MANEJADOR DE FIN DE RUTINA GLOBAL
    const handleWorkoutFinish = useCallback((data) => {
        if (data.user) {
            handleUserUpdate(data.user);
        }
        endWorkout();
        if (location.pathname === '/gym') {
            window.location.reload();
        }
    }, [handleUserUpdate, endWorkout, location.pathname]);

    // 🔥 2. useMemo: ESTA ES LA MAGIA. 
    // Mantiene el objeto de contexto intacto en memoria. 
    // Evita que TODAS las páginas hijas se re-rendericen innecesariamente.
    const contextValue = useMemo(() => ({
        user,
        setUser: handleUserUpdate,
        setIsUiHidden
    }), [user, handleUserUpdate]);

    // Pantalla de Muerte
    if (user?.stats?.hp <= 0 || user?.hp <= 0) {
        return <RedemptionScreen user={user} setUser={handleUserUpdate} />;
    }

    return (
        <div className="h-[100dvh] w-full bg-black text-zinc-200 font-sans relative flex flex-col overflow-hidden">

            {/* El Header SÍ debe actualizarse si cambian las monedas, por eso le pasamos el user directo */}
            {!isUiHidden && <Header user={user} setUser={handleUserUpdate} />}

            <main className={`flex-1 overflow-y-auto no-scrollbar w-full max-w-md mx-auto relative z-0 overscroll-contain ${isUiHidden ? 'pt-0 pb-0' : 'pt-28 pb-safe-content px-4'}`}>
                {/* Pasamos el contexto memoizado a las páginas */}
                <Outlet context={contextValue} />
            </main>

            {/* EL ENTRENO GLOBAL SE RENDERIZA AQUÍ */}
            {activeRoutine && (
                <ActiveWorkout
                    routine={activeRoutine}
                    onFinish={handleWorkoutFinish}
                />
            )}

            {!isUiHidden && <Footer user={user} />}
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