const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Necesario para login
const User = require('../models/User');
const DailyLog = require('../models/DailyLog');
const levelService = require('../services/levelService');
const { runNightlyMaintenance } = require('../utils/scheduler');

// Función auxiliar para generar JWT (por si no tienes el archivo utils a mano)
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ==========================================
// 0. AUTENTICACIÓN (LO QUE FALTABA)
// ==========================================
const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) { res.status(400); throw new Error('Rellena todos los campos'); }

    const userExists = await User.findOne({ email });
    if (userExists) { res.status(400); throw new Error('El usuario ya existe'); }

    const user = await User.create({ username, email, password });

    if (user) {
        res.status(201).json({
            _id: user.id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id)
        });
    } else {
        res.status(400); throw new Error('Datos no válidos');
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            isAdmin: user.isAdmin,
            token: generateToken(user._id)
        });
    } else {
        res.status(401); throw new Error('Credenciales inválidas');
    }
});

const updateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (user) {
        user.username = req.body.username || user.username;
        user.email = req.body.email || user.email;
        if (req.body.password) { user.password = req.body.password; }
        if (req.body.avatar) { user.avatar = req.body.avatar; }

        const updatedUser = await user.save();
        res.json({
            _id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            token: generateToken(updatedUser._id)
        });
    } else {
        res.status(404); throw new Error('Usuario no encontrado');
    }
});

// ==========================================
// 1. OBTENER PERFIL
// ==========================================
const getMe = asyncHandler(async (req, res) => {
    const user = await levelService.ensureLevelConsistency(req.user._id);
    let userToSend = user || await User.findById(req.user._id);

    await userToSend.populate('inventory.item');
    await userToSend.populate({
        path: 'missionRequests',
        populate: { path: 'user', select: 'username avatar' }
    });

    userToSend.password = undefined;
    if (userToSend) res.status(200).json(userToSend);
    else { res.status(404); throw new Error('Usuario no encontrado'); }
});

// 2. ACTUALIZAR MACROS
const updateMacros = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('Usuario no encontrado'); }
    const { calories, protein, carbs, fat, fiber } = req.body;
    if (!user.macros) user.macros = { calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 30 };
    if (calories !== undefined) user.macros.calories = Number(calories);
    if (protein !== undefined) user.macros.protein = Number(protein);
    if (carbs !== undefined) user.macros.carbs = Number(carbs);
    if (fat !== undefined) user.macros.fat = Number(fat);
    if (fiber !== undefined) user.macros.fiber = Number(fiber);
    user.markModified('macros');
    const updatedUser = await user.save();
    res.status(200).json(updatedUser);
});

// 3. RECOMPENSA DIARIA
const claimDailyReward = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('Usuario no encontrado'); }
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (!user.dailyRewards) user.dailyRewards = { claimedDays: [], lastClaimDate: null };

    if (user.dailyRewards.lastClaimDate) {
        const lastDateStr = new Date(user.dailyRewards.lastClaimDate).toISOString().split('T')[0];
        if (lastDateStr === todayStr) return res.status(400).json({ success: false, message: 'Ya reclamado hoy.' });
    }

    let currentDay = 1;
    if (user.dailyRewards.lastClaimDate) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const lastDateStr = new Date(user.dailyRewards.lastClaimDate).toISOString().split('T')[0];
        if (lastDateStr === yesterdayStr) {
            currentDay = (user.dailyRewards.claimedDays.length % 7) + 1;
        } else {
            user.dailyRewards.claimedDays = [];
            currentDay = 1;
        }
    }

    user.dailyRewards.claimedDays.push(currentDay);
    user.dailyRewards.lastClaimDate = now;
    await user.save();
    const result = await levelService.addRewards(user._id, 20, 0, 50);
    res.status(200).json({ success: true, message: `Día ${currentDay}`, user: result.user, reward: { xp: 20, coins: 0, gameCoins: 50, day: currentDay } });
});

// 4. RECOMPENSA JUEGOS
const addGameReward = asyncHandler(async (req, res) => {
    const { coins, xp, gameCoins } = req.body;
    const result = await levelService.addRewards(req.user._id, Number(xp || 0), Number(coins || 0), Number(gameCoins || 0));
    res.status(200).json({ success: true, user: result.user, leveledUp: result.leveledUp, newBalance: result.user.coins });
});

// 5. ACTUALIZAR DATOS FÍSICOS
const updatePhysicalStats = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { age, height, gender } = req.body;
    user.physicalStats = { age: Number(age), height: Number(height), gender };
    const updatedUser = await user.save();
    res.status(200).json(updatedUser);
});

// 6. GAME OVER / REDENCIÓN
const setRedemptionMission = asyncHandler(async (req, res) => {
    const { mission } = req.body;
    const user = await User.findById(req.user._id);
    if (user.redemptionMission) return res.status(400).json({ message: "Pacto ya sellado." });
    user.redemptionMission = mission;
    await user.save();
    res.json({ message: "Pacto sellado", user });
});

const reviveUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    user.hp = 20; user.lives = 20;
    await user.save();
    res.json({ message: "Has revivido.", user });
});

const updateStatsManual = asyncHandler(async (req, res) => {
    const { hp, xp, coins } = req.body;
    const user = await User.findById(req.user._id);
    if (hp !== undefined) { user.hp = hp; user.lives = hp; }
    if (xp !== undefined) user.currentXP = xp;
    if (coins !== undefined) user.coins = coins;
    await user.save();
    res.json(user);
});

// 7. DEBUG / TESTING
const simulateYesterday = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    user.streak.lastLogDate = yesterday;
    if (!user.streak.current) user.streak.current = 1;
    if (user.dailyRewards) user.dailyRewards.lastClaimDate = yesterday;
    await user.save();
    res.json({ message: "Simulado AYER", streak: user.streak });
});

const setManualStreak = asyncHandler(async (req, res) => {
    const { days } = req.body;
    const user = await User.findById(req.user._id);
    user.streak.current = parseInt(days);
    user.streak.lastLogDate = new Date();
    await user.save();
    res.json({ message: `Racha: ${days}`, streak: user.streak });
});

const forceNightlyMaintenance = asyncHandler(async (req, res) => {
    console.log("🔧 DEBUG: Forzando mantenimiento...");
    const result = await runNightlyMaintenance();
    res.json({ message: "Mantenimiento ejecutado.", result });
});

// 8. APPLE HEALTH SYNC
const syncHealthData = asyncHandler(async (req, res) => {
    const { steps, sleep, secret, userId } = req.body;
    if (secret !== process.env.CRON_SECRET) { res.status(401); throw new Error('Clave incorrecta'); }
    if (!userId) { res.status(400); throw new Error('Falta userId'); }

    const today = new Date().toISOString().split('T')[0];
    const log = await DailyLog.findOneAndUpdate(
        { user: userId, date: today },
        { $set: { 'healthStats.steps': Number(steps) || 0, 'healthStats.sleepHours': Number(sleep) || 0 } },
        { new: true, upsert: true }
    );
    res.status(200).json({ message: 'Datos sincronizados', log });
});

// ==========================================
// EXPORT FINAL (AHORA SÍ ESTÁN TODAS)
// ==========================================
module.exports = {
    registerUser, // <--- RESTAURADO
    loginUser,    // <--- RESTAURADO
    updateUser,   // <--- RESTAURADO
    getMe,
    updateMacros,
    claimDailyReward,
    addGameReward,
    updatePhysicalStats,
    setRedemptionMission,
    reviveUser,
    updateStatsManual,
    simulateYesterday,
    setManualStreak,
    forceNightlyMaintenance,
    syncHealthData
};