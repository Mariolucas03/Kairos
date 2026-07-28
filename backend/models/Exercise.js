const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    // Campos básicos
    name: { type: String, required: true },
    // Grupo muscular (Pecho, Espalda...). Es la clave con la que agregan las
    // estadísticas, así que SIEMPRE guarda un grupo, nunca un músculo concreto.
    muscle: { type: String, required: true },
    // Músculo concreto elegido en modo PRO (ej: 'Dorsal ancho'). Opcional:
    // en modo normal se queda vacío y todo sigue funcionando igual.
    muscleDetail: { type: String, default: '' },
    // Otros GRUPOS que participan en el ejercicio. Se usan para colorear el
    // mapa del cuerpo con menos intensidad que el músculo principal.
    secondary: { type: [String], default: [] },
    // Los de cardio puntúan por duración, no por kg levantados
    isCardio: { type: Boolean, default: false },
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