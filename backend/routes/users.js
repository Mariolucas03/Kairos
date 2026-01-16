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

// Rutas Debug
router.post('/debug/yesterday', protect, simulateYesterday);
router.put('/debug/streak', protect, setManualStreak);
router.post('/debug/force-night', protect, forceNightlyMaintenance);

module.exports = router;