const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const levelService = require('../services/levelService');
// Importamos la función manual del scheduler
const { runNightlyMaintenance } = require('../utils/scheduler');

// ==========================================
// 1. OBTENER PERFIL (getMe)
// ==========================================
// @desc    Obtener datos del usuario actual (Con auto-reparación)
const getMe = asyncHandler(async (req, res) => {
    const user = await levelService.ensureLevelConsistency(req.user._id);
    let userToSend = user;

    if (!userToSend) {
        userToSend = await User.findById(req.user._id);
    }

    // Poblamos inventario y las solicitudes de misión para el buzón
    await userToSend.populate('inventory.item');
    await userToSend.populate({
        path: 'missionRequests',
        populate: { path: 'user', select: 'username avatar' } // Para ver quién invita
    });

    userToSend.password = undefined;

    if (userToSend) {
        res.status(200).json(userToSend);
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado');
    }
});

// ==========================================
// 2. ACTUALIZAR MACROS
// ==========================================
const updateMacros = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('Usuario no encontrado'); }

    const { calories, protein, carbs, fat, fiber } = req.body;

    if (!user.macros) {
        user.macros = { calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 30 };
    }

    if (calories !== undefined) user.macros.calories = Number(calories);
    if (protein !== undefined) user.macros.protein = Number(protein);
    if (carbs !== undefined) user.macros.carbs = Number(carbs);
    if (fat !== undefined) user.macros.fat = Number(fat);
    if (fiber !== undefined) user.macros.fiber = Number(fiber);

    user.markModified('macros');
    const updatedUser = await user.save();
    res.status(200).json(updatedUser);
});

// ==========================================
// 3. RECOMPENSA DIARIA
// ==========================================
const claimDailyReward = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('Usuario no encontrado'); }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (!user.dailyRewards) {
        user.dailyRewards = { claimedDays: [], lastClaimDate: null };
    }

    if (user.dailyRewards.lastClaimDate) {
        const lastDate = new Date(user.dailyRewards.lastClaimDate);
        const lastDateStr = lastDate.toISOString().split('T')[0];

        if (lastDateStr === todayStr) {
            return res.status(400).json({
                success: false,
                message: '¡Ya has reclamado tu recompensa de hoy! Vuelve mañana.'
            });
        }
    }

    let currentDay = 1;
    if (user.dailyRewards.lastClaimDate) {
        const lastDate = new Date(user.dailyRewards.lastClaimDate);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const lastDateStr = lastDate.toISOString().split('T')[0];

        if (lastDateStr === yesterdayStr) {
            const currentStreak = user.dailyRewards.claimedDays.length;
            currentDay = (currentStreak % 7) + 1;
        } else {
            user.dailyRewards.claimedDays = [];
            currentDay = 1;
        }
    }

    const rewardCoins = 0;
    const rewardXP = 20;
    const rewardGameCoins = 50;

    user.dailyRewards.claimedDays.push(currentDay);
    user.dailyRewards.lastClaimDate = now;
    await user.save();

    const result = await levelService.addRewards(
        user._id,
        rewardXP,
        rewardCoins,
        rewardGameCoins
    );

    res.status(200).json({
        success: true,
        message: `¡Has reclamado el Día ${currentDay}!`,
        user: result.user,
        reward: { xp: rewardXP, coins: rewardCoins, gameCoins: rewardGameCoins, day: currentDay }
    });
});

// ==========================================
// 4. RECOMPENSA JUEGOS
// ==========================================
const addGameReward = asyncHandler(async (req, res) => {
    const { coins, xp, gameCoins } = req.body;
    const result = await levelService.addRewards(
        req.user._id,
        Number(xp || 0),
        Number(coins || 0),
        Number(gameCoins || 0)
    );

    res.status(200).json({
        success: true,
        user: result.user,
        leveledUp: result.leveledUp,
        newBalance: result.user.coins,
        newGameCoins: result.user.gameCoins
    });
});

// ==========================================
// 5. ACTUALIZAR DATOS FÍSICOS
// ==========================================
const updatePhysicalStats = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) { res.status(404); throw new Error('Usuario no encontrado'); }

    const { age, height, gender } = req.body;

    user.physicalStats = {
        age: Number(age),
        height: Number(height),
        gender
    };

    const updatedUser = await user.save();
    res.status(200).json(updatedUser);
});

// ==========================================
// 6. GAME OVER / REDENCIÓN
// ==========================================
const setRedemptionMission = asyncHandler(async (req, res) => {
    const { mission } = req.body;
    if (!mission || mission.trim() === '') return res.status(400).json({ message: "La misión es obligatoria" });
    const user = await User.findById(req.user._id);
    if (user.redemptionMission) return res.status(400).json({ message: "Pacto ya sellado." });
    user.redemptionMission = mission;
    await user.save();
    res.json({ message: "Pacto sellado", user });
});

const reviveUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    user.hp = 20;
    user.lives = 20;
    await user.save();
    res.json({ message: "Has revivido.", user });
});

const updateStatsManual = asyncHandler(async (req, res) => {
    const { hp, xp, coins } = req.body;
    const user = await User.findById(req.user._id);

    if (hp !== undefined) {
        user.hp = hp;
        user.lives = hp;
    }
    if (xp !== undefined) user.currentXP = xp;
    if (coins !== undefined) user.coins = coins;

    await user.save();
    res.json(user);
});

// ==========================================
// 7. DEBUG / TESTING
// ==========================================
const simulateYesterday = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    user.streak.lastLogDate = yesterday;
    if (!user.streak.current || user.streak.current === 0) user.streak.current = 1;

    if (user.dailyRewards) {
        user.dailyRewards.lastClaimDate = yesterday;
    }

    await user.save();
    res.json({
        message: "✅ Modo prueba: Última conexión y reclamo seteados a AYER.",
        streak: user.streak
    });
});

const setManualStreak = asyncHandler(async (req, res) => {
    const { days } = req.body;
    const user = await User.findById(req.user._id);
    user.streak.current = parseInt(days);
    user.streak.lastLogDate = new Date();
    await user.save();
    res.json({ message: `Racha forzada a ${days}`, streak: user.streak });
});

const forceNightlyMaintenance = asyncHandler(async (req, res) => {
    console.log("🔧 DEBUG: Forzando mantenimiento nocturno...");
    const result = await runNightlyMaintenance();
    const updatedUser = await User.findById(req.user._id);
    res.json({
        message: "🌃 Mantenimiento forzado ejecutado.",
        result,
        user: updatedUser
    });
});

// ==========================================
// EXPORT FINAL (¡SIEMPRE AL FINAL!)
// ==========================================
module.exports = {
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
    forceNightlyMaintenance
};