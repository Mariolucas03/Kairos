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
const mongoose = require('mongoose');
const AdminLog = require('../models/AdminLog');
const Routine = require('../models/Routine');
const Mission = require('../models/Mission');
const NutritionLog = require('../models/NutritionLog');
const { borrarUsuarioYSusDatos } = require('../services/borradoService');
// Las tablas del casino, para poder MEDIR lo que devuelve cada juego sin
// duplicar aqui los numeros: si se copiaran, el panel seguiria diciendo que
// todo va bien despues de que alguien cambiara un premio.
const {
    SCRATCH_SYMBOLS, SLOT_SYMBOLS, FORTUNE_PRIZES, FORTUNE_COSTS, TOWER_MULTIPLIERS
} = require('./gamesController');

/**
 * Panel de administración.
 *
 * Hasta ahora no existía el concepto de administrador: no había forma de banear
 * a nadie, ni de borrar un comentario ajeno, ni de mandar un aviso sin abrir una
 * terminal con el CRON_SECRET a mano. Mientras la app fuera solo para amigos
 * daba igual; en cuanto entra gente de fuera, el primer comentario ofensivo te
 * deja sin herramientas.
 */

/**
 * Deja constancia de lo que acaba de hacer un administrador.
 *
 * Se llama DESPUES de que la accion haya salido bien: un registro de intentos
 * fallidos solo mete ruido en el unico sitio donde hay que poder mirar rapido.
 *
 * Nunca revienta la peticion. Si la anotacion falla, la accion ya se hizo y
 * devolver un error haria pensar que no; se avisa por consola y se sigue.
 */
const anotar = async (req, accion, { objetivo, objetivoNombre, resumen, detalle } = {}) => {
    try {
        await AdminLog.create({
            admin: req.user?._id,
            adminNombre: req.user?.username || 'desconocido',
            accion,
            objetivo,
            objetivoNombre: objetivoNombre || '',
            resumen: resumen || '',
            detalle
        });
    } catch (e) {
        console.error('No se pudo anotar la accion de admin (' + accion + '):', e.message);
    }
};

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

    await anotar(req, 'banear', {
        objetivo: objetivo._id, objetivoNombre: objetivo.username,
        resumen: 'suspendio a ' + objetivo.username,
        detalle: { motivo: String(motivo || '').trim().slice(0, 200) || 'sin indicar' }
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

    await anotar(req, 'desbanear', {
        objetivo: objetivo._id, objetivoNombre: objetivo.username,
        resumen: 'levanto la suspension de ' + objetivo.username
    });

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

    await anotar(req, 'borrar-comentario', {
        resumen: 'borro un comentario',
        detalle: { entrenoId, comentarioId }
    });

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

    await anotar(req, 'borrar-entreno', {
        objetivo: entreno.user,
        resumen: 'borro el entreno "' + (entreno.routineName || 'sin nombre') + '"',
        detalle: { entrenoId: entreno._id, fecha: entreno.date }
    });

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

    // La clave NO se anota: el registro lo pueden leer otros administradores, y
    // una contrasena en claro guardada "por trazabilidad" es una contrasena
    // filtrada. Queda constancia de que se genero, que es lo que importa.
    await anotar(req, 'restablecer-clave', {
        objetivo: objetivo._id, objetivoNombre: objetivo.username,
        resumen: 'genero una clave temporal para ' + objetivo.username
    });

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

    // El estado de la base puede fallar (permisos del usuario de Atlas), y que
    // el panel entero se caiga por un dato accesorio seria peor que no tenerlo.
    const pedirEstadoBase = async () => {
        try { return await mongoose.connection.db.stats(); } catch { return null; }
    };

    const [marcas, usuarios, conPush, diasDeHoy, activos7dias, estadoBase] = await Promise.all([
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
        User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 7 * 86400000) } }),
        pedirEstadoBase()
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

        // Salud de la maquina y de la base. Sale aqui porque son las dos cosas
        // que, cuando van mal, hacen que la app "vaya rara" sin dar ningun
        // error: la base gratuita tiene 512 MB y Render reinicia el proceso a
        // menudo, y ninguna de las dos cosas se ve desde dentro de la app.
        base: {
            megasUsados: estadoBase ? Math.round((estadoBase.dataSize / 1048576) * 10) / 10 : null,
            topeMegas: 512,
            documentos: estadoBase ? estadoBase.objects : null,
            colecciones: estadoBase ? estadoBase.collections : null
        },

        proceso: {
            // Un uptime de dos minutos con usuarios dentro significa que el
            // servidor acaba de reiniciarse, que es la explicacion de la mitad
            // de los "me ha dado error una vez".
            minutosEncendido: Math.round(process.uptime() / 60),
            memoriaMB: Math.round(process.memoryUsage().rss / 1048576),
            version: process.version
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
        await anotar(req, 'tarea-castigo', { resumen: 'lanzo el castigo nocturno a mano', detalle: r });
        return res.json({ message: 'Mantenimiento nocturno ejecutado', detalle: r });
    }

    if (tarea === 'premios') {
        const r = await runMonthlyRankingRewards();
        await anotar(req, 'tarea-premios', { resumen: 'repartio los premios del ranking a mano', detalle: r });
        return res.json({ message: 'Premios del ranking repartidos: ' + (r.awarded || 0), detalle: r });
    }

    if (tarea === 'aviso') {
        const r = await runEveningReminder({ forzar: true });
        const total = (r.misiones || 0) + (r.diaria || 0) + (r.vuelve || 0);
        await anotar(req, 'tarea-aviso', { resumen: 'lanzo el aviso de las 20:00 a mano', detalle: r });
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

    await anotar(req, 'ajustar-saldo', {
        objetivo: objetivo._id, objetivoNombre: objetivo.username,
        // Se redacta con "sumo"/"resto" por cantidad y no un "sumo -100", que al
        // releer el registro dentro de un mes se entiende justo al reves.
        resumen: 'le ' + [
            monedas && (monedas > 0 ? 'sumo ' + monedas : 'resto ' + Math.abs(monedas)) + ' monedas',
            fichas && (fichas > 0 ? 'sumo ' + fichas : 'resto ' + Math.abs(fichas)) + ' fichas'
        ].filter(Boolean).join(' y ') + ' a ' + objetivo.username,
        detalle: {
            monedas, fichas, motivo: motivo || 'sin indicar',
            antes: { coins: objetivo.coins || 0, gameCoins: objetivo.gameCoins || 0 },
            despues: { coins: nuevasMonedas, gameCoins: nuevasFichas }
        }
    });

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

    if ((resultado.codigo || 200) < 400) {
        const { title, body, username, todos } = req.body || {};
        await anotar(req, 'notificar', {
            resumen: 'mando un aviso a ' + (todos ? 'todo el mundo' : (username || 'alguien')),
            detalle: { title, body, destino: todos ? 'todos' : username }
        });
    }

    res.status(resultado.codigo || 200).json(resultado.cuerpo);
});


/**
 * FICHA COMPLETA DE UN USUARIO.
 *
 * La lista de usuarios ensena lo justo para moderar (nombre, nivel, saldo). En
 * cuanto alguien escribe "me ha pasado algo raro", eso no basta: hace falta ver
 * si entrena, desde cuando, cuantas rutinas tiene y como va de vida. Hasta ahora
 * eso significaba abrir la base de datos desde un ordenador.
 *
 * @route   GET /api/admin/usuario/:id
 */
const fichaUsuario = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400); throw new Error('Usuario no valido'); }

    const u = await User.findById(id).select('-password').lean();
    if (!u) { res.status(404); throw new Error('Usuario no encontrado'); }

    const hace30 = new Date(Date.now() - 30 * 86400000);

    const [entrenos, ultimos, rutinas, misiones, misionesHechas, diasActivos, comidas, avisos] = await Promise.all([
        WorkoutLog.countDocuments({ user: id }),
        WorkoutLog.find({ user: id }).sort({ date: -1 }).limit(5)
            .select('routineName date duration caloriesBurned type').lean(),
        Routine.countDocuments({ user: id }),
        Mission.countDocuments({ user: id }),
        Mission.countDocuments({ user: id, completed: true }),
        DailyLog.countDocuments({ user: id, createdAt: { $gte: hace30 } }),
        NutritionLog.countDocuments({ user: id, totalCalories: { $gt: 0 } }),
        Notification.countDocuments({ user: id })
    ]);

    res.json({
        _id: u._id,
        username: u.username,
        email: u.email,
        isAdmin: !!u.isAdmin,
        baneado: u.baneado?.activo ? { motivo: u.baneado.motivo, fecha: u.baneado.fecha } : null,
        alta: u.createdAt,
        ultimoAcceso: u.lastActive,
        dispositivos: (u.pushSubscriptions || []).length,

        stats: {
            level: u.level || 1,
            currentXP: u.currentXP || 0,
            nextLevelXP: u.nextLevelXP || 100,
            title: u.title || '',
            hp: u.hp ?? 100,
            maxHp: u.maxHp ?? 100,
            lives: u.lives ?? 0,
            coins: u.coins || 0,
            gameCoins: u.gameCoins || 0,
            racha: u.streak?.current || 0
        },

        actividad: {
            entrenos,
            rutinas,
            misiones,
            misionesHechas,
            diasConRegistro30: diasActivos,
            diasConComida: comidas,
            notificaciones: avisos
        },

        ultimosEntrenos: ultimos
    });
});

/**
 * Ajustar las estadisticas de alguien: vida, nivel, racha, vidas.
 *
 * Hermano de ajustarSaldo, para lo que no es dinero. Nace de un caso real: una
 * noche el castigo nocturno se ejecuto sobre un dia ya castigado y dejo a dos
 * personas a 0 de vida sin merecerlo. Devolverles la vida exigio abrir la base
 * de datos a mano.
 *
 * Aqui SI se fija el valor en vez de sumar, al reves que con el saldo: "ponle
 * 100 de vida" es la frase que uno piensa, mientras que con el dinero lo que se
 * piensa es "devuelvele las 500 fichas que perdio".
 *
 * @route   POST /api/admin/ajustar-stats
 */
const ajustarStats = asyncHandler(async (req, res) => {
    const { userId, hp, level, racha, lives, motivo } = req.body || {};
    if (!userId) { res.status(400); throw new Error('Falta el usuario'); }

    const u = await User.findById(userId);
    if (!u) { res.status(404); throw new Error('Usuario no encontrado'); }

    const antes = { hp: u.hp, level: u.level, racha: u.streak?.current, lives: u.lives };
    const cambios = [];
    const numero = (v) => (v === undefined || v === null || v === '') ? null : Number(v);

    const nuevaHp = numero(hp);
    if (nuevaHp !== null && Number.isFinite(nuevaHp)) {
        // Nunca por encima del maximo: una vida de 300 sobre 100 pinta la barra
        // fuera de su caja y ademas no se gasta nunca.
        u.hp = Math.max(0, Math.min(Math.round(nuevaHp), u.maxHp || 100));
        cambios.push('vida a ' + u.hp);
    }

    const nuevoNivel = numero(level);
    if (nuevoNivel !== null && Number.isFinite(nuevoNivel)) {
        const objetivo = Math.max(1, Math.min(Math.round(nuevoNivel), 999));
        // El XP que hace falta para el siguiente nivel se recalcula con la misma
        // formula del modelo (x1,2 por nivel). Sin esto, alguien puesto a nivel
        // 20 subiria al 21 con los 100 XP que cuesta el nivel 1.
        let siguiente = 100;
        for (let n = 1; n < objetivo; n++) siguiente = Math.floor(siguiente * 1.2);
        u.level = objetivo;
        u.nextLevelXP = siguiente;
        u.currentXP = Math.min(u.currentXP || 0, siguiente - 1);
        cambios.push('nivel a ' + objetivo);
    }

    const nuevaRacha = numero(racha);
    if (nuevaRacha !== null && Number.isFinite(nuevaRacha)) {
        u.streak = u.streak || {};
        u.streak.current = Math.max(0, Math.min(Math.round(nuevaRacha), 3650));
        cambios.push('racha a ' + u.streak.current);
    }

    const nuevasVidas = numero(lives);
    if (nuevasVidas !== null && Number.isFinite(nuevasVidas)) {
        u.lives = Math.max(0, Math.min(Math.round(nuevasVidas), 100));
        cambios.push('vidas a ' + u.lives);
    }

    if (cambios.length === 0) { res.status(400); throw new Error('No has indicado nada que cambiar'); }

    await u.save();

    await anotar(req, 'ajustar-stats', {
        objetivo: u._id, objetivoNombre: u.username,
        resumen: 'cambio a ' + u.username + ': ' + cambios.join(', '),
        detalle: {
            antes,
            despues: { hp: u.hp, level: u.level, racha: u.streak?.current, lives: u.lives },
            motivo: motivo || 'sin indicar'
        }
    });

    res.json({ message: u.username + ': ' + cambios.join(', ') });
});

/**
 * Borrar una cuenta entera desde el panel.
 *
 * Usa el MISMO servicio que el borrado voluntario desde Ajustes, y no un
 * deleteOne suelto: si no, la cuenta desaparece pero sus entrenos siguen en el
 * feed, sus comentarios en los entrenos de otros y sus misiones en la base.
 *
 * @route   DELETE /api/admin/usuario/:id
 */
const borrarCuenta = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400); throw new Error('Usuario no valido'); }

    if (id.toString() === req.user._id.toString()) {
        res.status(400);
        throw new Error('No puedes borrar tu propia cuenta desde aqui');
    }

    const objetivo = await User.findById(id).select('username isAdmin');
    if (!objetivo) { res.status(404); throw new Error('Usuario no encontrado'); }

    // Misma regla que con el baneo: entre administradores, nadie borra a nadie.
    if (objetivo.isAdmin) {
        res.status(400);
        throw new Error('No se puede borrar a otro administrador');
    }

    const resumen = await borrarUsuarioYSusDatos(objetivo._id);

    await anotar(req, 'borrar-cuenta', {
        objetivoNombre: objetivo.username,
        resumen: 'borro la cuenta de ' + objetivo.username,
        detalle: resumen
    });

    res.json({ message: 'Cuenta de ' + objetivo.username + ' borrada', detalle: resumen });
});

/**
 * Ultimos entrenos publicados, para poder moderarlos.
 *
 * El endpoint para borrar un entreno ya existia, pero no habia forma de VER
 * cuales hay: solo se podia borrar uno cuyo identificador ya conocieras, y desde
 * el movil no lo conoces nunca.
 *
 * @route   GET /api/admin/entrenos
 */
const ultimosEntrenos = asyncHandler(async (req, res) => {
    const entrenos = await WorkoutLog.find({})
        .sort({ createdAt: -1 })
        .limit(40)
        .select('user routineName date duration caloriesBurned type postText photo comments createdAt')
        .populate('user', 'username')
        .lean();

    res.json(entrenos.map(e => ({
        _id: e._id,
        autor: e.user?.username || 'desconocido',
        nombre: e.routineName || 'Entreno',
        fecha: e.date,
        cuando: e.createdAt,
        duracion: e.duration || 0,
        calorias: e.caloriesBurned || 0,
        tipo: e.type || 'gym',
        texto: e.postText || '',
        // Solo si la hay, no la foto: mandar cuarenta fotos de 200 KB serian
        // ocho megas cada vez que se abre la pestana.
        tieneFoto: !!e.photo,
        comentarios: (e.comments || []).length
    })));
});

/**
 * LA ECONOMIA, DE UN VISTAZO.
 *
 * Existe por lo que se encontro en agosto de 2026: el rasca devolvia el 279% y
 * los tres modos de la ruleta de la fortuna pagaban mas de lo que costaban.
 * Estuvo asi meses. No dio ni un error, no aparecio en ningun registro y nadie
 * se entero, porque un juego que regala dinero funciona perfectamente: solo
 * esta mal. Lo unico que lo detecta es medirlo.
 *
 * Dos mitades:
 *
 *  - Lo que HAY: cuanto dinero existe y en manos de quien. Si las fichas se
 *    disparan de un dia para otro, hay una fuga en alguna parte.
 *  - Lo que DEBERIA pasar: el retorno de cada juego, calculado en el momento
 *    desde las MISMAS tablas que usa el juego de verdad. Si alguien toca un
 *    premio, se ve aqui al recargar, sin esperar a que se note en los saldos.
 *
 * @route   GET /api/admin/economia
 */

// El de los slots se simula (el pago depende de que salgan lineas de 3 o 4
// iguales en una cuadricula, y eso no tiene formula corta), asi que se calcula
// UNA vez por proceso y se reutiliza: no puede costar medio segundo cada vez que
// se abre el panel.
let retornoSlotsCache = null;
const retornoSlots = () => {
    if (retornoSlotsCache !== null) return retornoSlotsCache;

    const TIRADAS = 50000;
    const APUESTA = 10;
    const pesoTotal = SLOT_SYMBOLS.reduce((a, s) => a + s.weight, 0);
    const sacar = () => {
        let r = Math.random() * pesoTotal;
        for (const s of SLOT_SYMBOLS) { if (r < s.weight) return s; r -= s.weight; }
        return SLOT_SYMBOLS[0];
    };

    let apostado = 0, pagado = 0;
    for (let i = 0; i < TIRADAS; i++) {
        apostado += APUESTA;
        for (let f = 0; f < 4; f++) {
            const fila = [sacar(), sacar(), sacar(), sacar()];
            if (fila[0].val === 0) continue;
            let iguales = [];
            if (fila[0].id === fila[1].id && fila[1].id === fila[2].id && fila[2].id === fila[3].id) iguales = [0, 1, 2, 3];
            else if (fila[0].id === fila[1].id && fila[1].id === fila[2].id) iguales = [0, 1, 2];
            else if (fila[1].id === fila[2].id && fila[2].id === fila[3].id && fila[1].val > 0) iguales = [1, 2, 3];
            if (iguales.length >= 3) pagado += APUESTA * fila[iguales[0]].val * (iguales.length === 4 ? 2 : 1);
        }
    }
    retornoSlotsCache = Math.round((pagado / apostado) * 1000) / 10;
    return retornoSlotsCache;
};

const economia = asyncHandler(async (req, res) => {
    const [totales, ricos] = await Promise.all([
        User.aggregate([{
            $group: {
                _id: null,
                monedas: { $sum: '$coins' },
                fichas: { $sum: '$gameCoins' },
                cuentas: { $sum: 1 }
            }
        }]),
        User.find({}).select('username coins gameCoins').sort({ gameCoins: -1 }).limit(10).lean()
    ]);

    const t = totales[0] || { monedas: 0, fichas: 0, cuentas: 0 };

    // --- Retorno de cada juego, desde sus propias tablas ---
    const juegos = [];

    // Rasca: valor esperado cerrado. El XP no son fichas, asi que no cuenta.
    const repartoRasca = [
        { s: SCRATCH_SYMBOLS.DIAMOND, p: 0.05 },
        { s: SCRATCH_SYMBOLS.XP, p: 0.15 },
        { s: SCRATCH_SYMBOLS.COIN, p: 0.30 },
        { s: SCRATCH_SYMBOLS.LEMON, p: 0.50 }
    ];
    const mediaRasca = repartoRasca
        .filter(r => r.s.type !== 'xp')
        .reduce((total, r) => total + r.p * r.s.prize, 0);
    juegos.push({ juego: 'Rasca', devuelve: Math.round((0.35 * mediaRasca / 10) * 1000) / 10 });

    for (const modo of ['hardcore', 'premium']) {
        const premios = FORTUNE_PRIZES[modo].map(x => x.v);
        const media = premios.reduce((a, b) => a + b, 0) / premios.length;
        juegos.push({ juego: 'Ruleta ' + modo, devuelve: Math.round((media / FORTUNE_COSTS[modo]) * 1000) / 10 });
    }

    juegos.push({ juego: 'Slots', devuelve: retornoSlots() });

    // Torre: la planta 1 es la que se juega siempre, asi que es la que se ensena.
    juegos.push({
        juego: 'Torre (planta 1)',
        devuelve: Math.round(((2 / 3) * TOWER_MULTIPLIERS[0]) * 1000) / 10
    });

    const premiosDiaria = FORTUNE_PRIZES.daily.map(x => x.v);

    res.json({
        circulacion: {
            monedas: t.monedas || 0,
            fichas: t.fichas || 0,
            cuentas: t.cuentas || 0,
            fichasPorCuenta: t.cuentas ? Math.round((t.fichas || 0) / t.cuentas) : 0
        },
        ricos: ricos.map(u => ({ username: u.username, coins: u.coins || 0, gameCoins: u.gameCoins || 0 })),
        juegos: juegos.sort((a, b) => b.devuelve - a.devuelve),
        // La tirada gratis no tiene retorno (no cuesta nada): lo unico que la
        // contiene es que sea una al dia, y de eso se encarga el servidor.
        tiradaGratis: {
            media: Math.round(premiosDiaria.reduce((a, b) => a + b, 0) / premiosDiaria.length),
            maximo: Math.max(...premiosDiaria)
        },
        // Por encima de 100 el juego regala dinero; por debajo de 70 es tan duro
        // que nadie vuelve a jugar.
        limites: { techo: 100, suelo: 70 }
    });
});

/**
 * El registro de lo que han hecho los administradores.
 *
 * @route   GET /api/admin/registro
 */
const registroAdmin = asyncHandler(async (req, res) => {
    const filas = await AdminLog.find({})
        .sort({ createdAt: -1 })
        .limit(60)
        .lean();

    res.json(filas.map(f => ({
        _id: f._id,
        quien: f.adminNombre,
        accion: f.accion,
        sobre: f.objetivoNombre || '',
        resumen: f.resumen,
        detalle: f.detalle,
        cuando: f.createdAt
    })));
});

module.exports = {
    listarUsuarios, banear, desbanear, restablecerClave,
    estadoDelSistema, lanzarMantenimiento, ajustarSaldo,
    ultimosComentarios, borrarComentario, borrarEntreno,
    notificar,
    // Ampliacion del panel
    fichaUsuario, ajustarStats, borrarCuenta,
    ultimosEntrenos, economia, registroAdmin
};
