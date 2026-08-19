const express = require('express');
const router = express.Router();
const { subscribeToPush, testPush } = require('../controllers/pushController');
const protect = require('../middleware/authMiddleware');

router.post('/subscribe', protect, subscribeToPush);
// Manda una notificacion de prueba a TUS propios dispositivos y explica que
// falla si no llega. Es la unica forma de diagnosticar sin depender de otro.
router.post('/test', protect, testPush);

module.exports = router;