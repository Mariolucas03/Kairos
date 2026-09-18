const mongoose = require('mongoose');

const clanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxLength: 20
    },
    description: {
        type: String,
        default: "Un clan de guerreros.",
        maxLength: 150
    },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Array de miembros (referencias)
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Icono del clan (emoji o string)
    icon: { type: String, default: '🛡️' },

    // 🔥 NUEVO: Nivel mínimo para unirse (Integrado con el Frontend)
    minLevel: { type: Number, default: 1 },

    // Estadísticas agregadas (se actualizan cuando entra/sale gente o suben nivel)
    totalPower: { type: Number, default: 0 },

    // Configuración de acceso
    type: { type: String, enum: ['open', 'invite'], default: 'open' },

    // --- 🔥 SISTEMA DE EVENTO SEMANAL (ROTATIVO) 🔥 ---
    weeklyEvent: {
        startDate: { type: Date, default: Date.now }, // Fecha de inicio de la semana actual

        // Tipo de evento activo esta semana
        // volume = Kilos levantados
        // missions = Misiones completadas
        // calories = Calorías quemadas (Gym+Sport)
        // xp = Experiencia ganada
        type: {
            type: String,
            enum: ['volume', 'missions', 'calories', 'xp'],
            default: 'volume'
        },

        // Avisos ya mandados esta semana, para no repetirlos: el de "empieza
        // el evento" y los escalones alcanzados (1..5). Se marcan con una
        // escritura atomica ANTES de avisar, asi dos miembros abriendo el
        // clan a la vez no mandan el mismo aviso dos veces.
        avisado: { type: Boolean, default: false },
        hitosAvisados: { type: [Number], default: [] },

        // Registro de quién ha reclamado premios esta semana para evitar duplicados
        claims: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            tier: { type: Number, required: true }, // 1 (Bronce), 2 (Plata), 3 (Oro)
            claimedAt: { type: Date, default: Date.now }
        }]
    }

}, {
    timestamps: true
});

// Índice para el ranking por poder (rápido acceso al Top Clanes)
clanSchema.index({ totalPower: -1 });

module.exports = mongoose.model('Clan', clanSchema);