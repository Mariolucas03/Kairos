const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const levelService = require('../services/levelService');
// Importamos la función manual del scheduler
const { runNightlyMaintenance } = require('../utils/scheduler');
const { getRewardForDay } = require('../utils/dailyRewards');
const { getMadridDateString } = require('../utils/dateHelpers');

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
    const now = new Date();
    // 🔥 Fechas SIEMPRE en hora de Madrid. Con toISOString() (UTC) el "día" cambiaba
    // a las 02:00 locales, así que entre las 00:00 y 02:00 se podía reclamar dos veces
    // y el modal reaparecía como no reclamado.
    const todayStr = getMadridDateString(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getMadridDateString(yesterday);

    // 🔒 ATÓMICO: comparamos contra el DÍA guardado como string (hora de Madrid), así que
    // solo entra el primer clic del día natural. Evita doble premio por doble clic,
    // por dos pestañas abiertas, o por el desfase UTC/Madrid de madrugada.
    const claimLock = await User.findOneAndUpdate(
        { _id: req.user._id, 'dailyRewards.lastClaimDay': { $ne: todayStr } },
        { $set: { 'dailyRewards.lastClaimDay': todayStr, 'dailyRewards.lastClaimDate': now } },
        { new: false } // Queremos el documento ANTERIOR para saber en qué día del ciclo estaba
    );

    const alreadyClaimed = async () => {
        const current = await User.findById(req.user._id).select('dailyRewards');
        return res.status(400).json({
            success: false,
            alreadyClaimed: true,
            message: '¡Ya has reclamado tu recompensa de hoy! Vuelve mañana.',
            dailyRewards: current?.dailyRewards || null
        });
    };

    if (!claimLock) return alreadyClaimed();

    const previousRewards = claimLock.dailyRewards || { claimedDays: [], lastClaimDate: null };
    const lastStr = previousRewards.lastClaimDay
        || (previousRewards.lastClaimDate ? getMadridDateString(new Date(previousRewards.lastClaimDate)) : null);

    // Usuarios anteriores a este campo no tenían `lastClaimDay`, así que el lock de arriba
    // no los frena. Comprobamos también la fecha derivada para no regalar un reclamo extra.
    if (lastStr === todayStr) return alreadyClaimed();

    // Si la última vez fue ayer seguimos el ciclo; si se rompió la cadena, volvemos al día 1.
    const previousDays = previousRewards.claimedDays || [];
    const cyclePosition = lastStr === yesterdayStr ? (previousDays.length % 7) : 0;
    const currentDay = cyclePosition + 1;

    // `claimedDays` es siempre la lista canónica de días ya cobrados del ciclo en curso
    // ([1..currentDay], como máximo hasta el 6) y se vacía al cobrar el día 7.
    // Reconstruirla en vez de ir añadiendo evita que crezca sin límite —había cuentas
    // con más de 7 entradas, y entonces el calendario marcaba todos los días como cobrados.
    const nextClaimedDays = currentDay === 7
        ? []
        : Array.from({ length: currentDay }, (_, i) => i + 1);

    // 🔥 Recompensa calculada en el servidor según el día del ciclo (nunca confiar en el cliente)
    const { coins: rewardCoins, gameCoins: rewardGameCoins, xp: rewardXP, hp: rewardHp } = getRewardForDay(currentDay);

    const user = await User.findById(req.user._id);
    user.dailyRewards.claimedDays = nextClaimedDays;
    user.dailyRewards.lastClaimDate = now;
    user.dailyRewards.lastClaimDay = todayStr;
    if (rewardHp > 0) {
        user.hp = Math.min(user.maxHp, (user.hp ?? 0) + rewardHp);
        user.lives = user.hp;
    }
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
        // Lo devolvemos aparte para que el frontend pueda sincronizar el estado
        // aunque el objeto `user` viaje incompleto por cualquier motivo.
        dailyRewards: { claimedDays: nextClaimedDays, lastClaimDate: now, lastClaimDay: todayStr },
        reward: { xp: rewardXP, coins: rewardCoins, gameCoins: rewardGameCoins, hp: rewardHp, day: currentDay }
    });
});

// ==========================================
// 3.b AJUSTES DE PERFIL (descripción y privacidad)
// ==========================================
// @route PUT /api/users/profile
const updateProfileSettings = asyncHandler(async (req, res) => {
    const { bio, isPrivate, visibility } = req.body;

    const updates = {};

    if (bio !== undefined) {
        if (typeof bio !== 'string') { res.status(400); throw new Error('Descripción inválida'); }
        updates.bio = bio.slice(0, 150);
    }

    if (isPrivate !== undefined) {
        updates.isPrivate = !!isPrivate;
    }

    // Qué secciones enseñas. Se escriben campo a campo (no el objeto entero)
    // para que mandar solo una no borre las demás.
    if (visibility && typeof visibility === 'object') {
        ['workouts', 'food', 'missions', 'body'].forEach(k => {
            if (visibility[k] !== undefined) updates[`visibility.${k}`] = !!visibility[k];
        });
    }

    if (Object.keys(updates).length === 0) { res.status(400); throw new Error('Nada que actualizar'); }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
    ).select('-password');

    res.json({ message: 'Perfil actualizado', user });
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
        user.hp = Math.max(0, Math.min(user.maxHp, Number(hp) || 0));
        user.lives = user.hp;
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
        user.dailyRewards.lastClaimDay = getMadridDateString(yesterday);
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
    forceNightlyMaintenance,
    updateProfileSettings
};