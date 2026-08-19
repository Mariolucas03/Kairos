import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, X } from 'lucide-react';
import api from '../../services/api';
import WidgetCard, { WidgetStat, WIDGET_ACCENTS } from '../common/WidgetCard';

/**
 * El volumen semanal ya NO es una tarjeta propia: vive dentro de RUTINA GYM.
 * Este archivo conserva la lógica y el histórico:
 *   - useWeeklyStats(): el fetch a /gym/weekly (lo llama Home).
 *   - WeeklyHistoryModal: el modal de histórico por músculo (lo abre TrainingWidget).
 *   - export default: la tarjeta suelta, por si se quiere volver a mostrar aparte.
 */

export function useWeeklyStats() {
    const [stats, setStats] = useState({ currentVolume: 0, percentage: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            const fetchStats = async () => {
                try {
                    const res = await api.get('/gym/weekly');
                    setStats({
                        currentVolume: res.data.currentVolume || 0,
                        percentage: res.data.percentage || 0
                    });
                } catch (error) {
                    console.error('Error cargando weekly stats:', error);
                    setStats({ currentVolume: 0, percentage: 0 });
                } finally {
                    setLoading(false);
                }
            };
            fetchStats();
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    return { stats, loading };
}

export function WeeklyHistoryModal({ onClose }) {
    const accent = WIDGET_ACCENTS.weekly;
    const [selectedMuscle, setSelectedMuscle] = useState('Global');
    const [selectedYear] = useState(new Date().getFullYear());

    const muscles = ['Global', 'Pecho', 'Espalda', 'Pierna', 'Glúteo', 'Hombro', 'Bíceps', 'Tríceps', 'Abdomen'];

    return createPortal(
        <div style={{ top: 'var(--vv-top, 0px)', height: 'var(--vv-alto, 100dvh)' }} className="fixed left-0 right-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200" onClick={onClose}>
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />

            <div
                className="bg-[#09090b] border border-white/10 w-[95%] max-w-4xl rounded-[40px] p-6 shadow-2xl relative flex flex-col gap-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar z-10"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                <div className="flex justify-between items-center shrink-0 relative z-10">
                    <h2 className="text-2xl font-black text-white uppercase flex items-center gap-3 tracking-tighter not-italic">
                        HISTÓRICO <span style={{ color: accent }}>VOLUMEN</span>
                    </h2>
                    <button onClick={onClose} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-wrap gap-2 relative z-10">
                    {muscles.map((muscle) => (
                        <button
                            key={muscle}
                            onClick={() => setSelectedMuscle(muscle)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 not-italic border ${
                                selectedMuscle === muscle
                                    ? 'text-white border-transparent'
                                    : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                            }`}
                            style={selectedMuscle === muscle ? { background: accent } : undefined}
                        >
                            {muscle}
                        </button>
                    ))}
                </div>

                <div className="bg-zinc-900/30 rounded-[32px] p-6 border border-white/5 relative h-64 w-full flex items-center justify-center flex-col gap-4 text-zinc-600 shrink-0">
                    <BarChart3 size={64} className="opacity-20" />
                    <span className="uppercase font-black tracking-widest text-sm opacity-50 not-italic">
                        Gráfica de {selectedMuscle} - {selectedYear}
                    </span>
                    <p className="text-xs text-zinc-700 font-bold not-italic">(Próximamente)</p>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default function WeeklyWidget() {
    const accent = WIDGET_ACCENTS.weekly;
    const { stats, loading } = useWeeklyStats();
    const [isOpen, setIsOpen] = useState(false);

    const volumeText = Number(stats.currentVolume || 0).toLocaleString('es-ES');
    const pctColor = stats.percentage > 0 ? '#4ade80' : stats.percentage < 0 ? '#f87171' : '#a1a1aa';

    return (
        <>
            <WidgetCard
                accent={accent}
                onClick={() => setIsOpen(true)}
                className="h-full flex flex-col justify-between"
                label="VOLUMEN SEMANAL"
            >
                <div className="relative z-10 mt-auto pt-3">
                    <WidgetStat value={loading ? '—' : volumeText} unit="KG" accent={accent} />
                    <div className="mt-2.5 text-[9px] font-black uppercase tracking-[0.08em] not-italic" style={{ color: pctColor }}>
                        {stats.percentage > 0 ? '+' : ''}{stats.percentage}% ESTA SEMANA
                    </div>
                </div>
            </WidgetCard>

            {isOpen && <WeeklyHistoryModal onClose={() => setIsOpen(false)} />}
        </>
    );
}
