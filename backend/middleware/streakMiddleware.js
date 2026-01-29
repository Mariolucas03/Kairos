const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const checkStreak = asyncHandler(async (req, res, next) => {
    if (!req.user) return next();

    const userId = req.user._id;
    // Buscamos al usuario de nuevo para asegurar tener el dato más fresco de la BD
    const user = await User.findById(userId);

    if (!user) return next();

    // 1. Obtener fechas normalizadas (YYYY-MM-DD) para ignorar horas/minutos
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Manejo seguro por si es un usuario nuevo sin fecha registrada
    const lastLogDate = user.streak.lastLogDate ? new Date(user.streak.lastLogDate) : new Date(0);
    const lastLogStr = lastLogDate.toISOString().split('T')[0];

    // Calcular "Ayer"
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let changed = false;

    // 2. Lógica de Racha
    if (lastLogStr === todayStr) {
        // A. YA ENTRÓ HOY:
        // No tocamos la racha, ya se contó.
    } else if (lastLogStr === yesterdayStr) {
        // B. ENTRÓ AYER (Racha continua):
        // Es la primera vez que entra hoy -> Aumentamos racha
        user.streak.current += 1;
        user.streak.lastLogDate = now;
        changed = true;
    } else {
        // C. NO ENTRÓ AYER (Racha rota):
        // Verificamos que la fecha guardada sea realmente anterior a ayer
        // (Evita bugs si el reloj del sistema cambia)
        if (lastLogStr < yesterdayStr) {
            user.streak.current = 1; // Reseteamos a 1 (hoy es el día 1)
            user.streak.lastLogDate = now;
            changed = true;
        }
    }

    if (changed) {
        await user.save();
    }

    // Actualizamos el usuario en la request para que los controladores siguientes
    // tengan la racha actualizada
    req.user = user;

    next();
});

module.exports = { checkStreak };