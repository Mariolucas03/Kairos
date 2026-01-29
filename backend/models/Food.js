const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
    // --- VINCULACIÓN CON EL DUEÑO ---
    // Si tiene ID, es un alimento privado creado por ese usuario.
    // Si no tiene ID (null/undefined), se considera un alimento público/global del sistema.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    name: { type: String, required: true },
    calories: { type: Number, required: true },

    // Macros
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },

    // Detalles extra
    servingSize: { type: String, default: '100g' },
    icon: { type: String, default: '🍎' },

    // 🔥 FIX PUNTO 13: Organización por carpetas
    // Permite al usuario organizar sus alimentos guardados
    folder: {
        type: String,
        enum: ['General', 'Desayuno', 'Comida', 'Cena', 'Snack'],
        default: 'General'
    }
});

// Índice de texto para búsquedas rápidas por nombre (usado en el buscador)
foodSchema.index({ name: 'text' });

module.exports = mongoose.model('Food', foodSchema);