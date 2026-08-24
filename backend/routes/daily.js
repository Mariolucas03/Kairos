const express = require('express');
const router = express.Router();

const {
    getDailyLog,
    updateDailyLog,
    getDailyLogByDate,
    getWeightHistory,
    getActividad
} = require('../controllers/dailyController');

const protect = require('../middleware/authMiddleware');
const { checkStreak } = require('../middleware/streakMiddleware');

// RUTAS
// La ruta es '/' porque en index.js ya definimos '/api/daily'
router.get('/', protect, checkStreak, getDailyLog);
router.put('/', protect, updateDailyLog);
router.get('/specific', protect, getDailyLogByDate);
router.get('/history', protect, getWeightHistory);

// Mapa de actividad para el calendario de cuadraditos
router.get('/actividad', protect, getActividad);

module.exports = router;