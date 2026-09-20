const asyncHandler = require('express-async-handler');
const Sabelotodo = require('../models/Sabelotodo');
const User = require('../models/User');
const { PREGUNTAS, CATEGORIAS } = require('../data/preguntas');
const { addRewards } = require('../services/levelService');
const { notificarA } = require('./pushController');

/**
 * SABELOTODO: el trivial cooperativo, de dos a cuatro. Las reglas viven aqui.
 */
const VIDAS = 3;
const SEGUIDAS_MAX = 3;          // aciertos seguidos antes de pasar el turno
const TIEMPO_MS = 30000;         // el movil enseña 20 s; el servidor da margen de red
const MAX_JUGADORES = 4;
const PREMIO_GANAR = { xp: 250, fichas: 300 };   // para CADA uno
const PREMIO_PERDER = { xp: 40, fichas: 0 };
const APUESTA_MIN = 10;
const APUESTA_MAX = 5000;
const CLAVES = Object.keys(CATEGORIAS);
const RUTA = '/games/sabelotodo';
const PUSH = (body, title = 'Sabelotodo') => ({ title, body, icon: '/assets/icons/icon-192x192.png', url: RUTA });

const barajar = (lista) => {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

/** Elige categoria (entre las que le faltan a quien juega) y una pregunta no repetida. */
const siguientePregunta = (partida, coronas = partida.coronas) => {
    const faltan = CLAVES.filter(c => !coronas.includes(c));
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

const mismo = (a, b) => a && b && a.toString() === b.toString();
const puestoDe = (partida, userId) => partida.jugadores.findIndex(j => mismo(j.user, userId));
const estaInvitado = (partida, userId) => partida.invitados.some(j => mismo(j.user, userId));
const persona = (j) => ({ _id: j.user, nombre: j.nombre, avatar: j.avatar, coronas: j.coronas || [], vidas: j.vidas, eliminado: !!j.eliminado });
const esDuelo = (p) => p.modo === 'duelo';
/** En duelo, las coronas y vidas que se enseñan son las de quien mira */
const loMio = (partida, yo) => esDuelo(partida) && yo ? { coronas: yo.coronas || [], vidas: yo.vidas } : { coronas: partida.coronas, vidas: partida.vidas };

// El bote: cobrar y devolver
const cobrar = async (userId, fichas) => {
    if (fichas <= 0) return true;
    const r = await User.updateOne({ _id: userId, gameCoins: { $gte: fichas } }, { $inc: { gameCoins: -fichas } });
    return r.modifiedCount === 1;
};
const abonar = (userId, fichas) => fichas > 0 ? User.updateOne({ _id: userId }, { $inc: { gameCoins: fichas } }) : Promise.resolve();
const devolverApuestas = async (partida) => {
    for (const j of partida.jugadores) if (j.pagado) { await abonar(j.user, partida.apuesta); j.pagado = false; }
    partida.bote = 0;
};

/** Lo que ve cada uno. La respuesta correcta de la pregunta en curso NO viaja. */
const vista = (partida, yoId) => {
    const miPuesto = puestoDe(partida, yoId);
    const yo = miPuesto >= 0 ? partida.jugadores[miPuesto] : null;
    const soyInvitado = estaInvitado(partida, yoId);
    const soyCreador = mismo(partida.creador, yoId);
    const meToca = partida.estado === 'activa' && partida.turno === miPuesto;
    const e = partida.enCurso;
    const deTurno = partida.estado === 'activa' ? partida.jugadores[partida.turno] : null;

    const mio = loMio(partida, yo);
    return {
        _id: partida._id,
        estado: partida.estado,
        modo: partida.modo || 'equipo',
        apuesta: partida.apuesta || 0,
        bote: partida.bote || 0,
        ganador: partida.ganador ? persona(partida.jugadores.find(j => mismo(j.user, partida.ganador)) || { user: partida.ganador, nombre: '' }) : null,
        ganeYo: !!(partida.ganador && mismo(partida.ganador, yoId)),
        soyCreador,
        soyInvitado,
        miPuesto,
        meToca,
        yo: yo ? persona(yo) : null,
        // Todos los del equipo, con quien tiene el turno marcado
        jugadores: partida.jugadores.map((j, i) => ({ ...persona(j), soyYo: i === miPuesto, esTurno: partida.estado === 'activa' && i === partida.turno })),
        pendientes: partida.invitados.map(persona),
        // Para las pantallas que hablan de "el otro": el de turno si no soy
        // yo, o el primero que no sea yo.
        companero: (deTurno && !meToca ? persona(deTurno) : null) || partida.jugadores.filter((_, i) => i !== miPuesto).map(persona)[0] || partida.invitados.map(persona)[0] || null,
        maxJugadores: MAX_JUGADORES,
        puedeEmpezar: soyCreador && partida.estado === 'invitacion' && partida.jugadores.length >= 2,
        puedeInvitar: soyCreador && partida.estado === 'invitacion' && partida.jugadores.length + partida.invitados.length < MAX_JUGADORES,
        coronas: mio.coronas,
        vidas: mio.vidas,
        vidasMax: VIDAS,
        racha: partida.racha,
        seguidasMax: SEGUIDAS_MAX,
        // La pregunta solo la ve quien tiene que contestarla; el resto solo
        // sabe que hay una en el aire.
        enCurso: e
            ? (meToca
                ? { preguntaId: e.preguntaId, categoria: e.categoria, texto: e.texto, opciones: e.opciones, servidaEn: e.servidaEn, segundos: Math.max(0, Math.floor((TIEMPO_MS - (Date.now() - new Date(e.servidaEn).getTime())) / 1000)) }
                : { categoria: e.categoria })
            : null,
        historial: partida.historial.slice(-12).reverse().map(h => ({
            ...(h.toObject ? h.toObject() : h),
            fuiYo: mismo(h.usuario, yoId)
        })),
        premio: partida.premio,
        creada: partida.createdAt,
        actualizada: partida.updatedAt,
        terminadaEn: partida.terminadaEn
    };
};

const cargar = (id) => Sabelotodo.findById(id);
const nombreCategoria = (c) => CATEGORIAS[c]?.nombre || c;

/** ¿Estos dos ya comparten una partida viva? */
const yaJuntos = (a, b) => Sabelotodo.exists({
    estado: { $in: ['invitacion', 'activa'] },
    $and: [
        { $or: [{ 'jugadores.user': a }, { 'invitados.user': a }] },
        { $or: [{ 'jugadores.user': b }, { 'invitados.user': b }] }
    ]
});

/** Comprueba que son amigos y devuelve sus fichas. Lanza si alguno no vale. */
const amigosValidos = async (res, yo, ids) => {
    const limpios = [...new Set(ids.map(String).filter(id => id && id !== yo._id.toString()))];
    if (limpios.length === 0) { res.status(400); throw new Error('Elige al menos a un amigo'); }
    const amigosSet = new Set((yo.friends || []).map(String));
    if (limpios.some(id => !amigosSet.has(id))) { res.status(400); throw new Error('Solo se juega con amigos'); }
    const gente = await User.find({ _id: { $in: limpios } }).select('username avatar').lean();
    if (gente.length !== limpios.length) { res.status(404); throw new Error('Alguno de esos amigos no existe'); }
    for (const g of gente) {
        if (await yaJuntos(yo._id, g._id)) { res.status(400); throw new Error(`Ya tenéis una partida en marcha con ${g.username}`); }
    }
    return gente;
};

const avisarInvitados = (partida, gente) => {
    const quien = partida.jugadores[0]?.nombre || 'Alguien';
    const texto = esDuelo(partida)
        ? `${quien} te reta a un Sabelotodo por ${partida.apuesta} fichas. El que llegue a seis coronas se lleva el bote.`
        : `${quien} te invita a un Sabelotodo en equipo. Seis coronas, tres vidas, todos juntos.`;
    for (const g of gente) notificarA(g._id, PUSH(texto));
};

// ── CREAR E INVITAR ─────────────────────────────────────────────────────────
const crear = asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.amigosIds) ? req.body.amigosIds : (req.body?.amigoId ? [req.body.amigoId] : []);
    if (ids.length > MAX_JUGADORES - 1) { res.status(400); throw new Error(`Como mucho ${MAX_JUGADORES - 1} invitados`); }

    const yo = await User.findById(req.user._id).select('username avatar friends gameCoins').lean();
    const gente = await amigosValidos(res, yo, ids);

    // Modo duelo: apuesta por cabeza, y el creador la pone ya
    const modo = req.body?.modo === 'duelo' ? 'duelo' : 'equipo';
    let apuesta = 0;
    if (modo === 'duelo') {
        apuesta = Math.floor(Number(req.body?.apuesta));
        if (!Number.isFinite(apuesta) || apuesta < APUESTA_MIN || apuesta > APUESTA_MAX) { res.status(400); throw new Error(`La apuesta va de ${APUESTA_MIN} a ${APUESTA_MAX} fichas`); }
        if (!(await cobrar(yo._id, apuesta))) { res.status(400); throw new Error('No te llegan las fichas para esa apuesta'); }
    }

    const partida = await Sabelotodo.create({
        creador: yo._id,
        modo,
        apuesta,
        bote: apuesta,
        jugadores: [{ user: yo._id, nombre: yo.username, avatar: yo.avatar || '', vidas: VIDAS, pagado: modo === 'duelo' }],
        invitados: gente.map(g => ({ user: g._id, nombre: g.username, avatar: g.avatar || '', vidas: VIDAS })),
        estado: 'invitacion',
        vidas: VIDAS
    });

    avisarInvitados(partida, gente);
    res.status(201).json(vista(partida, req.user._id));
});

/** El creador mete a alguien mas mientras la sala sigue abierta. */
const invitar = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    if (!mismo(partida.creador, req.user._id)) { res.status(403); throw new Error('Solo invita quien la creó'); }
    if (partida.estado !== 'invitacion') { res.status(400); throw new Error('La partida ya ha empezado'); }
    if (partida.jugadores.length + partida.invitados.length >= MAX_JUGADORES) { res.status(400); throw new Error(`Sois ${MAX_JUGADORES} como mucho`); }

    const yo = await User.findById(req.user._id).select('username avatar friends').lean();
    const [g] = await amigosValidos(res, yo, [req.body?.amigoId]);
    partida.invitados.push({ user: g._id, nombre: g.username, avatar: g.avatar || '' });
    await partida.save();
    avisarInvitados(partida, [g]);
    res.json(vista(partida, req.user._id));
});

const arrancar = async (partida) => {
    partida.estado = 'activa';
    partida.turno = 0;
    partida.invitados = [];
    await partida.save();
    const primero = partida.jugadores[0];
    for (const j of partida.jugadores) {
        notificarA(j.user, PUSH(mismo(j.user, primero.user)
            ? `Sois ${partida.jugadores.length}. Empieza la partida: te toca girar.`
            : `Sois ${partida.jugadores.length}. Empieza la partida; abre ${primero.nombre}.`));
    }
};

const responderInvitacion = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    if (partida.estado !== 'invitacion' || !estaInvitado(partida, req.user._id)) {
        res.status(400); throw new Error('Esa invitación no es tuya o ya se contestó');
    }

    const yo = partida.invitados.find(j => mismo(j.user, req.user._id));
    partida.invitados = partida.invitados.filter(j => !mismo(j.user, req.user._id));
    const creador = partida.jugadores[0];

    if (req.body?.respuesta === 'aceptar') {
        if (esDuelo(partida)) {
            if (!(await cobrar(req.user._id, partida.apuesta))) { res.status(400); throw new Error(`Te faltan fichas: la apuesta es de ${partida.apuesta}`); }
            yo.pagado = true;
            partida.bote = (partida.bote || 0) + partida.apuesta;
        }
        yo.vidas = VIDAS;
        partida.jugadores.push(yo);
        if (partida.invitados.length === 0) {
            // Ya ha contestado todo el mundo: se empieza sin esperar a nadie
            await arrancar(partida);
        } else {
            await partida.save();
            notificarA(creador.user, PUSH(`${yo.nombre} se apunta. Ya sois ${partida.jugadores.length}; puedes empezar o esperar al resto.`));
        }
    } else if (partida.invitados.length === 0 && partida.jugadores.length < 2) {
        // Nadie ha querido: no hay partida, y el creador recupera su apuesta
        await devolverApuestas(partida);
        partida.estado = 'rechazada';
        partida.terminadaEn = new Date();
        await partida.save();
    } else if (partida.invitados.length === 0) {
        await arrancar(partida);
    } else {
        await partida.save();
    }

    res.json(vista(partida, req.user._id));
});

/** El creador arranca sin esperar a los que faltan por contestar. */
const empezar = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    if (!mismo(partida.creador, req.user._id)) { res.status(403); throw new Error('Solo empieza quien la creó'); }
    if (partida.estado !== 'invitacion') { res.status(400); throw new Error('Ya está en marcha'); }
    if (partida.jugadores.length < 2) { res.status(400); throw new Error('Hace falta que acepte al menos uno'); }
    await arrancar(partida);
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
        const nueva = siguientePregunta(partida, esDuelo(partida) ? partida.jugadores[mi].coronas : partida.coronas);
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
    // Todos cobran lo mismo: es un equipo
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
    const quien = partida.jugadores[mi];

    partida.enCurso = null;
    partida.historial.push({
        usuario: quien.user,
        nombre: quien.nombre,
        preguntaId: e.preguntaId,
        categoria: e.categoria,
        texto: e.texto,
        acierto,
        elegida: Number.isInteger(opcion) && e.opciones[opcion] !== undefined ? e.opciones[opcion] : '',
        correcta: e.opciones[e.correcta]
    });

    // El siguiente que siga en pie (en equipo, nadie queda eliminado)
    const siguienteVivo = (desde) => {
        for (let k = 1; k <= partida.jugadores.length; k++) {
            const idx = (desde + k) % partida.jugadores.length;
            if (!partida.jugadores[idx].eliminado) return idx;
        }
        return desde;
    };
    const siguiente = siguienteVivo(mi);
    // A quien avisar y con que: al siguiente cuando cambia el turno; a todos
    // cuando se acaba.
    let aviso = null;

    if (esDuelo(partida)) {
        const resultadoDuelo = await contestarEnDuelo(partida, mi, e, acierto, siguiente);
        if (resultadoDuelo.aviso) {
            const destinatarios = resultadoDuelo.aviso.todos ? partida.jugadores.filter((_, i) => i !== mi) : [partida.jugadores[resultadoDuelo.aviso.a]];
            for (const d of destinatarios) if (d) notificarA(d.user, PUSH(resultadoDuelo.aviso.texto));
        }
        return res.json({
            ...vista(partida, req.user._id),
            resultado: { acierto, aTiempo, correcta: e.opciones[e.correcta], elegida: e.opciones[opcion] ?? null, categoria: e.categoria }
        });
    }

    if (acierto) {
        if (!partida.coronas.includes(e.categoria)) partida.coronas.push(e.categoria);
        partida.racha += 1;
        if (partida.coronas.length >= CLAVES.length) {
            await terminar(partida, 'ganada');
            aviso = { todos: true, texto: `¡Seis coronas! ${quien.nombre} ha acertado la última. ${PREMIO_GANAR.fichas} fichas y ${PREMIO_GANAR.xp} XP para cada uno.` };
        } else if (partida.racha >= SEGUIDAS_MAX) {
            partida.turno = siguiente;
            partida.racha = 0;
            await partida.save();
            aviso = { todos: false, texto: `${quien.nombre} ha acertado tres seguidas. Te toca: ${partida.coronas.length} de ${CLAVES.length} coronas.` };
        } else {
            await partida.save();
        }
    } else {
        partida.vidas = Math.max(0, partida.vidas - 1);
        partida.racha = 0;
        if (partida.vidas <= 0) {
            await terminar(partida, 'perdida');
            aviso = { todos: true, texto: `Se acabaron las vidas en ${nombreCategoria(e.categoria)}. ${partida.coronas.length} coronas de ${CLAVES.length}. Otra vez será.` };
        } else {
            partida.turno = siguiente;
            await partida.save();
            aviso = { todos: false, texto: `${quien.nombre} ha fallado en ${nombreCategoria(e.categoria)}. Te toca, y quedan ${partida.vidas} ${partida.vidas === 1 ? 'vida' : 'vidas'}.` };
        }
    }

    if (aviso) {
        const destinatarios = aviso.todos ? partida.jugadores.filter((_, i) => i !== mi) : [partida.jugadores[siguiente]];
        for (const d of destinatarios) if (d) notificarA(d.user, PUSH(aviso.texto));
    }

    res.json({
        ...vista(partida, req.user._id),
        resultado: { acierto, aTiempo, correcta: e.opciones[e.correcta], elegida: e.opciones[opcion] ?? null, categoria: e.categoria }
    });
});

/** El duelo se acaba: el ganador se lleva el bote entero. */
const coronarGanador = async (partida, idx) => {
    const g = partida.jugadores[idx];
    partida.estado = 'terminada';
    partida.ganador = g.user;
    partida.terminadaEn = new Date();
    partida.enCurso = null;
    partida.premio = { xp: 0, fichas: partida.bote };
    await partida.save();
    await abonar(g.user, partida.bote);
};

/**
 * Una respuesta en modo duelo: coronas y vidas del que contesta. Gana quien
 * llega a seis coronas, o el ultimo que queda con vidas.
 */
const contestarEnDuelo = async (partida, mi, e, acierto, siguiente) => {
    const yo = partida.jugadores[mi];
    if (acierto) {
        if (!yo.coronas.includes(e.categoria)) yo.coronas.push(e.categoria);
        partida.racha += 1;
        if (yo.coronas.length >= CLAVES.length) {
            await coronarGanador(partida, mi);
            return { aviso: { todos: true, texto: `${yo.nombre} ha llegado a las seis coronas y se lleva ${partida.bote} fichas.` } };
        }
        if (partida.racha >= SEGUIDAS_MAX) {
            partida.turno = siguiente; partida.racha = 0;
            await partida.save();
            return { aviso: { a: siguiente, texto: `${yo.nombre} lleva ${yo.coronas.length} coronas. Te toca.` } };
        }
        await partida.save();
        return {};
    }
    yo.vidas = Math.max(0, (yo.vidas ?? VIDAS) - 1);
    partida.racha = 0;
    if (yo.vidas <= 0) yo.eliminado = true;
    const vivos = partida.jugadores.map((j, i) => (!j.eliminado ? i : -1)).filter(i => i >= 0);
    if (vivos.length === 1) {
        await coronarGanador(partida, vivos[0]);
        return { aviso: { todos: true, texto: `${partida.jugadores[vivos[0]].nombre} es el último en pie y se lleva ${partida.bote} fichas.` } };
    }
    partida.turno = siguiente;
    await partida.save();
    return { aviso: { a: siguiente, texto: yo.eliminado ? `${yo.nombre} se ha quedado sin vidas. Te toca.` : `${yo.nombre} ha fallado. Te toca.` } };
};

/**
 * Dejar la partida. En la sala, el creador la cancela y un invitado se
 * borra sin mas. En marcha, si quedan al menos dos se sigue sin el; si solo
 * erais dos, se acaba para los dos.
 */
const abandonar = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    const mi = puestoDe(partida, req.user._id);
    const invitado = estaInvitado(partida, req.user._id);
    if (mi < 0 && !invitado) { res.status(403); throw new Error('Esa partida no es tuya'); }
    if (!['invitacion', 'activa'].includes(partida.estado)) { res.status(400); throw new Error('Ya estaba terminada'); }

    const yo = mi >= 0 ? partida.jugadores[mi] : null;
    const otros = partida.jugadores.filter((_, i) => i !== mi);

    if (partida.estado === 'invitacion') {
        if (mismo(partida.creador, req.user._id)) {
            // Cancelar una sala que no ha empezado no es abandonar nada: cada
            // uno recupera lo que puso
            await devolverApuestas(partida);
            partida.estado = 'rechazada';
            partida.invitados = [];
            partida.terminadaEn = new Date();
        } else {
            if (yo?.pagado) { await abonar(yo.user, partida.apuesta); partida.bote -= partida.apuesta; }
            partida.jugadores = partida.jugadores.filter(j => !mismo(j.user, req.user._id));
            partida.invitados = partida.invitados.filter(j => !mismo(j.user, req.user._id));
        }
        await partida.save();
        return res.json(vista(partida, req.user._id));
    }

    if (esDuelo(partida)) {
        // Irse de un duelo es rendirse: la apuesta se queda en el bote
        yo.eliminado = true;
        const vivos = partida.jugadores.map((j, i) => (!j.eliminado ? i : -1)).filter(i => i >= 0);
        if (vivos.length === 1) {
            await coronarGanador(partida, vivos[0]);
            for (const o of otros) notificarA(o.user, PUSH(`${yo.nombre} se ha rendido. ${partida.jugadores[vivos[0]].nombre} se lleva ${partida.bote} fichas.`));
        } else {
            if (mi === partida.turno) { partida.enCurso = null; partida.racha = 0; partida.turno = vivos.find(i => i > mi) ?? vivos[0]; }
            await partida.save();
            for (const o of otros) notificarA(o.user, PUSH(`${yo.nombre} se ha rendido. Seguís ${vivos.length}.`));
        }
        return res.json(vista(partida, req.user._id));
    }

    if (partida.jugadores.length > 2) {
        // El equipo sigue sin el. El turno se recoloca para que siga
        // apuntando a la misma persona (o a la siguiente si era la suya).
        const eraSuTurno = mi === partida.turno;
        partida.jugadores.splice(mi, 1);
        if (mi < partida.turno) partida.turno -= 1;
        if (partida.turno >= partida.jugadores.length) partida.turno = 0;
        // Si se va con el turno (y quiza una pregunta en el aire), el turno
        // pasa al siguiente y la pregunta se descarta sin castigo.
        if (eraSuTurno) { partida.enCurso = null; partida.racha = 0; }
        await partida.save();
        for (const o of otros) notificarA(o.user, PUSH(`${yo.nombre} ha dejado la partida. Seguís ${partida.jugadores.length}.`));
    } else {
        partida.estado = 'abandonada';
        partida.enCurso = null;
        partida.terminadaEn = new Date();
        await partida.save();
        for (const o of otros) notificarA(o.user, PUSH(`${yo.nombre} ha dejado la partida.`));
    }
    res.json(vista(partida, req.user._id));
});

// ── LISTAS ──────────────────────────────────────────────────────────────────
const misPartidas = asyncHandler(async (req, res) => {
    const filas = await Sabelotodo.find({
        $or: [{ 'jugadores.user': req.user._id }, { 'invitados.user': req.user._id, estado: 'invitacion' }]
    }).sort({ updatedAt: -1 }).limit(30);
    res.json(filas.map(p => vista(p, req.user._id)));
});

const verPartida = asyncHandler(async (req, res) => {
    const partida = await cargar(req.params.id);
    if (!partida) { res.status(404); throw new Error('Partida no encontrada'); }
    if (puestoDe(partida, req.user._id) < 0 && !estaInvitado(partida, req.user._id)) { res.status(403); throw new Error('Esa partida no es tuya'); }
    res.json(vista(partida, req.user._id));
});

/** Invitaciones pendientes, para el buzon. */
const misInvitaciones = asyncHandler(async (req, res) => {
    const filas = await Sabelotodo.find({ 'invitados.user': req.user._id, estado: 'invitacion' })
        .sort({ createdAt: -1 }).limit(20).lean();
    res.json(filas.map(f => ({
        _id: f._id,
        de: f.jugadores[0]?.nombre || 'Alguien',
        avatar: f.jugadores[0]?.avatar || '',
        somos: f.jugadores.length + f.invitados.length,
        modo: f.modo || 'equipo',
        apuesta: f.apuesta || 0,
        creada: f.createdAt
    })));
});

/** Cuantas cosas piden mi atencion: invitaciones + partidas en las que me toca. */
const pendientesDe = async (userId) => {
    const [invitaciones, partidas] = await Promise.all([
        Sabelotodo.countDocuments({ 'invitados.user': userId, estado: 'invitacion' }),
        Sabelotodo.find({ estado: 'activa', 'jugadores.user': userId }).select('jugadores turno').lean()
    ]);
    const meTocan = partidas.filter(p => mismo(p.jugadores[p.turno]?.user, userId)).length;
    return invitaciones + meTocan;
};

module.exports = {
    crear, invitar, empezar, responderInvitacion, girar, contestar, abandonar, misPartidas, verPartida, misInvitaciones, pendientesDe,
    // Para las pruebas
    VIDAS, SEGUIDAS_MAX, MAX_JUGADORES, PREMIO_GANAR, PREMIO_PERDER, TIEMPO_MS, APUESTA_MIN, APUESTA_MAX, siguientePregunta, vista
};
