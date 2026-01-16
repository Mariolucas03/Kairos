import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableWidget({ id, children, className = '' }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto', // Pone el widget por encima al arrastrar
        opacity: isDragging ? 0.8 : 1, // Un poco transparente al arrastrar
        scale: isDragging ? '1.05' : '1', // Efecto "pop" al levantar
        touchAction: 'none' // Importante para móviles
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`${className} ${isDragging ? 'shadow-2xl ring-2 ring-blue-500 rounded-2xl' : ''}`}
        >
            {children}
        </div>
    );
}