const mongoose = require('mongoose');

const workoutLogSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    routine: { // ID de la rutina (solo para pesas)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Routine'
    },
    routineName: {
        type: String,
        required: true
    },
    duration: { // Segundos
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['gym', 'sport'],
        default: 'gym' // Por defecto todo es gym salvo que digamos lo contrario
    },
    intensity: { type: String, default: 'Normal' },
    distance: { type: Number },  // Solo para sport
    caloriesBurned: { type: Number, default: 0 },
    exercises: [{
        name: String,
        sets: [{
            weight: Number,
            reps: Number,
            completed: Boolean,
            // 'N' = serie normal, 'D' = dropset, para poder distinguirlas en el post
            type: { type: String, enum: ['N', 'D'], default: 'N' }
        }]
    }],
    // --- POST DEL ENTRENO (estilo Instagram) ---
    // Foto opcional en base64, ya comprimida en el móvil (~200 KB).
    // Se guarda aquí en vez de en un servicio externo para no depender de
    // ninguna cuenta de terceros; el backend limita el tamaño al guardar.
    photo: { type: String, default: '' },
    // Grupos musculares trabajados, derivados EN EL SERVIDOR a partir de los
    // ejercicios (no se confía en lo que mande el cliente).
    musclesWorked: { type: [String], default: [] },
    secondaryMuscles: { type: [String], default: [] },

    earnedXP: { type: Number, default: 0 },
    earnedCoins: { type: Number, default: 0 },
    date: {
        type: Date,
        default: Date.now
    },

    // --- 🔥 FEED SOCIAL (Likes y Comentarios) ---
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: { type: String, maxlength: 300 },
        createdAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

// 🔥 OPTIMIZACIÓN KAIROS: Índices para consultas ultra-rápidas
// 1. Índice principal para el historial cronológico y widgets semanales
workoutLogSchema.index({ user: 1, date: -1 });

// 2. Índice compuesto para filtrar por tipo (gym/sport) rápidamente
workoutLogSchema.index({ user: 1, type: 1, date: -1 });

// 3. Índice para gráficas de ejercicios específicos (ProfileStats)
workoutLogSchema.index({ user: 1, "exercises.name": 1, date: 1 });

module.exports = mongoose.model('WorkoutLog', workoutLogSchema);