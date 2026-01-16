const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const webpush = require('web-push');

// Configuración inicial (se ejecuta al cargar el archivo)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.MAILTO_URL,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// @desc    Guardar suscripción del navegador
// @route   POST /api/push/subscribe
const subscribeToPush = asyncHandler(async (req, res) => {
    const subscription = req.body;
    const userId = req.user._id;

    // Usamos $addToSet para evitar duplicados exactos automáticamente
    await User.findByIdAndUpdate(userId, {
        $addToSet: { pushSubscriptions: subscription }
    });

    res.status(201).json({ message: 'Push activado en este dispositivo.' });
});

// @desc    Función interna para enviar notificaciones (Usada por el Scheduler)
const sendPushToUser = async (user, payload) => {
    if (!user.pushSubscriptions || user.pushSubscriptions.length === 0) return;

    const notifications = user.pushSubscriptions.map(sub => {
        return webpush.sendNotification(sub, JSON.stringify(payload))
            .catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // La suscripción ya no es válida (usuario revocó permiso), la borramos
                    console.log(`🗑️ Eliminando suscripción caduca para ${user.username}`);
                    User.findByIdAndUpdate(user._id, {
                        $pull: { pushSubscriptions: { endpoint: sub.endpoint } }
                    }).exec();
                }
            });
    });

    await Promise.all(notifications);
};

module.exports = { subscribeToPush, sendPushToUser };