import { Loader2 } from 'lucide-react';

/**
 * Pantalla de carga ÚNICA de la app.
 *
 * Antes cada sección tenía la suya: unas con spinner amarillo, otras con texto
 * parpadeando, otras con el icono de Activity girando y con separaciones
 * distintas. Ahora todas cargan igual.
 */
export default function LoadingScreen({ message = 'Cargando...', full = true }) {
    return (
        <div className={`${full ? 'min-h-screen' : 'py-20'} bg-black flex flex-col items-center justify-center gap-4 select-none`}>
            <Loader2 className="animate-spin text-yellow-500" size={32} />
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{message}</p>
        </div>
    );
}
