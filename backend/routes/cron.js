const express = require('express');
const router = express.Router();
const { runNightlyMaintenance, runMonthlyRankingRewards, runEveningReminder, runMorningReminder, repasarAvisosPendientes } = require('../utils/scheduler');
const { protectCron } = require('../middleware/cronMiddleware');

// --- 1. RUTA DE MANTENIMIENTO NOCTURNO (PESADA) ---
// Usar esta SOLO UNA VEZ al día (ej: 04:00 AM)
router.get('/nightly-maintenance', protectCron, async (req, res) => {
    try {
        console.log("🌙 [CRON] Ejecutando mantenimiento nocturno...");
        // Ejecutamos la lógica, pero NO esperamos ni devolvemos el resultado gigante al cliente
        // forzar: el cron externo manda aunque ya se hubiera puesto al dia solo
        runNightlyMaintenance({ forzar: true }).catch(err => console.error("Error background maintenance:", err));

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

// --- 1.c RECORDATORIO DE LAS 20:00 ---
// Mismo problema que el nocturno: node-cron no dispara nada si Render tiene la
// instancia dormida a esa hora, asi que el aviso de misiones pendientes no
// salia casi nunca. Programar en cron-job.org a las 20:00 (Madrid).
// Es idempotente: llamarla dos veces el mismo dia NO manda dos avisos.
router.get('/evening-reminder', protectCron, (req, res) => {
    // ⚠️ SE CONTESTA ANTES DE MANDAR NADA.
    //
    // Antes se esperaba a que terminara el reparto entero. Con la instancia
    // recien despertada eso son el arranque en frio mas cientos de envios, y
    // cron-job.org corta a los 30 segundos: el aviso salia bien y el historial
    // lo marcaba igualmente como fallo. Ahora el cron recibe su 200 al momento
    // y el trabajo sigue por detras.
    res.status(200).send('Aviso de las 20:00 lanzado');
    runEveningReminder({ forzar: req.query.forzar === '1' })
        .catch(error => console.error("❌ Error en el recordatorio de las 20:00:", error));
});

// --- 1.d AVISO DE LAS 09:00: QUE TOCA ENTRENAR HOY ---
// Las rutinas guardan en que dias tocan. Esto lo convierte en un aviso.
// El cron interno (0 9 * * *) ya se dispara porque el ping mantiene despierta
// la instancia; esta ruta esta por si algun dia deja de hacerlo. Programar en
// cron-job.org a las 09:00 (Madrid).
// Es idempotente: llamarla dos veces el mismo dia NO manda dos avisos.
router.get('/morning-reminder', protectCron, (req, res) => {
    // Igual que el de las 20:00: primero el 200, luego el trabajo.
    res.status(200).send('Aviso de entreno lanzado');
    runMorningReminder({ forzar: req.query.forzar === '1' })
        .catch(error => console.error("❌ Error en el aviso de entreno:", error));
});

// --- 2. RUTA "KEEP ALIVE" (LIGERA) ---
// Usar esta cada 10-14 minutos para que Render no se duerma
// URL: https://tu-app.onrender.com/api/cron/ping
router.get('/ping', (req, res) => {
    // Respuesta mínima absoluta (1 byte) para ahorrar ancho de banda y evitar errores de "Response too big"
    res.status(200).send('.');

    // ⚠️ Y DE PASO, EL REPASO DE AVISOS.
    //
    // Este ping es lo unico que se garantiza que entra cada pocos minutos, asi
    // que es el mejor sitio para preguntar "¿falta por mandar el aviso de
    // hoy?". Si el cron de las 20:00 se encontro Render dormido o desplegando
    // y se llevo un 503, el siguiente ping dentro de la ventana lo manda.
    //
    // Va DESPUES de contestar y con su propio catch: el keep-alive no puede
    // tardar mas ni fallar por esto.
    repasarAvisosPendientes().catch(err => console.error('Repaso de avisos:', err.message));
});

module.exports = router;