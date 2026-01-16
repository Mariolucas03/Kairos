import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Activity, BarChart3, X } from 'lucide-react';
import api from '../../services/api';

export default function WeeklyWidget() {
    // --- ESTADOS ---
    const [stats, setStats] = useState({ currentVolume: 0, percentage: 0 });
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    // Estados del Modal
    const [selectedMuscle, setSelectedMuscle] = useState('Global');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const muscles = ['Global', 'Pecho', 'Espalda', 'Pierna', 'Glúteo', 'Hombro', 'Bíceps', 'Tríceps', 'Abdomen'];

    // --- EFECTOS (LAZY LOAD) ---
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
                    console.error("Error cargando weekly stats:", error);
                    setStats({ currentVolume: 0, percentage: 0 });
                } finally {
                    setLoading(false);
                }
            };
            fetchStats();
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    // --- HELPERS ---

    // Formato: 1.350
    const formatVolume = (num) => {
        if (!num) return '0';
        return num.toLocaleString('es-ES');
    };

    const volumeText = formatVolume(stats.currentVolume);

    const getPercentageColor = (val) => {
        if (val > 0) return 'text-green-400 bg-green-900/20 border-green-500/20';
        if (val < 0) return 'text-red-400 bg-red-900/20 border-red-500/20';
        return 'text-zinc-400 bg-zinc-900/20 border-zinc-500/20';
    };

    // Ajuste dinámico de fuente (más pequeño para que quepa el título grande)
    const getFontSize = (text) => {
        const len = text.toString().length;
        if (len > 8) return 'text-2xl';
        if (len > 6) return 'text-3xl';
        return 'text-4xl';
    };

    // --- COLORES FLOW "MYSTIC STEEL" ---
    const gradientClasses = "from-[#8ba3c9] via-[#65799B] to-[#5E2563]";
    const shadowColor = "rgba(101, 121, 155, 0.5)";

    return (
        <>
            {/* 1. WIDGET PRINCIPAL (PREVIEW) */}
            <div
                onClick={() => setIsOpen(true)}
                className={`
                    h-full w-full relative rounded-[32px] overflow-hidden
                    group cursor-pointer active:scale-[0.98] transition-all duration-200
                    p-[2px] 
                    bg-gradient-to-br ${gradientClasses}
                    shadow-[0_0_25px_${shadowColor}]
                `}
            >
                {/* CONTENEDOR INTERNO (Padding p-5 igual que Racha) */}
                <div className="h-full w-full bg-zinc-950 rounded-[30px] p-5 relative overflow-hidden flex flex-col justify-between z-10">

                    {/* HEADER (IDÉNTICO A RACHA) */}
                    <div className="flex justify-start w-full relative z-20 pt-1">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">
                            VOLUMEN SEMANAL
                        </h3>
                    </div>

                    {/* CONTENIDO CENTRAL */}
                    <div className="flex-1 flex flex-col items-center justify-center relative z-20 pb-2">
                        {loading ? <Activity className="animate-spin text-zinc-600" /> : (
                            <div className="flex flex-col items-center justify-center w-full">

                                {/* NÚMERO GRANDE + KG */}
                                <div className="flex items-baseline justify-center gap-1.5 w-full">
                                    <span
                                        className={`${getFontSize(volumeText)} font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} transition-all duration-300 not-italic`}
                                    >
                                        {volumeText}
                                    </span>
                                    {/* KG BLANCO */}
                                    <span className="text-lg font-black uppercase text-white tracking-tighter">
                                        KG
                                    </span>
                                </div>

                                {/* PORCENTAJE */}
                                <div className={`mt-1 px-3 py-0.5 rounded-full border text-[10px] font-black tracking-wide flex items-center justify-center gap-1 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 ${getPercentageColor(stats.percentage)}`}>
                                    <span>
                                        {stats.percentage > 0 ? '+' : ''}{stats.percentage}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* BARRA INFERIOR (Estilo Racha) */}
                    <div className="absolute bottom-0 left-0 w-full h-3 z-10">
                        <div className={`h-full w-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_20px_${shadowColor}]`}></div>
                    </div>

                    {/* LUZ AMBIENTAL */}
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${gradientClasses} opacity-20 z-0`}></div>
                </div>
            </div>

            {/* 2. MODAL DESPLEGABLE */}
            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsOpen(false)}
                >
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true"></div>

                    <div
                        className="bg-[#09090b] border border-white/10 w-[95%] max-w-4xl rounded-[40px] p-6 shadow-2xl relative flex flex-col gap-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar z-10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decoración Fondo */}
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
                        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none bg-gradient-to-bl ${gradientClasses} opacity-10`}></div>

                        {/* Header Modal */}
                        <div className="flex justify-between items-center shrink-0 relative z-10">
                            <h2 className="text-2xl font-black text-white uppercase flex items-center gap-3 tracking-tighter not-italic">
                                HISTÓRICO <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125`}>VOLUMEN</span>
                            </h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Pestañas de Músculos */}
                        <div className="flex flex-wrap gap-2 relative z-10">
                            {muscles.map((muscle) => (
                                <button
                                    key={muscle}
                                    onClick={() => setSelectedMuscle(muscle)}
                                    className={`
                                        px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 not-italic
                                        ${selectedMuscle === muscle
                                            ? `bg-gradient-to-r ${gradientClasses} text-white border-0 shadow-lg`
                                            : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                                        }
                                    `}
                                >
                                    {muscle}
                                </button>
                            ))}
                        </div>

                        {/* Contenedor Gráfica (Placeholder) */}
                        <div className="bg-zinc-900/30 rounded-[32px] p-6 border border-white/5 relative h-64 w-full flex items-center justify-center flex-col gap-4 text-zinc-600 shrink-0">
                            <div className={`absolute inset-0 bg-gradient-to-b ${gradientClasses} opacity-5`}></div>

                            <BarChart3 size={64} className="opacity-20" />
                            <span className="uppercase font-black tracking-widest text-sm opacity-50 not-italic">
                                Gráfica de {selectedMuscle} - {selectedYear}
                            </span>
                            <p className="text-xs text-zinc-700 font-bold not-italic">(Próximamente)</p>
                        </div>

                    </div>
                </div>,
                document.body
            )}
        </>
    );
}