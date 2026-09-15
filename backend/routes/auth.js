const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { registerUser, loginUser, vistazo } = require('../controllers/authController');

// Importamos validación
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../schemas/authSchemas');

// 🔥 Límite estricto contra fuerza bruta en login/registro
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }
});

// Inyectamos el middleware antes del controlador
router.post('/register', authLimiter, validate(registerSchema), registerUser);
router.post('/login', authLimiter, validate(loginSchema), loginUser);
// Mas holgado que el de entrar (se pide al escribir), pero con tope: no es
// una forma de listar usuarios a lo loco.
router.get('/vistazo/:username', rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }), vistazo);

module.exports = router;