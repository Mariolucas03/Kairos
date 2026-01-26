const asyncHandler = require('express-async-handler');
const Mission = require('../models/Mission');
const DailyLog = require('../models/DailyLog');
const User = require('../models/User');
const levelService = require('../services/levelService');
const mongoose = require('mongoose'); // Importante para convertir IDs

const BASE_XP = 10;
const BASE_COINS = 5;

const DIFFICULTY_MULTIPLIERS = { easy: 1, medium: 2, hard: 3, epic: 5 };
const FREQUENCY_MULTIPLIERS = { daily: 1, weekly: 5, monthly: 15, yearly: 100 };

// ------------------------------------------------------------------
// 1. OBTENER MISIONES (BLINDADO)
// ------------------------------------------------------------------
const getMissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // 🔥 DEBUG: Ver quién está pidiendo misiones
    // console.log(`🔍 Buscando misiones para Usuario: ${userId}`);

    // Convertimos a ObjectId para asegurar que Mongo lo entienda
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const missions = await Mission.find({
        $or: [
            // Caso 1: Soy participante (array)
            { participants: { $in: [userObjectId] } },
            // Caso 2: Soy el dueño (creador) -> Esto rescata misiones antiguas sin participants
            { user: userObjectId },
            // Caso 3: Coop activas donde estoy invitado
            { participants: { $in: [userObjectId] }, invitationStatus: 'active' }
        ]
    })
        .populate('participants', 'username avatar')
        .sort({ completed: 1, createdAt: -1 });

    // console.log(`✅ Encontradas ${missions.length} misiones.`);

    // Resetear hábitos diarios si es un nuevo día (Lógica Lazy Load)
    const today = new Date().toDateString();
    let updated = false;

    for (let mission of missions) {
        if (mission.type === 'habit' && mission.completed) {
            const lastUpdate = new Date(mission.lastUpdated).toDateString();
            if (lastUpdate !== today && mission.frequency === 'daily') {
                mission.progress = 0;
                mission.completed = false;
                // Asegurar que contributions es un Map
                if (!mission.contributions) mission.contributions = new Map();
                mission.participants.forEach(p => mission.contributions.set(p._id.toString(), 0));

                await mission.save();
                updated = true;
            }
        }
    }

    if (updated) {
        // Volver a pedir para asegurar consistencia
        return getMissions(req, res);
    }

    res.status(200).json(missions);
});

// ------------------------------------------------------------------
// 2. CREAR MISIÓN
// ------------------------------------------------------------------
const createMission = asyncHandler(async (req, res) => {
    const { title, frequency, type, difficulty, target, specificDays, unit, isCoop, friendId } = req.body;

    if (!title) {
        res.status(400);
        throw new Error('El título es obligatorio');
    }

    const freq = frequency || 'daily';
    const diff = difficulty || 'easy';
    const missionType = type || 'habit';
    const days = Array.isArray(specificDays) ? specificDays : [];
    const missionUnit = unit ? unit.trim() : '';

    let mult = (DIFFICULTY_MULTIPLIERS[diff] || 1) * (FREQUENCY_MULTIPLIERS[freq] || 1);
    if (isCoop) mult *= 1.5;

    const finalXP = Math.round(BASE_XP * mult);
    const finalCoins = Math.round(BASE_COINS * mult);
    const finalGameCoins = finalCoins * 2;

    const participants = [req.user._id];
    let invStatus = 'none';

    if (isCoop && friendId && friendId.trim() !== '') {
        participants.push(friendId);
        invStatus = 'pending';
    }

    const mission = await Mission.create({
        user: req.user._id,
        title: title.trim(),
        frequency: freq,
        specificDays: days,
        type: missionType,
        difficulty: diff,
        target: Number(target) || 1,
        unit: missionUnit,
        progress: 0,
        xpReward: finalXP,
        coinReward: finalCoins,
        gameCoinReward: finalGameCoins,
        isCoop: !!isCoop,
        participants: participants,
        invitationStatus: invStatus,
        contributions: { [req.user._id]: 0 }
    });

    if (isCoop && friendId) {
        await User.findByIdAndUpdate(friendId, {
            $push: { missionRequests: mission._id }
        });
    }

    res.status(201).json(mission);
});

// ------------------------------------------------------------------
// 3. RESPONDER INVITACIÓN
// ------------------------------------------------------------------
const respondMissionInvite = asyncHandler(async (req, res) => {
    const { missionId, action } = req.body;
    const userId = req.user._id;

    if (!missionId) { res.status(400); throw new Error('Falta ID de misión'); }

    const mission = await Mission.findById(missionId);

    if (!mission) {
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });
        return res.status(404).json({ message: 'Esta misión ya no existe.' });
    }

    if (action === 'accept') {
        mission.invitationStatus = 'active';
        if (!mission.contributions) mission.contributions = new Map();
        mission.contributions.set(userId.toString(), 0);

        await mission.save();
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });

        res.json({ message: '¡Misión aceptada! A trabajar.', mission });
    } else {
        await Mission.findByIdAndDelete(missionId);
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });
        res.json({ message: 'Invitación rechazada.' });
    }
});

// ------------------------------------------------------------------
// 4. ACTUALIZAR PROGRESO
// ------------------------------------------------------------------
const updateProgress = asyncHandler(async (req, res) => {
    const { amount } = req.body;
    const userId = req.user._id;

    const mission = await Mission.findById(req.params.id);
    if (!mission) { res.status(404); throw new Error('Misión no encontrada'); }

    // Validación más laxa para permitir al creador actualizar aunque los participantes estén raros
    const isParticipant = mission.participants.map(p => p.toString()).includes(userId.toString());
    const isOwner = mission.user.toString() === userId.toString();

    if (!isParticipant && !isOwner) {
        res.status(401); throw new Error('No participas en esta misión');
    }

    if (mission.isCoop && mission.invitationStatus === 'pending') {
        res.status(400); throw new Error('Esperando a que tu compañero acepte.');
    }

    const today = new Date();
    if (mission.type === 'habit' && mission.completed) {
        const last = new Date(mission.lastUpdated);
        if (last.toDateString() !== today.toDateString()) {
            mission.progress = 0;
            mission.completed = false;
            // Reiniciar mapa si no existe
            if (!mission.contributions) mission.contributions = new Map();
            mission.participants.forEach(p => mission.contributions.set(p.toString(), 0));
        } else {
            return res.status(200).json({ message: 'Misión ya completada hoy', alreadyCompleted: true });
        }
    }

    const addAmount = Number(amount) || 1;

    // SYNC LOGIC
    const linkedMissions = await Mission.find({
        user: userId,
        title: mission.title,
        _id: { $ne: mission._id },
        completed: false
    });

    for (let linked of linkedMissions) {
        linked.progress += addAmount;
        linked.lastUpdated = today;
        if (!linked.contributions) linked.contributions = new Map();

        const currentLinkedContrib = linked.contributions.get(userId.toString()) || 0;
        linked.contributions.set(userId.toString(), currentLinkedContrib + addAmount);

        if (linked.progress >= linked.target) {
            linked.completed = true;
            linked.progress = linked.target;
            await levelService.addRewards(userId, linked.xpReward, linked.coinReward, linked.gameCoinReward);

            const todayStr = today.toISOString().split('T')[0];
            await DailyLog.findOneAndUpdate(
                { user: userId, date: todayStr },
                {
                    $inc: { 'missionStats.completed': 1 },
                    $push: { 'missionStats.listCompleted': { title: linked.title, coinReward: linked.coinReward, xpReward: linked.xpReward, type: linked.type } }
                },
                { upsert: true }
            );
        }
        await linked.save();
    }

    mission.progress += addAmount;
    if (!mission.contributions) mission.contributions = new Map();
    const currentContrib = mission.contributions.get(userId.toString()) || 0;
    mission.contributions.set(userId.toString(), currentContrib + addAmount);

    mission.lastUpdated = today;

    let rewards = null;
    let leveledUp = false;
    let userResult = null;

    if (mission.progress >= mission.target) {
        mission.completed = true;
        mission.progress = mission.target;

        for (const pId of mission.participants) {
            const result = await levelService.addRewards(pId, mission.xpReward, mission.coinReward, mission.gameCoinReward);
            if (pId.toString() === userId.toString()) {
                userResult = result.user;
                leveledUp = result.leveledUp;
                rewards = { xp: mission.xpReward, coins: mission.coinReward, gameCoins: mission.gameCoinReward };
            }
        }

        const todayStr = today.toISOString().split('T')[0];
        await DailyLog.findOneAndUpdate(
            { user: userId, date: todayStr },
            {
                $inc: { 'missionStats.completed': 1 },
                $push: { 'missionStats.listCompleted': { title: mission.title, coinReward: mission.coinReward, xpReward: mission.xpReward, type: mission.type } }
            },
            { upsert: true }
        );
    }

    await mission.save();

    res.json({
        message: mission.completed ? '¡Misión Completada!' : `Progreso: ${mission.progress}/${mission.target}`,
        mission,
        user: userResult,
        leveledUp,
        rewards,
        progressOnly: !mission.completed
    });
});

// ------------------------------------------------------------------
// 5. ELIMINAR MISIÓN
// ------------------------------------------------------------------
const deleteMission = asyncHandler(async (req, res) => {
    const mission = await Mission.findById(req.params.id);
    if (!mission) { res.status(404); throw new Error('No encontrada'); }

    if (mission.user.toString() !== req.user._id.toString()) {
        res.status(403); throw new Error('Solo el creador puede cancelar la misión');
    }

    if (mission.invitationStatus === 'pending') {
        const friendId = mission.participants.find(p => p.toString() !== req.user._id.toString());
        if (friendId) {
            await User.findByIdAndUpdate(friendId, { $pull: { missionRequests: mission._id } });
        }
    }

    await mission.deleteOne();
    res.status(200).json({ id: req.params.id, message: "Misión eliminada." });
});

// ------------------------------------------------------------------
// 🔥 6. PURGA NUCLEAR (SOLO EMERGENCIAS)
// ------------------------------------------------------------------
const nukeMyMissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    // Borra todas las misiones donde el usuario sea el CREADOR
    await Mission.deleteMany({ user: userId });

    // Opcional: Borrar donde sea participante también (limpieza total)
    await Mission.deleteMany({ participants: { $in: [userId] } });

    res.status(200).json({ message: "☢️ Todas tus misiones han sido eliminadas. Cuenta limpia." });
});

module.exports = {
    getMissions,
    createMission,
    updateProgress,
    deleteMission,
    respondMissionInvite,
    nukeMyMissions // <--- Exportamos la nueva función
};