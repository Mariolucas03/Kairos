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

    // MARCAS DE LOS AVANCES YA APLICADOS.
    //
    // Cada "he hecho 3" que manda el movil lleva la suya, y aqui se apunta cual
    // se ha sumado ya. Es lo que permite reintentar un avance sin cobertura sin
    // que cuente dos veces: el progreso se incrementa, asi que un reenvio
    // duplicaria lo hecho y podria completar y PAGAR una mision que en realidad
    // no esta.
    //
    // Se recorta sola: solo importan los ultimos avances, los de un ciclo. La
    // lista entera de un habito diario de un ano serian cientos de cadenas
    // dentro del documento por nada.
    enviosAplicados: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

// Índice optimizado para búsquedas por participante
missionSchema.index({ participants: 1, frequency: 1, completed: 1 });
// Las consultas de misiones son SIEMPRE $or: [{ user }, { participants }], y solo
// habia indice para la segunda mitad. Mongo no puede usar un indice para media
// condicion: sin este, la mitad del $or recorria la coleccion entera. Se nota en
// el castigo nocturno y en el aviso de las 20:00, que recorren a todos.
missionSchema.index({ user: 1, frequency: 1, completed: 1 });

module.exports = mongoose.model('Mission', missionSchema);