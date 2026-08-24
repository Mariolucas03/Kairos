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
