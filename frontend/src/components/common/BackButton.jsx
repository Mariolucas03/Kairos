import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * Botón de "volver" ÚNICO de la app.
 *
 * Antes cada pantalla tenía el suyo y había 5 variantes distintas conviviendo
 * (círculo con ArrowLeft en la Tienda, cuadrado sin borde ni hover en Dados,
 * rounded-2xl p-3 en la Ruleta de la Fortuna, rounded-xl p-2 en el resto...).
 * Ahora todas usan este componente: mismo icono, forma, tamaño y posición
 * (siempre arriba a la izquierda).
 *
 * @param {string|number} [to] destino; por defecto vuelve a la pantalla anterior
 * @param {Function} [onClick] acción propia (tiene prioridad sobre `to`)
 */
export default function BackButton({ to, onClick, className = '' }) {
    const navigate = useNavigate();

    const handleClick = () => {
        if (onClick) return onClick();
        navigate(to !== undefined ? to : -1);
    };

    return (
        <button
            onClick={handleClick}
            aria-label="Volver"
            className={`bg-zinc-900 border border-zinc-800 p-2.5 rounded-2xl text-zinc-400 hover:text-white hover:border-zinc-700 active:scale-95 transition-all shrink-0 ${className}`}
        >
            <ChevronLeft size={20} />
        </button>
    );
}
