import useSWR from 'swr';
import api from '../services/api';

const fetcher = (url) => api.get(url).then(res => res.data);

/**
 * Avisos pendientes: solicitudes de amistad, invitaciones de misión, retos a
 * Carta Alta, mesas de póquer y actividad en tus publicaciones (me gusta y comentarios).
 *
 * Lo usan a la vez el footer (punto rojo en el icono de IG) y la cabecera del
 * feed (número sobre el buzón). Al compartir la misma clave de SWR se hace una
 * única petición aunque estén los dos en pantalla, y al marcar como leído se
 * refrescan los dos de golpe.
 */
export const BADGE_KEY = '/social/badge';

export default function useSocialBadge() {
    const { data, mutate } = useSWR(BADGE_KEY, fetcher, {
        refreshInterval: 60000,
        revalidateOnFocus: true
    });

    return {
        total: data?.total || 0,
        activity: data?.activity || 0,
        requests: data?.requests || 0,
        missions: data?.missions || 0,
        cartas: data?.cartas || 0,
        poker: data?.poker || 0,
        refreshBadge: mutate
    };
}
