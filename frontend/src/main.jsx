import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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