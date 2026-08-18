const asyncHandler = require('express-async-handler');
const DailyLog = require('../models/DailyLog');
const Mission = require('../models/Mission');
const NutritionLog = require('../models/NutritionLog');
const { getMadridDateString } = require('../utils/dateHelpers');

// ⚠️ ANTES: new Date().toISOString().split('T')[0], que da la fecha en UTC.
// Entre las 00:00 y las 02:00 de Madrid eso es AYER, así que todo lo que
// registrabas de madrugada (ánimo, peso, sueño, pasos) se guardaba en el día
// anterior, y encima no cuadraba con foodController/gymController, que ya
// usaban la fecha de Madrid: el log del día y el de nutrición apuntaban a
// documentos distintos y los totales nunca se sincronizaban.
const getServerDateString = () => getMadridDateString();

const ensureDailyLog = async (userId, dateString, userStreak) => {
    // ⚠️ new Date('2026-08-03') se interpreta como medianoche UTC, y getDay()
    // devuelve el día en la zona del servidor: con cualquier desfase negativo
    // salía el día ANTERIOR y se contaban las misiones del día equivocado.
    // Al fijar el mediodía, ningún huso horario puede cambiar el día.
    const dateObj = new Date(`${dateString}T12:00:00`);
    const dayOfWeek = dateObj.getDay();

    const missionQuery = {
        $and: [
            { $or: [{ user: userId }, { participants: userId }] },
            { frequency: 'daily' },
            { $or: [{ specificDays: { $size: 0 } }, { specificDays: dayOfWeek }] },
            { $or: [{ isCoop: false }, { isCoop: true, invitationStatus: 'active' }] }
        ]
    };

    const [activeCount, lastLog, nutritionLog] = await Promise.all([
        Mission.countDocuments(missionQuery),
        DailyLog.findOne({ user: userId }).sort({ date: -1 }).select('weight').lean(),
        NutritionLog.findOne({ user: userId, date: dateString }).lean()
    ]);

    const persistentWeight = lastLog ? lastLog.weight : 0;
    const currentKcal = nutritionLog ? nutritionLog.totalCalories : 0;

    let log = await DailyLog.findOneAndUpdate(
        { user: userId, date: dateString },
        {
            $setOnInsert: {
                user: userId, date: dateString, weight: persistentWeight, streakCurrent: userStreak,
                nutrition: { totalKcal: currentKcal },
                missionStats: { completed: 0, total: activeCount, listCompleted: [] },
                gains: { coins: 0, xp: 0, lives: 0 }
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    let needsSave = false;

    if (log.missionStats.total !== activeCount) {
        log.missionStats.total = activeCount;
        if (log.missionStats.completed > activeCount) log.missionStats.completed = activeCount;
        needsSave = true;
    }

    if (log.nutrition.totalKcal !== currentKcal) {
        log.nutrition.totalKcal = currentKcal;
        needsSave = true;
    }

    if (needsSave) await log.save();

    return { log, nutritionLog };
};

const getDailyLog = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const targetDate = req.query.date || getServerDateString();
    const { log, nutritionLog } = await ensureDailyLog(userId, targetDate, req.user.streak.current);
    const logObj = log.toObject();
    if (nutritionLog) {
        logObj.nutrition = { ...logObj.nutrition, meals: nutritionLog.meals, totalKcal: nutritionLog.totalCalories, totalProtein: nutritionLog.totalProtein, totalCarbs: nutritionLog.totalCarbs, totalFat: nutritionLog.totalFat, totalFiber: nutritionLog.totalFiber };
    }
    res.status(200).json(logObj);
});

const getDailyLogByDate = asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!date) { res.status(400); throw new Error('Falta fecha'); }
    const log = await DailyLog.findOne({ user: req.user._id, date: date }).lean();
    if (log) {
        const nutritionLog = await NutritionLog.findOne({ user: req.user._id, date: date }).lean();
        if (nutritionLog) log.nutrition = { ...log.nutrition, meals: nutritionLog.meals, totalKcal: nutritionLog.totalCalories };
        res.status(200).json(log);
    } else { res.status(200).json(null); }
});

const updateDailyLog = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { type, value, date } = req.body;
    const targetDate = date || req.query.date || getServerDateString();
    let { log } = await ensureDailyLog(userId, targetDate, req.user.streak.current);

    switch (type) {
        case 'mood': log.mood = value; break;
        case 'weight': log.weight = value; break;
        case 'sleepHours': log.sleepHours = value; break;
        case 'steps': log.steps = value; break;
        case 'streakCurrent': log.streakCurrent = value; break;
        case 'nutrition': log.nutrition = { ...log.nutrition, ...value }; break;
        // 🔒 'sport', 'training', 'missions' y 'gains' NO son editables por el cliente:
        // los gestiona el servidor (gymController con $push, levelService/missionController
        // con $inc) porque alimentan premios reales (ranking mensual, ranking de clanes).
        // Dejarlos aquí permitía a cualquiera mandar PUT /api/daily {type:'gains', value:{xp:9e9}}
        // y ganar el premio mensual/de clan de forma fraudulenta.
        default: res.status(400); throw new Error('Campo no editable'); // 🔥 solo se permiten los campos listados arriba
    }
    await log.save();
    const logObj = log.toObject();
    logObj.totalKcal = log.nutrition.totalKcal;
    res.status(200).json(logObj);
});

const getWeightHistory = asyncHandler(async (req, res) => {
    const logs = await DailyLog.find({ user: req.user._id, weight: { $gt: 0 } }).sort({ date: 1 }).select('date weight').lean();
    res.status(200).json(logs);
});

module.exports = { getDailyLog, getDailyLogByDate, updateDailyLog, getWeightHistory };