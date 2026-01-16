const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');

// Importamos validación
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../schemas/authSchemas');

// Inyectamos el middleware antes del controlador
router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);

module.exports = router;