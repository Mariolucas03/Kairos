const asyncHandler = require('express-async-handler');
const Sabelotodo = require('../models/Sabelotodo');
const User = require('../models/User');
const { PREGUNTAS, CATEGORIAS } = require('../data/preguntas');
const { addRewards } = require('../services/levelService');
const { notificarA } = require('./pushController');

/**
 * SABELOTODO: el trivial cooperativo. Las reglas viven aqui arriba.
 */
const VIDAS = 3;
const SEGUIDAS_MAX = 3;          // aciertos seguidos antes de pasar el turno
const TIEMPO_MS = 30000;         // el movil enseña 20 s; el servidor da margen de red
const PREMIO_GANAR = { xp: 250, fichas: 300 };   // para CADA uno
const PREMIO_PERDER = { xp: 40, fichas: 0 };
const CLAVES = Object.keys(CATEGORIAS);
const RUTA = '/games/sabelotodo';

const barajar = (lista) => {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

/** Elige categoria (entre las que faltan) y una pregunta no repetida de ella. */
const siguientePregunta = (partida) => {
    const faltan = CLAVES.filter(c => !partida.coronas.includes(c));
    const categoria = faltan[Math.floor(Math.random() * faltan.length)];
    const usadas = new Set(partida.usadas);
    let candidatas = PREGUNTAS.filter(p => p.categoria === categoria && !usadas.has(p.id));
    // Si la partida ya ha gastado toda la categoria, se vuelve a empezar con ella
    if (candidatas.length === 0) candidatas = PREGUNTAS.filter(p => p.categoria === categoria);
    const p = candidatas[Math.floor(Math.random() * candidatas.length)];
    const orden = barajar([0, 1, 2, 3]);
    return {
        preguntaId: p.id,
        categoria,
        texto: p.texto,
        opciones: orden.map(i => p.opciones[i]),
        correcta: orden.indexOf(0),
        servidaEn: new Date()
    };
};

const puestoDe = (partida, userId) =>
    partida.jugadores.findIndex(j => j.user && j.user.toString() === userId.toString());

/** Lo que ve cada uno. La respuesta correcta de la pregunta en curso NO viaja. */
const vista = (partida, yoId) => {
    const miPuesto = puestoDe(partida, yoId);
    const yo = miPuesto >= 0 ? partida.jugadores[miPuesto] : null;
    const companero = partida.jugadores.find((_, i) => i !== miPuesto) || null;
    const soyInvitado = partida.invitado && partida.invitado.toString() === yoId.toString();
    const meToca = partida.estado === 'activa' && partida.turno === miPuesto;
    const e = partida.enCurso;

    return {
        _id: partida._id,
        estado: partida.estado,
        soyCreador: partida.creador.toString() === yoId.toString(),
        soyInvitado: !!soyInvitado,
        miPuesto,
        meToca,
        yo: yo ? { _id: yo.user, nombre: yo.nombre, avatar: yo.avatar } : null,
        companero: companero ? { _id: companero.user, nombre: companero.nombre, avatar: companero.avatar } : null,
        coronas: partida.coronas,
        vidas: partida.vidas,
        vidasMax: VIDAS,
        racha: partida.racha,
        seguidasMax: SEGUIDAS_MAX,
        // La pregunta solo la ve quien tiene que contestarla; el otro solo
        // sabe que hay una en el aire.
        enCurso: e
            ? (meToca
                ? { preguntaId: e.preguntaId, categoria: e.categoria, texto: e.texto, opciones: e.opciones, servidaEn: e.servidaEn, segundos: Math.max(0, Math.floor((TIEMPO_MS - (Date.now() - new Date(e.servidaEn).getTime())) / 1000)) }
                : { categoria: e.categoria })
            : null,
        historial: partida.historial.slice(-12).reverse().map(h => ({
            ...h.toObject ? h.toObject() : h,
            nombre: partida.jugadores[h.jugador]?.nombre || '',
            fuiYo: h.jugador === miPuesto
        })),
        premio: partida.premio,
        creada: partida.createdAt,
        actualizada: partida.updatedAt,
        terminadaEn: partida.terminadaEn
    };
};

const cargar = (id) => Sabelotodo.findById(id);

const nombreCategoria = (c) => CATEGORIAS[c]?.nombre || c;

// ── CREAR E INVITAR ─────────────────────────────────────────────────────────
const crear = asyncHandler(async (req, res) => {
    const amigoId = String(req.body?.amigoId || '');
    if (!amigoId || amigoId === req.user._id.toString()) { res.status(400); throw new Error('Elige a un amigo'); }

    const yo = await User.findById(req.user._id).select('username avatar friends').lean();
    const esAmigo = (yo.friends || []).some(f => f.toString() === amigoId);
    if (!esAmigo) { res.status(400); throw new Error('Solo se juega con amigos'); }

    const amigo = await User.findById(amigoId).select('username avatar').lean();
    if (!amigo) { res.status(404); throw new Error('Ese amigo no existe'); }

    // Una partida viva por pareja: varias con la misma persona solo confunden
    const viva = await Sabelotodo.findOne({
        estado: { $in: ['invitacion', 'activa'] },
        'jugadores.user': { $all: [req.user._id, amigo._id] }
    }).lean();
    if (viva) { res.status(400); throw new Error(`Ya tenéis una partida en marcha con ${amigo.username}`); }

    // El invitado entra ya en `jugadores` (puesto 1) para que la partida sepa
    // quien es desde el principio; `invitado` marca que aun no ha dicho que si.
    const partida = await Sabelotodo.create({
        creador: req.user._id,
        invitado: amigo._id,
        jugadores: [
            { user: yo._id, nombre: yo.username, avatar: yo.avatar || '' },
            { user: amigo._id, nombre: amigo.username, avatar: amigo.avatar || '' }
        ],
        estado: 'invitacion',
        vidas: VIDAS
    });

    notificarA(amigo._id, {
        title: 'Sabelotodo',
        body: `${yo.username} te invita a un Sabelotodo en pareja. Seis coronas, tres vidas, los dos juntos.`,
        icon: '/assets/icons/icon-192x192.png',
        url: RUTA
    });

    res.status(201).json(vista(partida, req.user._id));
});

const responderInvitacion = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    if (!partida.invitado || partida.invitado.toString() !== req.user._id.toString() || partida.estado !== 'invitacion') {
        res.status(400); throw new Error('Esa invitación no es tuya o ya se contestó');
    }

    const creador = partida.jugadores[0];
    const yo = partida.jugadores[1];

    if (req.body?.respuesta === 'aceptar') {
        partida.invitado = null;
        partida.estado = 'activa';
        partida.turno = 0;
        await partida.save();
        notificarA(creador.user, { title: 'Sabelotodo', body: `${yo.nombre} ha aceptado. Te toca girar.`, icon: '/assets/icons/icon-192x192.png', url: RUTA });
    } else {
        partida.estado = 'rechazada';
        partida.invitado = null;
        partida.terminadaEn = new Date();
        await partida.save();
    }

    res.json(vista(partida, req.user._id));
});

// ── JUGAR ───────────────────────────────────────────────────────────────────
const girar = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    const mi = puestoDe(partida, req.user._id);
    if (mi < 0) { res.status(403); throw new Error('Esa partida no es tuya'); }
    if (partida.estado !== 'activa') { res.status(400); throw new Error('La partida ha terminado'); }
    if (partida.turno !== mi) { res.status(400); throw new Error('No te toca'); }

    // Si ya hay una en el aire (recarga del movil), se devuelve la misma
    if (!partida.enCurso) {
        const nueva = siguientePregunta(partida);
        // Atomico: solo entra si nadie ha servido una mientras tanto
        const r = await Sabelotodo.updateOne(
            { _id: partida._id, estado: 'activa', turno: mi, enCurso: null },
            { $set: { enCurso: nueva }, $addToSet: { usadas: nueva.preguntaId } }
        );
        if (r.modifiedCount !== 1) { res.status(409); throw new Error('Vuelve a intentarlo'); }
    }

    res.json(vista(await cargar(partida._id), req.user._id));
});

const terminar = async (partida, estado) => {
    partida.estado = estado;
    partida.terminadaEn = new Date();
    partida.enCurso = null;
    const premio = estado === 'ganada' ? PREMIO_GANAR : PREMIO_PERDER;
    partida.premio = premio;
    await partida.save();
    // Los dos cobran lo mismo: es un equipo
    for (const j of partida.jugadores) {
        try { await addRewards(j.user, premio.xp, 0, premio.fichas); }
        catch (e) { console.error('Premio del Sabelotodo no abonado a ' + j.user + ':', e.message); }
    }
};

const contestar = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    const mi = puestoDe(partida, req.user._id);
    if (mi < 0) { res.status(403); throw new Error('Esa partida no es tuya'); }
    if (partida.estado !== 'activa') { res.status(400); throw new Error('La partida ha terminado'); }
    if (partida.turno !== mi || !partida.enCurso) { res.status(400); throw new Error('No hay pregunta que contestar'); }

    const e = partida.enCurso;
    // Se reclama la pregunta de forma atomica: dos toques seguidos no la
    // contestan dos veces.
    const r = await Sabelotodo.updateOne(
        { _id: partida._id, estado: 'activa', turno: mi, 'enCurso.preguntaId': e.preguntaId },
        { $set: { enCurso: null } }
    );
    if (r.modifiedCount !== 1) { res.status(409); throw new Error('Esa pregunta ya se contestó'); }

    const opcion = Number(req.body?.opcion);
    const aTiempo = Date.now() - new Date(e.servidaEn).getTime() <= TIEMPO_MS;
    const acierto = aTiempo && Number.isInteger(opcion) && opcion === e.correcta;

    partida.enCurso = null;
    partida.historial.push({
        jugador: mi,
        preguntaId: e.preguntaId,
        categoria: e.categoria,
        texto: e.texto,
        acierto,
        elegida: Number.isInteger(opcion) && e.opciones[opcion] !== undefined ? e.opciones[opcion] : '',
        correcta: e.opciones[e.correcta]
    });

    const companero = partida.jugadores[1 - mi];
    let mensaje = null;

    if (acierto) {
        if (!partida.coronas.includes(e.categoria)) partida.coronas.push(e.categoria);
        partida.racha += 1;
        if (partida.coronas.length >= CLAVES.length) {
            await terminar(partida, 'ganada');
            mensaje = `¡Seis coronas! ${partida.jugadores[mi].nombre} ha acertado la última. ${PREMIO_GANAR.fichas} fichas y ${PREMIO_GANAR.xp} XP para cada uno.`;
        } else if (partida.racha >= SEGUIDAS_MAX) {
            partida.turno = 1 - mi;
            partida.racha = 0;
            await partida.save();
            mensaje = `${partida.jugadores[mi].nombre} ha acertado tres seguidas. Te toca: ${partida.coronas.length} de ${CLAVES.length} coronas.`;
        } else {
            await partida.save();
        }
    } else {
        partida.vidas = Math.max(0, partida.vidas - 1);
        partida.racha = 0;
        if (partida.vidas <= 0) {
            await terminar(partida, 'perdida');
            mensaje = `Se acabaron las vidas en ${nombreCategoria(e.categoria)}. ${partida.coronas.length} coronas de ${CLAVES.length}. Otra vez será.`;
        } else {
            partida.turno = 1 - mi;
            await partida.save();
            mensaje = `${partida.jugadores[mi].nombre} ha fallado en ${nombreCategoria(e.categoria)}. Te toca, y quedan ${partida.vidas} ${partida.vidas === 1 ? 'vida' : 'vidas'}.`;
        }
    }

    if (mensaje && companero) {
        notificarA(companero.user, { title: 'Sabelotodo', body: mensaje, icon: '/assets/icons/icon-192x192.png', url: RUTA });
    }

    res.json({
        ...vista(partida, req.user._id),
        resultado: { acierto, aTiempo, correcta: e.opciones[e.correcta], elegida: e.opciones[opcion] ?? null, categoria: e.categoria }
    });
});

const abandonar = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    const mi = puestoDe(partida, req.user._id);
    if (mi < 0) { res.status(403); throw new Error('Esa partida no es tuya'); }
    if (!['invitacion', 'activa'].includes(partida.estado)) { res.status(400); throw new Error('Ya estaba terminada'); }

    const compañero = partida.jugadores[1 - mi] || null;
    // Cancelar una invitacion que nadie ha contestado no es abandonar nada
    partida.estado = partida.estado === 'invitacion' ? 'rechazada' : 'abandonada';
    partida.invitado = null;
    partida.enCurso = null;
    partida.terminadaEn = new Date();
    await partida.save();

    if (compañero && partida.estado === 'abandonada') {
        notificarA(compañero.user, { title: 'Sabelotodo', body: `${partida.jugadores[mi].nombre} ha dejado la partida.`, icon: '/assets/icons/icon-192x192.png', url: RUTA });
    }
    res.json(vista(partida, req.user._id));
});

// ── LISTAS ──────────────────────────────────────────────────────────────────
const misPartidas = asyncHandler(async (req, res) => {
    const filas = await Sabelotodo.find({ 'jugadores.user': req.user._id }).sort({ updatedAt: -1 }).limit(30);
    res.json(filas.map(p => vista(p, req.user._id)));
});

const verPartida = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    const dentro = puestoDe(partida, req.user._id) >= 0;
    if (!dentro) { res.status(403); throw new Error('Esa partida no es tuya'); }
    res.json(vista(partida, req.user._id));
});

/** Invitaciones pendientes, para el buzon. */
const misInvitaciones = asyncHandler(async (req, res) => {
    const filas = await Sabelotodo.find({ invitado: req.user._id, estado: 'invitacion' })
        .sort({ createdAt: -1 }).limit(20).lean();
    res.json(filas.map(f => ({
        _id: f._id,
        de: f.jugadores[0]?.nombre || 'Alguien',
        avatar: f.jugadores[0]?.avatar || '',
        creada: f.createdAt
    })));
});

/** Cuantas cosas piden mi atencion: invitaciones + partidas en las que me toca. */
const pendientesDe = async (userId) => {
    const [invitaciones, partidas] = await Promise.all([
        Sabelotodo.countDocuments({ invitado: userId, estado: 'invitacion' }),
        Sabelotodo.find({ estado: 'activa', 'jugadores.user': userId }).select('jugadores turno').lean()
    ]);
    const meTocan = partidas.filter(p => p.jugadores[p.turno]?.user?.toString() === userId.toString()).length;
    return invitaciones + meTocan;
};

module.exports = {
    crear, responderInvitacion, girar, contestar, abandonar, misPartidas, verPartida, misInvitaciones, pendientesDe,
    // Para las pruebas
    VIDAS, SEGUIDAS_MAX, PREMIO_GANAR, PREMIO_PERDER, TIEMPO_MS, siguientePregunta, vista
};
