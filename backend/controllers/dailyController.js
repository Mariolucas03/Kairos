const asyncHandler = require('express-async-handler');
const DailyLog = require('../models/DailyLog');
const Mission = require('../models/Mission');
const NutritionLog = require('../models/NutritionLog');
const { getMadridDateString } = require('../utils/dateHelpers');

// ⚠️ ANTES: new Date().toISOString().split('T')[0], que da la fecha en UTC.
// Entre las 00:00 y las 02:00 de Madrid eso es AYER, así que todo lo que
// registrabas de madrugada (ánimo, peso, sueño, pasos) se guardaba en el día
// anterior, y encima no cuadraba con foodController/gymController, que ya
// usaban la fecha de Madrid: el log del día y el de nutrición apuntaban a
// documentos distintos y los totales nunca se sincronizaban.
const getServerDateString = () => getMadridDateString();

const ensureDailyLog = async (userId, dateString, userStreak) => {
    // ⚠️ new Date('2026-08-03') se interpreta como medianoche UTC, y getDay()
    // devuelve el día en la zona del servidor: con cualquier desfase negativo
    // salía el día ANTERIOR y se contaban las misiones del día equivocado.
    // Al fijar el mediodía, ningún huso horario puede cambiar el día.
    const dateObj = new Date(`${dateString}T12:00:00`);
    const dayOfWeek = dateObj.getDay();

    const missionQuery = {
        $and: [
            { $or: [{ user: userId }, { participants: userId }] },
            { frequency: 'daily' },
            { $or: [{ specificDays: { $size: 0 } }, { specificDays: dayOfWeek }] },
            { $or: [{ isCoop: false }, { isCoop: true, invitationStatus: 'active' }] }
        ]
    };

    const [activeCount, lastLog, nutritionLog] = await Promise.all([
        Mission.countDocuments(missionQuery),
        DailyLog.findOne({ user: userId }).sort({ date: -1 }).select('weight').lean(),
        NutritionLog.findOne({ user: userId, date: dateString }).lean()
    ]);

    const persistentWeight = lastLog ? lastLog.weight : 0;
    const currentKcal = nutritionLog ? nutritionLog.totalCalories : 0;

    let log = await DailyLog.findOneAndUpdate(
        { user: userId, date: dateString },
        {
            $setOnInsert: {
                user: userId, date: dateString, weight: persistentWeight, streakCurrent: userStreak,
                nutrition: { totalKcal: currentKcal },
                missionStats: { completed: 0, total: activeCount, listCompleted: [] },
                gains: { coins: 0, xp: 0, lives: 0 }
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    let needsSave = false;

    if (log.missionStats.total !== activeCount) {
        log.missionStats.total = activeCount;
        if (log.missionStats.completed > activeCount) log.missionStats.completed = activeCount;
        needsSave = true;
    }

    if (log.nutrition.totalKcal !== currentKcal) {
        log.nutrition.totalKcal = currentKcal;
        needsSave = true;
    }

    if (needsSave) await log.save();

    return { log, nutritionLog };
};

const getDailyLog = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const targetDate = req.query.date || getServerDateString();
    const { log, nutritionLog } = await ensureDailyLog(userId, targetDate, req.user.streak.current);
    const logObj = log.toObject();
    if (nutritionLog) {
        logObj.nutrition = { ...logObj.nutrition, meals: nutritionLog.meals, totalKcal: nutritionLog.totalCalories, totalProtein: nutritionLog.totalProtein, totalCarbs: nutritionLog.totalCarbs, totalFat: nutritionLog.totalFat, totalFiber: nutritionLog.totalFiber };
    }
    res.status(200).json(logObj);
});

const getDailyLogByDate = asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!date) { res.status(400); throw new Error('Falta fecha'); }
    const log = await DailyLog.findOne({ user: req.user._id, date: date }).lean();
    if (log) {
        const nutritionLog = await NutritionLog.findOne({ user: req.user._id, date: date }).lean();
        if (nutritionLog) log.nutrition = { ...log.nutrition, meals: nutritionLog.meals, totalKcal: nutritionLog.totalCalories };
        res.status(200).json(log);
    } else { res.status(200).json(null); }
});

const updateDailyLog = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { type, value, date } = req.body;
    const targetDate = date || req.query.date || getServerDateString();
    let { log } = await ensureDailyLog(userId, targetDate, req.user.streak.current);

    // ⚠️ Los CAMPOS ya estaban filtrados, pero no los VALORES.
    //
    // Number('abc') puesto en un campo numerico de Mongoose revienta con un error
    // 500 en la cara del usuario, y un numero enorme se guarda tal cual: 99.999 kg
    // de peso corporal, dos millones de pasos, cuarenta horas de sueno. Eso no es
    // solo feo en la grafica: el peso es lo que usa el gimnasio para calcular
    // cuanto mueves en los ejercicios de peso corporal, y las calorias de una
    // sesion salen tambien de ahi.
    const numeroEnRango = (v, min, max) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return null;
        return Math.min(Math.max(n, min), max);
    };

    switch (type) {
        // El animo es un texto corto elegido en pantalla, no un campo libre
        case 'mood': log.mood = value === null ? null : String(value).slice(0, 40); break;

        // Una persona pesa entre 20 y 500 kg. Fuera de ahi no hay nada que medir.
        case 'weight': log.weight = numeroEnRango(value, 20, 500); break;

        case 'sleepHours': log.sleepHours = numeroEnRango(value, 0, 24); break;

        // 200.000 pasos son unos 150 km andando: imposible en un dia
        case 'steps': log.steps = numeroEnRango(value, 0, 200000) ?? 0; break;

        // ⚠️ streakCurrent SE QUITA de la lista. Es un reflejo de la racha real
        // del usuario, que copia ensureDailyLog al crear el dia; dejar que el
        // cliente la escriba solo servia para ensenar una racha falsa en el
        // registro de ese dia sin haberla hecho.

        // Solo las claves conocidas y numericas: antes se volcaba el objeto
        // entero que mandara el cliente dentro de nutrition.
        case 'nutrition': {
            const limpio = {};
            for (const clave of ['totalKcal', 'protein', 'carbs', 'fat', 'fiber']) {
                if (value?.[clave] !== undefined) limpio[clave] = numeroEnRango(value[clave], 0, 30000) ?? 0;
            }
            log.nutrition = { ...log.nutrition, ...limpio };
            break;
        }
        // 🔒 'sport', 'training', 'missions' y 'gains' NO son editables por el cliente:
        // los gestiona el servidor (gymController con $push, levelService/missionController
        // con $inc) porque alimentan premios reales (ranking mensual, ranking de clanes).
        // Dejarlos aquí permitía a cualquiera mandar PUT /api/daily {type:'gains', value:{xp:9e9}}
        // y ganar el premio mensual/de clan de forma fraudulenta.
        default: res.status(400); throw new Error('Campo no editable'); // 🔥 solo se permiten los campos listados arriba
    }
    await log.save();
    const logObj = log.toObject();
    logObj.totalKcal = log.nutrition.totalKcal;
    res.status(200).json(logObj);
});

const getWeightHistory = asyncHandler(async (req, res) => {
    const logs = await DailyLog.find({ user: req.user._id, weight: { $gt: 0 } }).sort({ date: 1 }).select('date weight').lean();
    res.status(200).json(logs);
});

/**
 * Mapa de actividad de los últimos meses, un cuadradito por día.
 *
 * Devuelve solo lo justo para pintarlo —fecha y nivel de 0 a 4— y no los
 * registros enteros: son ~180 documentos con entrenos, comidas y misiones
 * dentro, y mandarlos completos para colorear cuadraditos es varios cientos de
 * kilobytes por una pantalla que se mira dos segundos.
 *
 * El nivel mezcla las tres cosas que cuentan como "hoy hice algo": entrenar,
 * completar misiones y registrar comida. Un mapa que solo mirara los entrenos
 * dejaría en blanco los días de descanso en los que sí cumpliste todo lo demás,
 * que es justo lo contrario de lo que anima a seguir.
 *
 * @route GET /api/daily/actividad?dias=180
 */
const getActividad = asyncHandler(async (req, res) => {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 180, 30), 400);

    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    const desdeStr = getMadridDateString(desde);

    // ⚠️ La nutricion se lee de NutritionLog y NO del campo copiado dentro de
    // DailyLog: ese solo se rellena al crear el dia y despues nadie lo vuelve a
    // tocar, asi que al probarlo con datos reales el mapa daba 12 dias activos a
    // alguien que tenia 47 dias con comida registrada. Un mapa de constancia que
    // se deja fuera dos tercios de lo que hiciste desanima en vez de animar.
    const [registros, nutricion] = await Promise.all([
        DailyLog.find({ user: req.user._id, date: { $gte: desdeStr } })
            .select('date missionStats gymWorkouts sportWorkouts').lean(),
        NutritionLog.find({ user: req.user._id, date: { $gte: desdeStr } })
            .select('date totalCalories').lean()
    ]);

    const kcalPorDia = {};
    for (const n of nutricion) kcalPorDia[n.date] = n.totalCalories || 0;

    const mapa = registros.map(r => {
        const entrenos = (r.gymWorkouts?.length || 0) + (r.sportWorkouts?.length || 0);
        const misiones = r.missionStats?.completed || 0;
        const comio = (kcalPorDia[r.date] || 0) > 0;

        // Un entreno pesa más que una misión suelta: es lo que de verdad cuesta.
        let puntos = entrenos * 2 + misiones + (comio ? 1 : 0);

        return {
            fecha: r.date,
            nivel: puntos === 0 ? 0 : Math.min(4, Math.ceil(puntos / 2)),
            entrenos,
            misiones
        };
    }).filter(d => d.nivel > 0);

    res.json({
        desde: desdeStr,
        dias,
        activos: mapa.length,
        mapa
    });
});

module.exports = {
    getActividad, getDailyLog, getDailyLogByDate, updateDailyLog, getWeightHistory };