const asyncHandler = require('express-async-handler');
const Clan = require('../models/Clan');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const DailyLog = require('../models/DailyLog');
const levelService = require('../services/levelService');

// --- CONFIGURACIÓN DE ROTACIÓN ---
const EVENT_ROTATION = ['volume', 'missions', 'calories', 'xp'];
const EVENT_GOALS = {
    volume: 1000000,    // 1M Kg
    missions: 300,      // 300 Misiones
    calories: 50000,    // 50k Kcal
    xp: 20000           // 20k XP
};

// Helper: Obtener el Lunes a las 04:00 AM
const getCurrentWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - diff);
    lastMonday.setHours(4, 0, 0, 0);
    if (day === 1 && now.getHours() < 4) {
        lastMonday.setDate(lastMonday.getDate() - 7);
    }
    return lastMonday;
};

// Helper: Tipo de evento
const getCurrentEventType = (weekStartDate) => {
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const weekIndex = Math.floor(weekStartDate.getTime() / oneWeek);
    return EVENT_ROTATION[weekIndex % 4];
};

// Helper: Calcular métricas usando Aggregation Framework
const getClanMetrics = async (clanMemberIds, weekStart, eventType) => {
    let stats = [];

    if (eventType === 'volume') {
        stats = await WorkoutLog.aggregate([
            { $match: { user: { $in: clanMemberIds }, date: { $gte: weekStart }, type: 'gym' } },
            { $unwind: "$exercises" }, { $unwind: "$exercises.sets" },
            { $group: { _id: "$user", total: { $sum: { $multiply: ["$exercises.sets.weight", "$exercises.sets.reps"] } } } }
        ]);
    }
    else if (eventType === 'calories') {
        stats = await WorkoutLog.aggregate([
            { $match: { user: { $in: clanMemberIds }, date: { $gte: weekStart } } },
            { $group: { _id: "$user", total: { $sum: "$caloriesBurned" } } }
        ]);
    }
    else if (eventType === 'missions') {
        const dateStr = weekStart.toISOString().split('T')[0];
        stats = await DailyLog.aggregate([
            { $match: { user: { $in: clanMemberIds }, date: { $gte: dateStr } } },
            { $group: { _id: "$user", total: { $sum: "$missionStats.completed" } } }
        ]);
    }
    else if (eventType === 'xp') {
        const dateStr = weekStart.toISOString().split('T')[0];
        stats = await DailyLog.aggregate([
            { $match: { user: { $in: clanMemberIds }, date: { $gte: dateStr } } },
            { $group: { _id: "$user", total: { $sum: "$gains.xp" } } }
        ]);
    }

    const memberStats = {};
    let clanTotal = 0;
    stats.forEach(s => {
        memberStats[s._id.toString()] = s.total;
        clanTotal += s.total;
    });

    return { memberStats, clanTotal };
};

// @desc    Obtener datos de MI clan
const getMyClan = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).populate('clan');
    if (!user.clan) return res.json(null);

    const clan = await Clan.findById(user.clan._id)
        .populate('members', 'username level avatar title frame streak clanRank pet');

    if (!clan) return res.json(null);

    const weekStart = getCurrentWeekStart();
    const eventType = getCurrentEventType(weekStart);
    const goal = EVENT_GOALS[eventType];

    // Resetear si cambió la semana (Operación Segura)
    if (!clan.weeklyEvent || !clan.weeklyEvent.startDate || new Date(clan.weeklyEvent.startDate).getTime() !== weekStart.getTime()) {
        clan.weeklyEvent = { startDate: weekStart, type: eventType, claims: [] };
        await clan.save();
    }

    const memberIds = clan.members.map(m => m._id);
    const { memberStats, clanTotal } = await getClanMetrics(memberIds, weekStart, eventType);

    const clanObj = clan.toObject();

    clanObj.members = clanObj.members.map(member => ({
        ...member,
        weeklyContribution: memberStats[member._id.toString()] || 0
    }));

    clanObj.members.sort((a, b) => b.weeklyContribution - a.weeklyContribution);

    clanObj.eventStats = {
        type: eventType,
        total: clanTotal,
        goal: goal,
        myClaims: clan.weeklyEvent.claims
            .filter(c => c.user.toString() === req.user._id.toString())
            .map(c => c.tier)
    };

    res.json(clanObj);
});

// @desc    Reclamar Recompensa (🔥 BLINDADO CONTRA DOBLE CLIC)
const claimEventReward = asyncHandler(async (req, res) => {
    const { tier } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user.clan) { res.status(400); throw new Error('No tienes clan'); }

    const clan = await Clan.findById(user.clan);
    const weekStart = getCurrentWeekStart();

    if (!clan.weeklyEvent || new Date(clan.weeklyEvent.startDate).getTime() !== weekStart.getTime()) {
        res.status(400); throw new Error('El evento se ha reiniciado.');
    }

    const eventType = getCurrentEventType(weekStart);
    const goal = EVENT_GOALS[eventType];
    const { clanTotal } = await getClanMetrics(clan.members, weekStart, eventType);

    const targets = {
        1: goal * 0.1,
        2: goal * 0.5,
        3: goal,
        4: goal * 1.5,
        5: goal * 2.0
    };

    if (clanTotal < targets[tier]) { res.status(400); throw new Error('Meta no alcanzada'); }

    // 🔥 ATÓMICO: Añadimos el claim SOLO si no existe (evita doble recompensa)
    const clanUpdate = await Clan.findOneAndUpdate(
        {
            _id: clan._id,
            "weeklyEvent.claims": { $not: { $elemMatch: { user: userId, tier: tier } } }
        },
        {
            $push: { "weeklyEvent.claims": { user: userId, tier, claimedAt: new Date() } }
        },
        { new: true }
    );

    if (!clanUpdate) {
        res.status(400); throw new Error('Ya has reclamado esta recompensa.');
    }

    const REWARDS = {
        1: { xp: 50, coins: 100, chips: 200 },
        2: { xp: 150, coins: 300, chips: 600 },
        3: { xp: 500, coins: 1000, chips: 2000 },
        4: { xp: 1000, coins: 2500, chips: 5000 },
        5: { xp: 2500, coins: 5000, chips: 10000 }
    };

    const prize = REWARDS[tier];
    const result = await levelService.addRewards(userId, prize.xp, prize.coins, prize.chips);

    res.json({ message: `¡Recompensa Tier ${tier} obtenida!`, user: result.user, leveledUp: result.leveledUp });
});

// @desc    Buscar clanes (Ranking)
const searchClans = asyncHandler(async (req, res) => {
    const clans = await Clan.find({})
        .sort({ totalPower: -1 })
        .limit(20)
        .select('name members totalPower icon description type');

    const result = clans.map(c => ({
        ...c.toObject(),
        memberCount: c.members.length
    }));

    res.json(result);
});

// @desc    Crear un clan
const createClan = asyncHandler(async (req, res) => {
    const { name, description, icon, minLevel } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (user.clan) { res.status(400); throw new Error('Ya tienes clan'); }

    if (await Clan.findOne({ name })) { res.status(400); throw new Error('Nombre ocupado'); }

    const clan = await Clan.create({
        name,
        description: description || "Clan de guerreros",
        icon: icon || '🛡️',
        minLevel: minLevel || 1,
        leader: userId,
        members: [userId],
        totalPower: (user.level || 1) * 100,
        weeklyEvent: { startDate: getCurrentWeekStart(), claims: [] }
    });

    user.clan = clan._id;
    user.clanRank = 'dios';
    await user.save();

    res.status(201).json(clan);
});

// @desc    Unirse a un clan (🔥 BLINDADO CONTRA OVERBOOKING)
const joinClan = asyncHandler(async (req, res) => {
    const clanId = req.params.id;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (user.clan) { res.status(400); throw new Error('Sal de tu clan primero'); }

    const clanData = await Clan.findById(clanId);
    if (!clanData) { res.status(404); throw new Error('Clan no encontrado'); }

    if (clanData.minLevel && user.level < clanData.minLevel) {
        res.status(400); throw new Error(`Nivel insuficiente. Necesitas nivel ${clanData.minLevel}`);
    }

    const powerToAdd = (user.level || 1) * 100;

    // 🔥 ATÓMICO: Intenta añadir si el miembro no está y si NO existe el elemento índice 9 (Max 10)
    const clanUpdate = await Clan.findOneAndUpdate(
        {
            _id: clanId,
            members: { $ne: userId },
            "members.9": { $exists: false } // Asegura que haya menos de 10 miembros
        },
        {
            $addToSet: { members: userId },
            $inc: { totalPower: powerToAdd }
        },
        { new: true }
    );

    if (!clanUpdate) {
        res.status(400); throw new Error('El clan está lleno (Máx 10) o ya estás dentro.');
    }

    user.clan = clanUpdate._id;
    user.clanRank = 'esclavo';
    await user.save();

    res.json({ message: `Unido a ${clanUpdate.name}`, clan: clanUpdate });
});

// @desc    Salir del clan (🔥 ATÓMICO)
const leaveClan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user.clan) { res.status(400); throw new Error('No tienes clan'); }

    const clan = await Clan.findById(user.clan);
    if (!clan) {
        user.clan = null; user.clanRank = null; await user.save();
        return res.json({ message: 'Has salido.' });
    }

    const powerToSubtract = (user.level || 1) * 100;

    if (clan.leader.toString() === userId.toString()) {
        if (clan.members.length <= 1) {
            await User.updateMany({ clan: clan._id }, { $set: { clan: null, clanRank: null } });
            await Clan.findByIdAndDelete(clan._id);
        } else {
            // Sucesión
            const remaining = await User.find({ _id: { $in: clan.members, $ne: userId } });
            const ranks = { 'esclavo': 0, 'recluta': 1, 'guerrero': 2, 'rey': 3, 'dios': 4 };
            remaining.sort((a, b) => {
                const rA = ranks[a.clanRank || 'esclavo'];
                const rB = ranks[b.clanRank || 'esclavo'];
                if (rB !== rA) return rB - rA;
                return b.level - a.level;
            });
            const newLeader = remaining[0];

            await Clan.findByIdAndUpdate(clan._id, {
                $set: { leader: newLeader._id },
                $pull: { members: userId },
                $inc: { totalPower: -powerToSubtract }
            });
            newLeader.clanRank = 'dios'; await newLeader.save();
        }
    } else {
        await Clan.findByIdAndUpdate(clan._id, {
            $pull: { members: userId },
            $inc: { totalPower: -powerToSubtract }
        });
    }

    user.clan = null; user.clanRank = null; await user.save();
    res.json({ message: 'Has abandonado el clan.' });
});

// @desc    Expulsar miembro
const kickMember = asyncHandler(async (req, res) => {
    const { memberId } = req.body;
    const requester = await User.findById(req.user._id);
    const target = await User.findById(memberId);

    if (!requester.clan || requester.clan.toString() !== target.clan?.toString()) throw new Error('Error de validación');

    const ranks = { 'esclavo': 0, 'recluta': 1, 'guerrero': 2, 'rey': 3, 'dios': 4 };
    if (ranks[requester.clanRank] <= ranks[target.clanRank]) throw new Error('Rango insuficiente para expulsar');

    const powerToSubtract = (target.level || 1) * 100;

    await Clan.findByIdAndUpdate(requester.clan, {
        $pull: { members: target._id },
        $inc: { totalPower: -powerToSubtract }
    });

    target.clan = null; target.clanRank = null; await target.save();
    res.json({ message: 'Miembro expulsado de la alianza.' });
});

const updateMemberRank = asyncHandler(async (req, res) => {
    const { memberId, newRank } = req.body;
    const target = await User.findById(memberId);
    target.clanRank = newRank;
    await target.save();
    res.json({ message: 'Rango actualizado' });
});

// @desc    Previsualizar clan
const getClanDetails = asyncHandler(async (req, res) => {
    const clanId = req.params.id;
    const clan = await Clan.findById(clanId).populate('members', 'username level avatar frame title clanRank');

    if (!clan) { res.status(404); throw new Error('Clan no encontrado'); }

    const weekStart = getCurrentWeekStart();
    const eventType = getCurrentEventType(weekStart);
    const goal = EVENT_GOALS[eventType];
    const { memberStats, clanTotal } = await getClanMetrics(clan.members.map(m => m._id), weekStart, eventType);

    const clanObj = clan.toObject();

    clanObj.members = clanObj.members.map(m => ({
        ...m,
        weeklyContribution: memberStats[m._id.toString()] || 0
    }));
    clanObj.members.sort((a, b) => b.weeklyContribution - a.weeklyContribution);

    clanObj.eventStats = {
        type: eventType,
        total: clanTotal,
        goal: goal,
        percent: Math.min((clanTotal / goal) * 100, 100)
    };

    res.json(clanObj);
});

const previewClan = getClanDetails;

module.exports = {
    getMyClan, createClan, searchClans, joinClan, leaveClan, updateMemberRank, kickMember, claimEventReward,
    getClanDetails, previewClan
};