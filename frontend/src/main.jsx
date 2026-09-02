import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import './index.css';
import { API_BASE_URL } from './config';
import { escucharFallosGlobales } from './utils/reportarFallo';
import { vigilarCola } from './utils/colaEnvios';

// Se engancha ANTES de montar React: los fallos que ocurren durante el arranque
// son justo los peores (pantalla en negro sin nada) y son los que hasta ahora
// no veia absolutamente nadie.
escucharFallosGlobales();

// Entrenos que se quedaron sin enviar por falta de cobertura: se reintentan al
// abrir la app y en cuanto vuelve la conexion. El usuario no tiene que hacer
// nada, ni acordarse de nada.
vigilarCola(({ enviados }) => {
    console.log(`Pendientes enviados al volver la conexion: ${enviados}`);
});

// --- DESPERTAR AL BACKEND CUANTO ANTES ---
// El backend (Render free tier) se duerme tras ~15 min de inactividad y tarda
// 30-50s en despertar en la primera petición real. Disparamos un ping ligero
// nada más cargar la app para que, cuando el usuario llegue a la primera
// pantalla interactiva, el servidor ya esté despierto.
fetch(`${API_BASE_URL}/api/cron/ping`).catch(() => { });

// --- REGISTRO SERVICE WORKER (PWA + PUSH) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('✅ SW Registrado:', registration.scope);
            })
            .catch((error) => {
                console.error('❌ Error SW:', error);
            });
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);