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
            completed: Boolean
        }]
    }],
    earnedXP: { type: Number, default: 0 },
    earnedCoins: { type: Number, default: 0 },
    date: {
        type: Date,
        default: Date.now
    }
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