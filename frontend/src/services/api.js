import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useServidorStore } from '../store/useServidorStore';

/**
 * Detector de "servidor despertando".
 *
 * Se cuentan las peticiones en vuelo. Si alguna lleva más de UMBRAL sin
 * responder, se avisa a la interfaz: en Render gratuito eso significa casi
 * siempre que el servidor estaba dormido y está arrancando (30-50 s).
 * En cuanto contesta cualquiera, se apaga.
 */
const UMBRAL_MS = 3500;
let enVuelo = 0;
let temporizador = null;

const marcarInicio = () => {
    enVuelo++;
    if (temporizador === null) {
        temporizador = setTimeout(() => {
            if (enVuelo > 0) useServidorStore.getState().setDespertando(true);
        }, UMBRAL_MS);
    }
};

const marcarFin = () => {
    enVuelo = Math.max(0, enVuelo - 1);
    if (enVuelo === 0) {
        clearTimeout(temporizador);
        temporizador = null;
        useServidorStore.getState().setDespertando(false);
    }
};

const api = axios.create({
    baseURL: API_BASE_URL + '/api', // Se asegura de apuntar a /api
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para inyectar el token automáticamente
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        marcarInicio();
        return config;
    },
    (error) => { marcarFin(); return Promise.reject(error); }
);

// Interceptor para manejar errores de sesión (401)
/**
 * Un 401 casi siempre significa "tu sesion ha caducado" y hay que echar a la
 * gente al login. Pero hay dos casos en los que NO:
 *
 *  1. El 401 del PROPIO login o registro. Ahi un 401 no es una sesion caducada:
 *     es una contrasena mal escrita, y la pantalla ya sabe contarlo.
 *  2. Cuando ya estas en el login. Recargar el login para llevarte al login no
 *     arregla nada; solo borra lo que hubiera escrito en pantalla.
 *
 * ⚠️ Sin esto, escribir mal la contrasena hacia que la pagina se recargara
 * ENTERA: volvias a un formulario vacio, sin ningun mensaje, sin enterarte de
 * que lo que fallaba era la clave. El aviso de error se pintaba durante unos
 * milisegundos y se lo llevaba la recarga por delante.
 */
const esIntentoDeAcceso = (url) => /\/auth\/(login|register)/.test(url || '');
const yaEstamosEnLaPuerta = () => ['/login', '/register'].includes(window.location.pathname);

api.interceptors.response.use(
    (response) => { marcarFin(); return response; },
    (error) => {
        marcarFin();
        if (error.response?.status === 401
            && !esIntentoDeAcceso(error.config?.url)
            && !yaEstamosEnLaPuerta()) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }

        // Cuenta suspendida: se corta la sesion igual que con un 401, pero
        // dejando el motivo escrito para que el login lo pueda enseñar. Echar a
        // alguien sin decirle por que solo genera un mensaje preguntando que
        // paso.
        if (error.response?.status === 403 && error.response.data?.baneado) {
            localStorage.setItem('motivoBaneo', error.response.data.message || 'Cuenta suspendida');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Si ya estas en la puerta, recargar solo borraria el mensaje que
            // acabas de guardar antes de que le de tiempo a leerse.
            if (!yaEstamosEnLaPuerta()) window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;