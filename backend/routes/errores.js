const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { registrarError } = require('../controllers/errorController');

/**
 * Lo llama la app cuando se le rompe una pantalla, asi que NO es solo para
 * administradores: exige sesion y nada mas. Los limites de lo que puede
 * escribir estan en el controlador.
 */
router.post('/', protect, registrarError);

module.exports = router;
