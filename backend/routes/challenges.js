const express = require('express');
const router = express.Router();
const {
    getChallenges,
    createChallenge,
    updateChallenge,
    deleteChallenge,
    respondChallenge // <--- 1. Importamos la nueva función del controlador
} = require('../controllers/challengeController');

// 2. CORRECCIÓN IMPORTANTE: Quitamos las llaves { } alrededor de protect
// Tu archivo authMiddleware exporta la función directamente (module.exports = protect)
const protect = require('../middleware/authMiddleware');

// Rutas base: /api/challenges
router.route('/')
    .get(protect, getChallenges)
    .post(protect, createChallenge);

// 3. NUEVA RUTA: Responder desafíos (Aceptar/Huir)
// Es importante ponerla ANTES de /:id para evitar conflictos de ruta
router.post('/respond', protect, respondChallenge);

// Rutas con ID: /api/challenges/:id
router.route('/:id')
    .put(protect, updateChallenge)
    .delete(protect, deleteChallenge);

module.exports = router;