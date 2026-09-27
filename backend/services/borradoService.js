const User = require('../models/User');
const Mission = require('../models/Mission');
const DailyLog = require('../models/DailyLog');
const NutritionLog = require('../models/NutritionLog');
const WorkoutLog = require('../models/WorkoutLog');
const Routine = require('../models/Routine');
const Food = require('../models/Food');
const Notification = require('../models/Notification');
const Challenge = require('../models/Challenge');
const Clan = require('../models/Clan');
const Exercise = require('../models/Exercise');
const Sabelotodo = require('../models/Sabelotodo');
const CartaAlta = require('../models/CartaAlta');
const Poker = require('../models/Poker');
const UserEventProgress = require('../models/UserEventProgress');

/**
 * BORRAR UNA CUENTA Y TODO SU RASTRO.
 *
 * Borrar solo el documento del usuario deja la base llena de basura que apunta a
 * un fantasma: entrenos sin dueño en el feed, misiones cooperativas con un
 * participante que ya no existe, "me gusta" de nadie, y sobre todo el id de la
 * persona borrada dentro de las listas de amigos de los demás. Eso último se ve:
 * la lista de amigos de otro usuario se queda con un hueco que no se puede
 * quitar.
 *
 * Por eso el borrado va por aquí y no suelto en cada sitio: lo usan tanto el
 * botón de "borrar mi cuenta" como el script de limpieza, y así no puede haber
 * dos versiones que borren cosas distintas.
 *
 * @returns {Promise<Object>} cuántos documentos se han borrado de cada sitio
 */
const borrarUsuarioYSusDatos = async (userId) => {
    const usuario = await User.findById(userId).select('username clan level');
    if (!usuario) return null;

    const resumen = { usuario: usuario.username };

    // --- 1. Lo que es suyo y de nadie más ---
    resumen.entrenos = (await WorkoutLog.deleteMany({ user: userId })).deletedCount;
    resumen.dias = (await DailyLog.deleteMany({ user: userId })).deletedCount;
    resumen.nutricion = (await NutritionLog.deleteMany({ user: userId })).deletedCount;
    resumen.rutinas = (await Routine.deleteMany({ user: userId })).deletedCount;
    resumen.alimentos = (await Food.deleteMany({ user: userId })).deletedCount;
    // Los ejercicios que se invento el, no el catalogo comun
    resumen.ejerciciosPropios = (await Exercise.deleteMany({ user: userId, isCustom: true })).deletedCount;
    resumen.eventos = (await UserEventProgress.deleteMany({ userId })).deletedCount;

    // --- 2. Misiones: las suyas, y salir de las cooperativas de otros ---
    resumen.misiones = (await Mission.deleteMany({ user: userId })).deletedCount;
    await Mission.updateMany(
        { participants: userId },
        { $pull: { participants: userId } }
    );

    // --- 3. Avisos que dio o recibió ---
    resumen.avisos = (await Notification.deleteMany({
        $or: [{ user: userId }, { actor: userId }]
    })).deletedCount;

    // --- 4. Retos en los que estuviera ---
    resumen.retos = (await Challenge.deleteMany({
        $or: [{ challenger: userId }, { opponent: userId }]
    })).deletedCount;

    // --- 4.b Partidas: las suyas se borran; las de otros se quedan sin el ---
    //
    // ⚠️ Esto no estaba: el servicio es de antes del Sabelotodo, Carta Alta y
    // el poquer. Una partida con un jugador que ya no existe se queda sin
    // poder terminar, y en la lista del otro sale un hueco sin nombre.
    resumen.partidas = 0;
    for (const [Modelo, campos] of [
        [Sabelotodo, ['jugadores.user', 'invitados.user']],
        [CartaAlta, ['jugadores.user', 'invitados']],
        [Poker, ['jugadores.user', 'invitados']]
    ]) {
        const suyas = { $or: campos.map(c => ({ [c]: userId })) };
        // Las que estan en marcha no pueden seguir sin el: se borran enteras
        resumen.partidas += (await Modelo.deleteMany({ ...suyas, estado: { $in: ['invitacion', 'sala', 'activa'] } })).deletedCount;
        // De las terminadas solo se le quita a el, que el historial del otro
        // sigue siendo suyo
        await Modelo.updateMany(suyas, {
            $pull: {
                jugadores: { user: userId },
                invitados: campos.includes('invitados') ? userId : { user: userId }
            }
        }).catch(() => { });
    }

    // --- 5. Su rastro en el contenido de OTROS ---
    // Los "me gusta" y comentarios que dejó en entrenos ajenos: si se quedan,
    // el feed intenta pintar el nombre de alguien que ya no existe.
    const enEntrenosAjenos = await WorkoutLog.updateMany(
        { $or: [{ likes: userId }, { 'comments.user': userId }] },
        { $pull: { likes: userId, comments: { user: userId } } }
    );
    resumen.rastroEnOtros = enEntrenosAjenos.modifiedCount;

    // --- 6. Su id dentro de los demás usuarios ---
    // Amigos, solicitudes recibidas e invitaciones. Sin esto, la lista de amigos
    // de otra persona se queda con un hueco imposible de quitar desde la app.
    // Y los premios de clan que reclamo, que apuntan a su id.
    const enOtrosUsuarios = await User.updateMany(
        {
            $or: [
                { friends: userId },
                { friendRequests: userId }
            ]
        },
        { $pull: { friends: userId, friendRequests: userId } }
    );
    resumen.enListasDeOtros = enOtrosUsuarios.modifiedCount;

    await Clan.updateMany(
        { 'weeklyEvent.claims.user': userId },
        { $pull: { 'weeklyEvent.claims': { user: userId } } }
    );

    // --- 7. Clan ---
    if (usuario.clan) {
        const clan = await Clan.findById(usuario.clan);
        if (clan) {
            await Clan.findByIdAndUpdate(clan._id, {
                $pull: { members: userId },
                $inc: { totalPower: -((usuario.level || 1) * 100) }
            });

            const actualizado = await Clan.findById(clan._id);

            // Un clan sin nadie dentro no debe quedarse ocupando sitio en el
            // ranking de clanes.
            if (!actualizado?.members?.length) {
                await Clan.findByIdAndDelete(clan._id);
                resumen.clanBorrado = clan.name;
            } else if (actualizado.leader?.toString() === userId.toString()) {
                // Si se va el líder pero queda gente, manda el primero que quede:
                // un clan sin líder no se puede administrar ni disolver.
                const heredero = actualizado.members[0];
                await Clan.findByIdAndUpdate(clan._id, { $set: { leader: heredero } });
                await User.findByIdAndUpdate(heredero, { $set: { clanRank: 'dios' } });
                resumen.nuevoLider = heredero.toString();
            }
        }
    }

    // --- 8. Y por último, la cuenta ---
    await User.findByIdAndDelete(userId);

    return resumen;
};

module.exports = { borrarUsuarioYSusDatos };
