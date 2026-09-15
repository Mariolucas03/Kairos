import { useState, useEffect } from 'react';
import useSWR from 'swr';
import api from '../services/api';
import { getMadridDateString } from '../utils/dateHelpers';

const fetcher = (url) => api.get(url).then(res => res.data);

/**
 * LA RACHA Y SU RECOMPENSA DIARIA.
 *
 * Una sola racha: los dias seguidos que entras y recoges. El camino (que dia
 * toca, que da cada dia, si hoy esta cobrado) lo manda el servidor en
 * GET /users/camino; aqui no hay ninguna tabla de premios que pueda quedarse
 * vieja. Antes habia una copia en utils/rewardsGenerator.js.
 */
export function useDailyRewards(user, setUser) {
    const [showRewardModal, setShowRewardModal] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [toast, setToast] = useState(null);
    // Lo que acaba de tocar, para enseñarlo en la ventana al recoger.
    const [premioRecogido, setPremioRecogido] = useState(null);

    const getTodayString = () => getMadridDateString();

    const { data: camino, mutate: recargarCamino } = useSWR(user ? '/users/camino' : null, fetcher, { revalidateOnFocus: true });

    const hasClaimedToday = () => {
        const dr = user?.dailyRewards;
        if (!dr) return false;
        const last = dr.lastClaimDay
            || (dr.lastClaimDate ? getMadridDateString(new Date(dr.lastClaimDate)) : null);
        return last === getTodayString();
    };

    const syncUser = (extra) => {
        if (!extra) return;
        setUser(prev => {
            const next = { ...prev, ...extra };
            localStorage.setItem('user', JSON.stringify(next));
            return next;
        });
    };

    // 1. Al entrar, si la de hoy esta sin recoger, se abre el camino.
    useEffect(() => {
        if (!user) return;
        const timer = setTimeout(() => {
            const sessionLock = sessionStorage.getItem(`reward_seen_${getTodayString()}`);
            if (!hasClaimedToday() && sessionLock !== 'true') {
                setPremioRecogido(null);
                setShowRewardModal(true);
            }
        }, 1500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?._id]);

    // 2. Recoger. El servidor decide el premio y lo cobra.
    const claimReward = async () => {
        if (claiming) return;
        setClaiming(true);
        sessionStorage.setItem(`reward_seen_${getTodayString()}`, 'true');
        try {
            const res = await api.post('/users/claim-daily');
            const { user: u, dailyRewards, streak, reward } = res.data;
            syncUser({ ...(u || {}), dailyRewards: dailyRewards || u?.dailyRewards, streak: streak || u?.streak });
            setPremioRecogido(reward || null);
            recargarCamino();
        } catch (error) {
            const data = error.response?.data;
            if (data?.alreadyClaimed) {
                syncUser({ dailyRewards: data.dailyRewards, streak: data.streak });
                setShowRewardModal(false);
                setToast({ message: data.message, type: 'info' });
                recargarCamino();
            } else {
                // Fallo de red o servidor despertando: no se silencia el aviso, para
                // que el premio no quede inaccesible hasta mañana.
                sessionStorage.removeItem(`reward_seen_${getTodayString()}`);
                setToast({ message: 'No se pudo recoger. Comprueba tu conexión e inténtalo de nuevo.', type: 'error' });
            }
        } finally {
            setClaiming(false);
        }
    };

    // 3. Abrir el camino desde el widget. Si la de hoy esta pendiente, se
    // puede recoger desde aqui.
    const openCalendar = () => {
        setPremioRecogido(null);
        recargarCamino();
        setShowRewardModal(true);
    };

    const closeModal = () => setShowRewardModal(false);

    return {
        showRewardModal,
        camino,
        premioRecogido,
        closeModal,
        claimReward,
        openCalendar,
        hasClaimedToday,
        claiming,
        toast,
        clearToast: () => setToast(null)
    };
}
