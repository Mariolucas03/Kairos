const UserEventProgress = require('../models/UserEventProgress');
const moment = require('moment'); // ⚠️ RECUERDA: npm install moment en la carpeta backend

// --- HELPER: Calcular la semana actual (Ciclo Lunes-Lunes) ---
// Usamos isoWeek() porque el estándar ISO empieza en Lunes.
const getCurrentPeriod = () => {
    const currentYear = moment().isoWeekYear();
    const currentWeek = moment().isoWeek();
    return `${currentYear}-W${currentWeek}`; // Ej: "2024-W52"
};

// @desc    Obtener estado del evento actual para un usuario
// @route   GET /api/events/status/:userId
exports.getEventStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentPeriod = getCurrentPeriod();

        // Buscamos el progreso SOLO de la semana actual
        let progress = await UserEventProgress.findOne({
            userId,
            periodId: currentPeriod
        }).lean(); // .lean() hace la consulta más rápida (devuelve objeto JS simple)

        // SI NO EXISTE: Significa que es una semana nueva (o usuario nuevo).
        // Devolvemos una estructura "vacía" para que el frontend muestre todo reiniciado.
        if (!progress) {
            return res.json({
                userId,
                periodId: currentPeriod,
                points: 0,
                rewards: {}, // Ninguna recompensa reclamada
                message: "Nuevo ciclo de evento iniciado."
            });
        }

        // SI EXISTE: Devolvemos el progreso real
        res.json(progress);

    } catch (error) {
        console.error("Error en getEventStatus:", error);
        res.status(500).json({ error: 'Error al obtener estado del evento' });
    }
};

// @desc    Sumar puntos al evento (Crea el documento de la semana si no existe)
// @route   POST /api/events/add-points
exports.addPoints = async (req, res) => {
    try {
        const { userId, points } = req.body;

        if (!userId || points === undefined) {
            return res.status(400).json({ message: "Faltan datos (userId o points)" });
        }

        const currentPeriod = getCurrentPeriod();

        // OPERACIÓN ATÓMICA (Upsert)
        // 1. Busca documento de este usuario Y esta semana.
        // 2. Si existe: Suma puntos ($inc).
        // 3. Si NO existe: Lo crea (upsert: true), pone puntos iniciales y rewards vacío ($setOnInsert).
        const updatedProgress = await UserEventProgress.findOneAndUpdate(
            { userId: userId, periodId: currentPeriod },
            {
                $inc: { points: points }, // Sumar puntos
                $set: { lastUpdated: new Date() }, // Actualizar fecha
                $setOnInsert: { rewards: {} } // Solo al crear: rewards vacío
            },
            {
                new: true,   // Devolver el documento nuevo/actualizado
                upsert: true, // ¡MAGIA! Crea el registro si es Lunes y no existe
                setDefaultsOnInsert: true
            }
        );

        res.json(updatedProgress);

    } catch (error) {
        console.error("Error en addPoints:", error);
        res.status(500).json({ error: 'Error al sumar puntos' });
    }
};

// @desc    Marcar una recompensa como reclamada
// @route   POST /api/events/claim-reward
exports.claimReward = async (req, res) => {
    try {
        const { userId, rewardId } = req.body; // rewardId ej: "chest_1", "gold_pack"

        if (!userId || !rewardId) {
            return res.status(400).json({ message: "Faltan datos" });
        }

        const currentPeriod = getCurrentPeriod();

        // Marcamos rewardId como true dentro del Map "rewards"
        const updatedProgress = await UserEventProgress.findOneAndUpdate(
            { userId: userId, periodId: currentPeriod },
            {
                $set: { [`rewards.${rewardId}`]: true, lastUpdated: new Date() }
            },
            { new: true }
        );

        if (!updatedProgress) {
            return res.status(404).json({ message: "No hay progreso activo para esta semana" });
        }

        res.json({ success: true, progress: updatedProgress });

    } catch (error) {
        console.error("Error en claimReward:", error);
        res.status(500).json({ error: 'Error al reclamar recompensa' });
    }
};