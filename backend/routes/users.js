const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController'); // Importamos TODO el objeto

// 🔥 DEBUG: ESTO NOS DIRÁ LA VERDAD EN LOS LOGS
console.log("🔍 INSPECCIONANDO CONTROLADOR:");
console.log("Keys disponibles:", Object.keys(userController));
console.log("¿Existe syncHealthData?", userController.syncHealthData ? "SÍ" : "NO (UNDEFINED)");

// Desestructuramos AHORA (después de importar)
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
    syncHealthData // <--- Aquí es donde suele fallar
} = userController;

const protect = require('../middleware/authMiddleware');

// ... (RESTO DEL CÓDIGO IGUAL QUE ANTES) ...
// (Asegúrate de mantener el resto de router.post... y el module.exports al final)

// ==========================================
// RUTAS PÚBLICAS Y DE AUTH
// ==========================================
router.post('/', registerUser);
router.post('/login', loginUser);

// ==========================================
// RUTAS PROTEGIDAS
// ==========================================
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

// ==========================================
// 🔥 RUTA DE APPLE HEALTH
// ==========================================
router.post('/health-sync', syncHealthData);

module.exports = router;