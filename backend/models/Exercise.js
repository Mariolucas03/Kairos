const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    // Campos básicos
    name: { type: String, required: true },
    muscle: { type: String, required: true },
    equipment: { type: String, default: "Barra" },

    // --- NUEVOS CAMPOS NECESARIOS PARA EL FIX ---

    // Vinculación con usuario (para que cada uno tenga sus propios ejercicios si quiere)
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Categoría (Fuerza, Cardio, etc)
    category: {
        type: String,
        default: 'strength'
    },

    // Si es un ejercicio creado por el sistema o por el usuario
    isCustom: {
        type: Boolean,
        default: false
    }
});

// Índice compuesto: Permite buscar rápido ejercicios por nombre para un usuario específico
exerciseSchema.index({ name: 1, user: 1 });

module.exports = mongoose.model('Exercise', exerciseSchema);