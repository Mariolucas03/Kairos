const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const checkStreak = asyncHandler(async (req, res, next) => {
    if (!req.user) return next();

    const userId = req.user._id;

    // Obtenemos fecha actual normalizada (00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Obtenemos último log del usuario
    const user = await User.findById(userId);
    const lastLogDate = new Date(user.streak.lastLogDate);
    lastLogDate.setHours(0, 0, 0, 0);

    // Diferencia en milisegundos
    const diffTime = Math.abs(today - lastLogDate);
    // Convertir a días
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Si pasaron más de 1 día (ayer), reseteamos racha
    if (diffDays > 1) {
        user.streak.current = 1; // Reseteamos a 1 porque hoy cuenta
        // user.hp -= 10; // Opcional: Castigo de vida
        await user.save();
        req.user = user; // Actualizamos req.user para el controlador
    } else if (diffDays === 1) {
        // Es consecutivo, el controlador sumará +1 si crea el log hoy
    }

    user.streak.lastLogDate = Date.now();
    await user.save();

    next();
});

module.exports = { checkStreak };