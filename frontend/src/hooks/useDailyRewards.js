import { useState, useEffect } from 'react';
import api from '../services/api';
import { getRewardForDay } from '../utils/rewardsGenerator';

export function useDailyRewards(user, setUser) {
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [rewardData, setRewardData] = useState(null);
    const [claiming, setClaiming] = useState(false);
    const [toast, setToast] = useState(null);

    // Helpers de fecha
    const getTodayString = () => new Date().toISOString().split('T')[0];

    const hasClaimedToday = () => {
        if (!user?.dailyRewards?.lastClaimDate) return false;
        const last = new Date(user.dailyRewards.lastClaimDate).toISOString().split('T')[0];
        return last === getTodayString();
    };

    // 1. Chequeo Automático al entrar
    useEffect(() => {
        if (!user) return;

        const checkDailyReward = () => {
            const todayLocal = getTodayString();

            // Check LocalStorage para no molestar en cada F5
            const sessionLock = sessionStorage.getItem(`reward_seen_${todayLocal}`);

            if (!hasClaimedToday() && sessionLock !== 'true') {
                const streakLength = user.dailyRewards?.claimedDays?.length || 0;
                const currentDayVisual = (streakLength % 7) + 1;

                setRewardData({
                    currentDay: currentDayVisual,
                    claimedDays: user.dailyRewards?.claimedDays || [],
                    rewardOfDay: getRewardForDay(currentDayVisual),
                    message: "¡RECOMPENSA DIARIA!",
                    subMessage: "¡Nuevo día, nueva ganancia!",
                    buttonText: "RECLAMAR AHORA",
                    isViewOnly: false
                });
                setShowRewardModal(true);
            }
        };

        const timer = setTimeout(checkDailyReward, 1500); // Pequeño delay para UX
        return () => clearTimeout(timer);
    }, [user]);

    // 2. Acción: Reclamar
    const claimReward = async () => {
        if (claiming) return; // Evita doble-clic / doble submit
        setClaiming(true);
        try {
            const res = await api.post('/users/claim-daily');
            const updatedUser = { ...user, ...res.data.user };

            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Bloquear popup por hoy
            sessionStorage.setItem(`reward_seen_${getTodayString()}`, 'true');
            setShowRewardModal(false);
        } catch (error) {
            console.error("Error reclamando recompensa:", error);
            const backendMessage = error.response?.data?.message;

            if (error.response?.status === 400 && backendMessage) {
                // Caso legítimo (ej. ya reclamada hoy): no hay nada que reintentar
                sessionStorage.setItem(`reward_seen_${getTodayString()}`, 'true');
                setShowRewardModal(false);
                setToast({ message: backendMessage, type: 'info' });
            } else {
                // Error transitorio (red caída, servidor despertando, etc.)
                // Dejamos el modal abierto para que pueda reintentar sin perder el premio.
                setToast({ message: 'No se pudo reclamar la recompensa. Comprueba tu conexión e inténtalo de nuevo.', type: 'error' });
            }
        } finally {
            setClaiming(false);
        }
    };

    // 3. Acción: Ver Calendario Manualmente
    const openCalendar = () => {
        const currentStreak = (user?.dailyRewards?.claimedDays?.length % 7) + 1;
        setRewardData({
            currentDay: currentStreak,
            claimedDays: user?.dailyRewards?.claimedDays || [],
            rewardOfDay: getRewardForDay(currentStreak),
            message: "Calendario de Premios",
            subMessage: hasClaimedToday() ? "¡Ya has reclamado hoy!" : "¡Tienes recompensa pendiente!",
            buttonText: "CERRAR",
            isViewOnly: true
        });
        setShowRewardModal(true);
    };

    return {
        showRewardModal,
        rewardData,
        closeModal: () => setShowRewardModal(false),
        claimReward,
        openCalendar,
        hasClaimedToday,
        claiming,
        toast,
        clearToast: () => setToast(null)
    };
}
