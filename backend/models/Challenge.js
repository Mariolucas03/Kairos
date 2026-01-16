const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    opponent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // 🔥 TIPOS DE DUELO SOPORTADOS
    type: {
        type: String,
        enum: ['missions', 'gym', 'steps', 'distance'], // missions=misiones, gym=kilos, steps=pasos, distance=km
        required: true
    },

    betAmount: { type: Number, required: true, default: 0 },

    status: {
        type: String,
        enum: ['pending', 'active', 'finished', 'rejected'],
        default: 'pending'
    },

    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    createdAt: { type: Date, default: Date.now },
    startDate: { type: Date },
    endDate: { type: Date }
});

module.exports = mongoose.model('Challenge', challengeSchema);