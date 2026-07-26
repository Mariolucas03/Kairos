import { useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { Z } from '../../utils/zLayers';

export default function Toast({ message, type = 'success', onClose }) {
    // Guardamos onClose en una ref: si la página pasa una función nueva en cada
    // render (lo habitual con arrow functions inline), el efecto se reiniciaba
    // constantemente y el aviso podía no cerrarse nunca.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        const timer = setTimeout(() => onCloseRef.current?.(), 3000);
        return () => clearTimeout(timer);
    }, [message]);

    // Colores según tipo
    const styles = type === 'success'
        ? 'bg-green-500/10 border-green-500 text-green-500'
        : type === 'error'
            ? 'bg-red-500/10 border-red-500 text-red-500'
            : 'bg-blue-500/10 border-blue-500 text-blue-500';

    const Icon = type === 'success' ? CheckCircle : AlertCircle;

    return (
        // Fijo abajo y centrado. Va en la capa más alta para que nunca lo tape
        // un modal (antes usaba z-200, el mismo que los modales).
        <div style={{ zIndex: Z.toast }} className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 w-[90%] max-w-sm bg-zinc-950/90 border-white/10">
            <div className={`p-2 rounded-full ${styles} bg-opacity-20`}>
                <Icon size={20} />
            </div>
            <div className="flex-1">
                <p className={`text-sm font-bold ${type === 'success' ? 'text-white' : 'text-white'}`}>
                    {message}
                </p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <X size={18} />
            </button>
        </div>
    );
}