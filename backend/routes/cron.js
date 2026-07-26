const express = require('express');
const router = express.Router();
const { runNightlyMaintenance, runMonthlyRankingRewards } = require('../utils/scheduler');
const { protectCron } = require('../middleware/cronMiddleware');

// --- 1. RUTA DE MANTENIMIENTO NOCTURNO (PESADA) ---
// Usar esta SOLO UNA VEZ al día (ej: 04:00 AM)
router.get('/nightly-maintenance', protectCron, async (req, res) => {
    try {
        console.log("🌙 [CRON] Ejecutando mantenimiento nocturno...");
        // Ejecutamos la lógica, pero NO esperamos ni devolvemos el resultado gigante al cliente
        runNightlyMaintenance().catch(err => console.error("Error background maintenance:", err));

        // Respondemos rápido y corto
        res.status(200).send('Maintenance started');
    } catch (error) {
        console.error("❌ Error en Cron Externo:", error);
        res.status(500).send('Error');
    }
});

// --- 1.b PREMIOS DEL RANKING MENSUAL ---
// El cron interno (0 0 1 * *) puede no dispararse nunca si Render tiene la
// instancia dormida a esa hora, así que exponemos la tarea para un cron externo.
// Es idempotente: llamarla varias veces NO reparte el premio dos veces.
// Programar en cron-job.org el día 1 de cada mes.
router.get('/monthly-rewards', protectCron, async (req, res) => {
    try {
        const result = await runMonthlyRankingRewards(req.query.period || null);
        res.status(200).json(result);
    } catch (error) {
        console.error("❌ Error en premios mensuales:", error);
        res.status(500).send('Error');
    }
});

// --- 2. RUTA "KEEP ALIVE" (LIGERA) ---
// Usar esta cada 10-14 minutos para que Render no se duerma
// URL: https://tu-app.onrender.com/api/cron/ping
router.get('/ping', (req, res) => {
    // Respuesta mínima absoluta (1 byte) para ahorrar ancho de banda y evitar errores de "Response too big"
    res.status(200).send('.');
});

module.exports = router;