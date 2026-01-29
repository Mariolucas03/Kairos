const asyncHandler = require('express-async-handler');
const Mission = require('../models/Mission');
const DailyLog = require('../models/DailyLog');
const User = require('../models/User');
const levelService = require('../services/levelService');
const mongoose = require('mongoose');

const BASE_XP = 10;
const BASE_COINS = 5;

const DIFFICULTY_MULTIPLIERS = { easy: 1, medium: 2, hard: 3, epic: 5 };
const FREQUENCY_MULTIPLIERS = { daily: 1, weekly: 5, monthly: 15, yearly: 100 };

// ------------------------------------------------------------------
// 1. OBTENER MISIONES (VERSIÓN ROBUSTA Y PERMISIVA)
// ------------------------------------------------------------------
const getMissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // 1. Preparamos las dos versiones del ID: Texto y Objeto
    // Esto arregla el problema si en la BD se guardó mezclado por migraciones antiguas
    const userIdString = userId.toString();
    let userIdObj;
    try {
        userIdObj = new mongoose.Types.ObjectId(userIdString);
    } catch (e) {
        userIdObj = userId; // Fallback
    }

    // 2. Consulta "Atrapalotodo"
    // Busca donde seas el dueño (String u Object) O donde seas participante (String u Object)
    const query = {
        $or: [
            { user: userIdObj },
            { user: userIdString },
            { participants: userIdObj },
            { participants: userIdString },
            // Misiones cooperativas donde fuiste invitado y aceptaste
            { participants: { $in: [userIdObj, userIdString] }, invitationStatus: 'active' }
        ]
    };

    // Ordenamos: Primero las no completadas, luego por fecha de creación (más nuevas primero)
    const missions = await Mission.find(query)
        .populate('participants', 'username avatar')
        .sort({ completed: 1, createdAt: -1 });

    // 3. Limpieza de Fechas (Auto-Reset para Hábitos)
    // Esto soluciona el problema de que el widget muestre 5/3 si cuenta misiones viejas
    const today = new Date().toDateString();
    let updated = false;

    for (let mission of missions) {
        try {
            // Si es hábito y está marcado como completado, verificamos la fecha
            if (mission.type === 'habit' && mission.completed) {
                // Si no tiene fecha, asumimos que es vieja y reseteamos
                if (!mission.lastUpdated) {
                    mission.lastUpdated = new Date();
                }

                const lastUpdate = new Date(mission.lastUpdated).toDateString();

                // Lógica de reseteo según frecuencia
                // Aquí nos enfocamos principalmente en DAILY para el widget del Home
                if (lastUpdate !== today && mission.frequency === 'daily') {
                    console.log(`🔄 [AUTO-FIX] Reseteando hábito diario antiguo: ${mission.title}`);
                    mission.progress = 0;
                    mission.completed = false;

                    // Asegurar mapa de contribuciones limpio
                    if (!mission.contributions) mission.contributions = new Map();

                    // Resetear contribuciones de todos los participantes
                    if (mission.participants && mission.participants.length > 0) {
                        mission.participants.forEach(p => {
                            const pId = p._id ? p._id.toString() : p.toString();
                            mission.contributions.set(pId, 0);
                        });
                    }

                    await mission.save();
                    updated = true;
                }
            }
        } catch (err) {
            console.error(`⚠️ [WARN] Error procesando reset de misión (${mission._id}):`, err.message);
        }
    }

    if (updated) {
        // Si hubo cambios (reseteos), volvemos a llamar recursivamente para traer los datos limpios
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

    // Calculamos recompensas basándonos en la dificultad
    let mult = (DIFFICULTY_MULTIPLIERS[diff] || 1) * (FREQUENCY_MULTIPLIERS[freq] || 1);
    if (isCoop) mult *= 1.5; // Bonus por cooperativo

    const finalXP = Math.round(BASE_XP * mult);
    const finalCoins = Math.round(BASE_COINS * mult);
    const finalGameCoins = finalCoins * 2;

    // Aseguramos que el creador está en participantes
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

    // Enviar notificación al amigo (añadiendo la misión a su array de requests)
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
        // Limpiamos la request muerta del usuario
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });
        return res.status(404).json({ message: 'Esta misión ya no existe o fue cancelada.' });
    }

    if (action === 'accept') {
        mission.invitationStatus = 'active';
        if (!mission.contributions) mission.contributions = new Map();
        mission.contributions.set(userId.toString(), 0);

        await mission.save();
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });

        res.json({ message: '¡Misión aceptada! A trabajar.', mission });
    } else {
        // Si se rechaza, la misión se borra por completo (reglas estrictas)
        await Mission.findByIdAndDelete(missionId);
        await User.findByIdAndUpdate(userId, { $pull: { missionRequests: missionId } });
        res.json({ message: 'Invitación rechazada y misión cancelada.' });
    }
});

// ------------------------------------------------------------------
// 4. ACTUALIZAR PROGRESO / EDITAR MISIÓN
// ------------------------------------------------------------------
const updateProgress = asyncHandler(async (req, res) => {
    const { amount, editMode, title, target } = req.body;
    const userId = req.user._id;

    const mission = await Mission.findById(req.params.id);
    if (!mission) { res.status(404); throw new Error('Misión no encontrada'); }

    // Validación de seguridad: Participante o Dueño
    const isParticipant = mission.participants.map(p => p.toString()).includes(userId.toString());
    const isOwner = mission.user.toString() === userId.toString();

    if (!isParticipant && !isOwner) {
        res.status(401); throw new Error('No tienes permiso para tocar esta misión');
    }

    // --- MODO EDICIÓN (Fix Solicitado Punto 1) ---
    if (editMode) {
        if (title) mission.title = title.trim();
        if (target) mission.target = Number(target);

        // Si el target cambia y es menor que el progreso actual, ajustamos
        if (mission.progress > mission.target) mission.progress = mission.target;

        await mission.save();
        return res.json({ message: "Misión actualizada correctamente", mission });
    }

    // Validar estado cooperativo
    if (mission.isCoop && mission.invitationStatus === 'pending') {
        res.status(400); throw new Error('Tu compañero aún no ha aceptado la misión.');
    }

    // Validación de Hábito Diario completado hoy
    const today = new Date();
    if (mission.type === 'habit' && mission.completed) {
        const last = new Date(mission.lastUpdated);
        // Si la última vez fue HOY, ya no se puede sumar más
        if (last.toDateString() === today.toDateString()) {
            return res.status(200).json({ message: 'Misión ya completada hoy', alreadyCompleted: true });
        } else {
            // Si fue ayer, reseteamos (aunque el getMissions ya debería haberlo hecho, doble seguridad)
            mission.progress = 0;
            mission.completed = false;
            if (!mission.contributions) mission.contributions = new Map();
            mission.participants.forEach(p => mission.contributions.set(p.toString(), 0));
        }
    }

    const addAmount = Number(amount) || 1;

    // --- SYNC LOGIC (Misiones Vinculadas) ---
    // 🔥 CORRECCIÓN PUNTO 2: Buscamos misiones con el mismo Título Y la misma UNIDAD
    const linkedMissions = await Mission.find({
        user: userId,
        title: mission.title,
        unit: mission.unit, // <--- CLAVE: Ahora diferenciamos "1 Pagina" de "1 Libro"
        _id: { $ne: mission._id }, // No la actual
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
            // Dar recompensa de la vinculada
            await levelService.addRewards(userId, linked.xpReward, linked.coinReward, linked.gameCoinReward);

            // Log en el diario
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

    // --- ACTUALIZAR MISIÓN ACTUAL ---
    mission.progress += addAmount;
    if (!mission.contributions) mission.contributions = new Map();
    const currentContrib = mission.contributions.get(userId.toString()) || 0;
    mission.contributions.set(userId.toString(), currentContrib + addAmount);

    mission.lastUpdated = today;

    let rewards = null;
    let leveledUp = false;
    let userResult = null;

    // Verificar Completitud
    if (mission.progress >= mission.target) {
        mission.completed = true;
        mission.progress = mission.target;

        // Dar recompensas a TODOS los participantes
        for (const pId of mission.participants) {
            const result = await levelService.addRewards(pId, mission.xpReward, mission.coinReward, mission.gameCoinReward);

            // Guardamos el resultado si soy yo para devolverlo al frontend
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

    // Permitir borrar aunque esté acabada si eres el dueño (Fix Punto 1)
    if (mission.user.toString() !== req.user._id.toString()) {
        res.status(403); throw new Error('Solo el creador puede cancelar la misión');
    }

    // Si era una invitación pendiente, limpiamos el buzón del amigo
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
// 6. PURGA NUCLEAR (DEV TOOL)
// ------------------------------------------------------------------
const nukeMyMissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const userIdString = userId.toString();

    await Mission.deleteMany({
        $or: [
            { user: userId },
            { user: userIdString },
            { participants: userId },
            { participants: userIdString }
        ]
    });

    console.log(`☢️ Misiones purgadas para el usuario: ${userId}`);
    res.status(200).json({ message: "☢️ Todas tus misiones han sido eliminadas. Cuenta limpia." });
});

module.exports = {
    getMissions,
    createMission,
    updateProgress,
    deleteMission,
    respondMissionInvite,
    nukeMyMissions
};
