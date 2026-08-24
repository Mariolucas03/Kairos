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

        // --- CÓMO SE MIDE ESTE EJERCICIO ---
        //
        // Todo esto es OPCIONAL y por defecto se comporta como siempre (peso x
        // repeticiones), así que los entrenos ya guardados siguen leyéndose
        // igual sin tocar ni un documento.

        // Medido por TIEMPO en vez de por repeticiones: plancha, muerto colgado,
        // isométricos. Antes no había forma de registrarlos: o te inventabas unas
        // repeticiones o no los apuntabas.
        esPorTiempo: { type: Boolean, default: false },

        // De peso corporal (dominadas, fondos, flexiones). El peso de cada serie
        // lo calcula el SERVIDOR sumando tu peso corporal más el lastre, así el
        // volumen y los récords cuentan lo que de verdad has movido.
        esPesoCorporal: { type: Boolean, default: false },

        // Superserie: los ejercicios con la misma letra ('A', 'B'...) se hacen
        // seguidos sin descanso entre medias.
        superserie: { type: String, default: '' },

        sets: [{
            weight: Number,
            reps: Number,
            completed: Boolean,

            // Segundos aguantados, en los ejercicios medidos por tiempo
            segundos: { type: Number, default: 0 },

            // Peso añadido en los de peso corporal (cinturón de lastre, chaleco)
            lastre: { type: Number, default: 0 },

            // Las repeticiones son POR LADO. Se guarda como bandera en vez de
            // duplicar el número: 10 por lado son 10 repeticiones de trabajo con
            // cada brazo, no 20 seguidas, y para el volumen sí cuentan las 20.
            porLado: { type: Boolean, default: false },

            // Cuánto te ha costado: RIR (repeticiones que te quedaban) o RPE
            // (esfuerzo del 1 al 10). Es lo que permite saber si progresas de
            // verdad o solo estás moviendo más peso a base de apretar más.
            esfuerzo: { type: Number },
            tipoEsfuerzo: { type: String, enum: ['RIR', 'RPE', ''], default: '' },

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
    // Récords personales conseguidos en esta sesión (más peso que nunca en ese
    // ejercicio). Se calculan al guardar comparando con el histórico, para no
    // tener que recalcularlos cada vez que se pinta el feed.
    records: [{
        name: String,
        weight: Number,
        reps: Number,
        previous: Number   // el récord anterior, para poder decir "+5 kg"
    }],

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