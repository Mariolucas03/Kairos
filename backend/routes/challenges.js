const express = require('express');
const router = express.Router();
const {
    getChallenges,
    createChallenge,
    respondChallenge
} = require('../controllers/challengeController');

// 2. CORRECCIÓN IMPORTANTE: Quitamos las llaves { } alrededor de protect
// Tu archivo authMiddleware exporta la función directamente (module.exports = protect)
const protect = require('../middleware/authMiddleware');

// Rutas base: /api/challenges
router.route('/')
    .get(protect, getChallenges)
    .post(protect, createChallenge);

// Aceptar, rechazar o rendirse. Es la UNICA forma de cambiar un duelo.
//
// Aqui debajo estaban PUT /:id y DELETE /:id. Ninguna pantalla las llamaba: el
// PUT no hacia nada y el DELETE era una segunda puerta a lo que ya hace
// 'reject'. Dos formas de cancelar un duelo son dos formas que mantener
// seguras, y esa ya costo una (borraba el duelo con las fichas de los dos
// dentro).
router.post('/respond', protect, respondChallenge);

module.exports = router;