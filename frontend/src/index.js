import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Tus estilos globales (Tailwind)
import App from './App'; // Tu componente principal

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// --- 🔥 ARQUITECTURA PWA: REGISTRO DEL SERVICE WORKER ---
// Esto hace que tu app funcione offline y permite las Notificaciones Push.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('✅ Service Worker registrado con éxito:', registration.scope);
            })
            .catch((error) => {
                console.error('❌ Error al registrar Service Worker:', error);
            });
    });
}