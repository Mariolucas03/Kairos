const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
    crear, invitar, empezar, responderInvitacion, girar, contestar, abandonar, misPartidas, verPartida, misInvitaciones
} = require('../controllers/sabelotodoController');

router.use(protect);

router.get('/', misPartidas);
router.post('/', crear);
router.get('/invitaciones', misInvitaciones);
router.get('/:id', verPartida);
router.post('/:id/invitar', invitar);
router.post('/:id/empezar', empezar);
router.post('/:id/responder', responderInvitacion);
router.post('/:id/girar', girar);
router.post('/:id/contestar', contestar);
router.post('/:id/abandonar', abandonar);

module.exports = router;
