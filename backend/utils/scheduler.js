const cron = require('node-cron');
const Mission = require('../models/Mission');
const User = require('../models/User');
const DailyLog = require('../models/DailyLog');
const { sendPushToUser } = require('../controllers/pushController');
const { addRewards } = require('../services/levelService');
const { getMonthlyRanking, MONTHLY_PRIZES } = require('../services/rankingService');
const { getMadridDateString, getMadridMonthString } = require('./dateHelpers');

// --- Recordatorio Nocturno (20:00) ---
const runEveningReminder = async () => {
    console.log("🔔 Ejecutando recordatorio de misiones (20:00)...");

    const usersToWarn = await User.find({
        pushSubscriptions: { $exists: true, $not: { $size: 0 } }
    });

    // 🔥 OPTIMIZACIÓN: Ejecutar notificaciones en paralelo
    const notifyPromises = usersToWarn.map(async (user) => {
        const todayDay = new Date().getDay();
        const pendingCount = await Mission.countDocuments({
            user: user._id,
            frequency: 'daily',
            completed: false,
            $or: [
                { specificDays: { $size: 0 } },
                { specificDays: todayDay }
            ]
        });

        if (pendingCount > 0) {
            const payload = {
                title: "⚠️ ¡Peligro de Daño!",
                body: `Tienes ${pendingCount} misiones pendientes. Complétalas antes de medianoche o perderás HP.`,
                icon: "/assets/icons/icon-192x192.png",
                url: "/missions"
            };
            await sendPushToUser(user, payload);
            console.log(`📨 Notificación enviada a ${user.username}`);
        }
    });

    await Promise.allSettled(notifyPromises);
};

// --- PREMIOS MENSUALES RANKING ---
/**
 * Reparte los premios del ranking MENSUAL.
 *
 * Se ejecuta el día 1, así que premia el mes que acaba de cerrar.
 * Es idempotente por usuario (marca `lastMonthlyRewardPeriod`), de forma que se
 * puede llamar varias veces —cron interno + cron externo, reintentos, etc.—
 * sin repartir el premio dos veces.
 */
const runMonthlyRankingRewards = async (targetPeriod = null) => {
    // Por defecto premiamos el MES ANTERIOR (se lanza el día 1 del mes nuevo)
    const period = targetPeriod || (() => {
        const d = new Date();
        d.setDate(0); // Último día del mes anterior
        return getMadridMonthString(d);
    })();

    console.log(`🏆 Repartiendo premios del ranking mensual (${period})...`);

    const ranking = await getMonthlyRanking(period, MONTHLY_PRIZES.length);

    if (ranking.length === 0) {
        console.log('📭 Nadie tuvo actividad ese mes: sin premios que repartir.');
        return { success: true, period, awarded: 0, message: 'Sin actividad en el periodo' };
    }

    let awarded = 0;

    for (let i = 0; i < ranking.length; i++) {
        const entry = ranking[i];
        const prize = MONTHLY_PRIZES[i];
        if (!prize) continue;

        try {
            // 🔒 IDEMPOTENTE: solo marcamos (y por tanto premiamos) si este usuario
            // no tiene ya registrado este periodo. Si otra ejecución se adelantó,
            // findOneAndUpdate devuelve null y no pagamos otra vez.
            const claimed = await User.findOneAndUpdate(
                { _id: entry._id, lastMonthlyRewardPeriod: { $ne: period } },
                { $set: { lastMonthlyRewardPeriod: period } },
                { new: true }
            );

            if (!claimed) {
                console.log(`↩️ ${entry.username} ya recibió el premio de ${period}, se omite.`);
                continue;
            }

            await addRewards(entry._id, 0, 0, prize);
            awarded++;

            await sendPushToUser(claimed, {
                title: `🏆 ¡Premio Mensual Ranking #${i + 1}!`,
                body: `¡Felicidades! Has ganado ${prize} Fichas por quedar #${i + 1} en ${period}.`,
                icon: "/assets/icons/ficha.png",
                url: "/social/ranking"
            });

            console.log(`🎁 Premio mensual (${period}) a ${entry.username}: ${prize} fichas`);
        } catch (error) {
            console.error(`Error enviando premio a ${entry.username}`, error);
        }
    }

    return { success: true, period, awarded };
};

// --- 🔥 LÓGICA CORE DE CASTIGO (OPTIMIZADA) ---
const runNightlyMaintenance = async () => {
    console.log("🌙 EJECUTANDO MANTENIMIENTO NOCTURNO...");
    const now = new Date();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getMadridDateString(yesterday);

    try {
        const frequenciesToPunish = ['daily'];
        if (yesterday.getDay() === 0) frequenciesToPunish.push('weekly');

        const tomorrow = new Date(now);
        if (tomorrow.getDate() === 1) frequenciesToPunish.push('monthly');

        console.log(`⚔️ Evaluando ciclos: ${frequenciesToPunish.join(', ')}`);

        const failedMissions = await Mission.find({
            frequency: { $in: frequenciesToPunish },
            completed: false
        });

        if (failedMissions.length > 0) {
            const DAMAGE_RULES = { easy: 5, medium: 10, hard: 20, epic: 50 };
            const userUpdates = {};

            // Agrupar fallos
            for (const mission of failedMissions) {
                const uid = mission.user.toString();
                if (!userUpdates[uid]) userUpdates[uid] = { damage: 0, failedItems: [] };

                const dmg = DAMAGE_RULES[mission.difficulty] || 5;
                userUpdates[uid].damage += dmg;

                userUpdates[uid].failedItems.push({
                    title: mission.title,
                    coinReward: 0, xpReward: 0, gameCoinReward: 0,
                    frequency: mission.frequency,
                    difficulty: mission.difficulty,
                    type: mission.type,
                    failed: true,
                    hpLoss: dmg
                });
            }

            // 🔥 MAGIA DE ARQUITECTO: APLICAR DAÑO EN PARALELO MASIVO
            const updatePromises = Object.entries(userUpdates).map(async ([userId, data]) => {
                try {
                    const user = await User.findById(userId);
                    if (!user) return;

                    const oldHp = user.hp !== undefined ? user.hp : 100;
                    const newHp = Math.max(0, oldHp - data.damage);

                    user.hp = newHp;
                    user.lives = newHp;

                    if (data.failedItems.some(m => m.frequency === 'daily')) {
                        user.streak.current = 0;
                    }

                    // Lanzamos guardado de Usuario y Log simultáneamente
                    await Promise.all([
                        user.save(),
                        DailyLog.findOneAndUpdate(
                            { user: userId, date: yesterdayStr },
                            {
                                $push: { 'missionStats.listCompleted': { $each: data.failedItems } },
                                $inc: { 'gains.lives': -data.damage }
                            },
                            { upsert: true }
                        )
                    ]);

                    console.log(`💀 Usuario ${user.username} bajó a ${newHp} HP (-${data.damage})`);
                } catch (err) {
                    console.error(`Error castigando user ${userId}:`, err);
                }
            });

            // Esperamos a que TODOS los usuarios reciban su castigo a la vez
            await Promise.allSettled(updatePromises);

        } else {
            console.log("✨ Nadie falló misiones ayer.");
        }

        // 4. LIMPIEZA
        for (const freq of frequenciesToPunish) {
            await processCycle(freq);
        }

        return { success: true, message: "Mantenimiento ejecutado de forma óptima." };

    } catch (error) {
        console.error('❌ Error crítico en Scheduler:', error);
        return { success: false, error: error.message };
    }
};

// Función auxiliar para resetear misiones
async function processCycle(frequency) {
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayDayNum = yesterdayDate.getDay();

    const habitsResult = await Mission.updateMany(
        { frequency: frequency, type: 'habit' },
        { $set: { completed: false, progress: 0, lastUpdated: new Date() } }
    );
    if (habitsResult.modifiedCount > 0) console.log(`🔄 [${frequency}] ${habitsResult.modifiedCount} Hábitos reiniciados.`);

    const tempResult = await Mission.deleteMany({
        frequency: frequency,
        type: 'temporal',
        $or: [{ specificDays: { $size: 0 } }, { specificDays: yesterdayDayNum }]
    });
    if (tempResult.deletedCount > 0) console.log(`🗑️ [${frequency}] ${tempResult.deletedCount} Temporales borradas.`);
}

// Inicializador del CRON
const initScheduledJobs = () => {
    cron.schedule('0 4 * * *', async () => {
        await runNightlyMaintenance();
    }, { scheduled: true, timezone: "Europe/Madrid" });

    cron.schedule('0 20 * * *', async () => {
        await runEveningReminder();
    }, { scheduled: true, timezone: "Europe/Madrid" });

    cron.schedule('0 0 1 * *', async () => {
        await runMonthlyRankingRewards();
    }, { scheduled: true, timezone: "Europe/Madrid" });
};

module.exports = { initScheduledJobs, runNightlyMaintenance, runMonthlyRankingRewards };