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
api.interceptors.response.use(
    (response) => { marcarFin(); return response; },
    (error) => {
        marcarFin();
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;