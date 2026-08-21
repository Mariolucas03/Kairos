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
    // ⚠️ El endpoint identifica al DISPOSITIVO, no a la cuenta. Se limpiaba
    // solo en el usuario que se estaba suscribiendo, asi que un movil que
    // entrara con una segunda cuenta quedaba registrado en las DOS: cada aviso
    // de las 20:00 llegaba dos veces al mismo telefono, uno por cuenta, con
    // textos distintos. Se quita de todas: el aparato es de quien lo usa ahora.
    await User.updateMany(
        { 'pushSubscriptions.endpoint': subscription.endpoint },
        { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } }
    );

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

/**
 * Envio de PRUEBA al propio usuario, con diagnostico.
 *
 * Sin esto la unica forma de saber si las notificaciones funcionan era esperar
 * a que alguien te diera un me gusta, y si no llegaba no habia manera de saber
 * por que: si faltaban las claves, si no habia suscripcion, o si el navegador
 * la habia caducado. Aqui se devuelve el motivo exacto.
 */
const testPush = asyncHandler(async (req, res) => {
    if (!PUSH_CONFIGURADO) {
        return res.status(503).json({
            ok: false,
            motivo: 'sin-claves',
            mensaje: 'El servidor no tiene claves VAPID configuradas (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).'
        });
    }

    const user = await User.findById(req.user._id).select('username pushSubscriptions');
    const subs = user?.pushSubscriptions || [];

    if (subs.length === 0) {
        return res.status(400).json({
            ok: false,
            motivo: 'sin-suscripcion',
            mensaje: 'Este usuario no tiene ningun dispositivo registrado. Pulsa ACTIVAR en el movil.'
        });
    }

    const payload = {
        title: 'Kairos',
        body: 'Si ves esto, las notificaciones funcionan.',
        url: '/home'
    };

    const resultados = await Promise.all(subs.map(async (sub) => {
        try {
            await webpush.sendNotification(sub, JSON.stringify(payload));
            return { endpoint: sub.endpoint.slice(-12), ok: true };
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                await User.findByIdAndUpdate(req.user._id, {
                    $pull: { pushSubscriptions: { endpoint: sub.endpoint } }
                });
            }
            return {
                endpoint: sub.endpoint.slice(-12),
                ok: false,
                codigo: err.statusCode || null,
                error: (err.body || err.message || '').toString().slice(0, 200)
            };
        }
    }));

    const enviadas = resultados.filter(r => r.ok).length;

    res.json({
        ok: enviadas > 0,
        dispositivos: subs.length,
        enviadas,
        resultados,
        mensaje: enviadas > 0
            ? `Enviada a ${enviadas} de ${subs.length} dispositivo(s).`
            : 'No se pudo entregar en ningun dispositivo. Mira el detalle.'
    });
});

/**
 * ENVIO MANUAL de una notificacion, a una persona o a todas.
 *
 * ⚠️ Va protegido por CRON_SECRET (protectCron en la ruta), NO por sesion de
 * usuario. Un endpoint que manda notificaciones arbitrarias con solo estar
 * logueado seria un altavoz para spamear a cualquiera: solo quien tenga el
 * secreto del servidor puede usarlo.
 *
 * Cuerpo:
 *   { username } o { userId }   a quien (uno de los dos)
 *   { todos: true }             a todo el que tenga notificaciones activadas
 *   { title, body, url }        que se manda (url opcional, por defecto /home)
 */
const adminSendPush = asyncHandler(async (req, res) => {
    if (!PUSH_CONFIGURADO) {
        return res.status(503).json({ ok: false, mensaje: 'Faltan las claves VAPID en el servidor.' });
    }

    const { username, userId, todos, title, body, url } = req.body || {};

    if (!title || !body) {
        res.status(400);
        throw new Error('Hacen falta "title" y "body"');
    }

    let destinatarios = [];

    if (todos === true) {
        // Solo los que tienen algun dispositivo: el resto no recibiria nada
        destinatarios = await User.find({ 'pushSubscriptions.0': { $exists: true } })
            .select('username pushSubscriptions');
    } else if (userId) {
        const encontrado = await User.findById(userId).select('username pushSubscriptions');
        if (encontrado) destinatarios = [encontrado];
    } else if (username) {
        // Busqueda exacta sin distinguir mayusculas. Se escapa la entrada: un
        // nombre con parentesis o puntos alteraria el RegExp y buscaria de mas.
        const limpio = String(username).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const encontrado = await User.findOne({ username: new RegExp('^' + limpio + '$', 'i') })
            .select('username pushSubscriptions');
        if (encontrado) destinatarios = [encontrado];
    } else {
        res.status(400);
        throw new Error('Indica "username", "userId" o "todos": true');
    }

    if (destinatarios.length === 0) {
        return res.status(404).json({ ok: false, mensaje: 'No se encontro a nadie con notificaciones activadas.' });
    }

    const payload = { title, body, url: url || '/home' };
    const informe = [];

    for (const destinatario of destinatarios) {
        const subs = destinatario.pushSubscriptions || [];
        let entregadas = 0;

        for (const sub of subs) {
            try {
                await webpush.sendNotification(sub, JSON.stringify(payload));
                entregadas++;
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await User.findByIdAndUpdate(destinatario._id, {
                        $pull: { pushSubscriptions: { endpoint: sub.endpoint } }
                    });
                }
            }
        }

        informe.push({ usuario: destinatario.username, dispositivos: subs.length, entregadas });
    }

    const total = informe.reduce((acc, i) => acc + i.entregadas, 0);

    res.json({
        ok: total > 0,
        mensaje: 'Entregada en ' + total + ' dispositivo(s) de ' + destinatarios.length + ' usuario(s).',
        informe
    });
});

/**
 * Manda una notificacion a un usuario del que solo tenemos el id.
 *
 * Existe para no repetir en cada controlador el findById con el select de las
 * suscripciones, y sobre todo para que un fallo al avisar NUNCA tumbe la
 * peticion que lo provoco: la solicitud de amistad ya se guardo, que el push
 * falle no puede devolver un error al que la mando.
 */
const notificarA = async (userId, payload) => {
    if (!PUSH_CONFIGURADO || !userId) return;
    try {
        const user = await User.findById(userId).select('username pushSubscriptions');
        if (user) await sendPushToUser(user, payload);
    } catch (e) {
        console.error('No se pudo notificar a ' + userId + ':', e.message);
    }
};

module.exports = { subscribeToPush, sendPushToUser, notificarA, testPush, adminSendPush };
