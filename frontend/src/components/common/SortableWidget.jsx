import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Move } from 'lucide-react';

export default function SortableWidget({ id, children, className = '', isDragEnabled = false }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id,
        // 🔥 CRÍTICO: Desactiva la lógica de DND a nivel de núcleo si no estamos editando
        disabled: !isDragEnabled
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.9 : 1,
        scale: isDragging ? '1.05' : '1',
        // 🔥 MAGIA DE SCROLL: 'auto' permite el scroll nativo. 'none' lo bloquea para arrastrar.
        touchAction: isDragEnabled ? 'none' : 'auto'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...(isDragEnabled ? attributes : {})}
            {...(isDragEnabled ? listeners : {})}
            className={`${className} relative ${isDragging ? 'shadow-2xl ring-4 ring-yellow-500 rounded-[32px] cursor-grabbing' : (isDragEnabled ? 'cursor-grab transform transition-transform ring-2 ring-yellow-500/50 rounded-[32px]' : '')}`}
        >
            {/* CAPA DE SUPERPOSICIÓN: Modo Edición Visual */}
            {isDragEnabled && !isDragging && (
                <div className="absolute inset-0 bg-black/60 z-[60] flex items-center justify-center rounded-[32px] backdrop-blur-[2px]">
                    <div className="bg-yellow-500 text-black px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.5)] flex items-center gap-2 animate-pulse">
                        <Move size={14} /> Mover
                    </div>
                </div>
            )}

            {/* Si está arrastrando, quitamos el overlay para que se vea el widget limpio flotando */}
            {children}
        </div>
    );
}