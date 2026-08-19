import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';
import WidgetCard, { WidgetStat, WidgetBar, WIDGET_ACCENTS } from '../common/WidgetCard';

export default function StepsWidget({ steps = 0, goal = 10000, onUpdate }) {
    // El registro diario devuelve null si aún no has apuntado pasos, y el valor
    // por defecto del parámetro solo cubre `undefined`: sin esto el input queda
    // con value={null} y React lo trata como no controlado.
    const pasosSeguros = Number(steps) || 0;
    const [isOpen, setIsOpen] = useState(false);
    const [tempSteps, setTempSteps] = useState(pasosSeguros);
    const accent = WIDGET_ACCENTS.steps;

    useEffect(() => { setTempSteps(pasosSeguros); }, [pasosSeguros]);

    const handleSave = () => {
        if (onUpdate) onUpdate(parseInt(tempSteps) || 0);
        setIsOpen(false);
    };

    const f = (n) => Number(n || 0).toLocaleString('es-ES');
    const percent = (tempSteps / (goal || 1)) * 100;
    const goalShort = goal >= 1000 ? `${Math.round(goal / 1000)}K` : goal;

    return (
        <>
            <WidgetCard
                accent={accent}
                onClick={() => setIsOpen(true)}
                className="h-full flex flex-col justify-between"
                label="PASOS"
            >
                <div className="relative z-10 mt-auto pt-3">
                    <WidgetStat value={f(tempSteps)} unit={`/${goalShort}`} accent={accent} unitSize="text-[11px]" />
                    <WidgetBar percent={percent} accent={accent} className="mt-2.5" />
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }} className="fixed left-0 right-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                    <div className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter not-italic">
                                REGISTRAR <span style={{ color: accent }}>PASOS</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-6 py-2 relative z-10">
                            <input
                                type="number"
                                value={tempSteps}
                                onChange={(e) => setTempSteps(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full bg-black border-4 border-zinc-800 focus:border-[#c9a227] rounded-3xl py-6 px-4 text-5xl font-black text-white outline-none transition-all duration-300 text-center shadow-inner not-italic"
                            />

                            <div>
                                <div className="flex justify-between text-xs font-bold text-zinc-500 uppercase mb-2">
                                    <span>Progreso diario</span>
                                    <span>Meta: {f(goal)}</span>
                                </div>
                                <div className="h-4 bg-zinc-900 rounded-full overflow-hidden border border-white/10">
                                    <div
                                        className="h-full transition-all duration-500"
                                        style={{ width: `${Math.min(percent, 100)}%`, background: accent }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSave}
                                className="w-full py-4 rounded-2xl font-black text-xl uppercase tracking-widest text-black transition-all active:scale-95 flex items-center justify-center gap-2"
                                style={{ background: accent }}
                            >
                                <Save size={24} /> GUARDAR
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
