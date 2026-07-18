const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');

const {
    getMe,
    updateMacros,
    claimDailyReward,
    addGameReward,
    updatePhysicalStats,
    simulateYesterday,
    setManualStreak,
    forceNightlyMaintenance,
    setRedemptionMission,
    reviveUser,
    updateStatsManual
} = require('../controllers/userController');

// Rutas base: /api/users
router.get('/', protect, getMe);
router.put('/macros', protect, updateMacros);
router.post('/claim-daily', protect, claimDailyReward); // <--- Esta fallaba
router.post('/reward', protect, addGameReward);
router.put('/physical-stats', protect, updatePhysicalStats);

// Rutas Game Over
router.post('/set-redemption-mission', protect, setRedemptionMission);
router.post('/revive', protect, reviveUser);
router.put('/update-stats', protect, updateStatsManual);

// Rutas Debug (🔥 solo disponibles fuera de producción: force-night dispara el mantenimiento
// nocturno GLOBAL para todos los usuarios, no solo el que llama)
const devOnly = (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: 'No disponible en producción' });
    }
    next();
};
router.post('/debug/yesterday', protect, devOnly, simulateYesterday);
router.put('/debug/streak', protect, devOnly, setManualStreak);
router.post('/debug/force-night', protect, devOnly, forceNightlyMaintenance);

module.exports = router;