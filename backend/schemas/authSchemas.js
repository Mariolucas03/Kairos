const Joi = require('joi');

const registerSchema = Joi.object({
    username: Joi.string().min(3).max(8).trim().required().messages({
        'string.min': 'El usuario debe tener al menos 3 caracteres',
        'string.max': 'Máximo 8 caracteres para el usuario'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Email inválido'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'La contraseña debe tener al menos 6 caracteres'
    }),
    // El cuerpo que se pinta en el mapa muscular. Opcional: quien no lo diga
    // ve el de siempre.
    gender: Joi.string().valid('male', 'female').optional()
});

// 🔥 ESTA ES LA PARTE IMPORTANTE QUE DEBES CAMBIAR
const loginSchema = Joi.object({
    // ANTES PONÍA: email: Joi.string().email().required()
    // AHORA DEBE PONER:
    username: Joi.string().required(),
    password: Joi.string().required()
});

module.exports = { registerSchema, loginSchema };