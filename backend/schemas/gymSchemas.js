const Joi = require('joi');

// Validación para guardar un log de entrenamiento (complejo)
const workoutLogSchema = Joi.object({
    routineId: Joi.string().hex().length(24).optional(), // ID de mongo opcional
    routineName: Joi.string().required(),
    duration: Joi.number().min(1).required(), // Debe ser número positivo
    intensity: Joi.string().valid('Baja', 'Media', 'Alta').default('Media'),

    // Array de ejercicios
    exercises: Joi.array().items(
        Joi.object({
            name: Joi.string().required(),
            // Array de sets dentro de cada ejercicio
            sets: Joi.array().items(
                Joi.object({
                    weight: Joi.number().required(), // Asegura que sean números
                    reps: Joi.number().required(),
                    completed: Joi.boolean().optional(),
                    // 'N' = serie normal, 'D' = dropset. El frontend ya lo enviaba,
                    // pero al no estar declarado aquí stripUnknown lo borraba.
                    type: Joi.string().valid('N', 'D').optional()
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