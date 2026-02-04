import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import {
    Settings, X, Bot, Send, ChevronRight, Flame, Wheat, Droplet, Leaf,
    Plus, Target, Trash2, ToggleLeft, ToggleRight, Save, Sparkles, BrainCircuit
} from 'lucide-react';
import api from '../services/api';
import FoodSearchModal from '../components/food/FoodSearchModal';
import FoodWidget from '../components/widgets/FoodWidget'; // 🔥 Importante para la gráfica
import Toast from '../components/common/Toast';

export default function Food() {
    const { user, setUser } = useOutletContext();

    // --- ESTADOS DE DATOS ---
    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // --- ESTADOS DE MODALES ---
    const [activeMealId, setActiveMealId] = useState(null);
    const [showSearch, setShowSearch] = useState(false);
    const [configModal, setConfigModal] = useState({ show: false, mode: 'manual' });

    // --- OBJETIVOS (MACROS) ---
    const [goals, setGoals] = useState(() => {
        if (user && user.macros) return user.macros;
        return { calories: 2100, protein: 158, carbs: 210, fat: 70, fiber: 30 };
    });

    // --- CHAT IA (MODAL CONFIG) ---
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    // --- FORMULARIO MANUAL (MACROS) ---
    const [manualStats, setManualStats] = useState({
        calories: 2100, protein: 150, carbs: 200, fat: 70, fiber: 30
    });
    const [isAutoMacro, setIsAutoMacro] = useState(true);

    // --- EFECTOS ---
    useEffect(() => {
        if (user && user.macros) {
            setGoals(user.macros);
            setManualStats(user.macros);
        }
    }, [user]);

    useEffect(() => {
        fetchLog();
    }, []);

    // Scroll al fondo del chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    // --- FUNCIONES API ---

    // 1. Obtener Log del día (Crucial para actualizar totales)
    const fetchLog = async () => {
        try {
            const res = await api.get('/food/log');
            setLog(res.data);
        } catch (error) {
            console.error("Error obteniendo log:", error);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type = 'success') => setToast({ message, type });

    // 2. Borrar Alimento
    const handleRemoveFood = async (mealId, foodItemId) => {
        if (!window.confirm("¿Borrar alimento?")) return;
        try {
            await api.delete(`/food/log/${mealId}/${foodItemId}`); // Endpoint nuevo (verificaste que existe en foodController?)
            showToast("Eliminado", "info");
            fetchLog(); // 🔥 Recargar para actualizar gráfica
        } catch (error) {
            // Fallback si la ruta delete específica no existe, usar update manual (menos ideal)
            // Pero asumo que creaste removeFoodFromLog en el backend como pediste anteriormente.
            console.error(error);
            showToast("Error al eliminar", "error");
        }
    };

    // 3. Actualizar Macros Usuario
    const updateGoals = async (newGoals) => {
        try {
            const res = await api.put('/users/macros', newGoals);
            setGoals(res.data.macros);
            setUser(res.data); // Actualizar contexto global
            return true;
        } catch (error) {
            showToast("Error al guardar objetivos", "error");
            return false;
        }
    };

    // --- LÓGICA FORMULARIO MACROS ---
    const handleCalorieChange = (e) => {
        const kcal = parseInt(e.target.value) || 0;
        if (isAutoMacro) {
            // Reparto estándar: 30% P / 40% C / 30% G
            setManualStats({
                calories: kcal,
                protein: Math.round((kcal * 0.3) / 4),
                carbs: Math.round((kcal * 0.4) / 4),
                fat: Math.round((kcal * 0.3) / 9),
                fiber: Math.round(kcal / 1000 * 14) // 14g por cada 1000kcal
            });
        } else {
            setManualStats(prev => ({ ...prev, calories: kcal }));
        }
    };

    const handleMacroChange = (field, value) => {
        setManualStats(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
    };

    const handleSaveManual = async () => {
        if (manualStats.calories < 500) return showToast("Mínimo 500 kcal", "error");
        if (await updateGoals(manualStats)) {
            setConfigModal({ show: false, mode: 'manual' });
            showToast("Objetivos actualizados");
        }
    };

    // --- LÓGICA CHAT IA ---
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
                const finalData = { calories, protein, carbs, fat, fiber: fiber || 30 };

                await updateGoals(finalData);
                setManualStats(finalData);
                setConfigModal({ show: false, mode: 'manual' });
                showToast(message || "Macros calculados", "success");
                setChatHistory([]);
            } else {
                setChatHistory([...newHistory, { role: 'assistant', content: res.data.message }]);
            }
        } catch (error) {
            showToast("Error conectando con IA", "error");
        } finally {
            setChatLoading(false);
        }
    };

    // --- UI HELPERS ---
    const handleOpenAdd = (mealId) => {
        setActiveMealId(mealId);
        setShowSearch(true);
    };

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-center text-zinc-500 animate-pulse uppercase text-xs font-bold">Cargando nutrición...</div>
        </div>
    );

    // Preparar datos para el Widget
    const currentKcal = log?.totalCalories || 0;
    const limitKcal = goals.calories || 2100;

    // Convertir array de comidas a objeto para el Widget (si fuera necesario, pero FoodWidget acepta array o keys)
    // Para simplificar, pasamos las comidas estructuradas si el widget las pide así, 
    // o simplemente usamos el log.meals para renderizar la lista abajo.
    const rawMeals = log?.meals || [];
    const structuredMealsForWidget = {
        breakfast: rawMeals.find(m => m.name === 'DESAYUNO')?.foods || [],
        lunch: rawMeals.find(m => m.name === 'COMIDA')?.foods || [],
        merienda: rawMeals.find(m => m.name === 'MERIENDA')?.foods || [],
        dinner: rawMeals.find(m => m.name === 'CENA')?.foods || [],
        snacks: rawMeals.find(m => m.name === 'SNACK')?.foods || []
    };

    return (
        <div className="animate-in fade-in space-y-6 pb-24 bg-black min-h-screen">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* HEADER */}
            <div className="flex justify-between items-center px-4 pt-4">
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

            {/* WIDGET GRÁFICO (Resumen) */}
            <div className="px-4 h-64">
                <FoodWidget
                    currentKcal={currentKcal}
                    limitKcal={limitKcal}
                    meals={structuredMealsForWidget}
                />
            </div>

            {/* LISTA DE COMIDAS */}
            <div className="space-y-4 px-4">
                {rawMeals.map((meal) => {
                    const mealKcal = meal.foods.reduce((acc, i) => acc + i.calories, 0);
                    return (
                        <div key={meal._id} className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-lg group">
                            {/* Cabecera de la Comida */}
                            <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 p-4 flex justify-between items-center border-b border-zinc-800/50">
                                <div>
                                    <h3 className="text-white font-black text-base uppercase tracking-tighter">{meal.name}</h3>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                        {meal.foods.length} items • <span className="text-zinc-300">{mealKcal} KCAL</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleOpenAdd(meal._id)}
                                    className="bg-zinc-800 text-zinc-400 p-2 rounded-xl hover:bg-zinc-700 hover:text-white transition-all active:scale-95 border border-zinc-700"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>

                            {/* Lista de Alimentos */}
                            <div className="p-2">
                                {meal.foods.length === 0 ? (
                                    <div className="py-6 text-center border border-dashed border-zinc-900 rounded-2xl m-2">
                                        <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">Sin alimentos</p>
                                    </div>
                                ) : (
                                    meal.foods.map((item, idx) => (
                                        <div key={item._id || idx} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-2xl transition-colors border-b border-zinc-900 last:border-0 last:mb-0 mb-1">
                                            <div className="flex-1 min-w-0 pr-3">
                                                <p className="text-sm font-bold text-zinc-200 truncate">{item.name}</p>
                                                <div className="text-[10px] text-zinc-500 font-bold uppercase flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                                                    <span className="text-zinc-400">x{item.quantity}</span>
                                                    <span className="text-blue-400/80">P: {Math.round(item.protein)}</span>
                                                    <span className="text-yellow-400/80">C: {Math.round(item.carbs)}</span>
                                                    <span className="text-red-400/80">G: {Math.round(item.fat)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-white whitespace-nowrap bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 flex items-center gap-1">
                                                    {Math.round(item.calories)} <span className="text-[9px] text-zinc-500 font-bold">KCAL</span>
                                                </span>
                                                <button
                                                    onClick={() => handleRemoveFood(meal._id, item._id)}
                                                    className="p-2 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-900/30 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* --- MODAL BUSCADOR / AÑADIR --- */}
            {showSearch && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black">
                    <div className="absolute inset-0 top-14 transform bg-zinc-950/50">
                        <FoodSearchModal
                            mealId={activeMealId}
                            onClose={() => setShowSearch(false)}
                            onFoodAdded={() => {
                                fetchLog(); // 🔥 Recargar datos al añadir
                            }}
                            onShowToast={showToast}
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* --- MODAL CONFIGURACIÓN (MANUAL / IA) --- */}
            {configModal.show && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] w-full max-w-sm shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative">
                        {/* Decoración Top */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-purple-600"></div>

                        {/* Header Modal Config */}
                        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                            <h3 className="text-lg font-black text-white uppercase italic tracking-wide">
                                {configModal.mode === 'ai' ? 'Nutricionista IA' : 'Ajustes Macro'}
                            </h3>
                            <button onClick={() => setConfigModal({ ...configModal, show: false })} className="text-zinc-500 hover:text-white bg-black p-2 rounded-full border border-zinc-800 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body Modal Config */}
                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-black/20">

                            {configModal.mode === 'manual' && (
                                <div className="space-y-6">
                                    {/* Botón ir a IA */}
                                    <button onClick={() => { setChatHistory([{ role: 'assistant', content: "Dime tus datos: Género, Edad, Peso, Altura, Actividad y Objetivo." }]); setConfigModal({ show: true, mode: 'ai' }); }} className="w-full bg-blue-900/10 p-4 rounded-2xl border border-blue-500/20 flex items-center gap-4 hover:bg-blue-900/20 transition-all group">
                                        <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform"><Bot size={24} /></div>
                                        <div className="text-left"><h4 className="font-black text-blue-200 text-sm uppercase">Usar IA</h4><p className="text-[10px] text-blue-400/60 font-bold uppercase tracking-wide">Cálculo automático</p></div>
                                        <ChevronRight className="ml-auto text-blue-500" />
                                    </button>

                                    {/* Inputs Manuales */}
                                    <div>
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Objetivo Calorías</label>
                                        <input type="number" value={manualStats.calories} onChange={handleCalorieChange} className="w-full bg-black text-white text-3xl font-black p-4 rounded-2xl border border-zinc-800 focus:border-white/20 outline-none text-center transition-colors mb-4" />

                                        <div onClick={() => setIsAutoMacro(!isAutoMacro)} className="flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800 mb-4 cursor-pointer">
                                            <span className="text-xs font-bold text-zinc-400 uppercase">Autocompletar Macros</span>
                                            {isAutoMacro ? <ToggleRight className="text-green-500" size={24} /> : <ToggleLeft className="text-zinc-600" size={24} />}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-[9px] font-bold text-blue-400 uppercase block mb-1 text-center">Proteína</label><input type="number" value={manualStats.protein} onChange={(e) => handleMacroChange('protein', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold focus:border-blue-500 outline-none" /></div>
                                            <div><label className="text-[9px] font-bold text-yellow-400 uppercase block mb-1 text-center">Carbos</label><input type="number" value={manualStats.carbs} onChange={(e) => handleMacroChange('carbs', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold focus:border-yellow-500 outline-none" /></div>
                                            <div><label className="text-[9px] font-bold text-red-400 uppercase block mb-1 text-center">Grasa</label><input type="number" value={manualStats.fat} onChange={(e) => handleMacroChange('fat', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold focus:border-red-500 outline-none" /></div>
                                            <div><label className="text-[9px] font-bold text-green-500 uppercase block mb-1 text-center">Fibra</label><input type="number" value={manualStats.fiber} onChange={(e) => handleMacroChange('fiber', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center text-white font-bold focus:border-green-500 outline-none" /></div>
                                        </div>
                                    </div>
                                    <button onClick={handleSaveManual} className="w-full bg-white text-black font-black py-4 rounded-2xl flex justify-center gap-2 uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition-all">
                                        <Save size={18} /> Guardar Cambios
                                    </button>
                                </div>
                            )}

                            {configModal.mode === 'ai' && (
                                <div className="flex flex-col h-full min-h-[400px]">
                                    <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 mb-4 custom-scrollbar">
                                        {chatHistory.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium whitespace-pre-line ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-bl-none'}`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                        {chatLoading && <div className="text-[10px] font-bold text-zinc-500 animate-pulse uppercase tracking-widest text-center mt-2">Calculando...</div>}
                                        <div ref={chatEndRef} />
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Escribe aquí..."
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                                            className="flex-1 bg-black text-white p-4 rounded-2xl border border-zinc-800 focus:border-blue-500 outline-none text-sm font-medium"
                                        />
                                        <button onClick={handleSendChat} disabled={chatLoading} className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-500 disabled:opacity-50 transition-colors">
                                            <Send size={20} />
                                        </button>
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