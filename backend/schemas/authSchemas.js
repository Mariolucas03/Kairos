const Joi = require('joi');

const registerSchema = Joi.object({
    username: Joi.string().min(3).max(20).trim().required().messages({
        'string.min': 'El usuario debe tener al menos 3 caracteres',
        'string.max': 'El usuario no puede exceder 20 caracteres'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Email inválido'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'La contraseña debe tener al menos 6 caracteres'
    })
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

module.exports = { registerSchema, loginSchema };