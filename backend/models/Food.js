const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
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

    // 🔥 FIX: Actualizada lista de carpetas permitidas
    folder: {
        type: String,
        enum: ['General', 'Desayuno', 'Snack', 'Comida', 'Merienda', 'Cena'],
        default: 'General'
    }
});

foodSchema.index({ name: 'text' });

module.exports = mongoose.model('Food', foodSchema);