import { useState } from 'react';
import { X, Save, Flame, Beef, Wheat, Droplet, Leaf } from 'lucide-react';
import api from '../../services/api';

export default function CreateFoodModal({ onClose, onFoodCreated }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        fiber: '',
        servingSize: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validación básica
        if (!formData.name || !formData.calories) {
            alert("Nombre y Calorías son obligatorios");
            return;
        }

        setLoading(true);

        try {
            // Llamamos a la ruta que YA EXISTE en tu backend
            const res = await api.post('/food/save', {
                name: formData.name,
                calories: Number(formData.calories),
                protein: Number(formData.protein || 0),
                carbs: Number(formData.carbs || 0),
                fat: Number(formData.fat || 0),
                fiber: Number(formData.fiber || 0),
                servingSize: formData.servingSize || '1 ración'
            });

            // Pasamos la comida creada al padre por si quiere mostrar un Toast
            if (onFoodCreated) onFoodCreated(res.data);

            onClose();
        } catch (error) {
            console.error("Error creando comida:", error);
            alert("Error al guardar la comida.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95">

                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Save className="text-blue-500" size={24} />
                        Crear Propia
                    </h2>
                    <button onClick={onClose} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Nombre */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Nombre del alimento</label>
                        <input
                            type="text"
                            name="name"
                            placeholder="Ej: Tortilla de Patatas Casera"
                            required
                            autoFocus
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white focus:border-blue-500 focus:outline-none transition-colors"
                        />
                    </div>

                    {/* Calorías */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block flex items-center gap-1"><Flame size={10} /> Calorías (kcal)</label>
                        <input
                            type="number"
                            name="calories"
                            placeholder="0"
                            required
                            value={formData.calories}
                            onChange={handleChange}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white font-bold text-lg focus:border-orange-500 focus:outline-none transition-colors"
                        />
                    </div>

                    {/* Macros Grid */}
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <label className="text-[9px] font-bold text-blue-400 uppercase mb-1 block text-center">Prot</label>
                            <div className="relative">
                                <input type="number" name="protein" placeholder="0" value={formData.protein} onChange={handleChange} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-2 text-white text-center text-sm focus:border-blue-500 focus:outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-yellow-400 uppercase mb-1 block text-center">Carb</label>
                            <div className="relative">
                                <input type="number" name="carbs" placeholder="0" value={formData.carbs} onChange={handleChange} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-2 text-white text-center text-sm focus:border-yellow-500 focus:outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-red-400 uppercase mb-1 block text-center">Grasa</label>
                            <div className="relative">
                                <input type="number" name="fat" placeholder="0" value={formData.fat} onChange={handleChange} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-2 text-white text-center text-sm focus:border-red-500 focus:outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-green-500 uppercase mb-1 block text-center">Fibra</label>
                            <div className="relative">
                                <input type="number" name="fiber" placeholder="0" value={formData.fiber} onChange={handleChange} className="w-full bg-gray-950 border border-gray-800 rounded-xl p-2 text-white text-center text-sm focus:border-green-500 focus:outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Porción (Opcional) */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">Tamaño Ración (Ref)</label>
                        <input
                            type="text"
                            name="servingSize"
                            placeholder="Ej: 1 plato, 100g, 1 unidad"
                            value={formData.servingSize}
                            onChange={handleChange}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-300 focus:border-gray-600 focus:outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 mt-4 flex justify-center items-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        {loading ? 'Guardando...' : <><Save size={20} /> GUARDAR EN MIS COMIDAS</>}
                    </button>

                </form>
            </div>
        </div>
    );
}