import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react';
import { getMadridDateString } from '../../utils/dateHelpers';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Calendario para viajar a un día concreto del historial.
 * Devuelve la fecha en formato YYYY-MM-DD (hora de Madrid, igual que el backend).
 */
export default function DayCalendarModal({ selectedDate, onSelect, onClose, accent = '#eab308' }) {
    const today = getMadridDateString();
    const initial = selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date();
    const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const rawFirstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const firstDay = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // semana que empieza en lunes

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} className="h-9 w-9" />);

    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = selectedDate === dStr;
        const isToday = today === dStr;
        const isFuture = dStr > today;

        cells.push(
            <button
                key={d}
                type="button"
                disabled={isFuture}
                onClick={() => onSelect(dStr)}
                className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black transition-all relative
                    ${isSelected
                        ? 'text-black scale-110 z-10'
                        : isFuture
                            ? 'text-zinc-800 cursor-not-allowed'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                style={isSelected ? { background: accent, boxShadow: `0 6px 18px -6px ${accent}` } : undefined}
            >
                {d}
                {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />
                )}
            </button>
        );
    }

    const goMonth = (delta) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />

            <div
                className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                <div className="flex justify-between items-center relative z-10">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 not-italic">
                        <CalendarDays size={22} style={{ color: accent }} /> HISTORIAL
                    </h2>
                    <button onClick={onClose} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex justify-between items-center relative z-10">
                    <button onClick={() => goMonth(-1)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-zinc-800 active:scale-95">
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-white font-black uppercase tracking-wider text-sm not-italic">
                        {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                    </span>
                    <button onClick={() => goMonth(1)} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-zinc-800 active:scale-95">
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center relative z-10">
                    {WEEKDAYS.map((d) => (
                        <span key={d} className="text-[10px] font-black text-zinc-600 uppercase">{d}</span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 place-items-center relative z-10">{cells}</div>

                <button
                    onClick={() => onSelect(today)}
                    className="relative z-10 w-full py-3 rounded-2xl bg-zinc-900 border border-white/5 text-[11px] font-black uppercase tracking-[0.15em] text-zinc-300 hover:text-white active:scale-[0.98] transition-all not-italic"
                >
                    Volver a hoy
                </button>
            </div>
        </div>,
        document.body
    );
}
