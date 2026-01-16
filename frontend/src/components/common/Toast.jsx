import { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000); // Se va solo a los 3 segundos
        return () => clearTimeout(timer);
    }, [onClose]);

    // Colores según tipo
    const styles = type === 'success'
        ? 'bg-green-500/10 border-green-500 text-green-500'
        : type === 'error'
            ? 'bg-red-500/10 border-red-500 text-red-500'
            : 'bg-blue-500/10 border-blue-500 text-blue-500';

    const Icon = type === 'success' ? CheckCircle : AlertCircle;

    return (
        // 🔥 CAMBIO: 'fixed bottom-24' en lugar de top. Centrado horizontalmente.
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 w-[90%] max-w-sm">
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