const asyncHandler = require('express-async-handler');
const Clan = require('../models/Clan');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const DailyLog = require('../models/DailyLog');
const levelService = require('../services/levelService');
const { getMadridDateString } = require('../utils/dateHelpers');
const { notificarA } = require('./pushController');

// --- CONFIGURACIÓN DE ROTACIÓN ---
const EVENT_ROTATION = ['volume', 'missions', 'calories', 'xp'];

// Meta POR MIEMBRO y por semana.
// ⚠️ Antes eran cifras fijas para todo el clan (1.000.000 kg de volumen, 300
// misiones...) que ni un clan lleno de 10 personas alcanzaba: el tier 3 estaba
// fuera de alcance y los tiers 4 y 5 eran decorativos. Ahora la meta se escala
// con la gente que hay dentro, así un clan de 3 tiene un objetivo de 3 y uno
// de 10 tiene uno de 10, y las cifras están puestas sobre lo que una persona
// constante hace de verdad en una semana.
const EVENT_GOALS_PER_MEMBER = {
    volume: 15000,      // 15.000 kg·rep ≈ 3 sesiones de pesas
    // ⚠️ Sube de 12 a 35. Con 12 por persona y semana, la meta del clan se
    // alcanzaba en DOS DIAS de uso normal, y eso paga 1.000 monedas. 35 son
    // cinco al dia, que es un uso intenso pero real.
    missions: 35,       // 35 misiones ≈ 5 al día
    calories: 2500,     // 2.500 kcal quemadas
    xp: 1200            // 1.200 XP
};

// Un clan de una sola persona tampoco debería tenerlo regalado
const MIN_MEMBERS_FOR_GOAL = 2;

const getEventGoal = (eventType, memberCount = 1) => {
    const porMiembro = EVENT_GOALS_PER_MEMBER[eventType] || EVENT_GOALS_PER_MEMBER.volume;
    return porMiembro * Math.max(memberCount, MIN_MEMBERS_FOR_GOAL);
};

// Escalones de la barra: el tier 3 es la meta y los dos últimos son el "más allá"
const TIER_FACTORS = { 1: 0.1, 2: 0.5, 3: 1, 4: 1.5, 5: 2 };

const TIER_LABELS = { 1: 'Bronce', 2: 'Plata', 3: 'Oro', 4: 'Platino', 5: 'Diamante' };

// Premio de cada escalón. Vive aquí arriba para que el frontend pinte
// exactamente lo que el servidor va a entregar (antes la lista de premios de la
// pantalla se escribía a mano y no mencionaba las fichas, que sí se daban).
const EVENT_REWARDS = {
    1: { xp: 50, coins: 100, chips: 200 },
    2: { xp: 150, coins: 300, chips: 600 },
    3: { xp: 500, coins: 1000, chips: 2000 },
    4: { xp: 1000, coins: 2500, chips: 5000 },
    5: { xp: 2500, coins: 5000, chips: 10000 }
};

const buildTiers = (goal) => Object.keys(TIER_FACTORS).map(t => {
    const tier = Number(t);
    return {
        tier,
        label: TIER_LABELS[tier],
        target: Math.round(goal * TIER_FACTORS[tier]),
        ...EVENT_REWARDS[tier]
    };
});

/**
 * Un clan sin nadie dentro no debe seguir existiendo: ocupaba sitio en el
 * explorador, se podía "entrar" en él y su nombre quedaba pillado para siempre
 * (el nombre es único). Se llama después de cada salida o expulsión.
 */
const borrarClanSiVacio = async (clanId) => {
    if (!clanId) return false;
    const clan = await Clan.findById(clanId).select('members').lean();
    if (!clan) return false;
    if ((clan.members || []).length > 0) return false;
    await Clan.findByIdAndDelete(clanId);
    console.log(`🏰 Clan ${clanId} eliminado: se quedó sin miembros`);
    return true;
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
        // Fecha en hora de Madrid, igual que la que guardan los DailyLog. Con
        // toISOString() (UTC) el inicio de semana podía caer en el día anterior
        // y el evento del clan contaba un día de más.
        const dateStr = getMadridDateString(weekStart);
        stats = await DailyLog.aggregate([
            { $match: { user: { $in: clanMemberIds }, date: { $gte: dateStr } } },
            // ⚠️ Como MUCHO 25 misiones por persona y dia.
            //
            // Las misiones las escribe el propio usuario, asi que sin tope bastaba
            // con crear cuarenta triviales cada dia para reventar la meta del clan
            // en una tarde y llevarse el premio maximo, que son 5.000 monedas: mas
            // que el objeto mas caro de la tienda. 25 es el mismo tope que ya se
            // aplica al cobro de misiones, asi que lo que cuenta para el clan es
            // exactamente lo que se te ha pagado.
            { $group: { _id: "$user", total: { $sum: { $min: ['$missionStats.completed', 25] } } } }
        ]);
    }
    else if (eventType === 'xp') {
        // Fecha en hora de Madrid, igual que la que guardan los DailyLog. Con
        // toISOString() (UTC) el inicio de semana podía caer en el día anterior
        // y el evento del clan contaba un día de más.
        const dateStr = getMadridDateString(weekStart);
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
    const goal = getEventGoal(eventType, clan.members.length);

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
        // Los escalones los manda el servidor para que la pantalla no pueda
        // enseñar metas ni premios distintos de los que se van a entregar
        tiers: buildTiers(goal),
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
    const goal = getEventGoal(eventType, clan.members.length);
    const { clanTotal } = await getClanMetrics(clan.members, weekStart, eventType);

    const factor = TIER_FACTORS[tier];
    if (!factor) { res.status(400); throw new Error('Recompensa no válida'); }
    if (clanTotal < goal * factor) { res.status(400); throw new Error('Meta no alcanzada'); }

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

    const prize = EVENT_REWARDS[tier];
    const result = await levelService.addRewards(userId, prize.xp, prize.coins, prize.chips);

    res.json({
        message: `¡${TIER_LABELS[tier]}! +${prize.xp} XP · +${prize.coins} monedas · +${prize.chips} fichas`,
        rewards: prize,
        user: result.user,
        leveledUp: result.leveledUp
    });
});

// @desc    Buscar clanes (Ranking)
const searchClans = asyncHandler(async (req, res) => {
    // Los clanes vacíos se borran en cuanto se detectan: puede quedar alguno de
    // antes de que existiera esa limpieza, y no tiene sentido enseñarlos.
    const vacios = await Clan.find({ $or: [{ members: { $size: 0 } }, { members: { $exists: false } }] }).select('_id').lean();
    if (vacios.length) {
        await Clan.deleteMany({ _id: { $in: vacios.map(c => c._id) } });
        console.log(`🏰 ${vacios.length} clan(es) vacío(s) eliminados`);
    }

    const clans = await Clan.find({ 'members.0': { $exists: true } })
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

    // El modelo acota el nombre y la descripcion, pero el icono y el nivel
    // minimo entraban tal cual desde el movil: el icono es un texto sin tope que
    // viaja en CADA listado de clanes, y un nivel minimo de 9.999 (o negativo)
    // deja un clan al que no puede entrar nadie y que no se puede arreglar.
    const iconoSeguro = String(icon || '🛡️').trim().slice(0, 4) || '🛡️';
    const nivelSeguro = Math.max(1, Math.min(Math.floor(Number(minLevel)) || 1, 100));

    const clan = await Clan.create({
        name,
        description: description || "Clan de guerreros",
        icon: iconoSeguro,
        minLevel: nivelSeguro,
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

    // El lider es el unico que puede ascender o expulsar, asi que es el unico
    // al que le sirve de algo enterarse en el momento.
    if (clanUpdate.leader && clanUpdate.leader.toString() !== userId.toString()) {
        notificarA(clanUpdate.leader, {
            title: '🛡️ Nuevo miembro en el clan',
            body: (user.username || 'Alguien') + ' se ha unido a ' + clanUpdate.name + '.',
            icon: '/assets/icons/icon-192x192.png',
            url: '/social/clans'
        });
    }

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
    await borrarClanSiVacio(clan._id);
    res.json({ message: 'Has abandonado el clan.' });
});

// @desc    Expulsar miembro
const kickMember = asyncHandler(async (req, res) => {
    const { memberId } = req.body;
    const requester = await User.findById(req.user._id);
    const target = await User.findById(memberId);

    // Sin esto, un id que no existe reventaba en target.clan y salia un 500
    // generico en vez de decir que pasa.
    if (!target) { res.status(404); throw new Error('Ese usuario no existe'); }
    if (target._id.toString() === requester._id.toString()) { res.status(400); throw new Error('Para salirte del clan usa abandonar'); }

    if (!requester.clan || requester.clan.toString() !== target.clan?.toString()) {
        res.status(403);
        throw new Error('No estais en el mismo clan');
    }

    const ranks = { 'esclavo': 0, 'recluta': 1, 'guerrero': 2, 'rey': 3, 'dios': 4 };
    if (ranks[requester.clanRank] <= ranks[target.clanRank]) {
        res.status(403);
        throw new Error('Rango insuficiente para expulsar');
    }

    const powerToSubtract = (target.level || 1) * 100;

    await Clan.findByIdAndUpdate(requester.clan, {
        $pull: { members: target._id },
        $inc: { totalPower: -powerToSubtract }
    });

    target.clan = null; target.clanRank = null; await target.save();
    await borrarClanSiVacio(requester.clan);
    res.json({ message: 'Miembro expulsado de la alianza.' });
});

const RANKS = { 'esclavo': 0, 'recluta': 1, 'guerrero': 2, 'rey': 3, 'dios': 4 };

const updateMemberRank = asyncHandler(async (req, res) => {
    const { memberId, newRank } = req.body;

    if (!RANKS.hasOwnProperty(newRank)) { res.status(400); throw new Error('Rango inválido'); }

    const requester = await User.findById(req.user._id);
    const target = await User.findById(memberId);
    if (!target) { res.status(404); throw new Error('Miembro no encontrado'); }

    if (!requester.clan || !target.clan || requester.clan.toString() !== target.clan.toString()) {
        res.status(403); throw new Error('Error de validación');
    }

    // Solo el líder ('dios') puede cambiar rangos, y no puede degradarse/ascender a sí mismo
    if (requester.clanRank !== 'dios') { res.status(403); throw new Error('Solo el líder puede cambiar rangos'); }
    if (target._id.toString() === requester._id.toString()) { res.status(400); throw new Error('No puedes cambiar tu propio rango'); }
    if (newRank === 'dios') { res.status(400); throw new Error('Usa la sucesión de liderazgo para transferir el mando'); }

    target.clanRank = newRank;
    await target.save();
    res.json({ message: 'Rango actualizado' });
});

// @desc    Editar datos del clan (solo el líder)
// @route   PUT /api/clans
// El frontend tenía un formulario de edición que en realidad no llamaba a ningún
// endpoint: parecía guardarse pero nunca se persistía nada.
const updateClan = asyncHandler(async (req, res) => {
    const { description, icon, minLevel } = req.body;

    const user = await User.findById(req.user._id);
    if (!user.clan) { res.status(400); throw new Error('No tienes clan'); }
    if (user.clanRank !== 'dios') { res.status(403); throw new Error('Solo el líder puede editar el clan'); }

    const updates = {};
    if (description !== undefined) updates.description = String(description).slice(0, 200);
    if (icon !== undefined) {
        const trimmed = String(icon).trim();
        // Estandarte = 1 emoji (permitimos hasta 4 code points por emojis compuestos)
        if (!trimmed || [...trimmed].length > 4) { res.status(400); throw new Error('Estandarte inválido'); }
        updates.icon = trimmed;
    }
    if (minLevel !== undefined) {
        const lvl = parseInt(minLevel);
        if (!Number.isInteger(lvl) || lvl < 1 || lvl > 100) { res.status(400); throw new Error('Nivel mínimo inválido'); }
        updates.minLevel = lvl;
    }

    if (Object.keys(updates).length === 0) { res.status(400); throw new Error('Nada que actualizar'); }

    // El nombre no se puede cambiar: es único y se usa como identidad del clan
    const clan = await Clan.findByIdAndUpdate(user.clan, { $set: updates }, { new: true });
    if (!clan) { res.status(404); throw new Error('Clan no encontrado'); }

    res.json({ message: 'Clan actualizado', clan });
});

// @desc    Previsualizar clan
const getClanDetails = asyncHandler(async (req, res) => {
    const clanId = req.params.id;
    const clan = await Clan.findById(clanId).populate('members', 'username level avatar frame title clanRank');

    if (!clan) { res.status(404); throw new Error('Clan no encontrado'); }

    const weekStart = getCurrentWeekStart();
    const eventType = getCurrentEventType(weekStart);
    const goal = getEventGoal(eventType, clan.members.length);
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
    getClanDetails, previewClan, updateClan
};