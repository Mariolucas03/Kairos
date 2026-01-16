import { useState, useRef, useEffect } from 'react';
import { Search, Plus, X, Flame, Wheat, Droplet, Leaf, Sparkles, ScanBarcode, ArrowRight, Camera, Image as ImageIcon, Trash2, BrainCircuit, Save, Check } from 'lucide-react';
import api from '../../services/api';

// --- COMPONENTE INTERNO: ÍTEM DESLIZABLE ---
const SwipeableFoodItem = ({ item, onAdd, onDelete }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const startY = useRef(0);

    // Cálculos de macros (asegurando ceros)
    const p = Math.round(item.protein || item.macros?.protein || 0);
    const c = Math.round(item.carbs || item.macros?.carbs || 0);
    const f = Math.round(item.fat || item.macros?.fat || 0);
    const fib = Math.round(item.fiber || item.macros?.fiber || 0);

    const handleTouchStart = (e) => { startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY; setIsDragging(true); };
    const handleTouchMove = (e) => {
        if (!isDragging) return;
        const diffX = e.touches[0].clientX - startX.current;
        const diffY = e.touches[0].clientY - startY.current;
        if (Math.abs(diffY) > Math.abs(diffX)) return;
        if (Math.abs(diffX) > 10 && Math.abs(diffX) < 150) setOffsetX(diffX);
    };
    const handleTouchEnd = () => { setIsDragging(false); finishDrag(); };
    const handleMouseDown = (e) => { startX.current = e.clientX; startY.current = e.clientY; setIsDragging(true); };
    const handleMouseMove = (e) => { if (!isDragging) return; const diffX = e.clientX - startX.current; if (Math.abs(diffX) < 150) setOffsetX(diffX); };
    const handleMouseUp = () => { setIsDragging(false); finishDrag(); };
    const handleMouseLeave = () => { if (isDragging) { setIsDragging(false); finishDrag(); } };

    const finishDrag = () => {
        if (Math.abs(offsetX) > 80) {
            setOffsetX(offsetX > 0 ? 500 : -500);
            setTimeout(() => onDelete(item._id), 300);
        } else { setOffsetX(0); }
    };

    const trashOpacity = Math.min(Math.abs(offsetX) / 50, 1);
    const trashScale = Math.min(Math.abs(offsetX) / 50, 1.2);

    return (
        <div className="relative w-full mb-2 h-[72px] select-none overflow-hidden rounded-2xl touch-pan-y">
            <div className="absolute inset-0 bg-red-600 flex items-center justify-between px-6 rounded-2xl transition-colors">
                <Trash2 className="text-white transition-transform" style={{ opacity: trashOpacity, transform: `scale(${trashScale})` }} size={24} />
                <Trash2 className="text-white transition-transform" style={{ opacity: trashOpacity, transform: `scale(${trashScale})` }} size={24} />
            </div>
            <div
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
                style={{ transform: `translateX(${offsetX}px)`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                className="absolute inset-0 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center z-10"
            >
                <div className="pointer-events-none">
                    <p className="font-bold text-white text-sm truncate w-56">{item.name}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] font-black uppercase tracking-wide">
                        <span className="text-zinc-400">KCAL: {Math.round(item.calories)}</span>
                        <span className="text-blue-400">P: {p}</span>
                        <span className="text-yellow-400">C: {c}</span>
                        <span className="text-red-400">G: {f}</span>
                        <span className="text-green-500">F: {fib}</span>
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); if (Math.abs(offsetX) === 0) onAdd(item); }} className="bg-white text-black p-1.5 rounded-lg shrink-0 hover:bg-zinc-200 active:scale-90 transition-transform cursor-pointer">
                    <Plus size={16} strokeWidth={3} />
                </button>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---
export default function FoodSearchModal({ mealId, onClose, onFoodAdded, onShowToast }) {
    const [mode, setMode] = useState('search');

    // Búsqueda
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    // IA
    const [aiInput, setAiInput] = useState('');
    const [aiImage, setAiImage] = useState(null);
    const [aiImagePreview, setAiImagePreview] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const fileInputRef = useRef(null);

    // IA Helper
    const [showAiHelper, setShowAiHelper] = useState(false);
    const [aiDescription, setAiDescription] = useState('');
    const [aiHelperLoading, setAiHelperLoading] = useState(false);

    // Formulario
    const [manualForm, setManualForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', quantity: 1 });
    const searchInputRef = useRef(null);

    useEffect(() => { if (mode === 'search' && query.trim() === '') fetchSavedFoods(); }, [mode, query]);
    const fetchSavedFoods = async () => { setLoading(true); try { const res = await api.get('/food/saved'); setResults(res.data); } catch (e) { console.error(e); } finally { setLoading(false); } };

    useEffect(() => { const timer = setTimeout(() => { if (query.trim().length > 0 && mode === 'search') searchFood(); }, 500); return () => clearTimeout(timer); }, [query]);
    const searchFood = async () => { setLoading(true); try { const res = await api.get(`/food/search?query=${query}`); setResults(res.data); } catch (e) { console.error(e); } finally { setLoading(false); } };

    // --- ACCIONES GENERALES ---
    const handleAddFood = async (food) => {
        try {
            const foodData = { name: food.name, calories: Number(food.calories), protein: Number(food.protein || 0), carbs: Number(food.carbs || 0), fat: Number(food.fat || 0), fiber: Number(food.fiber || 0), quantity: 1 };
            await api.post(`/food/log/${mealId}`, foodData);
            onFoodAdded(); onShowToast("Añadido correctamente", "success"); onClose();
        } catch (error) { onShowToast("Error al añadir", "error"); }
    };

    const handleDeleteSavedFood = async (id) => {
        try { await api.delete(`/food/saved/${id}`); setResults(prev => prev.filter(item => item._id !== id)); onShowToast("Alimento eliminado", "info"); }
        catch (e) { onShowToast("No se pudo eliminar", "error"); fetchSavedFoods(); }
    };

    // --- ACCIÓN 1: ESCANEAR (AHORA LLEVA A REVISIÓN) ---
    const handleAiScanSubmit = async () => {
        if (!aiInput.trim() && !aiImage) return;
        setAiLoading(true);
        try {
            let analyzedData = null;
            if (aiImage) {
                const formData = new FormData();
                formData.append('text', aiInput);
                formData.append('image', aiImage);
                const res = await api.post('/food/analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                analyzedData = res.data;
            } else {
                const res = await api.post('/food/analyze-text', { text: aiInput });
                if (res.data.type === 'success') { analyzedData = res.data.data; analyzedData.name = analyzedData.name || aiInput; }
            }

            if (!analyzedData || analyzedData.calories === undefined) throw new Error("No se identificó el alimento");

            setManualForm({
                name: analyzedData.name || "Alimento Detectado",
                calories: analyzedData.calories,
                protein: analyzedData.protein || 0,
                carbs: analyzedData.carbs || 0,
                fat: analyzedData.fat || 0,
                fiber: analyzedData.fiber || 0,
                quantity: 1
            });

            onShowToast("¡Analizado! Revisa los datos.", "success");
            setMode('review');

        } catch (error) {
            console.error(error);
            onShowToast("Error al procesar. Intenta de nuevo.", "error");
        } finally {
            setAiLoading(false);
        }
    };

    // --- ACCIONES DE REVISIÓN / MANUAL ---
    const handleAddToMealNow = async () => {
        if (!manualForm.name.trim() || manualForm.calories === '') { onShowToast("Nombre y Calorías obligatorios", "error"); return; }
        try {
            const foodData = { ...manualForm, calories: Number(manualForm.calories), protein: Number(manualForm.protein), carbs: Number(manualForm.carbs), fat: Number(manualForm.fat), fiber: Number(manualForm.fiber) };
            await api.post(`/food/log/${mealId}`, foodData);
            onFoodAdded(); onShowToast("Añadido a la comida", "success"); onClose();
        } catch (e) { onShowToast("Error al añadir", "error"); }
    };

    const handleSaveToList = async () => {
        if (!manualForm.name.trim() || manualForm.calories === '') { onShowToast("Nombre y Calorías obligatorios", "error"); return; }
        try {
            const foodData = { ...manualForm, calories: Number(manualForm.calories), protein: Number(manualForm.protein), carbs: Number(manualForm.carbs), fat: Number(manualForm.fat), fiber: Number(manualForm.fiber), servingSize: '1 ración' };
            await api.post('/food/save', foodData);
            onShowToast("Guardado en tu lista", "success");
            setMode('search'); setQuery(manualForm.name);
            const res = await api.get(`/food/search?query=${manualForm.name}`);
            setResults(res.data);
            setManualForm({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', quantity: 1 });
        } catch (e) { onShowToast("Error al guardar", "error"); }
    };

    const handleAiAutofill = async () => {
        if (!aiDescription.trim()) return;
        setAiHelperLoading(true);
        try {
            const res = await api.post('/food/analyze-text', { text: aiDescription });
            if (res.data.type === 'success') {
                const d = res.data.data;
                setManualForm(p => ({ ...p, calories: d.calories || p.calories, protein: d.protein || p.protein, carbs: d.carbs || p.carbs, fat: d.fat || p.fat, fiber: d.fiber || p.fiber }));
                setShowAiHelper(false); onShowToast("¡Macros calculados!", "success");
            }
        } catch (e) { onShowToast("Error IA", "error"); } finally { setAiHelperLoading(false); }
    };

    const handleImageUpload = (e) => { const f = e.target.files[0]; if (f) { setAiImage(f); setAiImagePreview(URL.createObjectURL(f)); } };
    const clearImage = () => { setAiImage(null); setAiImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

    return (
        <div className="flex flex-col h-full w-full bg-zinc-950 text-white animate-in slide-in-from-bottom-10 duration-200">
            <div className="px-5 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 shrink-0">
                <h2 className="text-lg font-black uppercase tracking-wider text-white">
                    {mode === 'review' ? 'Revisar Datos' : 'Añadir Alimento'}
                </h2>
                <button onClick={onClose} className="bg-zinc-900 p-2 rounded-full text-zinc-400 hover:text-white border border-zinc-800 transition-colors"><X size={20} /></button>
            </div>

            {mode !== 'review' && (
                <div className="p-4 shrink-0">
                    <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                        <button onClick={() => setMode('search')} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${mode === 'search' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500'}`}>Buscar</button>
                        <button onClick={() => setMode('ai')} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 ${mode === 'ai' ? 'bg-blue-900/30 text-blue-400 shadow-md border border-blue-500/30' : 'text-zinc-500'}`}><Sparkles size={12} /> IA Scan</button>
                        <button onClick={() => setMode('manual')} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${mode === 'manual' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500'}`}>Manual</button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-20">

                {mode === 'search' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input ref={searchInputRef} type="text" placeholder="Buscar en mis alimentos..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 text-white pl-11 pr-4 py-4 rounded-2xl outline-none focus:border-zinc-600 transition-all font-bold text-sm placeholder-zinc-600" />
                        </div>
                        <div className="space-y-2">
                            {loading ? <div className="text-center py-10 text-zinc-600 font-bold uppercase text-xs animate-pulse">Cargando...</div> :
                                results.length > 0 ? results.map((item, idx) => (
                                    <SwipeableFoodItem key={item._id || idx} item={item} onAdd={handleAddFood} onDelete={handleDeleteSavedFood} />
                                )) : <div className="text-center py-10 text-zinc-700 font-bold uppercase text-xs">{query ? "No encontrado" : "No tienes alimentos guardados"}</div>}
                        </div>
                    </div>
                )}

                {mode === 'ai' && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                        <div className="relative mt-2"><textarea placeholder="Describe tu comida o sube una foto..." className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white text-sm font-medium resize-none focus:border-blue-500/50 outline-none placeholder-zinc-600 leading-relaxed" value={aiInput} onChange={(e) => setAiInput(e.target.value)} /></div>
                        <div>
                            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                            {!aiImagePreview ? (
                                <button onClick={() => fileInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 hover:bg-zinc-900 transition-all group"><div className="bg-zinc-900 p-3 rounded-2xl group-hover:bg-black transition-colors"><Camera className="text-zinc-500 group-hover:text-blue-400" size={24} /></div><span className="text-xs font-bold text-zinc-500 uppercase tracking-wide group-hover:text-zinc-300">Tomar Foto / Subir Imagen</span></button>
                            ) : (
                                <div className="relative rounded-3xl overflow-hidden border border-zinc-800 group"><img src={aiImagePreview} alt="Preview" className="w-full h-48 object-cover opacity-80 group-hover:opacity-100 transition-opacity" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4"><div className="flex justify-between items-center w-full"><span className="text-xs font-bold text-white flex items-center gap-2"><ImageIcon size={14} /> Imagen seleccionada</span><button onClick={clearImage} className="bg-red-500/20 text-red-400 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all backdrop-blur-md border border-red-500/30"><Trash2 size={18} /></button></div></div></div>
                            )}
                        </div>
                        <div className="pt-2"><button onClick={handleAiScanSubmit} disabled={aiLoading || (!aiInput.trim() && !aiImage)} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-blue-900/20">{aiLoading ? <span className="animate-pulse flex items-center gap-2"><Sparkles size={16} /> Analizando...</span> : <>Procesar con IA <ArrowRight size={18} /></>}</button></div>
                    </div>
                )}

                {(mode === 'manual' || mode === 'review') && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                        {mode === 'review' && (
                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-3xl mb-2">
                                <p className="text-xs font-bold text-green-400 text-center">✅ ¡Análisis completado! Revisa los datos.</p>
                            </div>
                        )}

                        <div className="bg-zinc-900/30 p-4 rounded-3xl border border-zinc-800">
                            <label className="text-[10px] font-bold text-zinc-400 mb-1 block pl-2">Nombre</label>
                            <input type="text" placeholder="Ej: Pollo con arroz" className="w-full bg-zinc-950 border border-zinc-800 text-white p-4 rounded-2xl outline-none focus:border-zinc-600 font-bold" value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} />

                            {mode === 'manual' && (
                                <div className="mt-3 border-t border-zinc-800 pt-3"><button onClick={() => setShowAiHelper(!showAiHelper)} className="flex items-center gap-2 text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors"><Sparkles size={14} /> {showAiHelper ? 'Ocultar Asistente IA' : '🪄 Autocompletar con IA'}</button>{showAiHelper && (<div className="mt-3 space-y-2 animate-in slide-in-from-top-2"><textarea placeholder="Ej: 200g de pollo y 100g de arroz blanco cocido..." className="w-full bg-zinc-950 border border-purple-500/30 rounded-xl p-3 text-xs text-white focus:border-purple-500 outline-none min-h-[80px]" value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} /><button onClick={handleAiAutofill} disabled={aiHelperLoading || !aiDescription.trim()} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-xs font-black uppercase tracking-wider flex justify-center gap-2 disabled:opacity-50">{aiHelperLoading ? <BrainCircuit className="animate-spin" size={14} /> : <BrainCircuit size={14} />} Calcular Macros</button></div>)}</div>
                            )}
                        </div>

                        <div className="bg-zinc-900/30 p-4 rounded-3xl border border-zinc-800 space-y-4">
                            <div><label className="text-[10px] font-bold text-white mb-1 block pl-2 flex items-center gap-1">KCAL</label><input type="number" inputMode="decimal" placeholder="0" className="w-full bg-zinc-950 border border-zinc-800 text-white text-2xl p-4 rounded-2xl outline-none focus:border-orange-500/50 font-black text-center" value={manualForm.calories} onChange={e => setManualForm({ ...manualForm, calories: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[10px] font-bold text-zinc-400 mb-1 block pl-2 flex items-center gap-1"><Flame size={10} className="text-blue-500" /> Prot (g)</label><input type="number" inputMode="decimal" placeholder="0" className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-2xl outline-none focus:border-blue-500/50 font-bold text-center" value={manualForm.protein} onChange={e => setManualForm({ ...manualForm, protein: e.target.value })} /></div>
                                <div><label className="text-[10px] font-bold text-zinc-400 mb-1 block pl-2 flex items-center gap-1"><Wheat size={10} className="text-yellow-500" /> Carb (g)</label><input type="number" inputMode="decimal" placeholder="0" className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-2xl outline-none focus:border-yellow-500/50 font-bold text-center" value={manualForm.carbs} onChange={e => setManualForm({ ...manualForm, carbs: e.target.value })} /></div>
                                <div><label className="text-[10px] font-bold text-zinc-400 mb-1 block pl-2 flex items-center gap-1"><Droplet size={10} className="text-red-500" /> Grasa (g)</label><input type="number" inputMode="decimal" placeholder="0" className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-2xl outline-none focus:border-red-500/50 font-bold text-center" value={manualForm.fat} onChange={e => setManualForm({ ...manualForm, fat: e.target.value })} /></div>
                                <div><label className="text-[10px] font-bold text-zinc-400 mb-1 block pl-2 flex items-center gap-1"><Leaf size={10} className="text-green-500" /> Fibra (g)</label><input type="number" inputMode="decimal" placeholder="0" className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded-2xl outline-none focus:border-green-500/50 font-bold text-center" value={manualForm.fiber} onChange={e => setManualForm({ ...manualForm, fiber: e.target.value })} /></div>
                            </div>
                        </div>

                        <div className="pt-2 space-y-2">
                            {mode === 'manual' ? (
                                <button onClick={handleSaveToList} className="w-full bg-white text-black py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition-all shadow-lg shadow-white/10">Guardar Alimento</button>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    <button onClick={handleAddToMealNow} className="w-full bg-white text-black py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10"><Plus size={18} strokeWidth={3} /> Añadir a Comida Hoy</button>
                                    <button onClick={handleSaveToList} className="w-full bg-zinc-800 text-zinc-300 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-center gap-2 border border-zinc-700"><Save size={16} /> Guardar en Mis Alimentos</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}