import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import WidgetCard, { WidgetStat, WidgetBar, WIDGET_ACCENTS } from '../common/WidgetCard';

export default function SleepWidget({ hours = 0, onUpdate }) {
    // ⚠️ El valor por defecto de un parámetro solo entra si llega `undefined`.
    // El registro diario devuelve `sleepHours: null` cuando aún no has apuntado
    // nada, así que el input acababa con value={null} y React lo convertía en
    // no controlado (avisaba en consola y el campo se comportaba raro).
    const horasSeguras = Number(hours) || 0;
    const [isOpen, setIsOpen] = useState(false);
    const [tempHours, setTempHours] = useState(horasSeguras);
    const accent = WIDGET_ACCENTS.sleep;

    useEffect(() => { setTempHours(horasSeguras); }, [horasSeguras]);

    const handleSave = () => {
        if (onUpdate) onUpdate(tempHours);
        setIsOpen(false);
    };

    const progress = Math.min((tempHours / 8) * 100, 100);
    const shown = Number(tempHours).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    return (
        <>
            <WidgetCard
                accent={accent}
                onClick={() => setIsOpen(true)}
                className="h-full flex flex-col justify-between"
                label="SUEÑO"
            >
                <div className="relative z-10 mt-auto pt-3">
                    <WidgetStat value={shown} unit="H" accent={accent} />
                    <WidgetBar percent={progress} accent={accent} className="mt-2.5" />
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }} className="fixed left-0 right-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200" onClick={handleSave}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

                    <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter not-italic">
                                REGISTRAR <span style={{ color: accent }}>SUEÑO</span>
                            </h2>
                            <button onClick={handleSave} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-8 py-4 relative z-10">
                            <div className="flex justify-center items-baseline gap-2">
                                <span className="text-7xl font-black text-white tracking-tighter not-italic">{tempHours}</span>
                                <span className="text-2xl font-black uppercase not-italic" style={{ color: accent }}>H</span>
                            </div>

                            <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: accent }} />
                            </div>

                            <div className="relative pt-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="12"
                                    step="0.5"
                                    value={tempHours}
                                    onChange={(e) => setTempHours(Number(e.target.value))}
                                    className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-[#64748b]"
                                />
                                <div className="flex justify-between text-xs font-bold text-zinc-600 uppercase mt-3 px-1 not-italic">
                                    <span>0H</span><span>4H</span><span>8H</span><span>12H</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
