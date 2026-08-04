import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
// 🔥 IMPORTAMOS ZUSTAND EN LUGAR DE USEOUTLETCONTEXT
import { useAuthStore } from '../store/useAuthStore';
// 🔥 IMPORTAMOS SWR Y SMOOTHMOUNT
import { useSmoothMount } from '../hooks/useSmoothMount';
import useSWR from 'swr';
import {
    Settings, X, Bot, Send, ChevronRight,
    Plus, Trash2, ToggleLeft, ToggleRight, Save
} from 'lucide-react';
import api from '../services/api';
import FoodSearchModal from '../components/food/FoodSearchModal';
import Toast from '../components/common/Toast';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingScreen from '../components/common/LoadingScreen';

const fetcher = url => api.get(url).then(res => res.data);

const ACENTO = '#a3e635'; // lima: el color de la sección de comidas

// Un color por macro, igual en la tarjeta de resumen y en cada alimento
const MACRO_COLORS = { protein: '#3b82f6', carbs: '#facc15', fat: '#f87171', fiber: '#22c55e' };

// Un tono por comida, de más oscuro (primera del día) a más claro
const TONO_COMIDA = {
    DESAYUNO: '#65a30d',
    COMIDA: '#84cc16',
    MERIENDA: '#a3e635',
    CENA: '#bef264',
    SNACK: '#d9f99d'
};
const tonoDeComida = (nombre) => TONO_COMIDA[(nombre || '').toUpperCase()] || ACENTO;

const f = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');

export default function Food() {
    // 🔥 CONECTAMOS CON ZUSTAND Y AMORTIGUADOR
    const isSmoothMounted = useSmoothMount();
    const user = useAuthStore(state => state.user);
    const setUser = useAuthStore(state => state.setUser);

    // 🔥 SWR: Carga instantánea desde caché
    const { data: log, mutate: mutateLog, isLoading } = useSWR('/food/log', fetcher);

    // --- ESTADOS DE DATOS ---
    const [toast, setToast] = useState(null);
    // Confirmación de borrado con el modal de la app (antes era un window.confirm
    // nativo, que rompía la estética y no se puede tocar fuera para cancelar)
    const [confirmDelete, setConfirmDelete] = useState(null);

    // --- ESTADOS DE MODALES ---
    const [activeMealId, setActiveMealId] = useState(null);
    // Nombre de la comida activa: el modal lo usa para preseleccionar carpeta
    const [activeMealName, setActiveMealName] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [configModal, setConfigModal] = useState({ show: false, mode: 'manual' });

    // --- OBJETIVOS (MACROS) ---
    const [goals, setGoals] = useState(() => {
        if (user && user.macros) return user.macros;
        return { calories: 2100, protein: 158, carbs: 210, fat: 70, fiber: 30 };
    });

    // --- CHAT IA ---
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    // --- FORMULARIO MANUAL ---
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
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    // --- FUNCIONES API ---
    const showToast = (message, type = 'success') => setToast({ message, type });

    // 🔥 OPTIMISTIC UI: BORRAR
    const handleRemoveFood = async (mealId, foodItemId) => {
        // Actualizamos la UI AL INSTANTE en SWR
        mutateLog(prev => {
            if (!prev) return prev;
            const newLog = JSON.parse(JSON.stringify(prev)); // Clon profundo
            const meal = newLog.meals.find(m => m._id === mealId);
            if (meal) {
                const foodIdx = meal.foods.findIndex(f => f._id === foodItemId);
                if (foodIdx > -1) {
                    const food = meal.foods[foodIdx];
                    newLog.totalCalories = Math.max(0, newLog.totalCalories - food.calories);
                    newLog.totalProtein = Math.max(0, newLog.totalProtein - food.protein);
                    newLog.totalCarbs = Math.max(0, newLog.totalCarbs - food.carbs);
                    newLog.totalFat = Math.max(0, newLog.totalFat - food.fat);
                    newLog.totalFiber = Math.max(0, newLog.totalFiber - food.fiber);
                    meal.foods.splice(foodIdx, 1);
                }
            }
            return newLog;
        }, false);

        // Petición en segundo plano
        try {
            await api.delete(`/food/log/${mealId}/${foodItemId}`);
            mutateLog(); // Sincronizamos silenciosamente
        } catch (error) {
            console.error(error);
            mutateLog(); // Rollback si falla
            showToast("Error de conexión. Se han restaurado los datos.", "error");
        }
    };

    // 🔥 OPTIMISTIC UI: AÑADIR (Llamada desde el Modal)
    const handleOptimisticAdd = (foodData) => {
        mutateLog(prev => {
            if (!prev) return prev;
            const newLog = JSON.parse(JSON.stringify(prev));
            const meal = newLog.meals.find(m => m._id === activeMealId);
            if (meal) {
                // Le damos un ID temporal para que React no se queje
                meal.foods.push({ ...foodData, _id: `temp_${Math.random()}` });
                newLog.totalCalories += foodData.calories;
                newLog.totalProtein += foodData.protein;
                newLog.totalCarbs += foodData.carbs;
                newLog.totalFat += foodData.fat;
                newLog.totalFiber += foodData.fiber;
            }
            return newLog;
        }, false);
    };

    const updateGoals = async (newGoals) => {
        try {
            const res = await api.put('/users/macros', newGoals);
            setGoals(res.data.macros);
            setUser(res.data); // Sincroniza con Zustand
            return true;
        } catch (error) {
            showToast("Error al guardar objetivos", "error");
            return false;
        }
    };

    const handleCalorieChange = (e) => {
        const kcal = parseInt(e.target.value) || 0;
        if (isAutoMacro) {
            setManualStats({
                calories: kcal,
                protein: Math.round((kcal * 0.3) / 4),
                carbs: Math.round((kcal * 0.4) / 4),
                fat: Math.round((kcal * 0.3) / 9),
                fiber: Math.round(kcal / 1000 * 14)
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

    const handleOpenAdd = (mealId, mealName = '') => {
        setActiveMealId(mealId);
        setActiveMealName(mealName);
        setShowSearch(true);
    };

    if (!isSmoothMounted || (!log && isLoading)) return <LoadingScreen message="Cargando nutrición..." />;

    // --- CÁLCULOS VISUALES PARA LA TARJETA VERDE ---
    const currentKcal = log?.totalCalories || 0;
    const limitKcal = goals.calories || 2100;
    const percentage = Math.min((currentKcal / limitKcal) * 100, 100);
    const restanKcal = limitKcal - currentKcal;
    const sePasa = currentKcal > limitKcal;
    // Si te pasas de calorías, el acento de la tarjeta entera pasa a rojo
    const acentoComida = sePasa ? '#ef4444' : ACENTO;

    // Anillo de 112px con trazo de 9 (mismo que el widget del home)
    const R = 48;
    const C = 2 * Math.PI * R;
    const offsetAnillo = C - (percentage / 100) * C;

    const macros = [
        { label: 'PROT', current: log?.totalProtein || 0, total: goals.protein, color: MACRO_COLORS.protein },
        { label: 'CARBS', current: log?.totalCarbs || 0, total: goals.carbs, color: MACRO_COLORS.carbs },
        { label: 'GRASA', current: log?.totalFat || 0, total: goals.fat, color: MACRO_COLORS.fat },
        { label: 'FIBRA', current: log?.totalFiber || 0, total: goals.fiber, color: MACRO_COLORS.fiber },
    ];

    const rawMeals = log?.meals || [];

    return (
        <div className="animate-in fade-in space-y-6 pb-24 bg-black min-h-screen">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {confirmDelete && (
                <ConfirmDialog
                    message={`¿Quitar "${confirmDelete.name}" de esta comida?`}
                    confirmLabel="Borrar"
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={() => {
                        handleRemoveFood(confirmDelete.mealId, confirmDelete.foodItemId);
                        setConfirmDelete(null);
                    }}
                />
            )}

            {/* CABECERA DE PÁGINA */}
            <div className="flex items-start justify-between gap-3 px-4 pt-[18px]">
                <div className="min-w-0">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none not-italic">
                        Objetivo {f(limitKcal)} kcal
                    </p>
                    <h1 className="mt-[9px] text-[26px] font-black text-white uppercase tracking-[-0.045em] leading-none not-italic">
                        Comidas
                    </h1>
                </div>
                <button
                    onClick={() => setConfigModal({ show: true, mode: 'manual' })}
                    aria-label="Ajustar objetivos"
                    className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 mt-1"
                >
                    <Settings size={21} />
                </button>
            </div>

            {/* TARJETA DE MACROS */}
            <div className="px-4">
                <div className="relative bg-[#0a0a0c] border border-white/[0.07] rounded-[26px] p-[18px] overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${acentoComida}, transparent)` }} />
                    <div className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] opacity-[0.11] pointer-events-none" style={{ background: acentoComida }} />

                    <div className="relative z-10 flex items-center gap-[18px]">

                        {/* ANILLO DE CALORÍAS */}
                        <div className="relative w-28 h-28 shrink-0">
                            <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
                                <circle cx="56" cy="56" r={R} fill="none" stroke="#1b1b1e" strokeWidth="9" />
                                <circle
                                    cx="56" cy="56" r={R}
                                    fill="none"
                                    stroke={acentoComida}
                                    strokeWidth="9"
                                    strokeLinecap="round"
                                    strokeDasharray={C}
                                    strokeDashoffset={offsetAnillo}
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[27px] font-black text-white tracking-[-0.05em] leading-none not-italic">
                                    {f(currentKcal)}
                                </span>
                                <span className="mt-1 text-[10px] font-black tracking-[0.16em] leading-none not-italic" style={{ color: acentoComida }}>
                                    KCAL
                                </span>
                            </div>
                        </div>

                        {/* BARRAS DE MACROS */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.16em] leading-none not-italic">
                                    Macros
                                </span>
                                <span className="text-[10px] font-black leading-none not-italic" style={{ color: acentoComida }}>
                                    {sePasa ? `+${f(Math.abs(restanKcal))}` : `RESTAN ${f(restanKcal)}`}
                                </span>
                            </div>

                            <div className="mt-3.5 flex flex-col gap-[9px]">
                                {macros.map((m) => {
                                    const pct = m.total > 0 ? Math.min((m.current / m.total) * 100, 100) : 0;
                                    return (
                                        <div key={m.label} className="flex items-center gap-2">
                                            <span className="w-[44px] text-[9px] font-black uppercase tracking-[0.1em] leading-none text-zinc-400 not-italic">
                                                {m.label}
                                            </span>
                                            <div className="flex-1 h-[5px] bg-[#18181b] rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: m.color }} />
                                            </div>
                                            <span className="text-[9px] font-black leading-none text-zinc-300 whitespace-nowrap not-italic">
                                                {f(m.current)}<span style={{ color: m.color }}>/{f(m.total)}</span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* LISTA DE COMIDAS */}
            <div className="space-y-3 px-4">
                {rawMeals.map((meal) => {
                    const mealKcal = meal.foods.reduce((acc, i) => acc + i.calories, 0);
                    const tono = tonoDeComida(meal.name);
                    const vacia = meal.foods.length === 0;

                    return (
                        <div
                            key={meal._id}
                            className={`relative bg-[#0a0a0c] rounded-[24px] overflow-hidden ${vacia ? 'border-2 border-dashed border-white/[0.12]' : 'border border-white/[0.07]'}`}
                        >
                            {!vacia && (
                                <>
                                    <div className="absolute top-0 left-0 w-full h-[2px] pointer-events-none" style={{ background: `linear-gradient(90deg, ${tono}, transparent)` }} />
                                    <div className="absolute -right-7 -bottom-9 w-[130px] h-[130px] rounded-full blur-[30px] opacity-[0.11] pointer-events-none" style={{ background: tono }} />
                                </>
                            )}

                            {/* Cabecera de la comida */}
                            <div className="relative z-10 p-[18px] flex justify-between items-center gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.16em] leading-none not-italic" style={{ color: vacia ? '#71717a' : '#d4d4d8' }}>
                                        {meal.name}
                                    </h3>
                                    {vacia ? (
                                        <p className="mt-2 text-[9px] font-black text-zinc-600 uppercase tracking-[0.08em] leading-none not-italic">
                                            Sin alimentos{restanKcal > 0 && ` · Te quedan ${f(restanKcal)} kcal`}
                                        </p>
                                    ) : (
                                        <div className="mt-2 flex items-baseline gap-1.5">
                                            <span className="text-[20px] font-black text-white tracking-[-0.04em] leading-none not-italic">{f(mealKcal)}</span>
                                            <span className="text-[9px] font-black uppercase tracking-[0.08em] leading-none not-italic" style={{ color: tono }}>
                                                Kcal · {meal.foods.length} {meal.foods.length === 1 ? 'item' : 'items'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleOpenAdd(meal._id, meal.name)}
                                    aria-label={`Añadir a ${meal.name}`}
                                    className="w-[38px] h-[38px] rounded-[13px] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                                    style={{ background: `${tono}1f`, color: tono }}
                                >
                                    <Plus size={19} strokeWidth={2.6} />
                                </button>
                            </div>

                            {/* Lista de alimentos */}
                            {!vacia && (
                                <div className="relative z-10 border-t border-white/[0.05]">
                                    {meal.foods.map((item, idx) => (
                                        <div key={item._id || idx} className="flex justify-between items-center gap-3 px-[18px] py-3 border-b border-white/[0.04] last:border-0">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-bold text-zinc-200 truncate not-italic">{item.name}</p>
                                                <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-1 text-[9px] font-black uppercase not-italic">
                                                    <span className="text-zinc-600">x{item.quantity}</span>
                                                    <span style={{ color: MACRO_COLORS.protein }}>P {f(item.protein)}</span>
                                                    <span style={{ color: MACRO_COLORS.carbs }}>C {f(item.carbs)}</span>
                                                    <span style={{ color: MACRO_COLORS.fat }}>G {f(item.fat)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5 shrink-0">
                                                <span className="text-[13px] font-black text-white whitespace-nowrap not-italic">
                                                    {f(item.calories)}<span className="text-[9px] font-black ml-1" style={{ color: tono }}>KCAL</span>
                                                </span>
                                                <button
                                                    onClick={() => setConfirmDelete({ mealId: meal._id, foodItemId: item._id, name: item.name })}
                                                    aria-label={`Quitar ${item.name}`}
                                                    className="p-2 text-zinc-600 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* --- MODALES --- */}
            {showSearch && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black">
                    <div className="absolute inset-0 top-14 transform bg-zinc-950/50">
                        <FoodSearchModal
                            mealId={activeMealId}
                            mealName={activeMealName}
                            onClose={() => setShowSearch(false)}
                            // 🔥 LE PASAMOS LA FUNCIÓN OPTIMISTA AL MODAL
                            onFoodAddedOptimistic={(foodData) => handleOptimisticAdd(foodData)}
                            onBackgroundSync={() => mutateLog()}
                            onShowToast={showToast}
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Configuración (IA / Manual) */}
            {configModal.show && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] w-full max-w-sm shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-purple-600"></div>

                        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                            <h3 className="text-lg font-black text-white uppercase italic tracking-wide">
                                {configModal.mode === 'ai' ? 'Nutricionista IA' : 'Ajustes Macro'}
                            </h3>
                            <button onClick={() => setConfigModal({ ...configModal, show: false })} className="text-zinc-500 hover:text-white bg-black p-2 rounded-full border border-zinc-800 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-black/20">
                            {configModal.mode === 'manual' && (
                                <div className="space-y-6">
                                    <button onClick={() => { setChatHistory([{ role: 'assistant', content: "Dime tus datos: Género, Edad, Peso, Altura, Actividad y Objetivo." }]); setConfigModal({ show: true, mode: 'ai' }); }} className="w-full bg-blue-900/10 p-4 rounded-2xl border border-blue-500/20 flex items-center gap-4 hover:bg-blue-900/20 transition-all group">
                                        <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform"><Bot size={24} /></div>
                                        <div className="text-left"><h4 className="font-black text-blue-200 text-sm uppercase">Usar IA</h4><p className="text-[10px] text-blue-400/60 font-bold uppercase tracking-wide">Cálculo automático</p></div>
                                        <ChevronRight className="ml-auto text-blue-500" />
                                    </button>

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