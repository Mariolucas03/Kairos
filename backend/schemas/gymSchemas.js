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
                    completed: Joi.boolean().optional()
                })
            ).min(1).required()
        })
    ).min(1).required()
});

module.exports = { workoutLogSchema };