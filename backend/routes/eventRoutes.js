// routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// GET: http://localhost:5000/api/events/status/ID_DEL_USUARIO
router.get('/status/:userId', eventController.getEventStatus);

// POST: http://localhost:5000/api/events/add-points
router.post('/add-points', eventController.addPoints);

module.exports = router;