const asyncHandler = require('express-async-handler');
const DailyLog = require('../models/DailyLog');
const Mission = require('../models/Mission');
const NutritionLog = require('../models/NutritionLog'); // 🔥 FIX PUNTO 7: Importar modelo

// Utilidad para fecha servidor (Fallback)
const getServerDateString = () => new Date().toISOString().split('T')[0];

/**
 * 🔥 HELPER INTERNO OPTIMIZADO: Busca o Crea el Log del día
 * Usa Promise.all para paralelizar lecturas y reduce latencia.
 * Sincroniza Nutrición y Misiones.
 */
const ensureDailyLog = async (userId, dateString, userStreak) => {
    // Creamos fecha local simulada para obtener el día de la semana correcto (0-6)
    const dateObj = new Date(dateString);
    const dayOfWeek = dateObj.getDay();

    // 1. OPTIMIZACIÓN: Ejecutar consultas independientes en PARALELO
    // 🔥 FIX PUNTO 3: Contamos solo las misiones que APLICAN HOY para el denominador (Total)
    // No filtramos por 'completed: false' aquí porque 'total' debe ser la suma de hechas + pendientes
    const [activeCount, lastLog, nutritionLog] = await Promise.all([
        Mission.countDocuments({
            $or: [
                { user: userId },
                { participants: userId }
            ],
            frequency: 'daily',
            // Si es coop, aseguramos que esté activa
            $or: [
                { isCoop: false },
                { isCoop: true, invitationStatus: 'active' }
            ],
            // Filtrar por día específico o todos los días
            $or: [
                { specificDays: { $size: 0 } }, // Todos los días
                { specificDays: dayOfWeek }     // Día específico de hoy
            ]
        }),
        // .lean() para lectura rápida del último peso
        DailyLog.findOne({ user: userId }).sort({ date: -1 }).select('weight').lean(),
        // 🔥 FIX PUNTO 7: Traer el log de nutrición real para inyectar datos
        NutritionLog.findOne({ user: userId, date: dateString }).lean()
    ]);

    const persistentWeight = lastLog ? lastLog.weight : 0;

    // Preparar datos de nutrición sincronizados
    const currentKcal = nutritionLog ? nutritionLog.totalCalories : 0;

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
                nutrition: { totalKcal: currentKcal }, // Sincronizado al crear
                missionStats: { completed: 0, total: activeCount, listCompleted: [] },
                gains: { coins: 0, xp: 0, lives: 0 }
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // 3. Sincronizaciones posteriores a la creación (Self-Healing)
    let needsSave = false;

    // Sincronizar total de misiones si cambió (ej: se añadió una misión nueva hoy)
    // Solo actualizamos si es mayor, para no romper históricos pasados, o si es hoy
    const isToday = dateString === getServerDateString();
    if (isToday && log.missionStats.total !== activeCount) {
        log.missionStats.total = activeCount;
        needsSave = true;
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

    // 🔥 FIX PUNTO 7: INYECTAR DETALLE DE COMIDAS
    // El widget espera ver 'meals' para hacer el desglose. Si existe nutritionLog, lo pasamos.
    if (nutritionLog) {
        logObj.nutrition = {
            ...logObj.nutrition,
            meals: nutritionLog.meals, // Array de { name: 'Desayuno', foods: [...] }
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
    const { type, value, date } = req.body; // Aceptamos fecha en el body también

    // Prioridad: Fecha del body > Query > Servidor
    const targetDate = date || req.query.date || getServerDateString();

    // 1. Garantizamos que el log existe usando el Helper
    // Desestructuramos para obtener solo el documento mongoose 'log'
    let { log } = await ensureDailyLog(userId, targetDate, req.user.streak.current);

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