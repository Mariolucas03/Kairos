const asyncHandler = require('express-async-handler');
const Mission = require('../models/Mission');
const DailyLog = require('../models/DailyLog');
const User = require('../models/User');
const levelService = require('../services/levelService');

const BASE_XP = 10;
const BASE_COINS = 5;

const DIFFICULTY_MULTIPLIERS = { easy: 1, medium: 2, hard: 3, epic: 5 };
const FREQUENCY_MULTIPLIERS = { daily: 1, weekly: 5, monthly: 15, yearly: 100 };

// ------------------------------------------------------------------
// 1. OBTENER MISIONES
// ------------------------------------------------------------------
const getMissions = asyncHandler(async (req, res) => {
    // Busca misiones donde el usuario es participante, o es el creador, o son públicas/cooperativas activas
    const missions = await Mission.find({
        participants: { $in: [req.user._id] },
        $or: [
            { isCoop: false },
            { invitationStatus: 'active' }, // Solo mostrar cooperativas si ya aceptaron
            { user: req.user._id, invitationStatus: 'pending' } // O si soy el dueño esperando
        ]
    })
        .populate('participants', 'username avatar')
        .sort({ completed: 1, createdAt: -1 }); // Primero las no completadas

    // Resetear hábitos diarios si es un nuevo día (Lógica Lazy Load)
    const today = new Date().toDateString();
    let updated = false;

    for (let mission of missions) {
        if (mission.type === 'habit' && mission.completed) {
            const lastUpdate = new Date(mission.lastUpdated).toDateString();

            // Si la misión se completó en un día anterior, reiniciarla
            // Nota: Para semanales/mensuales necesitarías lógica más compleja de fechas, 
            // aquí asumimos reset diario básico o gestionado por CRON externo para precisión.
            if (lastUpdate !== today && mission.frequency === 'daily') {
                mission.progress = 0;
                mission.completed = false;
                mission.participants.forEach(p => mission.contributions.set(p.toString(), 0));
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

    // Default Values
    const freq = frequency || 'daily';
    const diff = difficulty || 'easy';
    const missionType = type || 'habit';
    const days = Array.isArray(specificDays) ? specificDays : [];

    // 🔥 FIX: Unidad vacía se guarda como string vacío, nunca null para evitar error de validación
    const missionUnit = unit ? unit.trim() : '';

    // Cálculo Recompensas Servidor (Seguridad)
    let mult = (DIFFICULTY_MULTIPLIERS[diff] || 1) * (FREQUENCY_MULTIPLIERS[freq] || 1);
    if (isCoop) mult *= 1.5;

    const finalXP = Math.round(BASE_XP * mult);
    const finalCoins = Math.round(BASE_COINS * mult);
    const finalGameCoins = finalCoins * 2; // Doble de monedas virtuales

    // Participantes
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

    // Enviar notificación/solicitud al amigo
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
        // Limpieza si ya no existe
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });
        return res.status(404).json({ message: 'Esta misión ya no existe.' });
    }

    if (action === 'accept') {
        mission.invitationStatus = 'active';
        // Inicializar contribución del invitado
        if (!mission.contributions) mission.contributions = new Map();
        mission.contributions.set(userId.toString(), 0);

        await mission.save();
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });

        res.json({ message: '¡Misión aceptada! A trabajar.', mission });
    } else {
        // Si rechaza, se borra la misión para ambos (o se podría sacar al usuario, decisión de diseño)
        await Mission.findByIdAndDelete(missionId);
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });
        res.json({ message: 'Invitación rechazada.' });
    }
});

// ------------------------------------------------------------------
// 4. ACTUALIZAR PROGRESO (CON SYNC LOGIC)
// ------------------------------------------------------------------
const updateProgress = asyncHandler(async (req, res) => {
    const { amount } = req.body;
    const userId = req.user._id;

    const mission = await Mission.findById(req.params.id);
    if (!mission) { res.status(404); throw new Error('Misión no encontrada'); }

    // Validaciones
    if (mission.isCoop && mission.invitationStatus === 'pending') {
        res.status(400); throw new Error('Esperando a que tu compañero acepte.');
    }
    if (!mission.participants.includes(userId)) {
        res.status(401); throw new Error('No participas en esta misión');
    }

    // Resetear si es Hábito ya completado en día anterior (Safety Check)
    const today = new Date();
    if (mission.type === 'habit' && mission.completed) {
        const last = new Date(mission.lastUpdated);
        if (last.toDateString() !== today.toDateString()) {
            mission.progress = 0;
            mission.completed = false;
            mission.participants.forEach(p => mission.contributions.set(p.toString(), 0));
        } else {
            return res.status(200).json({ message: 'Misión ya completada hoy', alreadyCompleted: true });
        }
    }

    const addAmount = Number(amount) || 1;

    // =================================================================================
    // 🔥 SYNC LOGIC: Buscar otras misiones con el MISMO NOMBRE y actualizarlas también
    // =================================================================================
    // Buscamos misiones del mismo usuario, con mismo título, que NO sean la actual y NO estén completadas
    const linkedMissions = await Mission.find({
        user: userId,
        title: mission.title,
        _id: { $ne: mission._id },
        completed: false
    });

    // Actualizamos las vinculadas
    for (let linked of linkedMissions) {
        linked.progress += addAmount;
        linked.lastUpdated = today;

        // Contribución personal en la vinculada
        const currentLinkedContrib = linked.contributions.get(userId.toString()) || 0;
        linked.contributions.set(userId.toString(), currentLinkedContrib + addAmount);

        // Chequear si se completa la vinculada
        if (linked.progress >= linked.target) {
            linked.completed = true;
            linked.progress = linked.target; // Cap

            // Dar recompensas de la vinculada también
            await levelService.addRewards(userId, linked.xpReward, linked.coinReward, linked.gameCoinReward);

            // Log en DailyLog de la vinculada
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
    // =================================================================================

    // Actualizar Misión Principal (La que tocó el usuario)
    mission.progress += addAmount;

    const currentContrib = mission.contributions.get(userId.toString()) || 0;
    mission.contributions.set(userId.toString(), currentContrib + addAmount);

    mission.lastUpdated = today;

    let rewards = null;
    let leveledUp = false;
    let userResult = null;

    // Chequear completado principal
    if (mission.progress >= mission.target) {
        mission.completed = true;
        mission.progress = mission.target;

        // Dar recompensas a TODOS los participantes (si es coop)
        for (const pId of mission.participants) {
            // Nota: Si es coop, ambos reciben premio. Si es solo, solo user.
            const result = await levelService.addRewards(pId, mission.xpReward, mission.coinReward, mission.gameCoinReward);

            // Guardamos resultado solo si es el usuario que hizo la acción para devolverlo al front
            if (pId.toString() === userId.toString()) {
                userResult = result.user;
                leveledUp = result.leveledUp;
                rewards = { xp: mission.xpReward, coins: mission.coinReward, gameCoins: mission.gameCoinReward };
            }
        }

        // Registrar en DailyLog
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
        user: userResult,     // Usuario actualizado con nuevo nivel/monedas
        leveledUp,            // Booleano para lanzar confeti en front
        rewards,              // Objeto con lo ganado
        progressOnly: !mission.completed
    });
});

// ------------------------------------------------------------------
// 5. ELIMINAR MISIÓN
// ------------------------------------------------------------------
const deleteMission = asyncHandler(async (req, res) => {
    const mission = await Mission.findById(req.params.id);
    if (!mission) { res.status(404); throw new Error('No encontrada'); }

    // Solo el creador puede borrar (incluso si es coop)
    if (mission.user.toString() !== req.user._id.toString()) {
        res.status(403); throw new Error('Solo el creador puede cancelar la misión');
    }

    // Si es una misión con "invitación pendiente", limpiamos la request del amigo
    if (mission.invitationStatus === 'pending') {
        const friendId = mission.participants.find(p => p.toString() !== req.user._id.toString());
        if (friendId) {
            await User.findByIdAndUpdate(friendId, { $pull: { missionRequests: mission._id } });
        }
    }

    await mission.deleteOne();
    res.status(200).json({ id: req.params.id, message: "Misión eliminada." });
});

module.exports = {
    getMissions,
    createMission,
    updateProgress,
    deleteMission,
    respondMissionInvite
};