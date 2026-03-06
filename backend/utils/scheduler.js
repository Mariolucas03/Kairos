const cron = require('node-cron');
const Mission = require('../models/Mission');
const User = require('../models/User');
const DailyLog = require('../models/DailyLog');
const { sendPushToUser } = require('../controllers/pushController');
const { addRewards } = require('../services/levelService');

// Función auxiliar para obtener fecha en String (Zona horaria Madrid)
const getMadridDateString = (dateObj) => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(dateObj);
};

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
const runMonthlyRankingRewards = async () => {
    console.log("🏆 Ejecutando premios mensuales del ranking...");

    const topUsers = await User.find({})
        .sort({ level: -1, currentXP: -1 })
        .limit(3);

    const PRIZES = [10000, 5000, 2500];

    // Mantenemos secuencial porque son solo 3 y addRewards es complejo
    for (let i = 0; i < topUsers.length; i++) {
        const user = topUsers[i];
        const prize = PRIZES[i];

        if (!user) continue;

        try {
            await addRewards(user._id, 0, 0, prize);
            const payload = {
                title: `🏆 ¡Premio Mensual Ranking #${i + 1}!`,
                body: `¡Felicidades! Has ganado ${prize} Fichas por ser de los mejores este mes.`,
                icon: "/assets/icons/ficha.png",
                url: "/social"
            };
            await sendPushToUser(user, payload);
            console.log(`🎁 Premio mensual enviado a ${user.username}: ${prize} fichas`);
        } catch (error) {
            console.error(`Error enviando premio a ${user.username}`, error);
        }
    }
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

module.exports = { initScheduledJobs, runNightlyMaintenance };