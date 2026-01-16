const cron = require('node-cron');
const Mission = require('../models/Mission');
const User = require('../models/User');
const DailyLog = require('../models/DailyLog');
const { sendPushToUser } = require('../controllers/pushController');
const { addRewards } = require('../services/levelService'); // Importamos para sumar recompensas de forma segura

// Función auxiliar para obtener fecha en String (Zona horaria Madrid)
const getMadridDateString = (dateObj) => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(dateObj);
};

// --- 🔥 NUEVA FUNCIÓN: Recordatorio Nocturno (20:00) ---
const runEveningReminder = async () => {
    console.log("🔔 Ejecutando recordatorio de misiones (20:00)...");

    // Buscamos usuarios que tengan suscripciones push activas
    const usersToWarn = await User.find({
        pushSubscriptions: { $exists: true, $not: { $size: 0 } }
    });

    for (const user of usersToWarn) {
        // Verificar misiones de HOY pendientes
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
                icon: "/assets/icons/icon-192x192.png", // Asegúrate de que esta ruta coincida con tu frontend
                url: "/missions" // Al hacer clic va a misiones
            };
            await sendPushToUser(user, payload);
            console.log(`📨 Notificación enviada a ${user.username}`);
        }
    }
};

// --- 🔥 NUEVA FUNCIÓN: PREMIOS MENSUALES RANKING ---
const runMonthlyRankingRewards = async () => {
    console.log("🏆 Ejecutando premios mensuales del ranking...");

    // Obtener Top 3 Global por Nivel y XP
    const topUsers = await User.find({})
        .sort({ level: -1, currentXP: -1 })
        .limit(3);

    const PRIZES = [10000, 5000, 2500]; // 1º, 2º, 3º

    for (let i = 0; i < topUsers.length; i++) {
        const user = topUsers[i];
        const prize = PRIZES[i];

        if (!user) continue;

        try {
            // Usamos el servicio de niveles para sumar de forma segura y subir nivel si aplica
            await addRewards(user._id, 0, 0, prize);

            // Notificación Push al ganador
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

// --- LÓGICA CORE DE CASTIGO (SEPARADA) ---
const runNightlyMaintenance = async () => {
    console.log("🌙 EJECUTANDO MANTENIMIENTO NOCTURNO (MANUAL O CRON)...");
    const now = new Date();

    // 1. "Ayer" (El día que estamos evaluando)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getMadridDateString(yesterday);

    try {
        // 2. ¿QUÉ CICLOS VENCIERON?
        const frequenciesToPunish = ['daily'];
        if (yesterday.getDay() === 0) frequenciesToPunish.push('weekly');

        const tomorrow = new Date(now);
        if (tomorrow.getDate() === 1) frequenciesToPunish.push('monthly');

        console.log(`⚔️ Evaluando ciclos: ${frequenciesToPunish.join(', ')}`);

        // 3. BUSCAR MISIONES FALLIDAS (No completadas)
        const failedMissions = await Mission.find({
            frequency: { $in: frequenciesToPunish },
            completed: false
        });

        if (failedMissions.length > 0) {
            const DAMAGE_RULES = { easy: 5, medium: 10, hard: 20, epic: 50 };
            const userUpdates = {};

            // Agrupar fallos por usuario
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

            // APLICAR DAÑO A CADA USUARIO
            for (const [userId, data] of Object.entries(userUpdates)) {
                try {
                    const user = await User.findById(userId);
                    if (user) {
                        const oldHp = user.hp !== undefined ? user.hp : 100;
                        const newHp = Math.max(0, oldHp - data.damage);

                        user.hp = newHp;
                        user.lives = newHp;

                        if (data.failedItems.some(m => m.frequency === 'daily')) {
                            user.streak.current = 0;
                        }

                        await user.save();
                        console.log(`💀 Usuario ${user.username} bajó a ${newHp} HP (-${data.damage})`);

                        await DailyLog.findOneAndUpdate(
                            { user: userId, date: yesterdayStr },
                            {
                                $push: { 'missionStats.listCompleted': { $each: data.failedItems } },
                                $inc: { 'gains.lives': -data.damage }
                            },
                            { upsert: true }
                        );
                    }
                } catch (err) {
                    console.error(`Error castigando user ${userId}:`, err);
                }
            }
        } else {
            console.log("✨ Nadie falló misiones ayer.");
        }

        // 4. LIMPIEZA
        for (const freq of frequenciesToPunish) {
            await processCycle(freq);
        }

        return { success: true, message: "Mantenimiento ejecutado." };

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
    // 1. Mantenimiento Nocturno (Castigo) a las 4 AM
    cron.schedule('0 4 * * *', async () => {
        await runNightlyMaintenance();
    }, { scheduled: true, timezone: "Europe/Madrid" });

    // 2. Recordatorio a las 20:00 PM
    cron.schedule('0 20 * * *', async () => {
        await runEveningReminder();
    }, { scheduled: true, timezone: "Europe/Madrid" });

    // 3. 🔥 Premios Mensuales (Día 1 de cada mes a las 00:00)
    cron.schedule('0 0 1 * *', async () => {
        await runMonthlyRankingRewards();
    }, { scheduled: true, timezone: "Europe/Madrid" });
};

module.exports = { initScheduledJobs, runNightlyMaintenance };