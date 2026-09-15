const asyncHandler = require('express-async-handler');
const { borrarUsuarioYSusDatos } = require('../services/borradoService');
const WorkoutLog = require('../models/WorkoutLog');
const DailyLog = require('../models/DailyLog');
const NutritionLog = require('../models/NutritionLog');
const Routine = require('../models/Routine');
const Mission = require('../models/Mission');
const Food = require('../models/Food');
const User = require('../models/User');
const levelService = require('../services/levelService');
// Importamos la función manual del scheduler
const { runNightlyMaintenance } = require('../utils/scheduler');
const { recompensaDelDia, tramoDelCamino } = require('../utils/caminoRacha');
const ShopItem = require('../models/ShopItem');
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
// 3. LA RACHA Y SU RECOMPENSA DIARIA
// ==========================================
/**
 * UNA SOLA RACHA: los dias SEGUIDOS que entras y recoges la recompensa.
 *
 * ⚠️ Antes habia dos cosas distintas con nombre parecido y se contradecian:
 * una "racha" que subia al completar TODAS las misiones del dia (y que el
 * castigo nocturno ponia a cero) y un "ciclo de recompensas" de siete dias
 * que avanzaba por calendario aunque no entraras. El widget enseñaba una y
 * el calendario la otra, y pasaban cosas raras: dias en rojo sin haber
 * fallado nada, la racha a cero con la diaria cobrada...
 *
 * Ahora es lo que se pidio: dia 1, dia 2, dia 3... Si un dia no recoges,
 * al siguiente vuelves al dia 1. Sin tope. El premio de cada dia esta en
 * utils/caminoRacha.js y el movil lo pinta desde ahi (GET /users/camino).
 */

/** El dia del camino que toca hoy: sigue la racha si ayer se cobro, o el 1. */
const diaQueToca = (usuario, hoyStr, ayerStr) => {
    const ultimo = usuario.dailyRewards?.lastClaimDay
        || (usuario.dailyRewards?.lastClaimDate ? getMadridDateString(new Date(usuario.dailyRewards.lastClaimDate)) : null);
    if (ultimo === hoyStr) return { dia: usuario.streak?.current || 1, cobradoHoy: true };
    if (ultimo === ayerStr) return { dia: (usuario.streak?.current || 0) + 1, cobradoHoy: false };
    return { dia: 1, cobradoHoy: false };
};

const fechasDeHoy = () => {
    const now = new Date();
    const hoyStr = getMadridDateString(now);
    const ayer = new Date(now); ayer.setDate(ayer.getDate() - 1);
    return { now, hoyStr, ayerStr: getMadridDateString(ayer) };
};

/** Aplica el premio de un dia del camino a un usuario. */
const darRecompensa = async (userId, premio) => {
    if (premio.tipo === 'fichas') {
        await User.updateOne({ _id: userId }, { $inc: { gameCoins: premio.valor } });
    } else if (premio.tipo === 'xp') {
        await levelService.addRewards(userId, premio.valor, 0, 0);
    } else if (premio.tipo === 'hp') {
        // Hasta el maximo y ni una mas, en la misma escritura.
        await User.updateOne({ _id: userId }, [{ $set: { hp: { $min: [{ $add: [{ $ifNull: ['$hp', 0] }, premio.valor] }, { $ifNull: ['$maxHp', 100] }] } } }]);
        await User.updateOne({ _id: userId }, [{ $set: { lives: '$hp' } }]);
    } else if (premio.tipo === 'cofre') {
        const cofre = await ShopItem.findOne({ category: 'chest', effectType: premio.cofre, user: null }).select('_id');
        if (!cofre) return { ...premio, sinCofre: true };
        const apilado = await User.updateOne({ _id: userId, 'inventory.item': cofre._id }, { $inc: { 'inventory.$.quantity': 1 } });
        if (apilado.matchedCount === 0) await User.updateOne({ _id: userId }, { $push: { inventory: { item: cofre._id, quantity: 1 } } });
    }
    return premio;
};

const claimDailyReward = asyncHandler(async (req, res) => {
    const { now, hoyStr, ayerStr } = fechasDeHoy();

    // 🔒 ATOMICO: solo entra el primer clic del dia natural (hora de Madrid).
    // Evita doble premio por doble clic, dos pestañas o el desfase UTC/Madrid.
    const anterior = await User.findOneAndUpdate(
        { _id: req.user._id, 'dailyRewards.lastClaimDay': { $ne: hoyStr } },
        { $set: { 'dailyRewards.lastClaimDay': hoyStr, 'dailyRewards.lastClaimDate': now } },
        { new: false }
    );

    const yaCobrada = async () => {
        const actual = await User.findById(req.user._id).select('dailyRewards streak');
        return res.status(400).json({
            success: false,
            alreadyClaimed: true,
            message: '¡Ya has recogido la de hoy! Vuelve mañana.',
            dailyRewards: actual?.dailyRewards || null,
            streak: actual?.streak || null
        });
    };
    if (!anterior) return yaCobrada();

    // Usuarios anteriores a `lastClaimDay` no tenian el campo y el candado de
    // arriba no los frena: se mira tambien la fecha derivada.
    const { dia, cobradoHoy } = diaQueToca(anterior, hoyStr, ayerStr);
    if (cobradoHoy) return yaCobrada();

    const premio = await darRecompensa(req.user._id, recompensaDelDia(dia));

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { 'streak.current': dia, 'streak.lastLogDate': now } },
        { new: true }
    ).populate('inventory.item');

    res.status(200).json({
        success: true,
        message: `Día ${dia} de racha`,
        user,
        streak: user.streak,
        dia,
        dailyRewards: { lastClaimDate: now, lastClaimDay: hoyStr, currentDay: dia },
        reward: premio
    });
});

/**
 * El camino: en que dia estas, si hoy ya esta cobrado, y el tramo de premios
 * alrededor para pintarlo. El movil no tiene copia de la tabla.
 */
const getCaminoRacha = asyncHandler(async (req, res) => {
    const { hoyStr, ayerStr } = fechasDeHoy();
    const usuario = await User.findById(req.user._id).select('dailyRewards streak').lean();
    const { dia, cobradoHoy } = diaQueToca(usuario, hoyStr, ayerStr);
    res.json({
        dia,
        cobradoHoy,
        racha: cobradoHoy ? dia : (usuario.streak?.current || 0),
        // La racha "viva": si ayer no se cobro, lo que se enseña como racha
        // actual es 0 aunque el numero guardado sea otro.
        rachaViva: cobradoHoy || dia > 1 ? (cobradoHoy ? dia : dia - 1) : 0,
        hoy: recompensaDelDia(dia),
        camino: tramoDelCamino(dia, 3, 10)
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
/*
 * ⚠️ AQUI HABIA UN GRIFO ABIERTO: addGameReward / POST /users/reward.
 *
 * Cogia coins, xp y gameCoins del CUERPO de la peticion y se los sumaba al
 * usuario tal cual, con solo estar logueado. Una peticion con 999999 en cada
 * campo y a correr: la economia entera dependia de que nadie mirara la lista de
 * rutas. Y no la llamaba nadie, ni el frontend ni el backend: era codigo muerto
 * de cuando los juegos pagaban desde el cliente. Los juegos cobran y pagan
 * ahora en el servidor (gamesController), que es donde se decide si has ganado.
 */

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

/**
 * Descargar TODO lo que la app guarda de ti, en un solo fichero.
 *
 * La politica de privacidad promete que puedes pedir una copia de tus datos. Sin
 * esto, cumplir esa promesa significaba que alguien entrara a la base de datos a
 * mano cada vez que alguien lo pidiera: en la practica, no se cumplia.
 *
 * Va todo: perfil, entrenos con sus series, dias registrados, nutricion,
 * rutinas, misiones y alimentos guardados. NO va la contrasena (esta cifrada y
 * no se puede devolver) ni las suscripciones de notificaciones (son claves de
 * dispositivo, no datos tuyos).
 *
 * @route   GET /api/users/mis-datos
 */
const exportarMisDatos = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const [perfil, entrenos, dias, nutricion, rutinas, misiones, alimentos] = await Promise.all([
        User.findById(userId).select('-password -pushSubscriptions').lean(),
        WorkoutLog.find({ user: userId }).sort({ date: -1 }).lean(),
        DailyLog.find({ user: userId }).sort({ date: -1 }).lean(),
        NutritionLog.find({ user: userId }).sort({ date: -1 }).lean(),
        Routine.find({ user: userId }).lean(),
        Mission.find({ $or: [{ user: userId }, { participants: userId }] }).lean(),
        Food.find({ user: userId }).lean()
    ]);

    const datos = {
        exportadoEl: new Date().toISOString(),
        aplicacion: 'Kairos',
        aviso: 'Copia completa de tus datos. No incluye tu contraseña (está cifrada y no se puede recuperar) ni los identificadores de tus dispositivos para notificaciones.',
        perfil,
        resumen: {
            entrenos: entrenos.length,
            diasRegistrados: dias.length,
            diasDeNutricion: nutricion.length,
            rutinas: rutinas.length,
            misiones: misiones.length,
            alimentosGuardados: alimentos.length
        },
        entrenos, dias, nutricion, rutinas, misiones, alimentos
    };

    // Con estas cabeceras el navegador lo descarga como fichero en vez de
    // enseñarlo por pantalla, que con miles de lineas no le sirve a nadie.
    const nombre = 'kairos-' + (perfil?.username || 'datos') + '-' + new Date().toISOString().slice(0, 10) + '.json';
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + nombre + '"');
    res.send(JSON.stringify(datos, null, 2));
});

/**
 * Borrar la propia cuenta, con todo lo que arrastra.
 *
 * No existia ninguna forma de irse. Guardamos correo, peso, fotos de comida y de
 * entrenos: son datos personales, y quien los da tiene derecho a que
 * desaparezcan sin depender de que alguien le conteste.
 *
 * Pide la contrasena a proposito. Un boton de borrar cuenta sin confirmar la
 * identidad convierte cualquier movil desbloqueado un momento —o una sesion
 * abierta en un ordenador prestado— en una cuenta destruida sin vuelta atras.
 *
 * @route   DELETE /api/users/me
 */
const borrarMiCuenta = asyncHandler(async (req, res) => {
    const { password } = req.body || {};

    if (!password) { res.status(400); throw new Error('Escribe tu contraseña para confirmar'); }

    const user = await User.findById(req.user._id).select('+password isAdmin username');
    if (!user) { res.status(404); throw new Error('Usuario no encontrado'); }

    const correcta = await user.comparePassword(password);
    if (!correcta) { res.status(401); throw new Error('La contraseña no es correcta'); }

    // Sin esto, el unico administrador podria dejar la app sin nadie que la
    // pueda moderar, y sin forma de nombrar a otro desde dentro.
    if (user.isAdmin) {
        res.status(400);
        throw new Error('Una cuenta de administrador no se puede borrar desde la app');
    }

    const resumen = await borrarUsuarioYSusDatos(user._id);

    res.json({ message: 'Cuenta borrada. Hasta otra.', resumen });
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

/**
 * Revivir tras la pantalla de redención.
 *
 * ⚠️ No comprobaba nada: llamarlo con 90 de vida te DEJABA en 20, porque asigna
 * en vez de curar. Solo tiene sentido estando a cero.
 */
const reviveUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if ((user.hp ?? 0) > 0) {
        res.status(400);
        throw new Error('Todavía estás vivo');
    }

    user.hp = 20;
    user.lives = 20;
    await user.save();
    res.json({ message: "Has revivido.", user });
});

/**
 * Bajar la vida a mano (el botón de daño de la cabecera).
 *
 * ⚠️ Esto aceptaba `hp`, `xp` y `coins` del cuerpo de la petición y los ESCRIBÍA
 * tal cual. Con la sesión iniciada, una sola llamada dejaba `coins: 999999` o la
 * vida a 100: se saltaba de golpe el castigo nocturno y la economía entera, que
 * es justo lo que costó cerrar en las misiones.
 *
 * Ahora solo puede BAJAR la vida. Subirla se gana: pociones, recompensa diaria o
 * subir de nivel. Y ya no toca ni el XP ni las monedas.
 */
const updateStatsManual = asyncHandler(async (req, res) => {
    const { hp } = req.body;

    if (hp === undefined) {
        res.status(400);
        throw new Error('Indica "hp"');
    }

    const user = await User.findById(req.user._id);
    const solicitada = Math.max(0, Math.min(user.maxHp, Number(hp) || 0));

    if (solicitada > (user.hp ?? 0)) {
        res.status(400);
        throw new Error('Por aquí solo se puede bajar la vida');
    }

    user.hp = solicitada;
    user.lives = solicitada;

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
    exportarMisDatos,
    borrarMiCuenta,
    getMe,
    updateMacros,
    claimDailyReward,
    getCaminoRacha,
    updatePhysicalStats,
    setRedemptionMission,
    reviveUser,
    updateStatsManual,
    simulateYesterday,
    setManualStreak,
    forceNightlyMaintenance,
    updateProfileSettings
};