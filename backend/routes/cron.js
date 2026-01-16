const express = require('express');
const router = express.Router();
const { runNightlyMaintenance } = require('../utils/scheduler');
const { protectCron } = require('../middleware/cronMiddleware');

// Esta ruta despertará al servidor y ejecutará el castigo/mantenimiento
// URL Final: https://tu-backend.onrender.com/api/cron/nightly-maintenance?secret=TU_CONTRASEÑA
router.get('/nightly-maintenance', protectCron, async (req, res) => {
    try {
        console.log("🌙 [CRON EXTERNO] Forzando mantenimiento...");
        const result = await runNightlyMaintenance();
        res.status(200).json(result);
    } catch (error) {
        console.error("❌ Error en Cron Externo:", error);
        res.status(500).json({ message: error.message });
    }
});

// Ruta simple para mantenerlo despierto si quieres (Ping)
router.get('/ping', (req, res) => res.send('Pong! 🤖'));

module.exports = router;