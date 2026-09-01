const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
    crearSala, invitar, responderInvitacion, expulsar, empezar,
    levantarCarta, salir, misSalas, verSala, misInvitaciones, cambiarApuesta
} = require('../controllers/cartaAltaController');

// Todo de aqui exige sesion: son partidas con fichas de por medio.
router.use(protect);

router.get('/', misSalas);
router.post('/', crearSala);

// Va ANTES de /:id, o "invitaciones" se leeria como un identificador
router.get('/invitaciones', misInvitaciones);

router.get('/:id', verSala);
router.post('/:id/invitar', invitar);
router.post('/:id/responder', responderInvitacion);
router.post('/:id/expulsar', expulsar);
router.post('/:id/empezar', empezar);
router.post('/:id/apuesta', cambiarApuesta);
router.post('/:id/levantar', levantarCarta);
router.post('/:id/salir', salir);

module.exports = router;
