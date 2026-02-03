const asyncHandler = require('express-async-handler');
const DailyLog = require('../models/DailyLog');
const Mission = require('../models/Mission');
const NutritionLog = require('../models/NutritionLog');

const getServerDateString = () => new Date().toISOString().split('T')[0];

const ensureDailyLog = async (userId, dateString, userStreak) => {
    const dateObj = new Date(dateString);
    const dayOfWeek = dateObj.getDay();

    const missionQuery = {
        $or: [{ user: userId }, { participants: userId }],
        frequency: 'daily',
        $or: [{ specificDays: { $size: 0 } }, { specificDays: dayOfWeek }],
        $or: [{ isCoop: false }, { isCoop: true, invitationStatus: 'active' }]
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
        case 'sport': log.sportWorkouts = value; break;
        case 'training': log.gymWorkouts = value; break;
        case 'missions': log.missionStats = value; break;
        case 'gains': log.gains = value; break;
        default: if (log[type] !== undefined) log[type] = value; break;
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