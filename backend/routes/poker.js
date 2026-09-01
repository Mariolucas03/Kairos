const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
    crearMesa, invitar, responderInvitacion, expulsar, empezar,
    actuar, siguienteMano, levantarse, misMesas, verMesa, misInvitaciones
} = require('../controllers/pokerController');

router.use(protect);

router.get('/', misMesas);
router.post('/', crearMesa);

// Antes de /:id, o "invitaciones" se leeria como un identificador
router.get('/invitaciones', misInvitaciones);

router.get('/:id', verMesa);
router.post('/:id/invitar', invitar);
router.post('/:id/responder', responderInvitacion);
router.post('/:id/expulsar', expulsar);
router.post('/:id/empezar', empezar);
router.post('/:id/actuar', actuar);
router.post('/:id/siguiente', siguienteMano);
router.post('/:id/levantarse', levantarse);

module.exports = router;
