// frontend/src/components/home/HomeModals.jsx
import { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { X, Activity, Dumbbell, Clock, Flame, MapPin, ArrowRightLeft, Utensils, User, ToggleLeft, ToggleRight, Trophy, CheckCircle, Star, Coins, Gamepad2, HeartCrack } from 'lucide-react';
import api from '../../services/api';

// 1. MODAL DETALLE DEPORTE
export function SportDetailsModal({ workouts, onClose }) {
    const [activeTab, setActiveTab] = useState(0);
    if (!workouts || workouts.length === 0) return null;
    const current = workouts[activeTab];

    return (
        <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="text-green-500" /> Deportes de Hoy</h2>
                    <button onClick={onClose} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
                {workouts.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto mb-4 pb-2 border-b border-gray-800">
                        {workouts.map((w, idx) => (
                            <button key={idx} onClick={() => setActiveTab(idx)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeTab === idx ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{w.routineName || `Actividad ${idx + 1}`}</button>
                        ))}
                    </div>
                )}
                <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300 key={activeTab}">
                    <div className="text-center">
                        <h3 className="text-2xl font-black text-white uppercase mb-1">{current.routineName}</h3>
                        <div className="flex justify-center gap-2">
                            <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 font-mono">{new Date(current.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-xs bg-green-900/30 text-green-400 border border-green-500/30 px-2 py-1 rounded font-bold capitalize">{current.intensity}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 text-center"><span className="text-blue-500 text-[10px] font-bold uppercase block mb-1 flex justify-center gap-1"><MapPin size={10} /> DISTANCIA</span><span className="text-white font-bold text-xl">{current.distance || 0} km</span></div>
                        <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 text-center"><span className="text-orange-500 text-[10px] font-bold uppercase block mb-1 flex justify-center gap-1"><Clock size={10} /> TIEMPO</span><span className="text-white font-bold text-xl">{current.duration} min</span></div>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-xl text-center"><span className="text-gray-500 text-xs">Calorías Quemadas (Aprox)</span><p className="text-2xl font-black text-white">{current.caloriesBurned || Math.round(current.duration * 7)} kcal</p></div>
                </div>
            </div>
        </div>
    );
}

// 2. MODAL DETALLE GYM
export function GymDetailsModal({ workouts, onClose }) {
    const [activeTab, setActiveTab] = useState(0);
    if (!workouts || workouts.length === 0) return null;
    const current = workouts[activeTab];
    const totalVolume = current.exercises?.reduce((t, e) => t + e.sets.reduce((s, st) => s + (st.weight * st.reps), 0), 0);

    return (
        <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Dumbbell className="text-blue-500" /> Rutinas de Hoy</h2>
                    <button onClick={onClose} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
                {workouts.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto mb-4 pb-2 border-b border-gray-800 shrink-0 custom-scrollbar">
                        {workouts.map((w, idx) => (
                            <button key={idx} onClick={() => setActiveTab(idx)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${activeTab === idx ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{w.name || `Rutina ${idx + 1}`}</button>
                        ))}
                    </div>
                )}
                <div className="flex-1 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-4 fade-in duration-300 key={activeTab}">
                    <div className="flex justify-between items-end mb-4 px-1">
                        <div><h3 className="font-bold text-white text-xl uppercase mb-1">{current.name}</h3><span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /> {Math.floor(current.duration / 60)} min</span></div>
                        <div className="text-right"><span className="bg-blue-900/30 text-blue-400 text-xs font-bold px-2 py-1 rounded border border-blue-500/30 block mb-1">{current.exercises?.length || 0} Ejercicios</span><span className="text-[10px] text-gray-500 font-bold uppercase block">{current.intensity || 'Media'}</span></div>
                    </div>
                    <div className="space-y-3">
                        {current.exercises?.map((ex, i) => (
                            <div key={i} className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                                <div className="flex justify-between mb-2"><span className="text-gray-200 font-bold text-sm">{ex.name}</span><span className="text-gray-500 text-xs font-mono">{ex.sets.length} Sets</span></div>
                                <div className="flex flex-wrap gap-2">{ex.sets.map((s, j) => (<div key={j} className="bg-gray-900 px-2 py-1 rounded text-xs text-gray-400 border border-gray-800"><span className="text-white font-bold">{s.weight}kg</span> x {s.reps}</div>))}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4">
                        <div className="text-center"><p className="text-xs text-gray-500 uppercase font-bold">Volumen</p><p className="text-xl font-black text-white">{totalVolume.toLocaleString()} <span className="text-sm font-normal text-gray-500">kg</span></p></div>
                        <div className="text-center border-l border-gray-800"><p className="text-xs text-orange-500 uppercase font-bold flex items-center justify-center gap-1"><Flame size={12} /> Kcal Aprox</p><p className="text-xl font-black text-orange-400">{current.caloriesBurned > 0 ? current.caloriesBurned : '--'}</p></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 3. MODAL BALANCE KCAL
export function BalanceDetailsModal({ data, burned, onClose }) {
    const { user, setUser } = useOutletContext();
    const [includeBMR, setIncludeBMR] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [formData, setFormData] = useState({ age: '', height: '', gender: 'male' });

    const intake = data.nutrition?.totalKcal || data.totalKcal || 0;
    const weight = data.weight || 75;

    const calculateBMR = () => {
        if (!user.physicalStats?.age || !user.physicalStats?.height) return Math.round(weight * 22);
        const { age, height, gender } = user.physicalStats;
        if (gender === 'male') return Math.round(88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age));
        else return Math.round(447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age));
    };

    const bmr = calculateBMR();
    const totalBurned = includeBMR ? (burned + bmr) : burned;
    const net = intake - totalBurned;

    const handleToggleBMR = () => {
        if (user.physicalStats?.age && user.physicalStats?.height) setIncludeBMR(!includeBMR);
        else setShowSetup(true);
    };

    const handleSaveStats = async () => {
        if (!formData.age || !formData.height) return;
        try {
            const res = await api.put('/users/physical-stats', formData);
            const updatedUser = { ...user, physicalStats: res.data.physicalStats };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setShowSetup(false);
            setIncludeBMR(true);
        } catch (error) { console.error("Error guardando datos", error); }
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                <button onClick={onClose} className="absolute top-4 right-4 bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white z-20"><X size={20} /></button>
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><ArrowRightLeft className="text-purple-500" /> Balance Energético</h2>

                {showSetup ? (
                    <div className="animate-in slide-in-from-bottom-10 fade-in">
                        <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-500/30 mb-4 text-center"><p className="text-blue-200 text-sm font-bold mb-1">¡Calibremos tu Metabolismo!</p><p className="text-blue-300/70 text-xs">Necesito estos datos para usar la fórmula científica.</p></div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Edad</label><input type="number" placeholder="Años" className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formData.age} onChange={e => setFormData({ ...formData, age: e.target.value })} /></div>
                                <div><label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Altura (cm)</label><input type="number" placeholder="cm" className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formData.height} onChange={e => setFormData({ ...formData, height: e.target.value })} /></div>
                            </div>
                            <div><label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Género</label><div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800"><button onClick={() => setFormData({ ...formData, gender: 'male' })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${formData.gender === 'male' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Hombre</button><button onClick={() => setFormData({ ...formData, gender: 'female' })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${formData.gender === 'female' ? 'bg-pink-600 text-white' : 'text-gray-500'}`}>Mujer</button></div></div>
                            <button onClick={handleSaveStats} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl mt-2 transition-all active:scale-95">Guardar y Calcular</button><button onClick={() => setShowSetup(false)} className="w-full text-xs text-gray-500 hover:text-white py-2">Cancelar</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-gray-800 mb-6"><div className="text-center"><span className="text-xs text-gray-500 font-bold uppercase block mb-1">Neto</span><span className={`text-3xl font-black ${net > 0 ? 'text-white' : 'text-green-400'}`}>{net > 0 ? '+' : ''}{Math.round(net)}</span></div><div className="h-10 w-[1px] bg-gray-700"></div><div className="text-center"><span className="text-xs text-gray-500 font-bold uppercase block mb-1">Estado</span><span className="text-sm font-bold text-gray-300">{net > 500 ? 'Superávit' : net < -500 ? 'Déficit' : 'Mantenimiento'}</span></div></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-950/50 p-4 rounded-2xl border border-blue-900/30"><div className="flex items-center gap-2 mb-3 text-blue-400 border-b border-blue-900/30 pb-2"><Utensils size={16} /> <span className="text-xs font-black uppercase">Ingesta</span></div><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-gray-500">Comidas</span><span className="text-white font-bold">{Math.round(intake)}</span></div></div><div className="mt-4 pt-2 border-t border-gray-800 flex justify-between"><span className="text-xs font-bold text-gray-400">TOTAL</span><span className="text-lg font-black text-blue-400">+{Math.round(intake)}</span></div></div>
                            <div className="bg-gray-950/50 p-4 rounded-2xl border border-orange-900/30"><div className="flex items-center gap-2 mb-3 text-orange-500 border-b border-orange-900/30 pb-2"><Flame size={16} /> <span className="text-xs font-black uppercase">Gasto</span></div><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-gray-500">Actividad</span><span className="text-white font-bold">{Math.round(burned)}</span></div>{includeBMR && (<div className="flex justify-between animate-in fade-in text-purple-300"><span className="text-purple-400/70">Basal</span><span className="font-bold">{bmr}</span></div>)}</div><div className="mt-4 pt-2 border-t border-gray-800 flex justify-between"><span className="text-xs font-bold text-gray-400">TOTAL</span><span className="text-lg font-black text-orange-500">-{Math.round(totalBurned)}</span></div></div>
                        </div>
                        <div className="mt-6 flex items-center justify-between bg-gray-800/50 p-3 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors" onClick={handleToggleBMR}><div className="flex items-center gap-3"><div className={`p-2 rounded-lg transition-colors ${includeBMR ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'}`}><User size={18} /></div><div className="flex flex-col"><span className="text-sm font-bold text-white">Metabolismo Basal (TMB)</span><span className="text-[10px] text-gray-500">{user.physicalStats?.age ? `Calculado: ~${bmr} kcal` : "Añadir datos para calcular"}</span></div></div>{includeBMR ? <ToggleRight size={24} className="text-purple-500" /> : <ToggleLeft size={24} className="text-gray-600" />}</div>
                    </>
                )}
            </div>
        </div>
    );
}

// 4. MODAL HISTORIAL MISIONES
export function MissionsHistoryModal({ stats, onClose }) {
    return (
        <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[80vh]">
                <button onClick={onClose} className="absolute top-4 right-4 bg-gray-800/50 p-2 rounded-full text-gray-400 hover:text-white"><X size={20} /></button>
                <div className="flex items-center gap-2 text-yellow-500 font-bold text-sm tracking-wider uppercase mb-1"><Trophy size={18} /> HISTORIAL</div>
                <h2 className="text-2xl font-black text-white mb-4">Misiones</h2>
                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1">
                    {stats.listCompleted && stats.listCompleted.length > 0 ? (
                        stats.listCompleted.map((m, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border flex flex-col gap-2 relative overflow-hidden group ${m.failed ? 'bg-red-950/30 border-red-500/30' : 'bg-gray-950 border-gray-800/50'}`}>
                                <div className="flex justify-between items-start relative z-10">
                                    <span className={`text-sm font-bold block line-clamp-2 ${m.failed ? 'text-red-200 line-through' : 'text-white'}`}>{m.title}</span>
                                    {m.failed ? <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">FAIL</span> : <CheckCircle size={16} className="text-green-500" />}
                                </div>
                                <div className={`flex gap-3 mt-1 pt-2 border-t relative z-10 ${m.failed ? 'border-red-500/20' : 'border-gray-800'}`}>
                                    {m.failed ? (
                                        <div className="flex items-center gap-1 w-full justify-center"><HeartCrack size={12} className="text-red-500 fill-red-500" /><span className="text-xs font-bold text-red-400">{m.hpLoss ? `-${m.hpLoss} HP` : 'Sin castigo'}</span></div>
                                    ) : (
                                        <>
                                            {(m.xpReward > 0) && <div className="flex items-center gap-1"><Star size={10} className="text-blue-400" /><span className="text-[10px] font-bold text-blue-200">+{m.xpReward} XP</span></div>}
                                            {(m.coinReward > 0) && <div className="flex items-center gap-1"><Coins size={10} className="text-yellow-400" /><span className="text-[10px] font-bold text-yellow-200">+{m.coinReward}</span></div>}
                                            {(m.gameCoinReward > 0) && <div className="flex items-center gap-1"><Gamepad2 size={10} className="text-purple-400" /><span className="text-[10px] font-bold text-purple-200">+{m.gameCoinReward}</span></div>}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 bg-gray-950 rounded-xl border border-gray-800 text-gray-500 text-sm"><p>No hay registro de misiones.</p></div>
                    )}
                </div>
            </div>
        </div>
    );
}