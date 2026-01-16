import api from '../services/api';

// ⚠️ PEGA AQUÍ LA CLAVE PÚBLICA QUE GENERASTE EN EL PASO 0
const VAPID_PUBLIC_KEY = "BHuNNV8fKxiIeIuObGJTavYPhf1G1Kpj4LN1TTCnaowLlmEJH6edktAmF0CcU5sZhpQZ5JxqzIK0qQ5sVSwmCuQ";

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

export const registerPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.error('Push no soportado en este navegador');
        return false;
    }

    try {
        // 1. Registrar Service Worker
        const register = await navigator.serviceWorker.register('/service-worker.js');

        // 2. Esperar a que esté listo
        await navigator.serviceWorker.ready;

        // 3. Suscribirse al Push Manager de Google/Mozilla/Apple
        const subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        // 4. Enviar la suscripción a TU backend para guardarla
        await api.post('/push/subscribe', subscription);
        console.log("✅ Suscripción Push enviada al servidor");
        return true;

    } catch (error) {
        console.error("Error en suscripción Push:", error);
        return false;
    }
};