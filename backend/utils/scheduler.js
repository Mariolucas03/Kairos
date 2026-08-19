const cron = require('node-cron');
const Mission = require('../models/Mission');
const User = require('../models/User');
const DailyLog = require('../models/DailyLog');
const { sendPushToUser } = require('../controllers/pushController');
const { addRewards } = require('../services/levelService');
const { getMonthlyRanking, MONTHLY_PRIZES } = require('../services/rankingService');
const { getMadridDateString, getMadridMonthString } = require('./dateHelpers');
const SystemState = require('../models/SystemState');

// Clave donde se anota el ULTIMO dia ya castigado, para no castigar dos veces
const CLAVE_NOCTURNO = 'nightly-maintenance';
// Lo mismo para el aviso de las 20:00: marca el ultimo dia ya avisado
const CLAVE_RECORDATORIO = 'evening-reminder';

// Vida que cuesta fallar cada mision. Vive aqui arriba porque la usan los DOS:
// el castigo de la noche y el aviso de las 20:00, que anuncia exactamente lo
// que se va a perder. Si estuviera duplicada, cambiar una tabla y no la otra
// haria que el aviso mintiera.
const DAMAGE_RULES = { easy: 5, medium: 10, hard: 20, epic: 50 };

// --- Recordatorio de las 20:00 ---
/**
 * Avisa de las misiones que quedan sin marcar y de la vida que cuesta no
 * hacerlas.
 *
 * Tenia el MISMO problema que el mantenimiento nocturno: el cron interno se
 * programa a las 20:00, pero en el plan gratuito de Render la instancia esta
 * dormida salvo que alguien este usando la app, y un proceso dormido no
 * ejecuta crons. El aviso no salia practicamente nunca. Por eso ahora se puede
 * disparar desde fuera (GET /api/cron/evening-reminder).
 *
 * Se anota el dia ya avisado: un cron externo que reintente, o dos crons
 * solapados, no pueden mandar dos veces la misma notificacion.
 */
const runEveningReminder = async ({ forzar = false } = {}) => {
    const hoy = getMadridDateString();

    if (!forzar) {
        const marca = await SystemState.findOne({ key: CLAVE_RECORDATORIO }).lean();
        if (marca?.value === hoy) {
            console.log('✅ El aviso de las 20:00 del ' + hoy + ' ya se mando, no se repite.');
            return { saltado: true, dia: hoy };
        }
    }

    console.log('🔔 Ejecutando recordatorio de misiones (20:00)...');

    const usuarios = await User.find({
        pushSubscriptions: { $exists: true, $not: { $size: 0 } }
    }).select('username pushSubscriptions');

    const diaSemana = new Date().getDay();
    let avisados = 0;

    const envios = usuarios.map(async (user) => {
        const pendientes = await Mission.find({
            frequency: 'daily',
            completed: false,
            invitationStatus: { $ne: 'pending' },
            $and: [
                { $or: [{ user: user._id }, { participants: user._id }] },
                { $or: [{ specificDays: { $size: 0 } }, { specificDays: diaSemana }] }
            ]
        }).select('difficulty').lean();

        if (pendientes.length === 0) return;

        // El daño REAL que se juega, con la misma tabla que aplica el castigo.
        // "Perderas HP" sin decir cuanto no ayuda a decidir si merece la pena
        // levantarse del sofa; "perderas 50 HP" si.
        const dano = pendientes.reduce((total, m) => total + (DAMAGE_RULES[m.difficulty] || 5), 0);
        const plural = pendientes.length === 1 ? 'misión' : 'misiones';

        await sendPushToUser(user, {
            title: '⚠️ Te quedan ' + pendientes.length + ' ' + plural,
            body: 'Complétalas antes de medianoche o perderás ' + dano + ' HP.',
            icon: '/assets/icons/corazon.png',
            url: '/missions'
        });
        avisados++;
    });

    await Promise.allSettled(envios);

    await SystemState.updateOne(
        { key: CLAVE_RECORDATORIO },
        { $set: { value: hoy, updatedAt: new Date() } },
        { upsert: true }
    );

    console.log('📨 Aviso de las 20:00: ' + avisados + ' avisados de ' + usuarios.length + ' con notificaciones activas.');
    return { success: true, dia: hoy, avisados, candidatos: usuarios.length };
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
/**
 * El castigo NO es idempotente por si solo: ejecutado dos veces para el mismo
 * dia, quita la vida dos veces. Esta marca en base de datos es lo que permite
 * lanzarlo al arrancar el servidor sin miedo.
 */
const yaCastigado = async (fecha) => {
    const marca = await SystemState.findOne({ key: CLAVE_NOCTURNO }).lean();
    return marca?.value === fecha;
};

const anotarCastigo = async (fecha) => {
    await SystemState.updateOne(
        { key: CLAVE_NOCTURNO },
        { $set: { value: fecha, updatedAt: new Date() } },
        { upsert: true }
    );
};

const runNightlyMaintenance = async ({ forzar = false } = {}) => {
    console.log("🌙 EJECUTANDO MANTENIMIENTO NOCTURNO...");
    const now = new Date();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getMadridDateString(yesterday);

    // Render reinicia la instancia a menudo; sin esta guarda, lanzarlo al
    // arrancar castigaria de nuevo en cada reinicio.
    if (!forzar && await yaCastigado(yesterdayStr)) {
        console.log('✅ El dia ' + yesterdayStr + ' ya estaba castigado, no se repite.');
        return { saltado: true, dia: yesterdayStr };
    }

    try {
        const frequenciesToPunish = ['daily'];
        if (yesterday.getDay() === 0) frequenciesToPunish.push('weekly');
        // El día 1 castigamos el mes que acaba de cerrarse
        if (now.getDate() === 1) frequenciesToPunish.push('monthly');

        console.log(`⚔️ Evaluando ciclos: ${frequenciesToPunish.join(', ')}`);

        // Inicio de ayer, para no castigar misiones creadas después
        const inicioDeAyer = new Date(yesterday);
        inicioDeAyer.setHours(0, 0, 0, 0);
        const diaDeAyer = yesterday.getDay();

        const failedMissions = await Mission.find({
            frequency: { $in: frequenciesToPunish },
            completed: false,

            // ⚠️ ESTO FALTABA: se castigaban TODAS las misiones sin completar,
            // sin mirar si tocaban ayer. Una misión puesta solo para lunes y
            // miércoles te quitaba vida los siete días de la semana. El reinicio
            // sí filtraba por `specificDays`; el castigo no.
            $or: [
                { specificDays: { $size: 0 } },
                { specificDays: { $exists: false } },
                { specificDays: diaDeAyer }
            ],

            // Una misión creada hoy no puede haberse fallado ayer
            createdAt: { $lte: inicioDeAyer },

            // Una invitación coop sin aceptar no es tuya todavía
            invitationStatus: { $ne: 'pending' }
        });

        if (failedMissions.length > 0) {
            const userUpdates = {};

            // Agrupar fallos. En las misiones coop aceptadas el daño lo reciben
            // TODOS los participantes, no solo quien la creó.
            for (const mission of failedMissions) {
                const dmg = DAMAGE_RULES[mission.difficulty] || 5;

                const affected = (mission.isCoop && mission.invitationStatus === 'active' && mission.participants?.length)
                    ? mission.participants.map(p => p.toString())
                    : [mission.user.toString()];

                for (const uid of new Set(affected)) {
                    if (!userUpdates[uid]) userUpdates[uid] = { damage: 0, failedItems: [] };
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

                    // La vida bajaba de madrugada y el usuario se encontraba el
                    // destrozo sin saber de que. Se avisa con el detalle.
                    const cuantas = data.failedItems.length;
                    const plural = cuantas === 1 ? 'misión' : 'misiones';
                    await sendPushToUser(user, newHp === 0 ? {
                        title: '💀 Te has quedado sin vida',
                        body: 'Fallaste ' + cuantas + ' ' + plural + ' y has perdido todo el HP.',
                        icon: '/assets/icons/corazon.png',
                        url: '/missions'
                    } : {
                        title: '💔 Has perdido ' + data.damage + ' HP',
                        body: cuantas + ' ' + plural + ' sin cumplir. Te quedan ' + newHp + ' HP.',
                        icon: '/assets/icons/corazon.png',
                        url: '/missions'
                    });

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

        // Se anota SOLO si todo fue bien: si algo revienta a medias, el proximo
        // intento vuelve a entrar en vez de dar el dia por castigado.
        await anotarCastigo(yesterdayStr);

        return { success: true, message: "Mantenimiento ejecutado de forma óptima.", dia: yesterdayStr };

    } catch (error) {
        console.error('❌ Error crítico en Scheduler:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Se llama al arrancar el servidor.
 *
 * El cron interno esta programado a las 03:00 de Madrid, pero en el plan
 * gratuito de Render la instancia esta DORMIDA a esa hora: un proceso dormido
 * no ejecuta crons. Resultado: el castigo por misiones no cumplidas no corria
 * NUNCA y la vida no bajaba nunca.
 *
 * Al despertar, se comprueba si el dia de ayer ya se castigo y, si no, se
 * castiga. Asi la app se cura sola en cuanto alguien la abre, sin depender de
 * que haya un cron externo configurado.
 */
// Promesa de la puesta al dia en curso. Las peticiones la esperan, asi que
// cuando el usuario recibe sus datos el castigo YA esta aplicado.
let puestaAlDiaEnCurso = null;

/**
 * Devuelve la promesa de la puesta al dia, o una ya resuelta si no hay nada
 * pendiente. Es lo que permite que /users y /daily no contesten con la vida
 * antigua.
 */
const esperarPuestaAlDia = () => puestaAlDiaEnCurso || Promise.resolve();

const ponerseAlDia = () => {
    // ⚠️ La promesa se asigna AQUI, de forma sincrona, no dentro del cuerpo
    // asincrono. Si se asignara despues de comprobar si hace falta castigar,
    // una peticion que llegara en ese instante veria `null`, pasaria de largo y
    // devolveria la vida antigua: justo la carrera que esto viene a evitar.
    puestaAlDiaEnCurso = (async () => {
        try {
            const ayer = new Date();
            ayer.setDate(ayer.getDate() - 1);
            const ayerStr = getMadridDateString(ayer);

            if (await yaCastigado(ayerStr)) return;

            console.log('⏰ El mantenimiento de ' + ayerStr + ' no se habia ejecutado. Poniendose al dia...');
            await runNightlyMaintenance();
        } catch (e) {
            console.error('No se pudo poner al dia el mantenimiento:', e.message);
        }
    })();

    return puestaAlDiaEnCurso;
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
    // 03:00 de Madrid: el castigo por misiones no marcadas del día anterior
    cron.schedule('0 3 * * *', async () => {
        await runNightlyMaintenance();
    }, { scheduled: true, timezone: "Europe/Madrid" });

    cron.schedule('0 20 * * *', async () => {
        await runEveningReminder();
    }, { scheduled: true, timezone: "Europe/Madrid" });

    cron.schedule('0 0 1 * *', async () => {
        await runMonthlyRankingRewards();
    }, { scheduled: true, timezone: "Europe/Madrid" });
};

module.exports = { initScheduledJobs, runNightlyMaintenance, runMonthlyRankingRewards, runEveningReminder, ponerseAlDia, esperarPuestaAlDia };