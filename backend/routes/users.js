const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    updateUser, // <--- Asegúrate de que esto estaba importado
    syncHealthData, // <--- IMPORTANTE: Importar la nueva función
    updateMacros, // <--- Importar si no estaba
    claimDailyReward,
    addGameReward,
    updatePhysicalStats,
    setRedemptionMission,
    reviveUser,
    updateStatsManual,
    simulateYesterday,
    setManualStreak,
    forceNightlyMaintenance
} = require('../controllers/userController');
const protect = require('../middleware/authMiddleware');

router.post('/', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateUser);

// Rutas de Gamificación y Stats
router.put('/macros', protect, updateMacros);
router.post('/daily-reward', protect, claimDailyReward);
router.post('/game-reward', protect, addGameReward);
router.put('/physical-stats', protect, updatePhysicalStats);

// Rutas de Game Over / Resurrección
router.post('/redemption', protect, setRedemptionMission);
router.post('/revive', protect, reviveUser);
router.put('/stats-manual', protect, updateStatsManual);

// Rutas de Debug / Admin
router.post('/simulate-yesterday', protect, simulateYesterday);
router.post('/manual-streak', protect, setManualStreak);
router.post('/force-maintenance', protect, forceNightlyMaintenance);

// 🔥 RUTA DE APPLE HEALTH (PÚBLICA PERO PROTEGIDA POR CLAVE SECRETA)
router.post('/health-sync', syncHealthData);

module.exports = router;