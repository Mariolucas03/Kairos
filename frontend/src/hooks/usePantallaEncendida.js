import { useEffect } from 'react';

/**
 * MANTIENE LA PANTALLA ENCENDIDA.
 *
 * Entrenar con el móvil apoyado en el banco y que la pantalla se apague entre
 * serie y serie obliga a desbloquearlo con las manos ocupadas (o sudadas) veinte
 * veces por sesión. Es de las cosas que más queman de una app de gimnasio, y se
 * arregla con una línea del navegador.
 *
 * Detalles que importan:
 *
 *  - El permiso se PIERDE al minimizar la app o apagar la pantalla a mano. Por
 *    eso se vuelve a pedir cuando la pestaña se hace visible otra vez: sin esto,
 *    basta con mirar un mensaje de WhatsApp para quedarse sin el resto del
 *    entreno.
 *  - Se suelta solo al terminar (o al salir de la pantalla), para no dejar la
 *    batería del usuario secuestrada por la app en segundo plano.
 *  - Si el navegador no lo soporta —Safari en iOS tardó en tenerlo— no pasa
 *    nada: la app funciona igual, solo que la pantalla se apaga como siempre.
 *
 * @param {boolean} activo mientras sea true, la pantalla no se apaga
 */
export default function usePantallaEncendida(activo = true) {
    useEffect(() => {
        if (!activo) return;
        if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

        let bloqueo = null;
        let cancelado = false;

        const pedir = async () => {
            try {
                bloqueo = await navigator.wakeLock.request('screen');
            } catch {
                // El navegador puede negarlo (batería baja, por ejemplo). No es
                // un error que deba enterarse el usuario: se entrena igual.
            }
        };

        const alVolver = () => {
            if (!cancelado && document.visibilityState === 'visible') pedir();
        };

        pedir();
        document.addEventListener('visibilitychange', alVolver);

        return () => {
            cancelado = true;
            document.removeEventListener('visibilitychange', alVolver);
            if (bloqueo) bloqueo.release().catch(() => { });
        };
    }, [activo]);
}
