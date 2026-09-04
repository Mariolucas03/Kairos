const asyncHandler = require('express-async-handler');
const Mission = require('../models/Mission');
const DailyLog = require('../models/DailyLog');
const User = require('../models/User');
const levelService = require('../services/levelService');
const { getMadridDateString } = require('../utils/dateHelpers');
const { notificarA } = require('./pushController');
const mongoose = require('mongoose');

// 🔥 TABLA DE RECOMPENSAS
const REWARD_TABLE = {
    easy: { xp: 50, gameCoins: 100, coins: 10 },
    medium: { xp: 75, gameCoins: 150, coins: 30 },
    hard: { xp: 100, gameCoins: 200, coins: 50 },
    epic: { xp: 150, gameCoins: 250, coins: 70 }
};

// ⚠️ Estos multiplicadores eran 1 / 5 / 15 / 100. Como el usuario elige la 
// dificultad Y la frecuencia, una mision anual + epica + coop daba
// 150 x 100 x 1,5 = 22.500 XP y 10.500 monedas... y con objetivo 1 se
// completaba de un toque. El objeto mas caro de la tienda cuesta 4.000: un
// solo toque valia 2,6 veces el catalogo entero, y se podian crear sin limite.
//
// Con 1 / 4 / 10 / 25 una anual epica coop pasa a 1.750 monedas: sigue siendo
// un premio gordo, pero no rompe la tienda.
const FREQUENCY_MULTIPLIERS = { daily: 1, weekly: 4, monthly: 10, yearly: 25 };

/**
 * TOPES CONTRA LA FÁBRICA DE MISIONES.
 *
 * ⚠️ Las misiones las escribe el propio usuario Y pagan. Una diaria fácil da 10
 * monedas, 100 fichas y 50 XP, y no había ningún límite: crear cincuenta
 * misiones triviales ("beber agua", "respirar") y marcarlas daba 500 monedas,
 * 5.000 fichas y 2.500 XP AL DÍA. El objeto más caro de la tienda cuesta 4.000
 * monedas, y la persona que más XP hizo en todo un mes sumó 1.442.
 *
 * Hacen falta los DOS topes, no vale con uno:
 *
 *  - El de misiones activas evita tener cien a la vez.
 *  - El de cobros al día evita darle la vuelta borrando y volviendo a crear,
 *    que es lo que haría cualquiera al chocar con el primero.
 *
 * Los números salen de lo que hace la gente de verdad: los usuarios reales
 * tienen entre 4 y 6 misiones. 40 activas y 25 cobros al día es entre seis y
 * diez veces el uso más intenso que se ha visto, así que nadie honesto lo va a
 * rozar; para farmear, en cambio, hacen falta cientos.
 */
const MAX_MISIONES_ACTIVAS = 40;
const MAX_COBROS_POR_DIA = 25;

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

/**
 * Sube la racha si hoy no queda ninguna misión diaria pendiente.
 *
 * ⚠️ LA RACHA NO SUBÍA NUNCA. Se ponía a 1 al registrarse y a 0 al fallar una
 * diaria, y no había una sola línea en toda la app que la incrementara: los tres
 * usuarios reales llevaban semanas con "racha: 1". El contador estaba en el
 * modelo, se pintaba en el widget de Inicio, salía en el perfil público y hasta
 * el aviso de las 20:00 lo mencionaba... y siempre valía 1.
 *
 * Sube aquí, al terminar la última diaria del día, y no en el mantenimiento
 * nocturno, porque una racha se disfruta en el momento en que te la ganas, no a
 * las tres de la mañana mientras duermes.
 *
 * La condición de fecha va DENTRO del findOneAndUpdate a propósito: si se
 * comprobara antes, dos misiones terminadas a la vez sumarían dos días de golpe.
 */
const actualizarRacha = async (userId) => {
    try {
        const diaSemana = new Date().getDay();

        // Las MISMAS condiciones que usan el castigo nocturno y el aviso de las
        // 20:00. Si las tres listas no coincidieran, la racha premiaría días que
        // el castigo considera fallados.
        const filtroDelDia = {
            frequency: 'daily',
            invitationStatus: { $ne: 'pending' },
            $and: [
                { $or: [{ user: userId }, { participants: userId }] },
                { $or: [{ specificDays: { $size: 0 } }, { specificDays: diaSemana }] }
            ]
        };

        const [total, pendientes] = await Promise.all([
            Mission.countDocuments(filtroDelDia),
            Mission.countDocuments({ ...filtroDelDia, completed: false })
        ]);

        // Sin misiones para hoy no hay nada que premiar: si no, bastaría con no
        // ponerse ninguna para tener una racha infinita sin hacer nada.
        if (total === 0 || pendientes > 0) return null;

        const inicioDeHoy = new Date();
        inicioDeHoy.setHours(0, 0, 0, 0);

        const actualizado = await User.findOneAndUpdate(
            { _id: userId, 'streak.lastLogDate': { $lt: inicioDeHoy } },
            { $inc: { 'streak.current': 1 }, $set: { 'streak.lastLogDate': new Date() } },
            { new: true }
        ).select('streak');

        // null = la racha de hoy ya estaba contada
        return actualizado ? actualizado.streak.current : null;
    } catch (error) {
        console.error('No se pudo actualizar la racha:', error.message);
        return null;
    }
};

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
        } catch (err) {
            console.error(`Error reseteando misión de hábito ${mission._id}:`, err);
        }
    }

    if (updated) return getMissions(req, res);
    res.status(200).json(missions);
});

const createMission = asyncHandler(async (req, res) => {
    const { title, frequency, type, difficulty, target, specificDays, unit, isCoop, friendId } = req.body;

    if (!title) { res.status(400); throw new Error('El título es obligatorio'); }

    const freq = frequency || 'daily';
    const diff = difficulty || 'easy';
    const days = Array.isArray(specificDays) ? specificDays : [];

    // Tope de misiones activas. Va antes de crear nada: quien llega aqui con 40
    // no necesita otra mision, necesita borrar alguna.
    const activas = await Mission.countDocuments({ user: req.user._id });
    if (activas >= MAX_MISIONES_ACTIVAS) {
        res.status(400);
        throw new Error('Tienes ' + activas + ' misiones. Borra alguna antes de crear otra (máximo ' + MAX_MISIONES_ACTIVAS + ').');
    }

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

        // Una invitacion coop sin aceptar bloquea la mision para los dos, asi
        // que cuanto antes se entere el invitado, mejor.
        notificarA(friendId, {
            title: '🤝 Te invitan a una misión',
            body: (req.user.username || 'Alguien') + ': "' + title.trim().slice(0, 60) + '"',
            icon: '/assets/icons/icon-192x192.png',
            url: '/missions'
        });
    }

    res.status(201).json(mission);
});

const updateProgress = asyncHandler(async (req, res) => {
    const { amount, editMode, title, target, frequency, difficulty, unit, specificDays, clienteId } = req.body;
    const userId = req.user._id;
    const marca = String(clienteId || '').trim().slice(0, 80);

    // 1. VALIDACIÓN INICIAL
    const mission = await Mission.findById(req.params.id);
    if (!mission) { res.status(404); throw new Error('Misión no encontrada'); }

    // ⚠️ ESTE AVANCE YA ESTABA SUMADO.
    //
    // Pasa cuando el movil reintenta: se guardo bien pero la respuesta se perdio
    // por el camino. Sin esto, el reintento vuelve a sumar —y como al llegar al
    // objetivo se paga XP, monedas y fichas, un avance repetido puede completar
    // y COBRAR una mision que en realidad no esta hecha.
    //
    // Se responde 200 y no un error: para la app es un exito, su avance esta
    // guardado.
    if (marca && (mission.enviosAplicados || []).includes(marca)) {
        return res.status(200).json({
            message: 'Este avance ya estaba apuntado',
            duplicado: true,
            mission
        });
    }

    const isParticipant = mission.participants.map(p => p.toString()).includes(userId.toString());
    const isOwner = mission.user.toString() === userId.toString();

    if (!isParticipant && !isOwner) { res.status(401); throw new Error('No tienes permiso'); }

    // 2. MODO EDICIÓN
    if (editMode) {
        if (title) mission.title = title.trim();
        if (target) mission.target = Number(target);
        if (frequency) mission.frequency = frequency;
        if (difficulty) mission.difficulty = difficulty;
        if (unit !== undefined) mission.unit = unit.trim();

        if (specificDays && Array.isArray(specificDays)) {
            mission.specificDays = specificDays;
        }

        if (frequency || difficulty) {
            // 🔥 BUG FIX: El orden correcto era difficulty, frequency, isCoop
            const r = calculateRewards(
                difficulty || mission.difficulty,
                frequency || mission.frequency,
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

    // 3. MODO PROGRESO (🔥 BLINDADO CON ATOMICIDAD)
    if (mission.isCoop && mission.invitationStatus === 'pending') {
        res.status(400); throw new Error('Tu compañero aún no ha aceptado.');
    }

    const today = new Date();
    // ⚠️ En UTC, entre las 00:00 y las 02:00 de Madrid esto devuelve AYER: la misión
    // completada de madrugada sumaba en el registro del día anterior y, como el
    // findOneAndUpdate va con upsert, podía crear un DailyLog fantasma con fecha mala.
    const todayStr = getMadridDateString();

    // Resetear hábitos si es un nuevo día.
    //
    // ⚠️ Esto reiniciaba CUALQUIER hábito completado en cuanto cambiaba el día,
    // sin mirar su frecuencia. Un hábito semanal, mensual o anual se completaba,
    // cobraba, y al día siguiente volvía a estar disponible y volvía a cobrar.
    // Con los multiplicadores de frecuencia eso es serio: uno anual + épico +
    // coop paga 2.625 monedas, y el objeto más caro de la tienda cuesta 4.000.
    //
    // Los ciclos largos los reinicia el mantenimiento nocturno cuando de verdad
    // toca (processCycle), que es quien sabe si el ciclo se ha cerrado.
    if (mission.type === 'habit' && mission.completed) {
        if (mission.frequency !== 'daily') {
            return res.status(200).json({ message: 'Ya completada en este ciclo', alreadyCompleted: true });
        }

        const last = new Date(mission.lastUpdated);
        if (last.toDateString() === today.toDateString()) {
            return res.status(200).json({ message: 'Ya completada hoy', alreadyCompleted: true });
        }

        // Reset atómico
        await Mission.findByIdAndUpdate(mission._id, {
            $set: { progress: 0, completed: false, lastUpdated: today }
        });
        mission.progress = 0;
        mission.completed = false;
    }

    // 🔥 Clamp: nunca confiar en un incremento arbitrario del cliente. Como mucho,
    // lo que falte para completar la misión (evita completar de un tirón misiones coop grandes).
    const remaining = Math.max(mission.target - mission.progress, 1);
    const requestedAmount = Number(amount) || 1;
    const addAmount = Math.min(Math.max(requestedAmount, 1), remaining);
    let rewards = null, leveledUp = false, userResult = null;
    let topeAlcanzado = false;

    // Función Helper para progresar y premiar sin Race Conditions
    const processMissionCompletion = async (targetMission, isMain) => {
        // Incrementamos de forma segura
        // La marca se apunta EN LA MISMA ESCRITURA que suma, y con la condicion
        // dentro del filtro. Comprobar antes y escribir despues deja pasar a dos
        // reintentos simultaneos, que es justo lo que manda la cola de
        // sin-conexion en cuanto vuelve la cobertura.
        //
        // Solo en la mision principal: en una coop, el avance del compañero es
        // otro documento y su marca no tiene por que ser unica ahi.
        const filtro = { _id: targetMission._id, completed: false };
        if (isMain && marca) filtro.enviosAplicados = { $ne: marca };

        const updated = await Mission.findOneAndUpdate(
            filtro,
            {
                $inc: { progress: addAmount },
                $set: { lastUpdated: today },
                // Se guardan las ultimas cincuenta y las demas se caen solas: de
                // un habito diario de un año, la lista entera serian cientos de
                // cadenas dentro del documento sin ninguna utilidad.
                ...(isMain && marca ? { $push: { enviosAplicados: { $each: [marca], $slice: -50 } } } : {})
            },
            { new: true }
        );

        if (!updated) return null; // Ya estaba completada, o el avance ya contaba

        if (updated.progress >= updated.target) {
            // ATÓMICO: Solo el primer hilo que haga coincidir {completed: false} podrá cerrarla y dar el premio
            const completedDoc = await Mission.findOneAndUpdate(
                { _id: updated._id, completed: false },
                { $set: { completed: true, progress: updated.target } },
                { new: true }
            );

            if (completedDoc) {
                // ¿Cuantas van cobradas hoy? El registro diario ya lleva la lista
                // de completadas, asi que no hace falta un contador aparte.
                const registroHoy = await DailyLog.findOne({ user: userId, date: todayStr })
                    .select('missionStats.listCompleted').lean();
                const cobradasHoy = (registroHoy?.missionStats?.listCompleted || [])
                    .filter(m => !m.failed).length;

                // Pasado el tope la mision SE COMPLETA igual —tacharla es la mitad
                // de la gracia— pero deja de pagar. Cobrar cero en silencio seria
                // peor que no dejar completarla, asi que la respuesta lo dice.
                const pagaPremio = cobradasHoy < MAX_COBROS_POR_DIA;
                if (!pagaPremio) topeAlcanzado = true;

                // ESTE HILO ES EL GANADOR: REPARTE PREMIOS
                for (const pId of (pagaPremio ? completedDoc.participants : [])) {
                    const r = await levelService.addRewards(pId, completedDoc.xpReward, completedDoc.coinReward, completedDoc.gameCoinReward);
                    if (isMain && pId.toString() === userId.toString()) {
                        userResult = r.user;
                        leveledUp = r.leveledUp;
                        rewards = { xp: completedDoc.xpReward, coins: completedDoc.coinReward, gameCoins: completedDoc.gameCoinReward };
                    }
                }

                await DailyLog.findOneAndUpdate(
                    { user: userId, date: todayStr },
                    {
                        $inc: { 'missionStats.completed': 1 },
                        $push: { 'missionStats.listCompleted': { title: completedDoc.title, coinReward: completedDoc.coinReward, xpReward: completedDoc.xpReward, type: completedDoc.type } }
                    },
                    { upsert: true }
                );
                return completedDoc;
            }
        }
        return updated;
    };

    // Procesar Misiones Enlazadas (Con mismo nombre y unidad)
    const linkedMissions = await Mission.find({ user: userId, title: mission.title, unit: mission.unit, _id: { $ne: mission._id }, completed: false });
    for (let linked of linkedMissions) {
        await processMissionCompletion(linked, false);
    }

    // Procesar Misión Principal
    const finalMainMission = await processMissionCompletion(mission, true);

    if (!finalMainMission) {
        // La misión ya fue procesada por otro clic concurrente
        const current = await Mission.findById(mission._id);
        return res.json({ message: 'Ya procesado', mission: current, progressOnly: true });
    }

    // Si esta era la ultima diaria pendiente, la racha sube un dia. Devuelve el
    // numero nuevo solo cuando acaba de subir, para poder celebrarlo en pantalla
    // sin repetir el aviso cada vez que se toca una mision ya completada.
    const rachaNueva = finalMainMission.completed ? await actualizarRacha(userId) : null;

    res.json({
        message: topeAlcanzado
            ? 'Completada, pero hoy ya has cobrado el máximo de misiones'
            : (finalMainMission.completed ? '¡Completada!' : 'Actualizada'),
        topeAlcanzado,
        mission: finalMainMission,
        user: userResult,
        leveledUp,
        rewards,
        rachaNueva,
        progressOnly: !finalMainMission.completed
    });
});

/**
 * Borrar una mision.
 *
 * ⚠️ ANTES SOLO PODIA EL CREADOR, Y EN UNA COOP ESO DEJA ATRAPADO AL OTRO.
 *
 * Una mision cooperativa es UN documento con los dos dentro. Si te invitan a
 * una y luego no te interesa, no habia forma de quitartela de la lista: el
 * borrado devolvia 403 y no hay ninguna otra salida en la pantalla. Te quedaba
 * ahi para siempre, contando para tu tope de misiones y quitandote vida cada
 * noche que no la cumplieras.
 *
 * Ahora la borra cualquiera de los dos y desaparece para los dos, que es lo
 * unico coherente con que sea una sola mision compartida: no hay dos copias que
 * puedan quedar en estados distintos.
 *
 * Al otro se le avisa. Que una mision compartida desaparezca sin explicacion es
 * peor que no poder borrarla.
 */
const deleteMission = asyncHandler(async (req, res) => {
    const mission = await Mission.findById(req.params.id);
    if (!mission) { res.status(404); throw new Error('No encontrada'); }

    const yo = req.user._id.toString();
    const participa = (mission.participants || []).some(p => p.toString() === yo);
    const esMia = mission.user.toString() === yo;
    if (!esMia && !participa) { res.status(403); throw new Error('Esta mision no es tuya'); }

    // La invitacion pendiente vive en el buzon del invitado: se quita tambien,
    // o le queda un aviso que lleva a una mision que ya no existe.
    const otros = (mission.participants || [])
        .map(p => p.toString())
        .filter(p => p !== yo);

    for (const id of otros) {
        await User.findByIdAndUpdate(id, { $pull: { missionRequests: mission._id } });
    }

    await mission.deleteOne();

    // Uno por uno: notificarA recibe UN id, no una lista.
    if (mission.isCoop) {
        for (const id of otros) {
            notificarA(id, {
                title: '🎯 Misión compartida cancelada',
                body: `${req.user.username} ha borrado "${mission.title}".`,
                url: '/missions'
            });
        }
    }

    res.status(200).json({ id: req.params.id, message: "Eliminada" });
});

/**
 * Aceptar o rechazar una invitacion a mision cooperativa.
 *
 * ⚠️ NO comprobaba de quien era la invitacion. Cogia el missionId del cuerpo y,
 * con action 'reject', hacia findByIdAndDelete: con la sesion normal y un id
 * cualquiera, se podian BORRAR las misiones de otra persona una a una. Y con
 * 'accept' se activaba una mision coop ajena sin haber sido invitado.
 *
 * La invitacion vive en el array missionRequests del invitado, asi que eso es
 * lo que hay que exigir. Se consume con findOneAndUpdate atomico: ademas de
 * comprobar el permiso, cierra la carrera de dos toques seguidos (aceptar dos
 * veces, o aceptar y rechazar a la vez).
 */
const respondMissionInvite = asyncHandler(async (req, res) => {
    const { missionId, action } = req.body;
    const userId = req.user._id;
    if (!missionId) { res.status(400); throw new Error('Falta ID'); }

    const invitado = await User.findOneAndUpdate(
        { _id: userId, missionRequests: missionId },
        { $pull: { missionRequests: missionId } }
    );

    if (!invitado) {
        res.status(403);
        throw new Error('No tienes ninguna invitacion a esa mision');
    }

    const mission = await Mission.findById(missionId);
    if (!mission) { return res.status(404).json({ message: 'No existe' }); }
    // Quien creo la mision es el que espera respuesta: se le avisa en los dos
    // casos. El rechazo importa incluso mas que la aceptacion, porque la mision
    // se borra y si no se dice, desaparece de su lista sin explicacion.
    const creador = mission.user;
    const quien = req.user.username || 'Tu compañero';

    if (action === 'accept') {
        mission.invitationStatus = 'active';
        if (!mission.contributions) mission.contributions = new Map();
        mission.contributions.set(userId.toString(), 0);
        await mission.save();

        notificarA(creador, {
            title: '🤝 Misión aceptada',
            body: quien + ' se une a "' + (mission.title || '').slice(0, 60) + '".',
            icon: '/assets/icons/icon-192x192.png',
            url: '/missions'
        });

        res.json({ message: 'Aceptada', mission });
    } else {
        await Mission.findByIdAndDelete(missionId);

        notificarA(creador, {
            title: '🙅 Invitación rechazada',
            body: quien + ' no acepta "' + (mission.title || '').slice(0, 60) + '". La misión se ha borrado.',
            icon: '/assets/icons/icon-192x192.png',
            url: '/missions'
        });

        res.json({ message: 'Rechazada' });
    }
});

const nukeMyMissions = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    await Mission.deleteMany({ $or: [{ user: userId }, { participants: userId }] });
    res.status(200).json({ message: "Purgado" });
});

module.exports = { getMissions, createMission, updateProgress, deleteMission, respondMissionInvite, nukeMyMissions };