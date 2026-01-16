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

// Helper: Calcular métricas
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

    // 🔥 AÑADIDO 'frame' AL POPULATE
    const clan = await Clan.findById(user.clan._id)
        .populate('members', 'username level avatar title frame streak clanRank pet');

    if (!clan) return res.json(null);

    const weekStart = getCurrentWeekStart();
    const eventType = getCurrentEventType(weekStart);
    const goal = EVENT_GOALS[eventType];

    // Resetear si cambió la semana
    if (!clan.weeklyEvent || !clan.weeklyEvent.startDate || new Date(clan.weeklyEvent.startDate).getTime() !== weekStart.getTime()) {
        clan.weeklyEvent = { startDate: weekStart, claims: [] };
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

// @desc    Reclamar Recompensa
const claimEventReward = asyncHandler(async (req, res) => {
    const { tier } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user.clan) { res.status(400); throw new Error('No tienes clan'); }

    const clan = await Clan.findById(user.clan);
    const weekStart = getCurrentWeekStart();

    if (!clan.weeklyEvent || !clan.weeklyEvent.startDate || new Date(clan.weeklyEvent.startDate).getTime() !== weekStart.getTime()) {
        res.status(400); throw new Error('El evento se ha reiniciado.');
    }

    const alreadyClaimed = clan.weeklyEvent.claims.find(
        c => c.user.toString() === userId.toString() && c.tier === tier
    );
    if (alreadyClaimed) { res.status(400); throw new Error('Ya reclamado'); }

    const eventType = getCurrentEventType(weekStart);
    const goal = EVENT_GOALS[eventType];
    const { clanTotal } = await getClanMetrics(clan.members, weekStart, eventType);

    // 🔥 NUEVOS TIERS DE RECOMPENSA
    const targets = {
        1: goal * 0.1,
        2: goal * 0.5,
        3: goal,
        4: goal * 1.5, // Platino
        5: goal * 2.0  // Diamante
    };

    if (clanTotal < targets[tier]) { res.status(400); throw new Error('Meta no alcanzada'); }

    // 🔥 PREMIOS AUMENTADOS
    const REWARDS = {
        1: { xp: 50, coins: 100, chips: 200 },    // Bronce
        2: { xp: 150, coins: 300, chips: 600 },   // Plata
        3: { xp: 500, coins: 1000, chips: 2000 }, // Oro
        4: { xp: 1000, coins: 2500, chips: 5000 },// Platino
        5: { xp: 2500, coins: 5000, chips: 10000 }// Diamante
    };

    const prize = REWARDS[tier];
    if (!prize) { res.status(400); throw new Error('Tier inválido'); }

    const result = await levelService.addRewards(userId, prize.xp, prize.coins, prize.chips);

    clan.weeklyEvent.claims.push({ user: userId, tier, claimedAt: new Date() });
    await clan.save();

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

// @desc    Unirse a un clan
const joinClan = asyncHandler(async (req, res) => {
    const clanId = req.params.id;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (user.clan) { res.status(400); throw new Error('Sal de tu clan primero'); }

    const clan = await Clan.findById(clanId);
    if (!clan) { res.status(404); throw new Error('Clan no encontrado'); }

    if (clan.members.length >= 10) { res.status(400); throw new Error('Clan lleno'); }

    // Validar nivel mínimo
    if (clan.minLevel && user.level < clan.minLevel) {
        res.status(400); throw new Error(`Nivel insuficiente. Necesitas nivel ${clan.minLevel}`);
    }

    clan.members.push(userId);
    clan.totalPower += (user.level || 1) * 100;
    await clan.save();

    user.clan = clan._id;
    user.clanRank = 'esclavo';
    await user.save();

    res.json({ message: `Unido a ${clan.name}`, clan });
});

// @desc    Salir del clan
const leaveClan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user.clan) { res.status(400); throw new Error('No tienes clan'); }

    const clan = await Clan.findById(user.clan);
    if (clan) {
        // Lógica líder se va
        if (clan.leader.toString() === userId.toString()) {
            if (clan.members.length <= 1) {
                await User.updateMany({ clan: clan._id }, { $set: { clan: null, clanRank: null } });
                await Clan.findByIdAndDelete(clan._id);
                user.clan = null; user.clanRank = null; await user.save();
                return res.json({ message: 'Clan disuelto.' });
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
                clan.leader = newLeader._id;
                newLeader.clanRank = 'dios'; await newLeader.save();
            }
        }

        clan.members = clan.members.filter(id => id.toString() !== userId.toString());
        clan.totalPower -= (user.level || 1) * 100;
        await clan.save();
    }

    user.clan = null; user.clanRank = null; await user.save();
    res.json({ message: 'Has salido.' });
});

const kickMember = asyncHandler(async (req, res) => {
    const { memberId } = req.body;
    const requester = await User.findById(req.user._id);
    const target = await User.findById(memberId);

    if (!requester.clan || requester.clan.toString() !== target.clan?.toString()) throw new Error('Error');

    const ranks = { 'esclavo': 0, 'recluta': 1, 'guerrero': 2, 'rey': 3, 'dios': 4 };
    if (ranks[requester.clanRank] <= ranks[target.clanRank]) throw new Error('Rango insuficiente');

    const clan = await Clan.findById(requester.clan);
    clan.members = clan.members.filter(id => id.toString() !== memberId.toString());
    clan.totalPower -= (target.level || 1) * 100;
    await clan.save();

    target.clan = null; target.clanRank = null; await target.save();
    res.json({ message: 'Expulsado.' });
});

const updateMemberRank = asyncHandler(async (req, res) => {
    const { memberId, newRank } = req.body;
    const target = await User.findById(memberId);
    target.clanRank = newRank;
    await target.save();
    res.json({ message: 'Rango actualizado' });
});

// @desc    Previsualizar clan (Para unirse/espiar)
// @route   GET /api/clans/:id
const getClanDetails = asyncHandler(async (req, res) => {
    const clanId = req.params.id;
    // 🔥 AÑADIDO 'frame' PARA QUE SE VEA EN LA PREVIEW
    const clan = await Clan.findById(clanId).populate('members', 'username level avatar frame title clanRank');

    if (!clan) { res.status(404); throw new Error('Clan no encontrado'); }

    // Calcular evento para visitantes
    const weekStart = getCurrentWeekStart();
    const eventType = getCurrentEventType(weekStart);
    const goal = EVENT_GOALS[eventType];
    const { memberStats, clanTotal } = await getClanMetrics(clan.members.map(m => m._id), weekStart, eventType);

    const clanObj = clan.toObject();

    // Inyectar contribuciones para ver el ranking interno
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

// 🔥 Añadimos la función previewClan (alias de getClanDetails) por si alguna ruta antigua la llama
const previewClan = getClanDetails;

module.exports = {
    getMyClan, createClan, searchClans, joinClan, leaveClan, updateMemberRank, kickMember, claimEventReward,
    getClanDetails, previewClan
};