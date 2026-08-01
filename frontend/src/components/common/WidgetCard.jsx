import React from 'react';

/**
 * CHASIS COMÚN DE LOS WIDGETS DEL HOME — sistema "Bento".
 *
 * Reglas del sistema (las mismas para todas las tarjetas):
 *  - Superficie #0a0a0c + borde blanco al 7% + radio 24px.
 *  - Línea de acento de 2px arriba, del color de la métrica.
 *  - Halo difuso del mismo color abajo a la derecha.
 *  - Etiqueta en 11px black, zinc-300, tracking .16em.
 *  - Número en blanco; la UNIDAD siempre en el color del widget.
 */
export default function WidgetCard({
    accent = '#eab308',
    label,
    labelRight,
    onClick,
    className = '',
    padding = 'p-4',
    glow = true,
    children
}) {
    return (
        <div
            onClick={onClick}
            className={`
                relative overflow-hidden bg-[#0a0a0c] border border-white/[0.07] rounded-[24px]
                transition-all duration-200 ${padding}
                ${onClick ? 'cursor-pointer active:scale-[0.985]' : ''}
                ${className}
            `}
        >
            {/* Línea de acento */}
            <div
                className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
            />

            {/* Halo */}
            {glow && (
                <div
                    className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] pointer-events-none"
                    style={{ background: accent, opacity: 0.11 }}
                />
            )}

            {(label || labelRight) && (
                <div className="relative z-10 flex items-baseline justify-between gap-2">
                    {label && <WidgetLabel>{label}</WidgetLabel>}
                    {labelRight}
                </div>
            )}

            {children}
        </div>
    );
}

/** Etiqueta del widget (PASOS, SUEÑO, MISIONES...) */
export function WidgetLabel({ children, className = '' }) {
    return (
        <span className={`block text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] leading-none not-italic ${className}`}>
            {children}
        </span>
    );
}

/** Número grande + unidad en el color del widget. */
export function WidgetStat({ value, unit, accent, size = 'text-[30px]', unitSize = 'text-[13px]' }) {
    return (
        <div className="flex items-baseline gap-1">
            <span className={`${size} font-black text-white tracking-[-0.05em] leading-none not-italic`}>{value}</span>
            {unit && (
                <span
                    className={`${unitSize} font-black leading-none tracking-[0.04em] not-italic`}
                    style={{ color: accent }}
                >
                    {unit}
                </span>
            )}
        </div>
    );
}

/** Barra de progreso fina con el color del widget. */
export function WidgetBar({ percent = 0, accent, className = '' }) {
    return (
        <div className={`h-1 w-full bg-[#18181b] rounded-full overflow-hidden ${className}`}>
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(percent, 100))}%`, background: accent }}
            />
        </div>
    );
}

/** Paleta central: un tono por métrica. */
export const WIDGET_ACCENTS = {
    streak: '#f97316',
    food: '#a3e635',
    missions: '#f43f5e',
    sport: '#22d3ee',
    training: '#eab308',
    steps: '#c9a227',
    sleep: '#64748b',
    weight: '#FF61D2',
    kcalBalance: '#94a3b8',
    mood: '#FE90AF',
    weekly: '#8ba3c9'
};
