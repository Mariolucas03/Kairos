const express = require('express');
const router = express.Router();
const { subscribeToPush, testPush, estadoPush, adminSendPush } = require('../controllers/pushController');
const { protectCron } = require('../middleware/cronMiddleware');
const protect = require('../middleware/authMiddleware');

router.post('/subscribe', protect, subscribeToPush);
// En que estado estan: claves del servidor y aparatos registrados en TU cuenta
router.get('/estado', protect, estadoPush);
// Manda una notificacion de prueba a TUS propios dispositivos y explica que
// falla si no llega. Es la unica forma de diagnosticar sin depender de otro.
router.post('/test', protect, testPush);
// Envio manual. Protegido por CRON_SECRET, no por sesion: si bastara con estar
// logueado, cualquier usuario podria mandar notificaciones a los demas.
router.post('/admin-send', protectCron, adminSendPush);

module.exports = router;