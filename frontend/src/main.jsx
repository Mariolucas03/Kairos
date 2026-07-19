import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { API_BASE_URL } from './config';

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
        <App />
    </React.StrictMode>
);