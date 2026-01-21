import { Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import Header from './Header';
import Footer from './Footer';
import api from '../../services/api';
import RedemptionScreen from './RedemptionScreen';
import IosInstallPrompt from '../common/IosInstallPrompt';
// 🔥 IMPORTAR EL CONTEXTO Y EL COMPONENTE DE ENTRENO
import { WorkoutProvider, useWorkout } from '../../context/WorkoutContext';
import ActiveWorkout from '../components/gym/ActiveWorkout';

// Componente interno para poder usar el hook useWorkout
function LayoutContent() {
    const navigate = useNavigate();
    const { activeRoutine, endWorkout } = useWorkout(); // <--- Traemos endWorkout también por si acaso

    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('user');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    const [isUiHidden, setIsUiHidden] = useState(false);

    // Función para actualizar datos del usuario (Monedas, XP, Nivel)
    const handleUserUpdate = useCallback((newData) => {
        setUser((prev) => {
            const updated = { ...prev, ...newData };
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Sincronización inicial con Backend
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
                    localStorage.removeItem('user'); localStorage.removeItem('token'); navigate('/login');
                }
            }
        };
        if (localStorage.getItem('token')) fetchUserData();
    }, [navigate]);

    // 🔥 MANEJADOR DE FIN DE RUTINA (LO QUE FALTABA)
    const handleWorkoutFinish = (data) => {
        // 1. Actualizamos el usuario con las nuevas monedas/XP ganadas
        if (data.user) {
            handleUserUpdate(data.user);
        }
        // 2. Si estamos en la página de Gym, forzamos recarga para ver el historial actualizado
        if (window.location.pathname === '/gym') {
            // Opcional: Podríamos usar un contexto para refrescar sin reload, 
            // pero reload es más seguro para limpiar estados.
            window.location.reload();
        }
    };

    if (user?.stats?.hp <= 0 || user?.hp <= 0) return <RedemptionScreen user={user} setUser={handleUserUpdate} />;

    return (
        <div className="h-[100dvh] w-full bg-black text-zinc-200 font-sans relative flex flex-col overflow-hidden">
            {!isUiHidden && <Header user={user} setUser={handleUserUpdate} />}

            <main className={`flex-1 overflow-y-auto no-scrollbar w-full max-w-md mx-auto relative z-0 overscroll-contain ${isUiHidden ? 'pt-0 pb-0' : 'pt-28 pb-safe-content px-4'}`}>
                <Outlet context={{ user, setUser: handleUserUpdate, setIsUiHidden }} />
            </main>

            {/* 🔥 EL ENTRENO GLOBAL VIVE AQUÍ */}
            {/* AÑADIDO: onFinish={handleWorkoutFinish} para evitar errores al terminar */}
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

// 🔥 EXPORTACIÓN PRINCIPAL CON EL PROVIDER
export default function Layout() {
    return (
        <WorkoutProvider>
            <LayoutContent />
        </WorkoutProvider>
    );
}