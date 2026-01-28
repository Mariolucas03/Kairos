const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    updateUser,
    updateMacros,
    claimDailyReward,
    addGameReward,
    updatePhysicalStats,
    setRedemptionMission,
    reviveUser,
    updateStatsManual,
    simulateYesterday,
    setManualStreak,
    forceNightlyMaintenance,
    syncHealthData
} = require('../controllers/userController');

const protect = require('../middleware/authMiddleware');

router.post('/', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateUser);
router.put('/macros', protect, updateMacros);
router.post('/daily-reward', protect, claimDailyReward);
router.post('/game-reward', protect, addGameReward);
router.put('/physical-stats', protect, updatePhysicalStats);
router.post('/redemption', protect, setRedemptionMission);
router.post('/revive', protect, reviveUser);
router.put('/stats-manual', protect, updateStatsManual);
router.post('/simulate-yesterday', protect, simulateYesterday);
router.post('/manual-streak', protect, setManualStreak);
router.post('/force-maintenance', protect, forceNightlyMaintenance);
router.post('/health-sync', syncHealthData);

module.exports = router;