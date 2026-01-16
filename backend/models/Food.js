const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
    // --- NUEVO: VINCULACIÓN CON EL DUEÑO ---
    // Si tiene ID, es privado de ese usuario.
    // Si no tiene ID (null/undefined), es un alimento público/global.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // ---------------------------------------

    name: { type: String, required: true },
    calories: { type: Number, required: true },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },
    servingSize: { type: String, default: '100g' },
    icon: { type: String, default: '🍎' }
});

// Índice para búsquedas rápidas por nombre
foodSchema.index({ name: 'text' });

module.exports = mongoose.model('Food', foodSchema);