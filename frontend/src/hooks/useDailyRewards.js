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

    /**
     * En que dia del ciclo estas.
     *
     * ⚠️ SE CUENTA POR CALENDARIO, NO POR PREMIOS COBRADOS.
     *
     * Antes era `(claimedDays.length % 7) + 1`: el numero de premios que habias
     * recogido. El servidor, en cambio, lo cuenta por dias transcurridos desde
     * que empezo el ciclo. Mientras no fallas ningun dia las dos cuentas dan lo
     * mismo, asi que parecia correcto — pero en cuanto te saltas un dia se
     * separan para siempre:
     *
     *     ciclo empieza el lunes, hoy es jueves, cobraste lunes y martes
     *     servidor: dia 4 (han pasado tres dias)
     *     pantalla: dia 3 (has cobrado dos premios)
     *
     * Y a partir de ahi la ventana marcaba como "hoy" un dia que no era, los
     * huecos rojos caian donde no tocaba, y el premio que veias no era el que
     * te iban a dar. Se copia la cuenta del servidor, que es quien manda.
     *
     * Sin ciclo empezado —recien instalada, o ciclo terminado— es el dia 1.
     */
    const estadoDelCiclo = () => {
        const inicio = user?.dailyRewards?.cycleStartDay;
        if (!inicio) return { dia: 1, vivo: false };

        const transcurridos = Math.round(
            (new Date(getTodayString() + 'T00:00:00Z') - new Date(inicio + 'T00:00:00Z')) / 86400000
        );
        // Fuera de rango = el ciclo se cerro y hoy empieza uno nuevo, igual que
        // decide el servidor.
        const vivo = transcurridos >= 0 && transcurridos < 7;
        return { dia: vivo ? transcurridos + 1 : 1, vivo };
    };

    const buildRewardData = (overrides = {}) => {
        const { dia, vivo } = estadoDelCiclo();

        // ⚠️ Con el ciclo caducado, los premios cobrados eran del ANTERIOR.
        //
        // Enseñarlos pintaria en verde dias de esta semana que no has tocado. La
        // primera version comprobaba "es dia 1 y el 1 no esta cobrado", que falla
        // justo en el caso que queria cubrir: si el ciclo caduco HABIENDO cobrado
        // el dia 1, la lista vieja pasaba entera como si fuera de esta semana.
        // Lo que hay que mirar es si el ciclo sigue vivo, no que dias tiene.
        const cobrados = vivo ? (user?.dailyRewards?.claimedDays || []) : [];

        return {
            currentDay: dia,
            claimedDays: cobrados,
            rewardOfDay: getRewardForDay(dia),
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
