const express = require('express');
const router = express.Router();
const { subscribeToPush } = require('../controllers/pushController');
const protect = require('../middleware/authMiddleware');

router.post('/subscribe', protect, subscribeToPush);

module.exports = router;