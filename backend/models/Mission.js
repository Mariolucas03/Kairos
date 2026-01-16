const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema({
    // Creador original (Dueño)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    title: { type: String, required: true },

    frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        default: 'daily'
    },

    // Días específicos (0=Domingo...)
    specificDays: { type: [Number], default: [] },

    type: {
        type: String,
        default: 'habit' // Borra la línea que pone enum: ['habit', 'daily'...]
    },

    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard', 'epic'],
        default: 'easy'
    },

    // --- SISTEMA DE UNIDADES Y PROGRESO ---
    unit: {
        type: String, // Solo type String, sin enum
        trim: true,   // Opcional: quita espacios extra
        default: ''
    },
    progress: { type: Number, default: 0 },
    target: { type: Number, default: 1 },

    // --- MODO COOPERATIVO ---
    isCoop: { type: Boolean, default: false },

    // Lista de todos los que participan (incluido el creador)
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Contribuciones individuales
    contributions: {
        type: Map,
        of: Number,
        default: {}
    },

    invitationStatus: {
        type: String,
        enum: ['none', 'pending', 'active', 'rejected'],
        default: 'none'
    },

    // Recompensas
    xpReward: { type: Number, default: 10 },
    coinReward: { type: Number, default: 5 },
    gameCoinReward: { type: Number, default: 50 },

    completed: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

// Índice optimizado para búsquedas por participante
missionSchema.index({ participants: 1, frequency: 1, completed: 1 });

module.exports = mongoose.model('Mission', missionSchema);