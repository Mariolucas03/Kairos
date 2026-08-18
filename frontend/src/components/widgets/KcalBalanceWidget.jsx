import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { X, Scale, Flame, Utensils, User, ToggleLeft, ToggleRight, Save, Activity, Edit2 } from 'lucide-react';
import api from '../../services/api';
import WidgetCard, { WidgetStat, WIDGET_ACCENTS } from '../common/WidgetCard';

export default function KcalBalanceWidget({ intake = 0, burned = 0, weight: propWeight }) {
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);
    const [isOpen, setIsOpen] = useState(false);
    const accent = WIDGET_ACCENTS.kcalBalance;

    const weight = propWeight || user?.dailyLog?.weight || user?.weight || 75;
    const hasPhysicalStats = user?.physicalStats?.age && user?.physicalStats?.height;

    const [includeBMR, setIncludeBMR] = useState(() => {
        const saved = localStorage.getItem('includeBMR');
        return saved === 'true' && hasPhysicalStats;
    });

    const [showSetup, setShowSetup] = useState(false);

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

    const calculateBMR = () => {
        const ageToUse = parseInt(formData.age) || user?.physicalStats?.age || 25;
        const heightToUse = parseInt(formData.height) || user?.physicalStats?.height || 175;
        const genderToUse = formData.gender || user?.physicalStats?.gender || 'male';

        if (!ageToUse || !heightToUse) return 0;

        if (genderToUse === 'male') {
            return Math.round(88.362 + (13.397 * weight) + (4.799 * heightToUse) - (5.677 * ageToUse));
        }
        return Math.round(447.593 + (9.247 * weight) + (3.098 * heightToUse) - (4.330 * ageToUse));
    };

    const bmr = calculateBMR();
    const totalBurned = includeBMR ? (burned + bmr) : burned;
    const balance = (intake || 0) - totalBurned;

    const toggleBMR = () => {
        if (includeBMR) {
            setIncludeBMR(false);
            localStorage.setItem('includeBMR', 'false');
        } else if (hasPhysicalStats) {
            setIncludeBMR(true);
            localStorage.setItem('includeBMR', 'true');
        } else {
            setShowSetup(true);
        }
    };

    // Candado de reentrada. NO basta con `disabled={estado}`: el estado no cambia
    // hasta el siguiente render, y entre el primer toque y ese render el botón
    // sigue vivo. En un móvil lento un doble toque entra dos veces y duplica lo
    // que se esté creando. El ref se actualiza en el acto.
    const enVuelo = useRef(false);

    const handleSaveStats = async () => {
        if (enVuelo.current) return;
        if (!formData.age || !formData.height) return;
        enVuelo.current = true;
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
            console.error('Error guardando datos físicos:', error);
        } finally {
            enVuelo.current = false;
        }
    };

    const f = (n) => Math.round(n).toLocaleString('es-ES');

    const formatBalance = (num) => {
        if (num === 0) return '0';
        // Signo menos tipográfico para el déficit
        return num > 0 ? `+${f(num)}` : `−${f(Math.abs(num))}`;
    };

    const displayBalance = formatBalance(balance);
    const isDeficit = balance < 0;

    return (
        <>
            <WidgetCard
                accent={accent}
                onClick={() => setIsOpen(true)}
                className="h-full flex flex-col justify-between"
                label="BALANCE"
            >
                <div className="relative z-10 mt-auto pt-3">
                    <div className="flex items-baseline gap-1">
                        <span
                            className="text-[30px] font-black tracking-[-0.05em] leading-none not-italic"
                            style={{ color: isDeficit ? '#4ade80' : '#ffffff' }}
                        >
                            {displayBalance}
                        </span>
                        <span className="text-xs font-black leading-none not-italic" style={{ color: accent }}>KCAL</span>
                    </div>
                    <div className="mt-2.5 text-[9px] font-black text-zinc-500 uppercase tracking-[0.08em] not-italic">
                        {isDeficit ? 'DÉFICIT' : balance > 0 ? 'SUPERÁVIT' : 'EN EQUILIBRIO'} · BASAL {includeBMR ? 'ON' : 'OFF'}
                    </div>
                </div>
            </WidgetCard>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" aria-hidden="true" />

                    <div
                        className="relative bg-[#09090b] border border-white/10 w-full max-w-sm rounded-[40px] p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 overflow-hidden max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute top-0 left-0 w-full h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

                        <div className="flex justify-between items-center relative z-10 shrink-0">
                            <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2 tracking-tighter not-italic">
                                RESUMEN <span style={{ color: accent }}>BALANCE</span>
                            </h2>
                            <button onClick={() => setIsOpen(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-white/5 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-4 relative z-10 overflow-y-auto custom-scrollbar pr-1">

                            <div className="flex flex-col items-center justify-center py-4 bg-zinc-900/30 rounded-3xl border border-white/5 relative overflow-hidden shrink-0">
                                <span className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Resultado neto</span>
                                <div className="flex items-baseline gap-1">
                                    <span
                                        className="text-6xl font-black tracking-tighter leading-none not-italic"
                                        style={{ color: isDeficit ? '#4ade80' : '#ffffff' }}
                                    >
                                        {displayBalance}
                                    </span>
                                    <span className="text-lg font-black uppercase" style={{ color: accent }}>KCAL</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 shrink-0">
                                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 flex flex-col gap-1 items-center">
                                    <div className="bg-black p-2 rounded-full border border-white/5 mb-1">
                                        <Utensils size={18} className="text-emerald-400" />
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Ingeridas</span>
                                    <span className="text-xl font-black text-white">{f(intake)}</span>
                                </div>

                                <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 flex flex-col gap-1 items-center relative overflow-hidden">
                                    <div className="bg-black p-2 rounded-full border border-white/5 mb-1 relative z-10">
                                        <Flame size={18} className="text-orange-500" />
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase relative z-10">Quemadas</span>
                                    <span className="text-xl font-black text-white relative z-10">-{f(totalBurned)}</span>
                                    {includeBMR && <div className="absolute inset-0 bg-slate-500/10 pointer-events-none" />}
                                </div>
                            </div>

                            {showSetup ? (
                                <div className="bg-zinc-800/40 p-4 rounded-2xl border border-slate-500/30 animate-in slide-in-from-bottom-2 fade-in relative overflow-hidden">
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
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.gender === 'male' ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                style={formData.gender === 'male' ? { background: accent } : undefined}
                                            >
                                                Hombre
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, gender: 'female' })}
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.gender === 'female' ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                style={formData.gender === 'female' ? { background: accent } : undefined}
                                            >
                                                Mujer
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 relative z-10">
                                        <button onClick={() => setShowSetup(false)} className="flex-1 py-2 bg-transparent border border-zinc-700 text-zinc-400 font-bold text-xs rounded-xl hover:text-white transition-colors">CANCELAR</button>
                                        <button
                                            onClick={handleSaveStats}
                                            className="flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 text-black active:scale-95 transition-all"
                                            style={{ background: accent }}
                                        >
                                            <Save size={14} /> GUARDAR
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <div
                                        className={`flex-1 flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                                            includeBMR ? 'border-transparent' : 'bg-zinc-900/30 border-white/5 hover:bg-zinc-800/50'
                                        }`}
                                        onClick={toggleBMR}
                                        style={includeBMR ? { background: accent } : undefined}
                                    >
                                        <div className="flex items-center gap-3 relative z-10">
                                            <div className={`p-2 rounded-xl ${includeBMR ? 'bg-black/20 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                                                <User size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-black uppercase tracking-wide ${includeBMR ? 'text-zinc-900' : 'text-zinc-400'}`}>
                                                    Metabolismo basal
                                                </span>
                                                <span className={`text-[10px] font-bold ${includeBMR ? 'text-zinc-800' : 'text-zinc-500'}`}>
                                                    {includeBMR ? `Activo (+${f(bmr)} kcal)` : 'Solo actividad física'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`relative z-10 ${includeBMR ? 'text-zinc-900' : 'text-zinc-600'}`}>
                                            {includeBMR ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                                        </div>
                                    </div>

                                    {includeBMR && (
                                        <button
                                            onClick={() => setShowSetup(true)}
                                            className="w-14 bg-zinc-900 border border-zinc-700 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors active:scale-95"
                                        >
                                            <Edit2 size={20} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

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
