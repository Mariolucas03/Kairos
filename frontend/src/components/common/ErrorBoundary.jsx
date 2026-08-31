import React from 'react';
import { reportarFallo } from '../../utils/reportarFallo';

/**
 * RED DE SEGURIDAD GLOBAL.
 *
 * Sin esto, cualquier error de render deja la app en NEGRO y sin salida: el
 * usuario tiene que cerrar la PWA a mano. Con esto se ve qué ha pasado y hay
 * un botón para volver al inicio.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('💥 Error no controlado:', error, info);

        // Se avisa al servidor. Hasta ahora este console.error era TODO lo que
        // pasaba: quedaba escrito en la consola de un movil que nadie va a
        // abrir nunca, y el fallo solo se descubria si el usuario lo contaba.
        //
        // Va antes de la posible recarga de mas abajo a proposito, y el envio
        // usa keepalive para que el navegador lo termine aunque la pagina se
        // muera a mitad.
        reportarFallo({
            mensaje: error?.message || String(error),
            // La pila de React (que componente ha sido) dice mucho mas que la
            // de JavaScript, que en produccion viene minificada.
            pila: (info?.componentStack || error?.stack || '').slice(0, 1200),
            origen: 'render'
        });

        // Tras un despliegue nuevo, el index.html que tiene el móvil en caché
        // apunta a trozos de código con un nombre que ya no existe: el import
        // dinámico falla y la pantalla se queda NEGRA. Se recarga una sola vez
        // (con marca en sessionStorage) para coger la versión buena.
        const msg = String(error?.message || '');
        const esFalloDeCarga = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(msg);

        if (esFalloDeCarga && !sessionStorage.getItem('kairos_recarga_por_chunk')) {
            sessionStorage.setItem('kairos_recarga_por_chunk', '1');
            window.location.reload();
        }
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center px-8 text-center gap-4">
                <span className="text-5xl">💥</span>
                <h1 className="text-white font-black uppercase tracking-tighter text-xl">Algo se ha roto</h1>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
                    La pantalla anterior ha fallado. No has perdido nada: vuelve al inicio y sigue.
                </p>
                <p className="text-[10px] text-zinc-700 font-mono break-all max-w-xs">
                    {String(this.state.error?.message || this.state.error)}
                </p>
                <button
                    onClick={() => { sessionStorage.removeItem('kairos_recarga_por_chunk'); window.location.href = '/'; }}
                    className="mt-2 bg-yellow-500 text-black font-black uppercase tracking-widest text-xs px-6 py-3 rounded-2xl active:scale-95 transition-transform"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }
}
