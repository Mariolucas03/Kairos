const asyncHandler = require('express-async-handler');
const Mission = require('../models/Mission');
const DailyLog = require('../models/DailyLog');
const User = require('../models/User');
const levelService = require('../services/levelService');
const mongoose = require('mongoose');

// 🔥 1. NUEVA TABLA DE RECOMPENSAS AUMENTADA
const REWARD_TABLE = {
    easy: { xp: 50, gameCoins: 100, coins: 10 },
    medium: { xp: 75, gameCoins: 150, coins: 30 },
    hard: { xp: 100, gameCoins: 200, coins: 50 },
    epic: { xp: 150, gameCoins: 250, coins: 70 }
};

const FREQUENCY_MULTIPLIERS = { daily: 1, weekly: 5, monthly: 15, yearly: 100 };

const calculateRewards = (difficulty, frequency, isCoop) => {
    const base = REWARD_TABLE[difficulty] || REWARD_TABLE.easy;
    const mult = FREQUENCY_MULTIPLIERS[frequency] || 1;
    const coopMult = isCoop ? 1.5 : 1;

    return {
        xpReward: Math.round(base.xp * mult * coopMult),
        gameCoinReward: Math.round(base.gameCoins * mult * coopMult),
        coinReward: Math.round(base.coins * mult * coopMult)
    };
};

// ... (getMissions, createMission se mantienen igual, usando calculateRewards) ...
// SOLO PONGO EL CONTROLADOR QUE CAMBIA (updateProgress) Y LA EXPORTACIÓN

// ------------------------------------------------------------------
// 1. OBTENER MISIONES
// ------------------------------------------------------------------
const getMissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const userIdString = userId.toString();
    let userIdObj;
    try { userIdObj = new mongoose.Types.ObjectId(userIdString); } catch (e) { userIdObj = userId; }

    const query = {
        $or: [
            { user: userIdObj }, { user: userIdString },
            { participants: userIdObj }, { participants: userIdString },
            { participants: { $in: [userIdObj, userIdString] }, invitationStatus: 'active' }
        ]
    };

    const missions = await Mission.find(query).populate('participants', 'username avatar').sort({ completed: 1, createdAt: -1 });

    const today = new Date().toDateString();
    let updated = false;

    for (let mission of missions) {
        try {
            if (mission.type === 'habit' && mission.completed) {
                if (!mission.lastUpdated) mission.lastUpdated = new Date();
                const lastUpdate = new Date(mission.lastUpdated).toDateString();

                if (lastUpdate !== today && mission.frequency === 'daily') {
                    mission.progress = 0;
                    mission.completed = false;
                    if (!mission.contributions) mission.contributions = new Map();
                    if (mission.participants) {
                        mission.participants.forEach(p => {
                            const pId = p._id ? p._id.toString() : p.toString();
                            mission.contributions.set(pId, 0);
                        });
                    }
                    await mission.save();
                    updated = true;
                }
            }
        } catch (err) { }
    }

    if (updated) return getMissions(req, res);
    res.status(200).json(missions);
});

// ------------------------------------------------------------------
// 2. CREAR MISIÓN
// ------------------------------------------------------------------
const createMission = asyncHandler(async (req, res) => {
    const { title, frequency, type, difficulty, target, specificDays, unit, isCoop, friendId } = req.body;

    if (!title) { res.status(400); throw new Error('El título es obligatorio'); }

    const freq = frequency || 'daily';
    const diff = difficulty || 'easy';
    const days = Array.isArray(specificDays) ? specificDays : [];

    // Calculamos recompensas con la nueva tabla
    const rewards = calculateRewards(diff, freq, !!isCoop);

    const participants = [req.user._id];
    let invStatus = 'none';

    if (isCoop && friendId) {
        participants.push(friendId);
        invStatus = 'pending';
    }

    const mission = await Mission.create({
        user: req.user._id,
        title: title.trim(),
        frequency: freq,
        specificDays: days,
        type: type || 'habit',
        difficulty: diff,
        target: Number(target) || 1,
        unit: unit ? unit.trim() : '',
        progress: 0,
        ...rewards,
        isCoop: !!isCoop,
        participants: participants,
        invitationStatus: invStatus,
        contributions: { [req.user._id]: 0 }
    });

    if (isCoop && friendId) {
        await User.findByIdAndUpdate(friendId, { $push: { missionRequests: mission._id } });
    }

    res.status(201).json(mission);
});

// ------------------------------------------------------------------
// 4. ACTUALIZAR / EDITAR
// ------------------------------------------------------------------
const updateProgress = asyncHandler(async (req, res) => {
    const { amount, editMode, title, target, frequency, difficulty, unit, specificDays } = req.body;
    const userId = req.user._id;

    const mission = await Mission.findById(req.params.id);
    if (!mission) { res.status(404); throw new Error('Misión no encontrada'); }

    const isParticipant = mission.participants.map(p => p.toString()).includes(userId.toString());
    const isOwner = mission.user.toString() === userId.toString();

    if (!isParticipant && !isOwner) { res.status(401); throw new Error('No tienes permiso'); }

    // --- MODO EDICIÓN ---
    if (editMode) {
        if (title) mission.title = title.trim();
        if (target) mission.target = Number(target);
        if (frequency) mission.frequency = frequency;
        if (difficulty) mission.difficulty = difficulty;
        if (unit !== undefined) mission.unit = unit.trim();

        // 🔥 FIX 3: Guardar días específicos al editar (Antes no se guardaba)
        if (specificDays && Array.isArray(specificDays)) {
            mission.specificDays = specificDays;
        }

        if (frequency || difficulty) {
            const r = calculateRewards(
                frequency || mission.frequency,
                difficulty || mission.difficulty,
                mission.isCoop
            );
            mission.xpReward = r.xpReward;
            mission.coinReward = r.coinReward;
            mission.gameCoinReward = r.gameCoinReward;
        }

        if (mission.progress > mission.target) mission.progress = mission.target;

        await mission.save();
        return res.json({ message: "Misión actualizada", mission });
    }

    // --- LÓGICA DE PROGRESO (SIN CAMBIOS) ---
    if (mission.isCoop && mission.invitationStatus === 'pending') {
        res.status(400); throw new Error('Tu compañero aún no ha aceptado.');
    }
    const today = new Date();
    if (mission.type === 'habit' && mission.completed) {
        const last = new Date(mission.lastUpdated);
        if (last.toDateString() === today.toDateString()) return res.status(200).json({ message: 'Ya completada hoy', alreadyCompleted: true });
        mission.progress = 0; mission.completed = false;
        if (mission.contributions) mission.participants.forEach(p => mission.contributions.set(p.toString(), 0));
    }

    const addAmount = Number(amount) || 1;

    // Sync Vinculadas (Mismo Título + Unidad)
    const linkedMissions = await Mission.find({ user: userId, title: mission.title, unit: mission.unit, _id: { $ne: mission._id }, completed: false });
    for (let linked of linkedMissions) {
        linked.progress += addAmount; linked.lastUpdated = today;
        if (linked.progress >= linked.target) {
            linked.completed = true; linked.progress = linked.target;
            await levelService.addRewards(userId, linked.xpReward, linked.coinReward, linked.gameCoinReward);
            await DailyLog.findOneAndUpdate({ user: userId, date: today.toISOString().split('T')[0] }, { $inc: { 'missionStats.completed': 1 }, $push: { 'missionStats.listCompleted': { title: linked.title, coinReward: linked.coinReward, xpReward: linked.xpReward, type: linked.type } } }, { upsert: true });
        }
        await linked.save();
    }

    mission.progress += addAmount;
    mission.lastUpdated = today;
    let rewards = null, leveledUp = false, userResult = null;

    if (mission.progress >= mission.target) {
        mission.completed = true; mission.progress = mission.target;
        for (const pId of mission.participants) {
            const r = await levelService.addRewards(pId, mission.xpReward, mission.coinReward, mission.gameCoinReward);
            if (pId.toString() === userId.toString()) { userResult = r.user; leveledUp = r.leveledUp; rewards = { xp: mission.xpReward, coins: mission.coinReward, gameCoins: mission.gameCoinReward }; }
        }
        await DailyLog.findOneAndUpdate({ user: userId, date: today.toISOString().split('T')[0] }, { $inc: { 'missionStats.completed': 1 }, $push: { 'missionStats.listCompleted': { title: mission.title, coinReward: mission.coinReward, xpReward: mission.xpReward, type: mission.type } } }, { upsert: true });
    }
    await mission.save();
    res.json({ message: mission.completed ? '¡Completada!' : 'Actualizada', mission, user: userResult, leveledUp, rewards, progressOnly: !mission.completed });
});

// ... (deleteMission, respondMissionInvite, nukeMyMissions IGUAL QUE ANTES) ...
const deleteMission = asyncHandler(async (req, res) => {
    const mission = await Mission.findById(req.params.id);
    if (!mission) { res.status(404); throw new Error('No encontrada'); }
    if (mission.user.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Solo el creador puede cancelar'); }
    if (mission.invitationStatus === 'pending') {
        const friendId = mission.participants.find(p => p.toString() !== req.user._id.toString());
        if (friendId) await User.findByIdAndUpdate(friendId, { $pull: { missionRequests: mission._id } });
    }
    await mission.deleteOne();
    res.status(200).json({ id: req.params.id, message: "Eliminada" });
});

const respondMissionInvite = asyncHandler(async (req, res) => {
    const { missionId, action } = req.body;
    const userId = req.user._id;
    if (!missionId) { res.status(400); throw new Error('Falta ID'); }
    const mission = await Mission.findById(missionId);
    if (!mission) { await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } }); return res.status(404).json({ message: 'No existe' }); }
    if (action === 'accept') {
        mission.invitationStatus = 'active';
        if (!mission.contributions) mission.contributions = new Map();
        mission.contributions.set(userId.toString(), 0);
        await mission.save();
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });
        res.json({ message: 'Aceptada', mission });
    } else {
        await Mission.findByIdAndDelete(missionId);
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });
        res.json({ message: 'Rechazada' });
    }
});

const nukeMyMissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    await Mission.deleteMany({ $or: [{ user: userId }, { participants: userId }] });
    res.status(200).json({ message: "Purgado" });
});

module.exports = { getMissions, createMission, updateProgress, deleteMission, respondMissionInvite, nukeMyMissions };