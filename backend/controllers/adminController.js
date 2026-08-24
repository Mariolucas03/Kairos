const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const Notification = require('../models/Notification');
const { enviarNotificacionManual } = require('./pushController');

/**
 * Panel de administración.
 *
 * Hasta ahora no existía el concepto de administrador: no había forma de banear
 * a nadie, ni de borrar un comentario ajeno, ni de mandar un aviso sin abrir una
 * terminal con el CRON_SECRET a mano. Mientras la app fuera solo para amigos
 * daba igual; en cuanto entra gente de fuera, el primer comentario ofensivo te
 * deja sin herramientas.
 */

// @desc    Lista de usuarios con lo justo para moderar
// @route   GET /api/admin/usuarios
const listarUsuarios = asyncHandler(async (req, res) => {
    const usuarios = await User.find({})
        .select('username email level coins gameCoins hp isAdmin baneado lastActive createdAt pushSubscriptions')
        .sort({ createdAt: -1 })
        .lean();

    res.json(usuarios.map(u => ({
        _id: u._id,
        username: u.username,
        email: u.email,
        level: u.level || 1,
        coins: u.coins || 0,
        hp: u.hp ?? 100,
        isAdmin: !!u.isAdmin,
        baneado: u.baneado?.activo ? { motivo: u.baneado.motivo, fecha: u.baneado.fecha } : null,
        dispositivos: (u.pushSubscriptions || []).length,
        lastActive: u.lastActive,
        createdAt: u.createdAt
    })));
});

// @desc    Suspender una cuenta
// @route   POST /api/admin/banear
const banear = asyncHandler(async (req, res) => {
    const { userId, motivo } = req.body;
    if (!userId) { res.status(400); throw new Error('Falta el usuario'); }

    if (userId.toString() === req.user._id.toString()) {
        res.status(400);
        throw new Error('No puedes banearte a ti mismo');
    }

    const objetivo = await User.findById(userId).select('username isAdmin');
    if (!objetivo) { res.status(404); throw new Error('Usuario no encontrado'); }

    // Un administrador no puede echar a otro: si algún día hay dos, una discusión
    // no puede acabar con uno dejando fuera al otro de un botón.
    if (objetivo.isAdmin) {
        res.status(400);
        throw new Error('No se puede banear a otro administrador');
    }

    await User.findByIdAndUpdate(userId, {
        $set: {
            baneado: {
                activo: true,
                motivo: String(motivo || '').trim().slice(0, 200) || 'Sin motivo indicado',
                fecha: new Date()
            },
            // Se le quitan las suscripciones: una cuenta suspendida no debe
            // seguir recibiendo los avisos de las 20:00 como si nada.
            pushSubscriptions: []
        }
    });

    res.json({ message: objetivo.username + ' ha sido suspendido' });
});

// @desc    Levantar la suspensión
// @route   POST /api/admin/desbanear
const desbanear = asyncHandler(async (req, res) => {
    const { userId } = req.body;
    const objetivo = await User.findByIdAndUpdate(
        userId,
        { $set: { 'baneado.activo': false } },
        { new: true }
    ).select('username');

    if (!objetivo) { res.status(404); throw new Error('Usuario no encontrado'); }
    res.json({ message: objetivo.username + ' vuelve a tener acceso' });
});

// @desc    Últimos comentarios del feed, para poder moderarlos
// @route   GET /api/admin/comentarios
const ultimosComentarios = asyncHandler(async (req, res) => {
    const filas = await WorkoutLog.aggregate([
        { $match: { 'comments.0': { $exists: true } } },
        { $unwind: '$comments' },
        { $sort: { 'comments.createdAt': -1 } },
        { $limit: 50 },
        {
            $project: {
                comentarioId: '$comments._id',
                texto: '$comments.text',
                fecha: '$comments.createdAt',
                autor: '$comments.user',
                entreno: '$_id',
                nombreEntreno: '$routineName'
            }
        }
    ]);

    const autores = await User.find({ _id: { $in: filas.map(f => f.autor) } })
        .select('username').lean();
    const mapa = new Map(autores.map(u => [u._id.toString(), u.username]));

    res.json(filas.map(f => ({ ...f, autor: mapa.get(f.autor?.toString()) || 'desconocido' })));
});

// @desc    Borrar un comentario ajeno
// @route   DELETE /api/admin/comentario/:entrenoId/:comentarioId
const borrarComentario = asyncHandler(async (req, res) => {
    const { entrenoId, comentarioId } = req.params;

    const r = await WorkoutLog.updateOne(
        { _id: entrenoId },
        { $pull: { comments: { _id: comentarioId } } }
    );

    if (r.modifiedCount === 0) { res.status(404); throw new Error('Ese comentario ya no está'); }

    // La notificación que lo anunciaba se va con él: dejarla es dejar el texto
    // del comentario visible en el buzón de la víctima.
    await Notification.deleteMany({ type: 'comment', workout: entrenoId });

    res.json({ message: 'Comentario borrado' });
});

// @desc    Borrar un entreno del feed
// @route   DELETE /api/admin/entreno/:id
const borrarEntreno = asyncHandler(async (req, res) => {
    const entreno = await WorkoutLog.findByIdAndDelete(req.params.id);
    if (!entreno) { res.status(404); throw new Error('Ese entreno ya no está'); }

    await Notification.deleteMany({ workout: entreno._id });
    res.json({ message: 'Entreno borrado' });
});

/**
 * Restablecer la contrasena de un usuario.
 *
 * No hay recuperacion por correo, y montarla significa un servicio de envio, un
 * dominio verificado y otra cuenta que mantener. Para una app de esta escala
 * esto resuelve el mismo problema: el usuario te escribe, le generas una clave
 * temporal y se la pasas. El la cambia luego si quiere.
 *
 * La clave se devuelve EN CLARO una sola vez, en la respuesta a este admin. No
 * se guarda en ningun sitio ni se puede volver a consultar: en la base ya entra
 * cifrada por el hook del modelo.
 *
 * @route   POST /api/admin/restablecer-clave
 */
const restablecerClave = asyncHandler(async (req, res) => {
    const { userId } = req.body;
    if (!userId) { res.status(400); throw new Error('Falta el usuario'); }

    const objetivo = await User.findById(userId);
    if (!objetivo) { res.status(404); throw new Error('Usuario no encontrado'); }

    // Igual que con el baneo: un administrador no puede tomar la cuenta de otro.
    if (objetivo.isAdmin && objetivo._id.toString() !== req.user._id.toString()) {
        res.status(400);
        throw new Error('No se puede restablecer la clave de otro administrador');
    }

    // Alfabeto sin caracteres que se confunden al dictarla por telefono o
    // WhatsApp: fuera 0/O, 1/I/l. Y crypto, no Math.random: una clave temporal
    // adivinable no sirve de nada.
    const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const temporal = Array.from(
        { length: 10 },
        () => ALFABETO[crypto.randomInt(ALFABETO.length)]
    ).join('');

    objetivo.password = temporal;
    await objetivo.save(); // el hook del modelo la cifra

    res.json({
        message: 'Clave nueva para ' + objetivo.username,
        usuario: objetivo.username,
        temporal
    });
});

// @desc    Mandar una notificación push a mano
// @route   POST /api/admin/notificar
const notificar = asyncHandler(async (req, res) => {
    // Misma función que usa la ruta protegida por CRON_SECRET: el envío vive en
    // un solo sitio, así que no puede haber dos comportamientos distintos según
    // por dónde entres.
    const resultado = await enviarNotificacionManual(req.body || {});
    res.status(resultado.codigo || 200).json(resultado.cuerpo);
});

module.exports = {
    listarUsuarios, banear, desbanear, restablecerClave,
    ultimosComentarios, borrarComentario, borrarEntreno,
    notificar
};
