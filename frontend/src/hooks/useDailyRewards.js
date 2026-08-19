import { useState, useEffect } from 'react';
import api from '../services/api';
import { getRewardForDay } from '../utils/rewardsGenerator';
import { getMadridDateString } from '../utils/dateHelpers';

export function useDailyRewards(user, setUser) {
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [rewardData, setRewardData] = useState(null);
    const [claiming, setClaiming] = useState(false);
    const [toast, setToast] = useState(null);

    // 🔥 Mismo criterio de "día" que el backend (hora de Madrid, no UTC)
    const getTodayString = () => getMadridDateString();

    const hasClaimedToday = () => {
        const dr = user?.dailyRewards;
        if (!dr) return false;
        // Preferimos el día explícito que guarda el servidor; si es un usuario
        // antiguo sin ese campo, lo derivamos de la fecha.
        const last = dr.lastClaimDay
            || (dr.lastClaimDate ? getMadridDateString(new Date(dr.lastClaimDate)) : null);
        return last === getTodayString();
    };

    // Aplica al store el estado de recompensas que devuelve el servidor,
    // para que hasClaimedToday() deje de ofrecer un premio ya cobrado.
    const syncDailyRewards = (dailyRewards, extraUserData) => {
        if (!dailyRewards && !extraUserData) return;
        setUser(prev => {
            const next = {
                ...prev,
                ...(extraUserData || {}),
                dailyRewards: dailyRewards || extraUserData?.dailyRewards || prev?.dailyRewards
            };
            localStorage.setItem('user', JSON.stringify(next));
            return next;
        });
    };

    const buildRewardData = (overrides = {}) => {
        const streakLength = user?.dailyRewards?.claimedDays?.length || 0;
        const currentDayVisual = (streakLength % 7) + 1;
        return {
            currentDay: currentDayVisual,
            claimedDays: user?.dailyRewards?.claimedDays || [],
            rewardOfDay: getRewardForDay(currentDayVisual),
            ...overrides
        };
    };

    // 1. Chequeo automático al entrar
    useEffect(() => {
        if (!user) return;

        const checkDailyReward = () => {
            const todayLocal = getTodayString();
            // No molestamos en cada F5 del mismo día
            const sessionLock = sessionStorage.getItem(`reward_seen_${todayLocal}`);

            if (!hasClaimedToday() && sessionLock !== 'true') {
                setRewardData(buildRewardData({
                    message: '¡RECOMPENSA DIARIA!',
                    subMessage: '¡Nuevo día, nueva ganancia!',
                    buttonText: 'RECLAMAR AHORA',
                    isViewOnly: false
                }));
                setShowRewardModal(true);
            }
        };

        const timer = setTimeout(checkDailyReward, 1500); // Pequeño delay para UX
        return () => clearTimeout(timer);
    }, [user]);

    // 2. Acción: Reclamar
    const claimReward = async () => {
        if (claiming) return;
        setClaiming(true);

        // ⚠️ El modal se cierra YA, sin esperar al servidor.
        // Antes se esperaba a la respuesta para cerrarlo, y contra un Render
        // dormido eso son 30-50 segundos con el boton bloqueado: parecia que la
        // recompensa "tardaba en darse". El servidor sigue siendo quien decide
        // el premio y quien lo cobra; lo unico que se adelanta es cerrar la
        // ventana. Si falla, se vuelve a abrir mas abajo.
        setShowRewardModal(false);
        sessionStorage.setItem(`reward_seen_${getTodayString()}`, 'true');

        try {
            const res = await api.post('/users/claim-daily');
            syncDailyRewards(res.data.dailyRewards, res.data.user);

            const r = res.data.reward;
            if (r) {
                const parts = [];
                if (r.xp) parts.push(`+${r.xp} XP`);
                if (r.coins) parts.push(`+${r.coins} monedas`);
                if (r.gameCoins) parts.push(`+${r.gameCoins} fichas`);
                if (r.hp) parts.push(`+${r.hp} HP`);
                setToast({ message: parts.join(' · ') || '¡Recompensa reclamada!', type: 'success' });
            }
        } catch (error) {
            console.error('Error reclamando recompensa:', error);
            const data = error.response?.data;

            if (data?.alreadyClaimed) {
                // Caso legítimo: ya estaba cobrada (otra pestaña, doble clic...).
                // Sincronizamos para que el modal no vuelva a aparecer.
                syncDailyRewards(data.dailyRewards);
                sessionStorage.setItem(`reward_seen_${getTodayString()}`, 'true');
                setShowRewardModal(false);
                setToast({ message: data.message, type: 'info' });
            } else {
                // Error transitorio (red caida, servidor despertando en Render...).
                // Como el modal ya se cerro de forma optimista, hay que volver a
                // abrirlo: si no, el premio quedaria inaccesible hasta manana.
                sessionStorage.removeItem(`reward_seen_${getTodayString()}`);
                setShowRewardModal(true);
                setToast({ message: 'No se pudo reclamar. Comprueba tu conexión e inténtalo de nuevo.', type: 'error' });
            }
        } finally {
            setClaiming(false);
        }
    };

    // 3. Acción: abrir el calendario desde el botón de regalo.
    // 🔥 Si la recompensa de hoy sigue pendiente, este modal SÍ permite reclamarla.
    // Antes siempre era isViewOnly:true, así que si te perdías el popup automático
    // no había ninguna forma de cobrar el premio del día.
    const openCalendar = () => {
        const claimed = hasClaimedToday();
        setRewardData(buildRewardData({
            message: claimed ? 'Calendario de Premios' : '¡RECOMPENSA DIARIA!',
            subMessage: claimed ? '¡Ya has reclamado hoy!' : '¡Tienes recompensa pendiente!',
            buttonText: claimed ? 'CERRAR' : 'RECLAMAR AHORA',
            isViewOnly: claimed
        }));
        setShowRewardModal(true);
    };

    const closeModal = () => {
        // Cerrar sin reclamar no debe silenciar el aviso el resto del día:
        // si sigue pendiente, volverá a aparecer en la próxima visita.
        setShowRewardModal(false);
    };

    return {
        showRewardModal,
        rewardData,
        closeModal,
        claimReward,
        openCalendar,
        hasClaimedToday,
        claiming,
        toast,
        clearToast: () => setToast(null)
    };
}
