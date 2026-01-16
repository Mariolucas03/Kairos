import { Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import Header from './Header';
import Footer from './Footer';
import api from '../../services/api';
import RedemptionScreen from './RedemptionScreen';
import IosInstallPrompt from '../common/IosInstallPrompt';

export default function Layout() {
    const navigate = useNavigate();

    // 1. Inicialización Lazy del Estado
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('user');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error("Error parsing user data", e);
            return null;
        }
    });

    const [isUiHidden, setIsUiHidden] = useState(false);

    // 2. Sincronización con Backend
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Obtenemos /daily pero también pedimos /users/ para tener las notificaciones frescas
                const [dailyRes, userRes] = await Promise.all([
                    api.get('/daily'),
                    api.get('/users/') // Este endpoint trae requests
                ]);

                setUser((prevUser) => {
                    const safePrev = prevUser || {};
                    const updatedUser = {
                        ...safePrev,
                        ...(dailyRes.data.user || {}),
                        ...userRes.data, // Mezclamos datos frescos del usuario (notificaciones)
                        dailyLog: dailyRes.data
                    };

                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    return updatedUser;
                });
            } catch (error) {
                console.error("Error sincronizando:", error);
                if (error.response?.status === 401) {
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            }
        };

        const token = localStorage.getItem('token');
        if (token) fetchUserData();

    }, [navigate]);

    // 3. Callback para actualizar usuario
    const handleUserUpdate = useCallback((newData) => {
        setUser((prev) => {
            const updated = { ...prev, ...newData };
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // 4. Lógica de "Game Over"
    if (user?.stats?.hp <= 0 || user?.hp <= 0) {
        return <RedemptionScreen user={user} setUser={handleUserUpdate} />;
    }

    return (
        <div className="h-[100dvh] w-full bg-black text-zinc-200 font-sans relative flex flex-col overflow-hidden">

            {!isUiHidden && <Header user={user} setUser={handleUserUpdate} />}

            <main className={`flex-1 overflow-y-auto no-scrollbar w-full max-w-md mx-auto relative z-0 overscroll-contain ${isUiHidden ? 'pt-0 pb-0' : 'pt-28 pb-safe-content px-4'}`}>
                <Outlet context={{ user, setUser: handleUserUpdate, setIsUiHidden }} />
            </main>

            {/* 🔥 PASAMOS EL USUARIO AL FOOTER PARA LAS NOTIFICACIONES */}
            {!isUiHidden && <Footer user={user} />}

            <IosInstallPrompt />

        </div>
    );
}