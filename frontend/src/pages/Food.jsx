import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { Settings, X, Save, Bot, Send, ChevronRight, Flame, Wheat, Droplet, Leaf, Plus, Target } from 'lucide-react';
import api from '../services/api';
import FoodSearchModal from '../components/food/FoodSearchModal';
import Toast from '../components/common/Toast';

export default function Food() {
    const { user, setUser } = useOutletContext();

    // Estados
    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // Modales
    const [activeMealId, setActiveMealId] = useState(null);
    const [showSearch, setShowSearch] = useState(false);
    const [configModal, setConfigModal] = useState({ show: false, mode: 'manual' });

    // Objetivos
    const [goals, setGoals] = useState(() => {
        if (user && user.macros) return user.macros;
        return { calories: 2100, protein: 158, carbs: 210, fat: 70, fiber: 30 };
    });

    // Chat / Inputs
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);
    const [manualCalories, setManualCalories] = useState(goals.calories);

    useEffect(() => { if (user && user.macros) setGoals(user.macros); }, [user]);
    useEffect(() => { fetchLog(); }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

    const fetchLog = async () => {
        try {
            const res = await api.get('/food/log');
            setLog(res.data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    const showToast = (message, type = 'success') => setToast({ message, type });

    const updateGoals = async (newGoals) => {
        try {
            const res = await api.put('/users/macros', newGoals);
            setGoals(res.data.macros);
            setUser(res.data);
            return true;
        } catch (error) {
            showToast("Error guardando objetivos", "error");
            return false;
        }
    };

    const handleSaveManual = async () => {
        const kcal = parseInt(manualCalories);
        if (isNaN(kcal) || kcal < 500) return showToast("Calorías inválidas", "error");

        const p = Math.round((kcal * 0.3) / 4);
        const c = Math.round((kcal * 0.4) / 4);
        const f = Math.round((kcal * 0.3) / 9);
        const fib = Math.round(kcal / 1000 * 14);

        const success = await updateGoals({ calories: kcal, protein: p, carbs: c, fat: f, fiber: fib });
        if (success) {
            setConfigModal({ show: false, mode: 'manual' });
            showToast("Objetivos actualizados");
        }
    };

    const handleSendChat = async () => {
        if (!chatInput.trim()) return;
        const userMsg = { role: 'user', content: chatInput };
        const newHistory = [...chatHistory, userMsg];
        setChatHistory(newHistory);
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await api.post('/food/chat-macros', { history: newHistory });
            if (res.data.type === 'final') {
                const { calories, protein, carbs, fat, fiber, message } = res.data.data;
                await updateGoals({ calories, protein, carbs, fat, fiber });
                setConfigModal({ show: false, mode: 'manual' });
                showToast(message || "Calculado por IA", "success");
                setChatHistory([]);
            } else {
                setChatHistory([...newHistory, { role: 'assistant', content: res.data.message }]);
            }
        } catch (error) {
            showToast("Error conexión IA", "error");
        } finally {
            setChatLoading(false);
        }
    };

    const handleOpenAdd = (mealId) => {
        setActiveMealId(mealId);
        setShowSearch(true);
    };

    // --- LÓGICA DE COLORES DEL CÍRCULO ---
    const getCircleGradient = (percent) => {
        if (percent > 100) return { start: "#ef4444", end: "#dc2626" }; // Rojo Alerta
        if (percent <= 25) return { start: "#22c55e", end: "#84cc16" }; // Verde
        if (percent <= 50) return { start: "#84cc16", end: "#eab308" }; // Verde -> Amarillo
        if (percent <= 75) return { start: "#eab308", end: "#f97316" }; // Amarillo -> Naranja
        return { start: "#f97316", end: "#ef4444" }; // Naranja -> Rojo
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-center text-zinc-500 animate-pulse uppercase text-xs font-bold">Cargando datos...</div></div>;

    const currentKcal = log?.totalCalories || 0;
    const limitKcal = goals.calories || 2100;
    const calPercent = Math.min((currentKcal / limitKcal) * 100, 100);
    const isOver = currentKcal > limitKcal;

    const gradientColors = getCircleGradient(calPercent);
    const shadowColor = isOver ? "rgba(220, 38, 38, 0.4)" : "rgba(34, 197, 94, 0.4)";

    return (
        <div className="animate-in fade-in space-y-6 pb-24 bg-black min-h-screen">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER SECCIÓN */}
            <div className="flex justify-between items-center px-1 pt-2">
                <div>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Comidas</h1>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Target size={12} /> Objetivo: {limitKcal} kcal
                    </p>
                </div>
                <button
                    onClick={() => setConfigModal({ show: true, mode: 'manual' })}
                    className="bg-zinc-900 p-2.5 rounded-xl text-zinc-400 hover:text-white border border-zinc-800 shadow-md transition-colors active:scale-95"
                >
                    <Settings size={20} />
                </button>
            </div>

            {/* RESUMEN CIRCULAR */}
            <div className={`
                relative rounded-[32px] overflow-hidden p-[2px] 
                bg-gradient-to-br from-[${gradientColors.start}] to-[${gradientColors.end}]
                shadow-[0_0_25px_${shadowColor}]
            `} style={{ backgroundImage: `linear-gradient(to bottom right, ${gradientColors.start}, ${gradientColors.end})` }}>

                <div className="bg-zinc-950 rounded-[30px] p-6 relative overflow-hidden flex items-center justify-between">
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-20" style={{ backgroundColor: gradientColors.end }}></div>

                    <div className="relative w-32 h-32 flex items-center justify-center shrink-0 z-10">
                        <svg className="transform -rotate-90 w-full h-full overflow-visible">
                            <defs>
                                <linearGradient id="calorieFlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={gradientColors.start} />
                                    <stop offset="100%" stopColor={gradientColors.end} />
                                </linearGradient>
                            </defs>
                            <circle cx="50%" cy="50%" r="54" stroke="#27272a" strokeWidth="8" fill="transparent" />
                            <circle
                                cx="50%" cy="50%" r="54"
                                stroke="url(#calorieFlowGradient)"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={339}
                                strokeDashoffset={339 - (339 * calPercent) / 100}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                            />
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <div className="w-full flex justify-center items-center px-1">
                                <span className="text-3xl font-black tracking-tighter text-white filter brightness-110 leading-none pb-1">
                                    {currentKcal}
                                </span>
                            </div>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">de {limitKcal}</span>
                        </div>
                    </div>

                    <div className="flex-1 pl-6 space-y-3 relative z-10">
                        {[
                            { label: 'Prot', current: log?.totalProtein, total: goals.protein, color: 'bg-blue-600', text: 'text-blue-400', icon: <Flame size={12} /> },
                            { label: 'Carbs', current: log?.totalCarbs, total: goals.carbs, color: 'bg-yellow-500', text: 'text-yellow-400', icon: <Wheat size={12} /> },
                            { label: 'Grasa', current: log?.totalFat, total: goals.fat, color: 'bg-red-500', text: 'text-red-400', icon: <Droplet size={12} /> },
                            { label: 'Fibra', current: log?.totalFiber, total: goals.fiber, color: 'bg-green-500', text: 'text-green-500', icon: <Leaf size={12} /> },
                        ].map((m, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-[10px] font-bold mb-1">
                                    <span className={`${m.text} flex items-center gap-1 uppercase tracking-wide`}>{m.icon} {m.label}</span>
                                    <span className="text-zinc-500">{Math.round(m.current || 0)}/{m.total}</span>
                                </div>
                                <div className="h-1.5 bg-black rounded-full overflow-hidden border border-zinc-800/50">
                                    <div className={`h-full ${m.color} rounded-full transition-all duration-500 shadow-[0_0_8px_currentColor]`} style={{ width: `${Math.min((m.current / m.total) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* LISTA DE COMIDAS */}
            <div className="space-y-4">
                {log?.meals.map((meal) => {
                    const mealKcal = meal.foods.reduce((acc, i) => acc + i.calories, 0);
                    return (
                        <div key={meal._id} className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-lg group">
                            <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 p-4 flex justify-between items-center border-b border-zinc-800/50">
                                <div>
                                    <h3 className="text-white font-black text-base uppercase tracking-tighter">{meal.name}</h3>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{meal.foods.length} items • <span className="text-zinc-300">{mealKcal} KCAL</span></p>
                                </div>
                                <button
                                    onClick={() => handleOpenAdd(meal._id)}
                                    className="bg-zinc-800 text-zinc-400 p-2 rounded-xl hover:bg-zinc-700 hover:text-white transition-all active:scale-95 border border-zinc-700"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            <div className="p-2">
                                {meal.foods.length === 0 ? (
                                    <div className="py-6 text-center border border-dashed border-zinc-900 rounded-2xl m-2">
                                        <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Sin alimentos</p>
                                    </div>
                                ) : (
                                    meal.foods.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-2xl transition-colors border-b border-zinc-900 last:border-0 last:mb-0 mb-1">
                                            <div className="flex-1 min-w-0 pr-3">
                                                <p className="text-sm font-bold text-zinc-200 truncate">{item.name}</p>
                                                <div className="text-[10px] text-zinc-500 font-bold uppercase flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                                                    <span className="text-zinc-400">x{item.quantity}</span>
                                                    <span className="text-blue-400/80">P: {Math.round(item.protein)}</span>
                                                    <span className="text-yellow-400/80">C: {Math.round(item.carbs)}</span>
                                                    <span className="text-red-400/80">G: {Math.round(item.fat)}</span>
                                                    <span className="text-green-500/80">F: {Math.round(item.fiber)}</span>
                                                </div>
                                            </div>
                                            <span className="text-sm font-black text-white whitespace-nowrap bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 flex items-center gap-1">
                                                {Math.round(item.calories)} <span className="text-[9px] text-zinc-500 font-bold">KCAL</span>
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 🔥 SOLUCIÓN: PORTAL CON "transform" Y FONDO NEGRO TOTAL PARA FORZAR LA POSICIÓN DEL MODAL */}
            {showSearch && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black">
                    {/* Contenedor con transform para atrapar hijos 'fixed' y bajarlos 56px */}
                    <div className="absolute inset-0 top-14 transform bg-zinc-950/50">
                        <FoodSearchModal
                            mealId={activeMealId}
                            onClose={() => setShowSearch(false)}
                            onFoodAdded={fetchLog}
                            onShowToast={showToast}
                        />
                    </div>
                </div>,
                document.body
            )}

            {configModal.show && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] w-full max-w-sm shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                            <h3 className="text-lg font-black text-white uppercase italic tracking-wide">
                                {configModal.mode === 'ai' ? 'Nutricionista IA' : 'Ajustes Macro'}
                            </h3>
                            <button onClick={() => setConfigModal({ ...configModal, show: false })} className="text-zinc-500 hover:text-white bg-black p-2 rounded-full border border-zinc-800 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-black/20">
                            {configModal.mode === 'manual' && (
                                <div className="space-y-6">
                                    <button onClick={() => { setChatHistory([{ role: 'assistant', content: "Dime tus datos: Género, Edad, Peso, Altura, Actividad y Objetivo." }]); setConfigModal({ show: true, mode: 'ai' }); }} className="w-full bg-blue-900/10 p-4 rounded-2xl border border-blue-500/20 flex items-center gap-4 hover:bg-blue-900/20 transition-all group">
                                        <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform"><Bot size={24} /></div>
                                        <div className="text-left">
                                            <h4 className="font-black text-blue-200 text-sm uppercase">Usar IA</h4>
                                            <p className="text-[10px] text-blue-400/60 font-bold uppercase tracking-wide">Cálculo automático</p>
                                        </div>
                                        <ChevronRight className="ml-auto text-blue-500" />
                                    </button>
                                    <div>
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Objetivo Calorías</label>
                                        <input type="number" value={manualCalories} onChange={e => setManualCalories(e.target.value)} className="w-full bg-black text-white text-3xl font-black p-4 rounded-2xl border border-zinc-800 focus:border-white/20 outline-none text-center transition-colors" />
                                        <p className="text-[9px] text-center text-zinc-600 mt-2 font-bold uppercase">Se recalcularán los macros (30/40/30/14)</p>
                                    </div>
                                    <button onClick={handleSaveManual} className="w-full bg-white text-black font-black py-4 rounded-2xl flex justify-center gap-2 uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition-all"><Save size={18} /> Guardar</button>
                                </div>
                            )}
                            {configModal.mode === 'ai' && (
                                <div className="flex flex-col h-full min-h-[400px]">
                                    <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 mb-4 custom-scrollbar">
                                        {chatHistory.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium whitespace-pre-line ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-bl-none'}`}>{msg.content}</div>
                                            </div>
                                        ))}
                                        {chatLoading && <div className="text-[10px] font-bold text-zinc-500 animate-pulse uppercase tracking-widest text-center mt-2">Calculando...</div>}
                                        <div ref={chatEndRef} />
                                    </div>
                                    <div className="flex gap-2">
                                        <input autoFocus type="text" placeholder="Escribe aquí..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} className="flex-1 bg-black text-white p-4 rounded-2xl border border-zinc-800 focus:border-blue-500 outline-none text-sm font-medium" />
                                        <button onClick={handleSendChat} disabled={chatLoading} className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-500 disabled:opacity-50 transition-colors"><Send size={20} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}