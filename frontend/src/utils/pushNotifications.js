import api from '../services/api';

// Clave publica VAPID. TIENE que ser la pareja de la VAPID_PRIVATE_KEY del
// servidor: si no coinciden, el navegador se suscribe pero el envio falla.
//
// Se lee de VITE_VAPID_PUBLIC_KEY para poder rotar las claves sin tocar codigo.
// El valor de abajo es el que habia fijo, y queda como respaldo para no romper
// los despliegues que aun no definan la variable.
const VAPID_PUBLIC_KEY =
    import.meta.env.VITE_VAPID_PUBLIC_KEY ||
    "BHuNNV8fKxiIeIuObGJTavYPhf1G1Kpj4LN1TTCnaowLlmEJH6edktAmF0CcU5sZhpQZ5JxqzIK0qQ5sVSwmCuQ";

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Activa las notificaciones en ESTE dispositivo.
 *
 * ⚠️ Antes devolvia solo true/false, asi que cuando no funcionaba no habia
 * forma de saber por que: navegador sin soporte, permiso denegado, iPhone sin
 * instalar en pantalla de inicio, clave que no cuadra... Ahora devuelve el
 * motivo, que es lo unico que permite arreglarlo sin adivinar.
 *
 * @returns {Promise<{ok: boolean, motivo?: string, mensaje: string}>}
 */
export const registerPush = async () => {
    if (!('serviceWorker' in navigator)) {
        return { ok: false, motivo: 'sin-sw', mensaje: 'Este navegador no soporta service workers.' };
    }
    if (!('PushManager' in window)) {
        // Caso tipico de iPhone: en Safari normal no hay PushManager; solo
        // aparece si la app esta instalada en la pantalla de inicio.
        const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        return {
            ok: false,
            motivo: 'sin-push',
            mensaje: esIOS
                ? 'En iPhone hay que instalar la app: Compartir → Añadir a pantalla de inicio, y abrirla desde ahí.'
                : 'Este navegador no soporta notificaciones push.'
        };
    }

    try {
        // 1. Permiso explicito. `subscribe()` lo pide de forma implicita, pero
        //    entonces un "denegado" llega como una excepcion generica.
        const permiso = await Notification.requestPermission();
        if (permiso !== 'granted') {
            return {
                ok: false,
                motivo: 'permiso',
                mensaje: permiso === 'denied'
                    ? 'Has bloqueado las notificaciones. Hay que permitirlas en los ajustes del navegador para este sitio.'
                    : 'No se concedio el permiso de notificaciones.'
            };
        }

        // 2. Service worker listo
        const register = await navigator.serviceWorker.register('/service-worker.js');
        await navigator.serviceWorker.ready;

        // 3. Reaprovechar la suscripcion si ya existe; si la clave del servidor
        //    ha cambiado hay que tirar la vieja o el envio fallara para siempre.
        const existente = await register.pushManager.getSubscription();
        if (existente) await existente.unsubscribe();

        const subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        // 4. Guardarla en el servidor
        const res = await api.post('/push/subscribe', subscription);

        if (res.data?.activo === false) {
            return {
                ok: false,
                motivo: 'sin-claves',
                mensaje: 'Este dispositivo quedo registrado, pero el servidor no tiene claves VAPID configuradas.'
            };
        }

        return { ok: true, mensaje: 'Notificaciones activadas en este dispositivo.' };
    } catch (error) {
        console.error('Error activando push:', error);
        return {
            ok: false,
            motivo: 'error',
            mensaje: (error?.message || 'No se pudo activar').slice(0, 140)
        };
    }
};

/** Manda una notificacion de prueba a tus propios dispositivos. */
export const probarPush = async () => {
    try {
        const res = await api.post('/push/test');
        return { ok: !!res.data?.ok, mensaje: res.data?.mensaje || 'Enviada.', detalle: res.data };
    } catch (error) {
        const d = error.response?.data;
        const codigo = error.response?.status;

        // ⚠️ Si el servidor no contesta con NUESTRO error estructurado, el
        // problema esta antes de llegar al endpoint. Decir solo "no se pudo"
        // deja al usuario igual de perdido, asi que se nombra la causa.
        let mensaje = d?.mensaje;
        if (!mensaje) {
            if (!error.response) mensaje = 'Sin respuesta del servidor. Puede estar arrancando (Render tarda 30-50 s): espera y reintenta.';
            else if (codigo === 404) mensaje = 'El servidor no tiene la ruta de prueba (404). Falta desplegar la ultima version del backend.';
            else if (codigo === 401) mensaje = 'Sesion caducada (401). Cierra sesion y vuelve a entrar.';
            else mensaje = `El servidor respondio ${codigo} sin detalle.`;
        }

        return { ok: false, mensaje, codigo, detalle: d };
    }
};
