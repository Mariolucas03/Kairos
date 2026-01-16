const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    muscle: { type: String, required: true },
    sets: { type: Number, default: 3 },
    reps: { type: String, default: '10-12' },
    targetWeight: { type: Number, default: 0 }
});

const routineSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },

    // 🔥 CAMPO NUEVO: Guardar el color elegido
    color: { type: String, default: 'blue' },

    exercises: [exerciseSchema],
    lastPerformed: { type: Date },
    timesCompleted: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Routine', routineSchema);