const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    muscle: { type: String, required: true },
    // Músculo concreto y grupos secundarios, para mostrar qué trabaja cada ejercicio
    muscleDetail: { type: String, default: '' },
    secondary: { type: [String], default: [] },
    sets: { type: Number, default: 3 },
    reps: { type: String, default: '10-12' },
    targetWeight: { type: Number, default: 0 },
    // Descanso propio de este ejercicio. Si es 0 se usa el general de la rutina.
    rest: { type: Number, default: 0 },

    // Los mismos ajustes que en el registro, guardados en la rutina para no
    // tener que marcarlos en cada entreno.
    esPorTiempo: { type: Boolean, default: false },
    esPesoCorporal: { type: Boolean, default: false },
    porLado: { type: Boolean, default: false },
    superserie: { type: String, default: '' },
    // Segundos objetivo en los ejercicios de tiempo (equivale a `reps`)
    targetSegundos: { type: Number, default: 0 },

    // Cómo progresa este ejercicio. La app mira tu última sesión y propone la
    // siguiente en vez de dejarte decidir de memoria, que es donde la gente se
    // estanca meses con el mismo peso sin darse cuenta.
    progresion: {
        type: String,
        enum: ['ninguna', 'lineal', 'doble', 'greyskull'],
        default: 'ninguna'
    },
    // Cuánto sube cada vez. 2,5 kg es el salto habitual con discos de 1,25 por
    // lado; en ejercicios pequeños (curl, elevaciones) conviene bajarlo a 1.
    incremento: { type: Number, default: 2.5 }
});

const routineSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },

    // 🔥 CAMPO NUEVO: Guardar el color elegido
    color: { type: String, default: 'blue' },

    // Días de la semana en que toca esta rutina (0 = domingo ... 6 = sábado).
    // Vacío = sin día fijo, se hace cuando se quiera.
    //
    // Se usa la MISMA numeración que las misiones (specificDays) y que
    // Date.getDay(). Tener dos convenciones de días en la misma app es la forma
    // más silenciosa de que algo salga el día equivocado.
    dias: { type: [Number], default: [] },

    // Descanso general de la rutina, en segundos.
    // ⚠️ Faltaba en el esquema: el frontend lo enviaba desde el principio pero
    // Mongoose (modo strict) lo descartaba sin avisar, así que el descanso que
    // configurabas al crear la rutina nunca llegaba a guardarse.
    defaultRest: { type: Number, default: 60 },

    exercises: [exerciseSchema],
    lastPerformed: { type: Date },
    timesCompleted: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Routine', routineSchema);