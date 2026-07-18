// routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const protect = require('../middleware/authMiddleware');

// GET: http://localhost:5000/api/events/status  (siempre el usuario autenticado)
router.get('/status', protect, eventController.getEventStatus);

// POST: http://localhost:5000/api/events/add-points
router.post('/add-points', protect, eventController.addPoints);

// POST: http://localhost:5000/api/events/claim-reward
router.post('/claim-reward', protect, eventController.claimReward);

module.exports = router;