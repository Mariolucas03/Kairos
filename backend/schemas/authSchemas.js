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
    })
});

// 🔥 CAMBIO: LOGIN POR USERNAME
const loginSchema = Joi.object({
    username: Joi.string().required(), // Antes era email
    password: Joi.string().required()
});

module.exports = { registerSchema, loginSchema };