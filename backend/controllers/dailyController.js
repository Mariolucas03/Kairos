const asyncHandler = require('express-async-handler');
const DailyLog = require('../models/DailyLog');
const Mission = require('../models/Mission');
const NutritionLog = require('../models/NutritionLog');

// Utilidad para fecha servidor (Fallback)
const getServerDateString = () => new Date().toISOString().split('T')[0];

/**
 * 🔥 HELPER INTERNO OPTIMIZADO: Busca o Crea el Log del día
 * Usa Promise.all para paralelizar lecturas y reduce latencia.
 * Sincroniza Nutrición y Misiones.
 */
const ensureDailyLog = async (userId, dateString, userStreak) => {
    // Creamos fecha local simulada para obtener el día de la semana correcto (0-6)
    // Nota: new Date('YYYY-MM-DD') en UTC puede dar el día anterior según la zona horaria.
    // Usamos una pequeña corrección para asegurar el día local.
    const dateObj = new Date(dateString);
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 1 = Lunes...

    // 1. OPTIMIZACIÓN: Ejecutar consultas independientes en PARALELO

    // 🔥 FIX WIDGET: Contar SOLO misiones diarias que tocan HOY
    const missionQuery = {
        $or: [
            { user: userId },
            { participants: userId }
        ],
        frequency: 'daily', // SOLO DIARIAS
        // Si es coop, aseguramos que esté activa
        $or: [
            { isCoop: false },
            { isCoop: true, invitationStatus: 'active' }
        ],
        // 🔥 FILTRO DE DÍA: O array vacío (todos los días) O contiene el día de hoy
        $or: [
            { specificDays: { $size: 0 } },
            { specificDays: dayOfWeek }
        ]
    };

    const [activeCount, lastLog, nutritionLog] = await Promise.all([
        Mission.countDocuments(missionQuery),
        // .lean() para lectura rápida del último peso
        DailyLog.findOne({ user: userId }).sort({ date: -1 }).select('weight').lean(),
        NutritionLog.findOne({ user: userId, date: dateString }).lean()
    ]);

    const persistentWeight = lastLog ? lastLog.weight : 0;

    // Preparar datos de nutrición sincronizados
    const currentKcal = nutritionLog ? nutritionLog.totalCalories : 0;

    // 2. Operación Atómica: Buscar O Crear
    let log = await DailyLog.findOneAndUpdate(
        { user: userId, date: dateString },
        {
            $setOnInsert: {
                user: userId,
                date: dateString,
                weight: persistentWeight,
                streakCurrent: userStreak,
                nutrition: { totalKcal: currentKcal }, // Sincronizado al crear
                missionStats: { completed: 0, total: activeCount, listCompleted: [] },
                gains: { coins: 0, xp: 0, lives: 0 }
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // 3. Sincronizaciones posteriores a la creación (Self-Healing)
    let needsSave = false;

    // 🔥 AUTO-CORRECCIÓN WIDGET:
    // Si el total guardado en el Log no coincide con el cálculo real de hoy, lo actualizamos.
    // Esto arregla el bug "1/12" si cambiaste los días de las misiones después de crearse el log.
    if (log.missionStats.total !== activeCount) {
        // Solo actualizamos el total, mantenemos las completadas
        log.missionStats.total = activeCount;

        // Safety check: Si por algún motivo completadas > total (bug raro), ajustamos
        if (log.missionStats.completed > activeCount) {
            log.missionStats.completed = activeCount;
        }

        needsSave = true;
        console.log(`🔧 [DailyLog] Corrigiendo total de misiones: ${log.missionStats.total} -> ${activeCount}`);
    }

    // Sincronizar calorías si difieren
    if (log.nutrition.totalKcal !== currentKcal) {
        log.nutrition.totalKcal = currentKcal;
        needsSave = true;
    }

    if (needsSave) {
        await log.save();
    }

    return { log, nutritionLog };
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
    const { log, nutritionLog } = await ensureDailyLog(userId, targetDate, req.user.streak.current);

    const logObj = log.toObject();

    // INYECTAR DETALLE DE COMIDAS
    if (nutritionLog) {
        logObj.nutrition = {
            ...logObj.nutrition,
            meals: nutritionLog.meals,
            totalKcal: nutritionLog.totalCalories,
            totalProtein: nutritionLog.totalProtein,
            totalCarbs: nutritionLog.totalCarbs,
            totalFat: nutritionLog.totalFat,
            totalFiber: nutritionLog.totalFiber
        };
    }

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
        // Intentar buscar nutrición para ese día también para completar datos
        const nutritionLog = await NutritionLog.findOne({ user: req.user._id, date: date }).lean();

        if (nutritionLog) {
            log.nutrition = {
                ...log.nutrition,
                meals: nutritionLog.meals,
                totalKcal: nutritionLog.totalCalories
            };
        } else {
            log.totalKcal = log.nutrition ? log.nutrition.totalKcal : 0;
        }

        res.status(200).json(log);
    } else {
        res.status(200).json(null);
    }
});

// @desc    Actualizar widgets (Peso, Sueño, Mood...)
// @route   PUT /api/daily
const updateDailyLog = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { type, value, date } = req.body;

    // Prioridad: Fecha del body > Query > Servidor
    const targetDate = date || req.query.date || getServerDateString();

    let { log } = await ensureDailyLog(userId, targetDate, req.user.streak.current);

    switch (type) {
        case 'mood': log.mood = value; break;
        case 'weight': log.weight = value; break;
        case 'sleepHours': log.sleepHours = value; break;
        case 'steps': log.steps = value; break;
        case 'streakCurrent': log.streakCurrent = value; break;

        case 'nutrition':
            log.nutrition = { ...log.nutrition, ...value };
            break;

        case 'sport': log.sportWorkouts = value; break;
        case 'training': log.gymWorkouts = value; break;
        case 'missions': log.missionStats = value; break;
        case 'gains': log.gains = value; break;

        default:
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
        .sort({ date: 1 })
        .select('date weight')
        .lean();

    res.status(200).json(logs);
});

module.exports = {
    getDailyLog,
    getDailyLogByDate,
    updateDailyLog,
    getWeightHistory
};