import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { X, Scale, Flame, Utensils, User, ToggleLeft, ToggleRight, Save, Activity, Edit2 } from 'lucide-react';
import api from '../../services/api';

export default function KcalBalanceWidget({ intake = 0, burned = 0, weight: propWeight }) {
    const { user, setUser } = useOutletContext();
    const [isOpen, setIsOpen] = useState(false);

    // --- DATOS DEL USUARIO ---
    const weight = propWeight || user?.dailyLog?.weight || user?.weight || 75;
    const hasPhysicalStats = user?.physicalStats?.age && user?.physicalStats?.height;

    // --- ESTADOS ---
    const [includeBMR, setIncludeBMR] = useState(() => {
        const saved = localStorage.getItem('includeBMR');
        return saved === 'true' && hasPhysicalStats;
    });

    const [showSetup, setShowSetup] = useState(false);

    // Formulario
    const [formData, setFormData] = useState({
        age: user?.physicalStats?.age || '',
        height: user?.physicalStats?.height || '',
        gender: user?.physicalStats?.gender || 'male'
    });

    useEffect(() => {
        if (user?.physicalStats) {
            setFormData({
                age: user.physicalStats.age || '',
                height: user.physicalStats.height || '',
                gender: user.physicalStats.gender || 'male'
            });
        }
    }, [user]);

    // --- CÁLCULO BMR ---
    const calculateBMR = () => {
        const ageToUse = parseInt(formData.age) || user?.physicalStats?.age || 25;
        const heightToUse = parseInt(formData.height) || user?.physicalStats?.height || 175;
        const genderToUse = formData.gender || user?.physicalStats?.gender || 'male';

        if (!ageToUse || !heightToUse) return 0;

        if (genderToUse === 'male') {
            return Math.round(88.362 + (13.397 * weight) + (4.799 * heightToUse) - (5.677 * ageToUse));
        } else {
            return Math.round(447.593 + (9.247 * weight) + (3.098 * heightToUse) - (4.330 * ageToUse));
        }
    };

    const bmr = calculateBMR();
    const totalBurned = includeBMR ? (burned + bmr) : burned;
    const balance = (intake || 0) - totalBurned;

    // --- MANEJADORES ---
    const toggleBMR = () => {
        if (includeBMR) {
            setIncludeBMR(false);
            localStorage.setItem('includeBMR', 'false');
        } else {
            if (hasPhysicalStats) {
                setIncludeBMR(true);
                localStorage.setItem('includeBMR', 'true');
            } else {
                setShowSetup(true);
            }
        }
    };

    const handleSaveStats = async () => {
        if (!formData.age || !formData.height) return;

        try {
            const res = await api.put('/users/physical-stats', {
                age: parseInt(formData.age),
                height: parseInt(formData.height),
                gender: formData.gender
            });

            const updatedUser = { ...user, physicalStats: res.data.physicalStats };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            setShowSetup(false);
            setIncludeBMR(true);
            localStorage.setItem('includeBMR', 'true');

        } catch (error) {
            console.error("Error guardando datos físicos:", error);
        }
    };

    // --- FORMATEO ---
    const f = (n) => Math.round(n).toLocaleString('es-ES');

    const formatBalance = (num) => {
        if (num === 0) return '0';
        const sign = num > 0 ? '+' : '';
        return `${sign}${f(num)}`;
    };

    const displayBalance = formatBalance(balance);

    const getFontSize = (str) => {
        if (str.length > 6) return 'text-3xl';
        if (str.length > 4) return 'text-5xl';
        return 'text-6xl';
    };

    // --- COLORES FLOW "SHINY TITANIUM" ---
    const gradientClasses = "from-slate-200 via-[#868F96] to-[#596164]";
    const shadowColor = "rgba(134, 143, 150, 0.8)";

    return (
        <>
            {/* 1. WIDGET PEQUEÑO (PREVIEW) */}
            <div
                onClick={() => setIsOpen(true)}
                className={`
                    h-full w-full relative rounded-[32px] overflow-hidden
                    group cursor-pointer active:scale-[0.98] transition-all duration-200
                    p-[2px] 
                    bg-gradient-to-br ${gradientClasses}
                    shadow-[0_0_30px_${shadowColor}]
                `}
            >
                <div className="h-full w-full bg-zinc-950 rounded-[30px] flex flex-col justify-between relative overflow-hidden z-10">
                    <div className="px-5 pt-5 flex justify-start z-10 shrink-0">
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-md pr-2">
                            BALANCE
                        </h2>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center z-10 mt-2 text-center w-full px-2">
                        <div className="flex items-baseline justify-center animate-in fade-in zoom-in duration-300 w-full">
                            <span className={`${getFontSize(displayBalance)} font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125 drop-shadow-[0_0_8px_rgba(134,143,150,0.6)] not-italic`}>
                                {displayBalance}
                            </span>
                        </div>
                    </div>

                    <div className="px-5 pb-8 z-10 flex justify-center items-end w-full shrink-0">
                        <span className="text-2xl font-black text-white uppercase tracking-tight leading-none drop-shadow-lg opacity-100 not-italic">
                            KCAL
                        </span>
                    </div>

                    <div className="absolute bottom-0 left-0 w-full h-3 z-0">
                        <div className={`h-full w-full bg-gradient-to-r ${gradientClasses} shadow-[0_-2px_25px_${shadowColor}]`}></div>
                    </div>
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-gradient-to-tr ${gradientClasses} opacity-30`}></div>
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
                        className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decoración Fondo */}
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradientClasses}`}></div>
                        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none bg-gradient-to-bl ${gradientClasses} opacity-20`}></div>

                        {/* Header Modal */}
                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2 tracking-tighter not-italic">
                                RESUMEN <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} filter brightness-125`}>BALANCE</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Contenido Central */}
                        <div className="flex flex-col gap-4 relative z-10 overflow-y-auto custom-scrollbar pr-1">

                            {/* RESULTADO GRANDE */}
                            <div className="flex flex-col items-center justify-center py-4 bg-zinc-900/30 rounded-3xl border border-white/5 relative overflow-hidden shrink-0">
                                <div className={`absolute inset-0 bg-gradient-to-b ${gradientClasses} opacity-5`}></div>
                                <span className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Resultado Neto</span>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-6xl font-black tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r ${gradientClasses} drop-shadow-xl filter brightness-125`}>
                                        {displayBalance}
                                    </span>
                                    <span className="text-lg font-black text-zinc-600 uppercase">KCAL</span>
                                </div>
                            </div>

                            {/* DESGLOSE (INGESTA vs QUEMADA) */}
                            <div className="grid grid-cols-2 gap-3 shrink-0">
                                {/* Ingesta */}
                                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 flex flex-col gap-1 items-center">
                                    <div className="bg-black p-2 rounded-full border border-white/5 mb-1">
                                        <Utensils size={18} className="text-emerald-400" />
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Ingeridas</span>
                                    <span className="text-xl font-black text-white">
                                        {f(intake)}
                                    </span>
                                </div>

                                {/* Quemadas (Dinámico) */}
                                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 flex flex-col gap-1 items-center relative overflow-hidden">
                                    <div className="bg-black p-2 rounded-full border border-white/5 mb-1 relative z-10">
                                        <Flame size={18} className="text-orange-500" />
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase relative z-10">Quemadas</span>
                                    <span className="text-xl font-black text-white relative z-10">
                                        -{f(totalBurned)}
                                    </span>

                                    {/* Indicador sutil de que incluye BMR */}
                                    {includeBMR && (
                                        <div className="absolute inset-0 bg-slate-500/10 pointer-events-none"></div>
                                    )}
                                </div>
                            </div>

                            {/* --- SECCIÓN BMR (METABOLISMO BASAL) CON ESTILO TITANIUM --- */}

                            {/* Caso 1: MODO CONFIGURACIÓN (SETUP) */}
                            {showSetup ? (
                                <div className="bg-zinc-800/40 p-4 rounded-2xl border border-slate-500/30 animate-in slide-in-from-bottom-2 fade-in relative overflow-hidden">
                                    {/* Brillo de fondo */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientClasses} opacity-5`}></div>

                                    <div className="flex items-center justify-between mb-3 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <Activity size={18} className="text-slate-400" />
                                            <span className="text-xs font-black text-white uppercase tracking-wider">Configurar BMR</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-zinc-400 uppercase">Calculando con: {weight}kg</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-3 relative z-10">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-bold text-zinc-500 uppercase">Edad</label>
                                            <input
                                                type="number"
                                                value={formData.age}
                                                onChange={e => setFormData({ ...formData, age: e.target.value })}
                                                placeholder="Años"
                                                className="bg-black border border-zinc-700 rounded-xl p-2 text-white text-sm font-bold text-center focus:border-slate-400 outline-none transition-colors"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-bold text-zinc-500 uppercase">Altura (cm)</label>
                                            <input
                                                type="number"
                                                value={formData.height}
                                                onChange={e => setFormData({ ...formData, height: e.target.value })}
                                                placeholder="Ej: 175"
                                                className="bg-black border border-zinc-700 rounded-xl p-2 text-white text-sm font-bold text-center focus:border-slate-400 outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 mb-4 relative z-10">
                                        <label className="text-[9px] font-bold text-zinc-500 uppercase">Género</label>
                                        <div className="flex bg-black rounded-xl p-1 border border-zinc-700">
                                            <button
                                                onClick={() => setFormData({ ...formData, gender: 'male' })}
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.gender === 'male'
                                                        ? `bg-gradient-to-r ${gradientClasses} text-black shadow-md`
                                                        : 'text-zinc-500 hover:text-zinc-300'
                                                    }`}
                                            >
                                                Hombre
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, gender: 'female' })}
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.gender === 'female'
                                                        ? `bg-gradient-to-r ${gradientClasses} text-black shadow-md`
                                                        : 'text-zinc-500 hover:text-zinc-300'
                                                    }`}
                                            >
                                                Mujer
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 relative z-10">
                                        <button onClick={() => setShowSetup(false)} className="flex-1 py-2 bg-transparent border border-zinc-700 text-zinc-400 font-bold text-xs rounded-xl hover:text-white transition-colors">CANCELAR</button>
                                        <button
                                            onClick={handleSaveStats}
                                            className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all bg-gradient-to-r ${gradientClasses} text-black hover:brightness-110`}
                                        >
                                            <Save size={14} /> GUARDAR
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Caso 2: TOGGLE DE ACTIVACIÓN + BOTÓN EDITAR (ESTILO TITANIUM) */
                                <div className="flex gap-2">
                                    <div
                                        className={`
                                            flex-1 flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group
                                            ${includeBMR
                                                ? 'border-transparent shadow-lg shadow-slate-500/20'
                                                : 'bg-zinc-900/30 border-white/5 hover:bg-zinc-800/50'
                                            }
                                        `}
                                        onClick={toggleBMR}
                                    >
                                        {/* Fondo Metálico cuando está activo */}
                                        {includeBMR && (
                                            <div className={`absolute inset-0 bg-gradient-to-r ${gradientClasses}`}></div>
                                        )}

                                        <div className="flex items-center gap-3 relative z-10">
                                            <div className={`p-2 rounded-xl ${includeBMR ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                                                <User size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-black uppercase tracking-wide ${includeBMR ? 'text-zinc-900' : 'text-zinc-400'}`}>
                                                    Metabolismo Basal
                                                </span>
                                                <span className={`text-[10px] font-bold ${includeBMR ? 'text-zinc-800' : 'text-zinc-500'}`}>
                                                    {includeBMR ? `Activo (+${f(bmr)} kcal)` : 'Solo actividad física'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`transition-colors relative z-10 ${includeBMR ? 'text-zinc-900' : 'text-zinc-600'}`}>
                                            {includeBMR ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </div>
                                    </div>

                                    {/* BOTÓN EDITAR (SOLO SI ESTÁ ACTIVO) */}
                                    {includeBMR && (
                                        <button
                                            onClick={() => setShowSetup(true)}
                                            className="w-14 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors shadow-lg active:scale-95"
                                        >
                                            <Edit2 size={20} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer / Nota */}
                        <div className="text-center relative z-10 pt-2 opacity-50 shrink-0">
                            <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-zinc-600 uppercase">
                                <Scale size={12} /> Balance = Ingesta - {includeBMR ? '(Actividad + Basal)' : 'Actividad'}
                            </div>
                        </div>

                    </div>
                </div>,
                document.body
            )}
        </>
    );
}