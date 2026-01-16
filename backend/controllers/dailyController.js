const asyncHandler = require('express-async-handler');
const DailyLog = require('../models/DailyLog');
const Mission = require('../models/Mission');

// Utilidad para fecha servidor (Fallback)
const getServerDateString = () => new Date().toISOString().split('T')[0];

/**
 * 🔥 HELPER INTERNO OPTIMIZADO: Busca o Crea el Log del día
 * Usa Promise.all para paralelizar lecturas y reduce latencia.
 */
const ensureDailyLog = async (userId, dateString, userStreak) => {
    // Creamos fecha local simulada para obtener el día de la semana correcto (0-6)
    const dateObj = new Date(dateString);
    const dayOfWeek = dateObj.getDay();

    // 1. OPTIMIZACIÓN: Ejecutar consultas independientes en PARALELO
    const [activeCount, lastLog] = await Promise.all([
        Mission.countDocuments({
            participants: userId, // Busca en array de participantes
            frequency: 'daily',
            $or: [
                { specificDays: { $size: 0 } }, // Todos los días
                { specificDays: dayOfWeek }     // Día específico
            ]
        }),
        // .lean() para lectura rápida del último peso
        DailyLog.findOne({ user: userId }).sort({ date: -1 }).select('weight').lean()
    ]);

    const persistentWeight = lastLog ? lastLog.weight : 0;

    // 2. Operación Atómica: Buscar O Crear
    // No usamos .lean() aquí porque necesitamos el documento Mongoose completo por si hay que guardar
    let log = await DailyLog.findOneAndUpdate(
        { user: userId, date: dateString },
        {
            $setOnInsert: {
                user: userId,
                date: dateString,
                weight: persistentWeight,
                streakCurrent: userStreak,
                nutrition: { totalKcal: 0 },
                missionStats: { completed: 0, total: activeCount, listCompleted: [] },
                gains: { coins: 0, xp: 0, lives: 0 }
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // 3. Sincronizar total de misiones si cambió (ej: se añadió una misión nueva hoy)
    if (log.missionStats.total !== activeCount) {
        log.missionStats.total = activeCount;
        await log.save();
    }

    return log;
};

// ==========================================
// CONTROLADORES EXPORTADOS
// ==========================================

// @desc    Obtener datos de HOY (o fecha pasada por query)
// @route   GET /api/daily?date=YYYY-MM-DD
const getDailyLog = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    // Prioridad: Fecha del cliente > Fecha del servidor
    const targetDate = req.query.date || getServerDateString();

    // Usamos el helper centralizado
    const log = await ensureDailyLog(userId, targetDate, req.user.streak.current);

    const logObj = log.toObject();
    logObj.totalKcal = log.nutrition.totalKcal; // Compatibilidad frontend

    res.status(200).json(logObj);
});

// @desc    Obtener datos de una FECHA ANTIGUA (Específica para calendario)
// @route   GET /api/daily/specific?date=YYYY-MM-DD
const getDailyLogByDate = asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!date) {
        res.status(400);
        throw new Error('Falta el parámetro fecha');
    }

    // Aquí solo buscamos, no creamos (si no entró ese día, no hay datos)
    const log = await DailyLog.findOne({ user: req.user._id, date: date }).lean();

    if (log) {
        // Al usar lean(), log ya es un objeto, no necesitamos .toObject()
        log.totalKcal = log.nutrition ? log.nutrition.totalKcal : 0;
        res.status(200).json(log);
    } else {
        res.status(200).json(null);
    }
});

// @desc    Actualizar widgets (Peso, Sueño, Mood...)
// @route   PUT /api/daily
const updateDailyLog = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { type, value, date } = req.body; // Aceptamos fecha en el body también

    // Prioridad: Fecha del body > Query > Servidor
    const targetDate = date || req.query.date || getServerDateString();

    // 1. Garantizamos que el log existe usando el Helper
    let log = await ensureDailyLog(userId, targetDate, req.user.streak.current);

    // 2. Switch Case para actualizar campos
    switch (type) {
        case 'mood': log.mood = value; break;
        case 'weight': log.weight = value; break;
        case 'sleepHours': log.sleepHours = value; break;
        case 'steps': log.steps = value; break;
        case 'streakCurrent': log.streakCurrent = value; break;

        case 'nutrition':
            // Merge de objetos para no borrar otros macros si solo mandas kcal
            log.nutrition = { ...log.nutrition, ...value };
            break;

        case 'sport': log.sportWorkouts = value; break;
        case 'training': log.gymWorkouts = value; break;
        case 'missions': log.missionStats = value; break;
        case 'gains': log.gains = value; break;

        default:
            // Seguridad: solo actualiza si el campo existe en el esquema raíz
            if (log[type] !== undefined) log[type] = value;
            break;
    }

    await log.save();

    const logObj = log.toObject();
    logObj.totalKcal = log.nutrition.totalKcal;

    res.status(200).json(logObj);
});

// @desc    Obtener historial de peso para gráficas
// @route   GET /api/daily/history
const getWeightHistory = asyncHandler(async (req, res) => {
    const logs = await DailyLog.find({
        user: req.user._id,
        weight: { $gt: 0 } // Solo días donde se registró peso
    })
        .sort({ date: 1 }) // Orden cronológico
        .select('date weight') // Solo devolver lo necesario (Rendimiento)
        .lean(); // 🔥 Lean para velocidad

    res.status(200).json(logs);
});

module.exports = {
    getDailyLog,
    getDailyLogByDate,
    updateDailyLog,
    getWeightHistory
};