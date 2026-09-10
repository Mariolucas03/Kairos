const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    muscle: { type: String, required: true },
    // Músculo concreto y grupos secundarios, para mostrar qué trabaja cada ejercicio
    muscleDetail: { type: String, default: '' },
    secondary: { type: [String], default: [] },
    sets: { type: Number, default: 3 },
    reps: { type: String, default: '10-12' },

    // ⚠️ AQUI VIVIAN `targetWeight` y `targetSegundos`, y no los leia nadie.
    //
    // Se escribian —siempre a 0, ni siquiera con un valor— al crear una rutina
    // y al copiar el entreno de un amigo, viajaban al servidor, se guardaban... y
    // ninguna pantalla ni ningun calculo los miraba jamas. El peso objetivo lo
    // propone `services/progresionService.js` a partir de lo que levantaste la
    // ultima vez, que es lo que reemplazo a ponerlo a mano.
    //
    // Son la tercera tanda de "ajustes muertos" que se quita: antes fueron el
    // selector de progresion (greyskull y compania) y el tipo de serie, que
    // tambien se guardaban sin que nada los usara. Un campo que solo se escribe
    // hace pensar que la app lo tiene en cuenta, y no es verdad.
    //
    // Las rutinas ya guardadas los conservan en la base; simplemente dejan de
    // devolverse, que es lo que ya pasaba de hecho.
    // Descanso propio de este ejercicio. Si es 0 se usa el general de la rutina.
    rest: { type: Number, default: 0 },

    // Los mismos ajustes que en el registro, guardados en la rutina para no
    // tener que marcarlos en cada entreno.
    esPorTiempo: { type: Boolean, default: false },
    esPesoCorporal: { type: Boolean, default: false },
    porLado: { type: Boolean, default: false },
    superserie: { type: String, default: '' },

    // Aquí vivían `progresion` e `incremento`: el sistema de progresión y el
    // salto de peso, elegidos ejercicio por ejercicio. Ya no se preguntan. La
    // app mira tu última sesión y propone la siguiente ella sola, con una única
    // regla —ver services/progresionService.js—, y el salto sale del propio peso
    // que mueves. Las rutinas antiguas pueden traer los dos campos guardados;
    // simplemente no se leen.
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

    // Cuando se entreno por ultima vez. La usa el aviso de "hoy toca" para
    // decir "la ultima fue hace 6 dias" —ver utils/scheduler.js—, que es lo que
    // convierte un despertador en una decision. Se escribe al guardar el entreno.
    lastPerformed: { type: Date },

    // Aqui vivia `timesCompleted`. No lo leia NADIE y tampoco lo escribia nadie:
    // llevaba desde el primer dia valiendo 0 en todas las rutinas. Un contador
    // que no cuenta es peor que no tener contador, porque el dia que alguien lo
    // pinte en una pantalla dira que no has entrenado nunca.
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Routine', routineSchema);