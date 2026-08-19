const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const webpush = require('web-push');

// Configuración inicial (se ejecuta al cargar el archivo)
const PUSH_CONFIGURADO = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (PUSH_CONFIGURADO) {
    webpush.setVapidDetails(
        process.env.MAILTO_URL || 'mailto:admin@kairos.app',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    // ⚠️ Sin claves VAPID, web-push NO puede enviar nada: las suscripciones se
    // guardan pero ninguna notificación sale jamás, y en silencio. Este aviso
    // es lo unico que distingue "no llegan" de "no estan configuradas".
    console.warn('⚠️  PUSH DESACTIVADO: faltan VAPID_PUBLIC_KEY y/o VAPID_PRIVATE_KEY en el entorno. Las suscripciones se guardan pero no se envia ninguna notificacion.');
}

// @desc    Guardar suscripción del navegador
// @route   POST /api/push/subscribe
const subscribeToPush = asyncHandler(async (req, res) => {
    const subscription = req.body || {};
    const userId = req.user._id;

    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        res.status(400);
        throw new Error('Suscripción incompleta');
    }

    // ⚠️ Antes se usaba $addToSet confiando en que evitaria duplicados. NO lo
    // hacia: mongoose le pone un _id propio a cada subdocumento, asi que la
    // suscripcion guardada nunca es identica a la que llega y $addToSet la
    // anadia OTRA VEZ. Como registerPush() corre cada vez que se abre el Home,
    // un mismo movil acumulaba una suscripcion por visita... y habria recibido
    // la misma notificacion tantas veces como copias tuviera.
    //
    // El endpoint YA identifica al dispositivo de forma unica: se borra por
    // endpoint y se inserta una sola vez.
    await User.findByIdAndUpdate(userId, {
        $pull: { pushSubscriptions: { endpoint: subscription.endpoint } }
    });

    await User.findByIdAndUpdate(userId, {
        $push: {
            pushSubscriptions: {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
            }
        }
    });

    res.status(201).json({
        message: 'Push activado en este dispositivo.',
        // Si el servidor no tiene claves, el movil deberia saberlo en vez de
        // creer que quedo activado
        activo: PUSH_CONFIGURADO
    });
});

// @desc    Función interna para enviar notificaciones (Usada por el Scheduler)
const sendPushToUser = async (user, payload) => {
    if (!PUSH_CONFIGURADO) return;
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