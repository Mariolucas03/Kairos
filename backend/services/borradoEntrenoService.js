const WorkoutLog = require('../models/WorkoutLog');
const DailyLog = require('../models/DailyLog');
const Routine = require('../models/Routine');
const Notification = require('../models/Notification');
const { quitarXp } = require('./levelService');
const { revisarSubidasDeRango } = require('./rankUpService');
const { getMadridDateString } = require('../utils/dateHelpers');

/**
 * BORRAR UN ENTRENO Y TODO LO QUE DEJÓ POR AHÍ.
 *
 * ⚠️ BORRAR EL DOCUMENTO NO ERA BORRAR EL ENTRENO.
 *
 * Antes esto quitaba el `WorkoutLog` y sus avisos del buzón, y ya. Pero un
 * entreno, al guardarse, escribe en cinco sitios más, y los que son COPIAS se
 * quedaban:
 *
 *   - El registro del día (`DailyLog.gymWorkouts`), que es lo que pinta el
 *     inicio y el mapa de constancia: el entreno borrado seguía ahí.
 *   - El XP que pagó, que además sube de nivel.
 *   - `Routine.lastPerformed`, o sea "cuándo hiciste esta rutina por última
 *     vez", que seguía apuntando a una sesión que ya no existe.
 *   - Los rangos musculares, que salen del volumen.
 *
 * Lo que SÍ se arregla solo son las estadísticas que se calculan leyendo los
 * entrenos (volumen semanal, marcas, gráficas, mapa del cuerpo): al no estar
 * el documento, dejan de contarlo. Aquí solo hay que deshacer lo copiado.
 *
 * ⚠️ Y HAY QUE DEVOLVER EL XP, NO ES OPCIONAL.
 *
 * Si borrar dejara el XP puesto, guardar un entreno, borrarlo y volverlo a
 * guardar sería una impresora de experiencia. El XP se calcula igual que al
 * darlo (sale de las calorías del propio entreno, que están guardadas), así
 * que se puede deshacer exacto aunque el entreno sea de hace meses.
 */

/** El XP que pagó este entreno. Misma fórmula que al guardarlo. */
const xpQueDio = (log) => Math.max(5, Math.ceil((log.caloriesBurned || 0) * 0.50));

/** Reconstruye el día a partir de los entrenos que QUEDAN. */
const rehacerElDia = async (userId, fecha) => {
    const dia = getMadridDateString(fecha);

    // El día entero en hora de Madrid, que es con la que se guardan los días.
    const desde = new Date(`${dia}T00:00:00.000Z`);
    desde.setUTCHours(desde.getUTCHours() - 2);          // Madrid va por delante
    const hasta = new Date(desde.getTime() + 26 * 3600 * 1000);

    const quedan = await WorkoutLog.find({
        user: userId,
        date: { $gte: desde, $lte: hasta }
    }).lean();

    // ⚠️ Se RECONSTRUYE en vez de quitar la entrada concreta. El registro del
    // día no guarda a qué entreno corresponde cada línea, así que buscarla
    // sería adivinar por nombre y hora. Rehacerla desde los entrenos que
    // quedan es exacto, y de paso repara los días que ya estuvieran
    // descuadrados.
    const delDia = quedan.filter(l => getMadridDateString(l.date) === dia);

    const gymWorkouts = delDia.filter(l => l.type === 'gym').map(l => ({
        name: l.routineName,
        duration: l.duration,
        caloriesBurned: l.caloriesBurned,
        intensity: l.intensity || 'Media',
        exercises: (l.exercises || []).map(ex => ({
            name: ex.name,
            sets: (ex.sets || []).map(s => ({ weight: s.weight, reps: s.reps }))
        })),
        timestamp: l.date
    }));

    const sportWorkouts = delDia.filter(l => l.type === 'sport').map(l => ({
        routineName: l.routineName,
        duration: Math.round((l.duration || 0) / 60),
        intensity: l.intensity,
        distance: l.distance,
        caloriesBurned: l.caloriesBurned,
        timestamp: l.date
    }));

    await DailyLog.updateOne(
        { user: userId, date: dia },
        { $set: { gymWorkouts, sportWorkouts } }
    );

    return { gymWorkouts: gymWorkouts.length, sportWorkouts: sportWorkouts.length };
};

/** Deja `lastPerformed` en la última vez que SÍ se hizo esa rutina. */
const recolocarLaRutina = async (userId, routineId) => {
    if (!routineId) return;

    const ultimo = await WorkoutLog.findOne({ user: userId, routine: routineId })
        .sort({ date: -1 }).select('date').lean();

    await Routine.updateOne(
        { _id: routineId, user: userId },
        { $set: { lastPerformed: ultimo ? ultimo.date : null } }
    );
};

/**
 * @returns {Promise<{ok: boolean, motivo?: string, xpDevuelto?: number}>}
 */
const borrarEntreno = async (workoutId, userId) => {
    const log = await WorkoutLog.findById(workoutId).lean();
    if (!log) return { ok: false, motivo: 'no-existe' };
    if (log.user.toString() !== userId.toString()) return { ok: false, motivo: 'no-es-tuyo' };

    const xp = xpQueDio(log);

    // Primero fuera el entreno: todo lo que viene detrás se calcula a partir
    // de los que QUEDAN, así que el orden importa.
    await WorkoutLog.deleteOne({ _id: workoutId });

    // Los avisos que lo anunciaban apuntan a algo que ya no está: dejarlos
    // llena el buzón de la gente de entradas que no llevan a ningún sitio.
    await Notification.deleteMany({ workout: workoutId });

    await rehacerElDia(userId, log.date);
    await recolocarLaRutina(userId, log.routine);

    const { quitado } = await quitarXp(userId, xp);

    // El XP del día también se apuntó: es de donde salen el ranking mensual y
    // el evento de clan "Era de Sabiduría".
    await DailyLog.updateOne(
        { user: userId, date: getMadridDateString(log.date) },
        { $inc: { 'gains.xp': -quitado } }
    );

    // Los rangos salen del volumen, que acaba de bajar. Se vuelven a anotar
    // para que el número guardado no se quede por encima del real.
    await revisarSubidasDeRango(userId);

    return { ok: true, xpDevuelto: quitado };
};

module.exports = { borrarEntreno, xpQueDio };
