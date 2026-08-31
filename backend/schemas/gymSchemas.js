const Joi = require('joi');

// Validación para guardar un log de entrenamiento (complejo)
const workoutLogSchema = Joi.object({
    routineId: Joi.string().hex().length(24).optional(), // ID de mongo opcional
    routineName: Joi.string().required(),
    duration: Joi.number().min(1).required(), // Debe ser número positivo
    intensity: Joi.string().valid('Baja', 'Media', 'Alta').default('Media'),

    // Array de ejercicios
    //
    // ⚠️ ESTE VALIDADOR CORRE CON stripUnknown: TODO lo que no esté declarado
    // aquí se BORRA en silencio antes de que el controlador lo vea. Es correcto
    // como defensa, y es justo lo que lo hace peligroso: no da error, no sale
    // en ningún registro, y el dato simplemente no llega.
    //
    // Ya pasó, y durante semanas: la app mandaba esPesoCorporal, esPorTiempo,
    // superserie, lastre, segundos y porLado desde que se añadieron esas
    // funciones, y aquí no estaba declarado ninguno. Los seis se tiraban en la
    // puerta. Una dominada con 15 kg de lastre y una plancha de 90 segundos
    // valían CERO volumen — y el volumen sube los rangos musculares, que pagan.
    //
    // Al añadir un campo nuevo al entreno, hay que añadirlo TAMBIÉN aquí.
    exercises: Joi.array().items(
        Joi.object({
            name: Joi.string().required(),

            // Cómo se mide el ejercicio. El servidor los necesita para saber
            // cuánto se ha movido de verdad: en los de peso corporal suma el
            // peso del usuario, y en los de tiempo convierte segundos en reps.
            esPorTiempo: Joi.boolean().optional(),
            esPesoCorporal: Joi.boolean().optional(),
            // Letra de superserie: los que la comparten van seguidos
            superserie: Joi.string().allow('').max(2).optional(),

            // Array de sets dentro de cada ejercicio
            sets: Joi.array().items(
                Joi.object({
                    // Nunca negativos: un peso en negativo falseaba el volumen
                    // total y los récords personales
                    weight: Joi.number().min(0).max(1000).required(),
                    reps: Joi.number().min(0).max(1000).required(),
                    completed: Joi.boolean().optional(),
                    // 'N' = serie normal, 'D' = dropset. El frontend ya lo enviaba,
                    // pero al no estar declarado aquí stripUnknown lo borraba.
                    type: Joi.string().valid('N', 'D').optional(),

                    // Peso añadido en los de peso corporal (cinturón, chaleco).
                    // Va aparte de `weight` porque el peso efectivo lo calcula
                    // el servidor: cuerpo + lastre.
                    lastre: Joi.number().min(0).max(1000).optional(),

                    // En los de tiempo, la serie se mide en segundos y `reps`
                    // llega a 0. Los topes son los mismos que aplica el
                    // controlador.
                    segundos: Joi.number().min(0).max(3600).optional(),

                    // Las repeticiones son de CADA lado: para el volumen cuentan
                    // el doble, pero se guarda la bandera para poder enseñar
                    // "12 por lado" y no "24".
                    porLado: Joi.boolean().optional(),

                    // Cuánto costó la serie: RIR (repeticiones que quedaban) o
                    // RPE (esfuerzo del 1 al 10). El modelo y el controlador ya
                    // lo guardan; declararlo aquí es lo que permitirá añadir la
                    // casilla en la pantalla sin tocar nada más.
                    esfuerzo: Joi.number().min(0).max(10).optional(),
                    tipoEsfuerzo: Joi.string().valid('RIR', 'RPE', '').optional()
                })
            ).min(1).required()
        })
    ).min(1).required(),

    // Foto del entreno en base64 (primera diapositiva del post).
    // Aquí solo comprobamos que sea una imagen: del tamaño se encarga el
    // controlador, para poder responder 413 con un mensaje entendible en vez
    // del error genérico de validación.
    photo: Joi.string().pattern(/^data:image\//).allow('').optional()
});

module.exports = { workoutLogSchema };