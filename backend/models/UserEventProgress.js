// models/UserEventProgress.js
const mongoose = require('mongoose');

const userEventProgressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    periodId: { type: String, required: true, index: true }, // Ej: "2024-W52"
    points: { type: Number, default: 0 },
    rewards: { type: Map, of: Boolean, default: {} },
    lastUpdated: { type: Date, default: Date.now }
});

// Índice para asegurar que un usuario solo tenga un progreso por semana
userEventProgressSchema.index({ userId: 1, periodId: 1 }, { unique: true });

module.exports = mongoose.model('UserEventProgress', userEventProgressSchema);