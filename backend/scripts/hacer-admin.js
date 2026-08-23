/**
 * NOMBRAR (O QUITAR) ADMINISTRADORES
 *
 * A propósito NO hay ningún endpoint para esto. Una ruta que reparta permisos de
 * administrador es exactamente la que no debe existir: por muy bien protegida
 * que esté, es el único fallo que convierte a cualquiera en dueño de la app.
 * Se hace desde aquí, con acceso al .env, que ya implica tener las llaves.
 *
 * Uso:
 *     node backend/scripts/hacer-admin.js --usuario Mario_27
 *     node backend/scripts/hacer-admin.js --usuario Mario_27 --quitar
 *     node backend/scripts/hacer-admin.js --listar
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

const arg = (n) => {
    const i = process.argv.indexOf(n);
    return i !== -1 ? process.argv[i + 1] : null;
};

(async () => {
    await mongoose.connect(process.env.MONGO_URI);

    if (process.argv.includes('--listar')) {
        const admins = await User.find({ isAdmin: true }).select('username email').lean();
        console.log(admins.length ? 'Administradores:' : 'No hay ningún administrador todavía.');
        admins.forEach(a => console.log('   ' + a.username + '  <' + a.email + '>'));
        return await mongoose.disconnect();
    }

    const nombre = arg('--usuario');
    if (!nombre) {
        console.log('Uso: node backend/scripts/hacer-admin.js --usuario <nombre> [--quitar]');
        console.log('     node backend/scripts/hacer-admin.js --listar');
        return await mongoose.disconnect();
    }

    const quitar = process.argv.includes('--quitar');

    // Búsqueda exacta sin distinguir mayúsculas, escapando la entrada: un nombre
    // con puntos o paréntesis alteraría el patrón y podría tocar a otro usuario.
    const limpio = nombre.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOneAndUpdate(
        { username: new RegExp('^' + limpio + '$', 'i') },
        { $set: { isAdmin: !quitar } },
        { new: true }
    ).select('username isAdmin');

    if (!user) console.log('❌ No existe ningún usuario llamado "' + nombre + '"');
    else console.log((user.isAdmin ? '✅ ' : '🚫 ') + user.username + (user.isAdmin ? ' ya es administrador' : ' ya no es administrador'));

    await mongoose.disconnect();
})().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
