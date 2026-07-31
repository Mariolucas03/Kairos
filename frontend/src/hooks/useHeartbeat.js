import { useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Avisa al servidor de que la app está abierta, para que tus amigos te vean
 * con el punto verde.
 *
 * Antes esto dependía de que la pantalla en la que estuvieras refrescara datos
 * por su cuenta: si te quedabas quieto en una sección sin sondeos, dejabas de
 * "existir" y aparecías desconectado con la app abierta.
 *
 * Late cada 3 minutos y SOLO con la app en primer plano (si está en segundo
 * plano no estás usándola, y a los 10 minutos pasas a desconectado, que es lo
 * que se quiere). Al volver a primer plano late de inmediato.
 */
const CADA = 3 * 60 * 1000;

export default function useHeartbeat(activo = true) {
    const ultimo = useRef(0);

    useEffect(() => {
        if (!activo) return;

        const latir = () => {
            if (document.visibilityState !== 'visible') return;
            // Evita latidos duplicados si coinciden el intervalo y un cambio de pestaña
            if (Date.now() - ultimo.current < 30000) return;
            ultimo.current = Date.now();
            api.post('/social/heartbeat').catch(() => { /* sin conexión: ya latirá luego */ });
        };

        latir();
        const id = setInterval(latir, CADA);
        document.addEventListener('visibilitychange', latir);

        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', latir);
        };
    }, [activo]);
}
