import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { Z } from '../../utils/zLayers';

/**
 * Diálogo de confirmación ÚNICO de la app.
 *
 * Sustituye tanto a los `window.confirm()` nativos (que se veían como una alerta
 * del navegador, rompiendo la estética) como a las tres copias del mismo modal
 * que había duplicadas en Social, Amigos y Clanes.
 */
export default function ConfirmDialog({
    message,
    title = '¿Estás seguro?',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    danger = true,
    onConfirm,
    onCancel
}) {
    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-6 animate-in fade-in duration-200" style={{ zIndex: Z.confirm }}>
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onCancel} />
            <div className="bg-[#09090b] border border-white/10 w-full max-w-xs rounded-[24px] p-6 shadow-2xl text-center relative z-10 animate-in zoom-in-95">
                <div className="flex justify-center mb-4 text-yellow-500"><AlertTriangle size={40} /></div>
                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                <p className="text-zinc-400 text-sm mb-6">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl font-bold text-sm active:scale-95 transition-transform hover:bg-zinc-700">
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform ${danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-black'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
