const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('../models/User');
const WorkoutLog = require('../models/WorkoutLog');
const Notification = require('../models/Notification');
const { enviarNotificacionManual } = require('./pushController');
const SystemState = require('../models/SystemState');
const DailyLog = require('../models/DailyLog');
const { runNightlyMaintenance, runMonthlyRankingRewards, runEveningReminder } = require('../utils/scheduler');
const { getMadridDateString } = require('../utils/dateHelpers');

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

/**
 * Estado del sistema de un vistazo.
 *
 * Existe porque hasta ahora la única forma de saber si la app estaba haciendo su
 * trabajo —si el castigo nocturno corrió, si salió el aviso de las 20:00, si
 * queda cuota de IA— era abrir la base de datos a mano o mirar los registros de
 * Render desde un ordenador. Desde el móvil, nada.
 *
 * Todo lo que sale aquí son cosas que fallan EN SILENCIO: cuando el aviso de las
 * 20:00 no sale, no aparece ningún error en ningún sitio, simplemente no llega.
 *
 * @route   GET /api/admin/estado
 */
const estadoDelSistema = asyncHandler(async (req, res) => {
    const hoy = getMadridDateString();
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = getMadridDateString(ayer);

    const claveIA = 'ia-llamadas-' + hoy;

    const [marcas, usuarios, conPush, diasDeHoy, activos7dias] = await Promise.all([
        SystemState.find({}).lean(),
        User.countDocuments({}),
        User.countDocuments({ 'pushSubscriptions.0': { $exists: true } }),
        // Los entrenos de hoy se cuentan desde el registro diario y NO filtrando
        // WorkoutLog.date por fecha.
        //
        // ⚠️ new Date('2026-08-24T00:00:00') se interpreta en la zona del SERVIDOR,
        // y Render va en UTC: eso son las 02:00 de Madrid, asi que los entrenos de
        // madrugada no se contaban. Y poner un desfase fijo estaria mal en invierno,
        // cuando Madrid es +01:00. El registro diario ya guarda la fecha en formato
        // de Madrid, asi que preguntarle a el no tiene ese problema.
        DailyLog.find({ date: hoy }).select('gymWorkouts sportWorkouts').lean(),
        User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 7 * 86400000) } })
    ]);

    const porClave = {};
    for (const m of marcas) porClave[m.key] = m;

    const llamadasIA = porClave[claveIA]?.contador || 0;
    const topeIA = Number(process.env.MAX_IA_DIA) || 300;

    res.json({
        fecha: hoy,

        usuarios: { total: usuarios, conNotificaciones: conPush, activos7dias },

        actividad: {
            entrenosHoy: diasDeHoy.reduce((t, d) => t + (d.gymWorkouts?.length || 0) + (d.sportWorkouts?.length || 0), 0)
        },

        ia: {
            usadasHoy: llamadasIA,
            tope: topeIA,
            porcentaje: Math.round((llamadasIA / topeIA) * 100)
        },

        tareas: {
            // El castigo se anota con la fecha del dia castigado, que es AYER
            castigoNocturno: {
                ultimoDia: porClave['nightly-maintenance']?.value || null,
                alDia: porClave['nightly-maintenance']?.value === ayerStr
            },
            avisoDeLas20: {
                ultimoDia: porClave['evening-reminder']?.value || null,
                enviadoHoy: porClave['evening-reminder']?.value === hoy
            }
        }
    });
});

/**
 * Lanzar a mano una tarea programada.
 *
 * Las tres dependen de que un cron externo las llame a su hora. Si ese dia
 * fallo —Render reiniciando, cron-job.org caido, el secreto mal puesto— hasta
 * ahora la unica salida era una peticion con curl desde un ordenador. Esto
 * permite arreglarlo desde el movil.
 *
 * Las tres son idempotentes: el castigo se anota por dia, los premios por
 * usuario y periodo, y el aviso reserva el dia antes de mandar nada. Repetirlas
 * no castiga dos veces, no paga dos veces y no avisa dos veces.
 *
 * @route   POST /api/admin/mantenimiento
 */
const lanzarMantenimiento = asyncHandler(async (req, res) => {
    const { tarea } = req.body || {};

    if (tarea === 'castigo') {
        const r = await runNightlyMaintenance({ forzar: true });
        return res.json({ message: 'Mantenimiento nocturno ejecutado', detalle: r });
    }

    if (tarea === 'premios') {
        const r = await runMonthlyRankingRewards();
        return res.json({ message: 'Premios del ranking repartidos: ' + (r.awarded || 0), detalle: r });
    }

    if (tarea === 'aviso') {
        const r = await runEveningReminder({ forzar: true });
        const total = (r.misiones || 0) + (r.diaria || 0) + (r.vuelve || 0);
        return res.json({ message: 'Aviso enviado a ' + total + ' personas', detalle: r });
    }

    res.status(400);
    throw new Error('Tarea no válida: usa castigo, premios o aviso');
});

/**
 * Ajustar el saldo de alguien.
 *
 * Para compensar cuando algo falla: se pierde una recompensa por un error, un
 * juego se queda a medias, se cobra algo que no era. Sin esto la unica forma de
 * arreglarlo era entrar a la base de datos a mano.
 *
 * Es SUMAR o RESTAR, no fijar: escribir directamente el saldo final es como se
 * borran mil monedas por equivocarse en un dedo, y ademas obliga a saber cuanto
 * tenia antes.
 *
 * @route   POST /api/admin/ajustar-saldo
 */
const ajustarSaldo = asyncHandler(async (req, res) => {
    const { userId, coins = 0, gameCoins = 0, motivo } = req.body || {};

    const monedas = Math.round(Number(coins) || 0);
    const fichas = Math.round(Number(gameCoins) || 0);

    if (!userId) { res.status(400); throw new Error('Falta el usuario'); }
    if (monedas === 0 && fichas === 0) { res.status(400); throw new Error('Indica cuánto sumar o restar'); }

    // Tope por operacion: un cero de mas al escribir no puede regalar un millon
    if (Math.abs(monedas) > 100000 || Math.abs(fichas) > 100000) {
        res.status(400);
        throw new Error('Como mucho 100.000 por ajuste');
    }

    const objetivo = await User.findById(userId).select('username coins gameCoins');
    if (!objetivo) { res.status(404); throw new Error('Usuario no encontrado'); }

    // El saldo NO puede quedar negativo: un saldo bajo cero rompe las compras,
    // que comprueban "tienes suficiente" y no "tienes mas que cero".
    const nuevasMonedas = Math.max(0, (objetivo.coins || 0) + monedas);
    const nuevasFichas = Math.max(0, (objetivo.gameCoins || 0) + fichas);

    await User.findByIdAndUpdate(userId, { $set: { coins: nuevasMonedas, gameCoins: nuevasFichas } });

    console.log('💰 Ajuste de saldo a ' + objetivo.username + ': ' +
        monedas + ' monedas, ' + fichas + ' fichas. Motivo: ' + (motivo || 'sin indicar'));

    res.json({
        message: objetivo.username + ': ' + nuevasMonedas + ' monedas, ' + nuevasFichas + ' fichas',
        antes: { coins: objetivo.coins || 0, gameCoins: objetivo.gameCoins || 0 },
        despues: { coins: nuevasMonedas, gameCoins: nuevasFichas }
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
    estadoDelSistema, lanzarMantenimiento, ajustarSaldo,
    ultimosComentarios, borrarComentario, borrarEntreno,
    notificar
};
