const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');

const {
    getMe,
    updateMacros,
    claimDailyReward,
    updatePhysicalStats,
    simulateYesterday,
    setManualStreak,
    forceNightlyMaintenance,
    setRedemptionMission,
    reviveUser,
    updateStatsManual,
    updateProfileSettings,
    borrarMiCuenta,
    exportarMisDatos
} = require('../controllers/userController');

// Rutas base: /api/users
router.get('/', protect, getMe);
router.put('/macros', protect, updateMacros);
router.post('/claim-daily', protect, claimDailyReward); // <--- Esta fallaba
router.put('/physical-stats', protect, updatePhysicalStats);
// Ajustes del perfil público: descripción, cuenta privada y modo de gym
router.put('/profile', protect, updateProfileSettings);

// Llevarte tus datos. Va antes del borrado a proposito: quien se va deberia
// poder llevarse lo suyo primero.
router.get('/mis-datos', protect, exportarMisDatos);

// Irse del todo: pide la contrasena en el cuerpo para confirmar
router.delete('/me', protect, borrarMiCuenta);

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