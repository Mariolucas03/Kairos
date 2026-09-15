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

// RUTAS
// La ruta es '/' porque en index.js ya definimos '/api/daily'
// Sin `checkStreak`: la racha ya no sube por entrar, sube al RECOGER la
// recompensa diaria (userController.claimDailyReward). Con tres sitios
// tocando la misma racha, el numero bailaba.
router.get('/', protect, getDailyLog);
router.put('/', protect, updateDailyLog);
router.get('/specific', protect, getDailyLogByDate);
router.get('/history', protect, getWeightHistory);

// Mapa de actividad para el calendario de cuadraditos
router.get('/actividad', protect, getActividad);

module.exports = router;