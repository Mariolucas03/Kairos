const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const CartaAlta = require('../models/CartaAlta');
const User = require('../models/User');
const { mazoNuevo, fuerzaDe, nombreDe, NOMBRES } = require('../services/barajaEspanola');
const { notificarA } = require('./pushController');

/**
 * CARTA ALTA — salas de juego.
 *
 * Tres reglas gobiernan todo lo de aquí:
 *
 *  1. EL MAZO NO SALE DEL SERVIDOR. Cada respuesta se monta a mano con
 *     `vista()`, que lo deja fuera a propósito. Nunca se devuelve el documento
 *     tal cual: eso sería mandarle al móvil las cartas que aún no ha pedido.
 *
 *  2. HAY DINERO Y VARIAS PERSONAS TOCANDO LA MISMA SALA. Todo lo que mueve
 *     saldo lleva la condición dentro de la escritura, no en un "leo, compruebo
 *     y escribo" que dos móviles pueden atravesar a la vez.
 *
 *  3. EL JUEGO NO CREA FICHAS. Entre personas, lo que pierde uno lo gana otro y
 *     la suma no se mueve. Contra la máquina, la casa se queda los empates: es
 *     lo único que le da ventaja, y es una regla que se puede explicar en una
 *     frase en vez de un porcentaje escondido.
 */

const APUESTA_MINIMA = 10;
const APUESTA_MAXIMA = 5000;

// Con más de ocho, la partida son cinco manos y no da tiempo ni a contar nada.
const MAX_JUGADORES = 8;

const NOMBRE_MAQUINA = 'La Máquina';

/** Lo que se le manda al móvil. El mazo NO entra. */
const vista = (sala, yoId) => {
    const yo = yoId.toString();
    const miPuesto = sala.jugadores.findIndex(j => j.user && j.user.toString() === yo);
    const soyLider = sala.lider.toString() === yo;
    const manoEnCurso = sala.manos.find(m => m.ganador === null && !m.empate) || null;

    const yaTire = manoEnCurso
        ? manoEnCurso.tiradas.some(t => t.puesto === miPuesto)
        : false;

    const miCarta = manoEnCurso
        ? (manoEnCurso.tiradas.find(t => t.puesto === miPuesto)?.carta || null)
        : null;

    const activos = sala.jugadores.filter(j => j.activo).length;

    return {
        _id: sala._id,
        estado: sala.estado,
        apuesta: sala.apuesta,
        bote: sala.bote,
        contraMaquina: sala.contraMaquina,
        soyLider,
        miPuesto,

        jugadores: sala.jugadores.map((j, i) => ({
            puesto: i,
            nombre: j.nombre,
            avatar: j.avatar,
            esMaquina: j.esMaquina,
            esLider: !!(j.user && j.user.toString() === sala.lider.toString()),
            soyYo: i === miPuesto,
            saldo: j.saldo,
            activo: j.activo,
            // Solo importa en partida: si ya ha levantado en la mano en curso
            haTirado: manoEnCurso ? manoEnCurso.tiradas.some(t => t.puesto === i) : false,
            _id: j.user
        })),

        invitadosPendientes: sala.invitados.length,
        plazasLibres: Math.max(0, MAX_JUGADORES - sala.jugadores.length - sala.invitados.length),
        maxJugadores: MAX_JUGADORES,

        cartasRestantes: sala.mazo.length,
        manosJugadas: sala.manos.filter(m => m.ganador !== null || m.empate).length,
        manosTotales: sala.manosTotales,

        enCurso: manoEnCurso ? { numero: manoEnCurso.numero, yaTire, miCarta } : null,

        historial: sala.manos
            .filter(m => m.ganador !== null || m.empate)
            .map(m => ({
                numero: m.numero,
                empate: m.empate,
                premio: m.premio,
                ganador: m.ganador >= 0 ? sala.jugadores[m.ganador]?.nombre : null,
                ganeYo: m.ganador === miPuesto,
                tiradas: m.tiradas.map(t => ({
                    nombre: sala.jugadores[t.puesto]?.nombre,
                    soyYo: t.puesto === miPuesto,
                    carta: t.carta
                }))
            }))
            .reverse(),

        jugadoresActivos: activos,
        creada: sala.createdAt,
        terminadaEn: sala.terminadaEn
    };
};

const cargar = (id) => CartaAlta.findById(id);

const puestoDe = (sala, userId) =>
    sala.jugadores.findIndex(j => j.user && j.user.toString() === userId.toString());

/** Crea una sala. Quien la crea entra como líder. */
const crearSala = asyncHandler(async (req, res) => {
    const fichas = Math.floor(Number(req.body?.apuesta));
    if (!Number.isFinite(fichas) || fichas < APUESTA_MINIMA || fichas > APUESTA_MAXIMA) {
        res.status(400);
        throw new Error(`La apuesta va de ${APUESTA_MINIMA} a ${APUESTA_MAXIMA} fichas`);
    }

    const yo = await User.findById(req.user._id).select('username avatar gameCoins').lean();
    if ((yo.gameCoins || 0) < fichas) { res.status(400); throw new Error('No te llegan las fichas ni para una mano'); }

    // Una sala abierta a la vez: dos salas tuyas en marcha solo sirven para
    // confundir a quien recibe la invitación.
    const abierta = await CartaAlta.findOne({ lider: req.user._id, estado: { $in: ['sala', 'activa'] } }).lean();
    if (abierta) { res.status(400); throw new Error('Ya tienes una sala abierta'); }

    const sala = await CartaAlta.create({
        lider: req.user._id,
        apuesta: fichas,
        apuestaBase: fichas,
        jugadores: [{ user: yo._id, nombre: yo.username, avatar: yo.avatar || '', esMaquina: false }],
        estado: 'sala'
    });

    res.status(201).json(vista(sala, req.user._id));
});

/** Invitar a un amigo a la sala. */
const invitar = asyncHandler(async (req, res) => {
    const { amigoId } = req.body || {};
    if (!mongoose.isValidObjectId(amigoId)) { res.status(400); throw new Error('Elige a quién invitas'); }

    const sala = await cargar(req.params.id);
    if (!sala) { res.status(404); throw new Error('Sala no encontrada'); }
    if (sala.lider.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Solo el líder invita'); }
    if (sala.estado !== 'sala') { res.status(400); throw new Error('La partida ya ha empezado'); }

    if (sala.jugadores.length + sala.invitados.length >= MAX_JUGADORES) {
        res.status(400);
        throw new Error(`La sala está llena (máximo ${MAX_JUGADORES})`);
    }

    if (puestoDe(sala, amigoId) >= 0) { res.status(400); throw new Error('Ya está en la sala'); }
    if (sala.invitados.some(i => i.toString() === amigoId.toString())) {
        res.status(400); throw new Error('Ya le has invitado');
    }

    // Solo amigos: evita que cualquiera pueda mandarte a jugarte dinero.
    const yo = await User.findById(req.user._id).select('friends username').lean();
    if (!(yo.friends || []).some(f => f.toString() === amigoId.toString())) {
        res.status(403); throw new Error('Solo puedes invitar a tus amigos');
    }

    const amigo = await User.findById(amigoId).select('username gameCoins').lean();
    if (!amigo) { res.status(404); throw new Error('Ese usuario ya no existe'); }
    if ((amigo.gameCoins || 0) < sala.apuesta) {
        res.status(400);
        throw new Error(`A ${amigo.username} no le llegan las fichas para esa apuesta`);
    }

    sala.invitados.push(amigoId);
    await sala.save();

    notificarA(amigoId, {
        title: '🃏 Te invitan a Carta Alta',
        body: `${yo.username} monta una partida de ${sala.apuesta} fichas por mano.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/games/carta-alta'
    });

    res.json(vista(sala, req.user._id));
});

/** Aceptar o rechazar una invitación. */
const responderInvitacion = asyncHandler(async (req, res) => {
    const acepta = req.body?.respuesta === 'aceptar';
    const sala = await cargar(req.params.id);

    if (!sala || sala.estado !== 'sala') { res.status(404); throw new Error('Esa sala ya no está disponible'); }
    const invitado = sala.invitados.some(i => i.toString() === req.user._id.toString());
    if (!invitado) { res.status(404); throw new Error('No tienes ninguna invitación a esa sala'); }

    sala.invitados = sala.invitados.filter(i => i.toString() !== req.user._id.toString());

    if (!acepta) {
        await sala.save();
        return res.json({ message: 'Invitación rechazada' });
    }

    if (sala.jugadores.length >= MAX_JUGADORES) {
        await sala.save();
        res.status(400); throw new Error('La sala se ha llenado');
    }

    const yo = await User.findById(req.user._id).select('username avatar').lean();
    sala.jugadores.push({ user: yo._id, nombre: yo.username, avatar: yo.avatar || '', esMaquina: false });
    await sala.save();

    notificarA(sala.lider, {
        title: '🃏 Se han unido',
        body: `${yo.username} entra en tu sala de Carta Alta.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/games/carta-alta'
    });

    res.json(vista(sala, req.user._id));
});

/** Expulsar a alguien, o retirar una invitación. Solo el líder. */
const expulsar = asyncHandler(async (req, res) => {
    const { jugadorId } = req.body || {};
    const sala = await cargar(req.params.id);

    if (!sala) { res.status(404); throw new Error('Sala no encontrada'); }
    if (sala.lider.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Solo el líder expulsa'); }
    if (sala.estado !== 'sala') { res.status(400); throw new Error('Con la partida empezada ya no se puede expulsar'); }
    if (jugadorId?.toString() === req.user._id.toString()) {
        res.status(400); throw new Error('No puedes expulsarte a ti mismo. Cierra la sala.');
    }

    const antesJ = sala.jugadores.length;
    sala.jugadores = sala.jugadores.filter(j => !(j.user && j.user.toString() === jugadorId?.toString()));
    const antesI = sala.invitados.length;
    sala.invitados = sala.invitados.filter(i => i.toString() !== jugadorId?.toString());

    if (sala.jugadores.length === antesJ && sala.invitados.length === antesI) {
        res.status(404); throw new Error('Esa persona no está en la sala');
    }

    await sala.save();

    if (antesJ !== sala.jugadores.length) {
        notificarA(jugadorId, {
            title: '🃏 Fuera de la sala',
            body: 'Te han sacado de la partida de Carta Alta.',
            icon: '/assets/icons/icon-192x192.png',
            url: '/games/carta-alta'
        });
    }

    res.json(vista(sala, req.user._id));
});

/**
 * EMPEZAR. Solo el líder.
 *
 * Si no hay nadie más, entra la máquina: la promesa es que puedas jugar aunque
 * no tengas a quien invitar, y una sala de uno no es una partida.
 */
const empezar = asyncHandler(async (req, res) => {
    const sala = await cargar(req.params.id);
    if (!sala) { res.status(404); throw new Error('Sala no encontrada'); }
    if (sala.lider.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Solo el líder empieza la partida'); }
    if (sala.estado !== 'sala') { res.status(400); throw new Error('La partida ya ha empezado'); }

    const humanos = sala.jugadores.filter(j => !j.esMaquina).length;

    if (humanos === 1) {
        sala.contraMaquina = true;
        sala.jugadores.push({ user: null, esMaquina: true, nombre: NOMBRE_MAQUINA, avatar: '' });
    }

    // Las invitaciones sin contestar se caen: la partida empieza con quien está.
    sala.invitados = [];

    // 40 cartas entre los que juegan. Con dos son 20 manos; con cinco, ocho.
    sala.manosTotales = Math.floor(40 / sala.jugadores.length);
    if (sala.manosTotales < 1) { res.status(400); throw new Error('Sois demasiados para una baraja'); }

    sala.mazo = mazoNuevo();
    sala.estado = 'activa';
    await sala.save();

    for (const j of sala.jugadores) {
        if (j.user && j.user.toString() !== req.user._id.toString()) {
            notificarA(j.user, {
                title: '🃏 Empieza la partida',
                body: `Ya podéis levantar carta. ${sala.manosTotales} manos.`,
                icon: '/assets/icons/icon-192x192.png',
                url: '/games/carta-alta'
            });
        }
    }

    res.json(vista(sala, req.user._id));
});

/** La mano en curso, creándola si hace falta. */
const manoActual = (sala) => {
    let mano = sala.manos.find(m => m.ganador === null && !m.empate);
    if (mano) return mano;

    const activos = sala.jugadores.filter(j => j.activo).length;
    if (sala.mazo.length < activos) return null;
    if (sala.manos.length >= sala.manosTotales) return null;

    sala.manos.push({ numero: sala.manos.length + 1, tiradas: [], ganador: null, empate: false, premio: 0 });
    return sala.manos[sala.manos.length - 1];
};

/** Resuelve la mano cuando ya han tirado todos los activos. */
const resolverMano = async (sala, mano) => {
    let mejor = -1;
    let ganador = -1;
    let empatados = 0;

    for (const t of mano.tiradas) {
        const f = fuerzaDe(t.carta);
        if (f > mejor) { mejor = f; ganador = t.puesto; empatados = 1; }
        else if (f === mejor) empatados++;
    }

    const activos = sala.jugadores.filter(j => j.activo).length;
    const enJuego = sala.apuesta * activos + sala.bote;

    mano.resueltaEn = new Date();

    if (empatados > 1) {
        // ⚠️ UN EMPATE DOBLA LA APUESTA Y NO PAGA A NADIE.
        //
        // Todo lo que había en la mesa se queda para la siguiente, y la próxima
        // mano cuesta el doble. Dos empates seguidos son cuatro veces. Quien
        // gane, se lo lleva TODO.
        //
        // Es lo que convierte un empate de "vaya, nada" en el momento más tenso
        // de la partida: cuanto más se alarga, más hay encima y más cuesta
        // seguir. Misma regla contra la máquina que entre amigos — una regla que
        // cambia según con quién juegas es una regla que nadie recuerda.
        mano.empate = true;
        mano.ganador = -1;
        mano.premio = 0;
        sala.bote = enJuego;

        // Con tope: doblar sin freno acabaría en una mano que nadie puede pagar
        // y la partida se quedaría clavada.
        sala.apuesta = Math.min(sala.apuesta * 2, APUESTA_MAXIMA);
        return;
    }

    mano.ganador = ganador;
    mano.premio = enJuego;
    sala.bote = 0;

    // Se acabó la escalada: la siguiente mano vuelve a costar lo normal.
    sala.apuesta = sala.apuestaBase;

    const puestoGanador = sala.jugadores[ganador];
    if (puestoGanador.user) {
        await User.findByIdAndUpdate(puestoGanador.user, { $inc: { gameCoins: enJuego } });
    }
    // Si gana la máquina, las fichas desaparecen: no hay cuenta detrás y
    // reciclarlas seria inventarselas.

    for (let i = 0; i < sala.jugadores.length; i++) {
        if (!sala.jugadores[i].activo) continue;
        sala.jugadores[i].saldo += (i === ganador ? enJuego - sala.apuesta : -sala.apuesta);
    }
};

/**
 * Cambiar la apuesta. Solo el lider, y solo entre manos.
 *
 * En mitad de una mano no se puede: alguien ya habria pagado el precio viejo y
 * el siguiente pagaria otro, asi que el bote no seria de nadie en concreto.
 *
 * @route POST /api/carta-alta/:id/apuesta
 */
const cambiarApuesta = asyncHandler(async (req, res) => {
    const sala = await cargar(req.params.id);
    if (!sala) { res.status(404); throw new Error('Sala no encontrada'); }
    if (sala.lider.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Solo el líder cambia la apuesta'); }
    if (!['sala', 'activa'].includes(sala.estado)) { res.status(400); throw new Error('La partida ya ha terminado'); }

    const fichas = Math.floor(Number(req.body?.apuesta));
    if (!Number.isFinite(fichas) || fichas < APUESTA_MINIMA || fichas > APUESTA_MAXIMA) {
        res.status(400);
        throw new Error(`La apuesta va de ${APUESTA_MINIMA} a ${APUESTA_MAXIMA} fichas`);
    }

    const manoAMedias = sala.manos.find(m => m.ganador === null && !m.empate && m.tiradas.length > 0);
    if (manoAMedias) {
        res.status(400);
        throw new Error('Hay una mano a medias: espera a que se resuelva');
    }

    sala.apuesta = fichas;
    sala.apuestaBase = fichas;
    await sala.save();

    res.json(vista(sala, req.user._id));
});

/** Levantar carta. */
const levantarCarta = asyncHandler(async (req, res) => {
    const sala = await cargar(req.params.id);
    if (!sala) { res.status(404); throw new Error('Sala no encontrada'); }
    if (sala.estado !== 'activa') { res.status(400); throw new Error('Esta partida no está en juego'); }

    const miPuesto = puestoDe(sala, req.user._id);
    if (miPuesto < 0) { res.status(403); throw new Error('No juegas en esta sala'); }
    if (!sala.jugadores[miPuesto].activo) { res.status(400); throw new Error('Ya no estás en la partida'); }

    const mano = manoActual(sala);
    if (!mano) { res.status(400); throw new Error('Ya no quedan manos por jugar'); }
    if (mano.tiradas.some(t => t.puesto === miPuesto)) {
        res.status(400); throw new Error('Ya has levantado tu carta en esta mano');
    }

    // ⚠️ El cobro va PRIMERO, con la condición de saldo dentro del filtro. Si no
    // llegan las fichas no se toca la sala ni se gasta una carta.
    const cobrado = await User.findOneAndUpdate(
        { _id: req.user._id, gameCoins: { $gte: sala.apuesta } },
        { $inc: { gameCoins: -sala.apuesta } },
        { new: true }
    );
    if (!cobrado) { res.status(400); throw new Error('No te llegan las fichas para esta mano'); }

    mano.tiradas.push({ puesto: miPuesto, carta: sala.mazo.shift() });

    // La máquina no espera a nadie: levanta en cuanto le toca.
    for (let i = 0; i < sala.jugadores.length; i++) {
        const j = sala.jugadores[i];
        if (j.esMaquina && j.activo && !mano.tiradas.some(t => t.puesto === i) && sala.mazo.length > 0) {
            mano.tiradas.push({ puesto: i, carta: sala.mazo.shift() });
        }
    }

    const activos = sala.jugadores.filter(j => j.activo).length;
    let resultado = null;

    if (mano.tiradas.length >= activos) {
        await resolverMano(sala, mano);

        resultado = {
            empate: mano.empate,
            premio: mano.premio,
            ganador: mano.ganador >= 0 ? sala.jugadores[mano.ganador].nombre : null,
            ganeYo: mano.ganador === miPuesto,
            tiradas: mano.tiradas.map(t => ({
                nombre: sala.jugadores[t.puesto].nombre,
                soyYo: t.puesto === miPuesto,
                carta: t.carta
            })),
            texto: mano.empate
                ? (sala.contraMaquina
                    ? `Empate: el bote se lo queda la casa`
                    : `Empate: el bote sube a ${sala.bote}`)
                : `${nombreDe(mano.tiradas.find(t => t.puesto === mano.ganador).carta)} — gana ${sala.jugadores[mano.ganador].nombre}`
        };

        // ⚠️ NO se avisa de quien ha ganado la mano, a proposito.
        //
        // Con veinte manos por partida serian veinte notificaciones seguidas
        // por algo que se ve al abrir la app. Un aviso que llega tantas veces
        // deja de leerse, y arrastra consigo a los que si importan — la
        // invitacion a una sala, por ejemplo. Lo que pasa dentro de una partida
        // se mira dentro de la partida.
    }

    // ¿Se acabó?
    const todasResueltas = sala.manos.every(m => m.ganador !== null || m.empate);
    if (todasResueltas && (sala.manos.length >= sala.manosTotales || sala.mazo.length < activos)) {
        sala.estado = 'terminada';
        sala.terminadaEn = new Date();

        // Un bote colgando al final no es de nadie: se devuelve a partes
        // iguales. Quedárselo sería robar, y entre personas no hay casa.
        if (sala.bote > 0) {
            const vivos = sala.jugadores.filter(j => j.activo && j.user);
            if (vivos.length > 0) {
                const parte = Math.floor(sala.bote / vivos.length);
                for (const j of vivos) await User.findByIdAndUpdate(j.user, { $inc: { gameCoins: parte } });
            }
            sala.bote = 0;
        }
    }

    await sala.save();

    res.json({
        ...vista(sala, req.user._id),
        acabasDeLevantar: mano.tiradas.find(t => t.puesto === miPuesto)?.carta || null,
        resultado
    });
});

/** Salir de la sala o abandonar la partida. */
const salir = asyncHandler(async (req, res) => {
    const sala = await cargar(req.params.id);
    if (!sala) { res.status(404); throw new Error('Sala no encontrada'); }

    const miPuesto = puestoDe(sala, req.user._id);
    if (miPuesto < 0) { res.status(403); throw new Error('No estás en esa sala'); }

    const soyLider = sala.lider.toString() === req.user._id.toString();

    // ⚠️ SI SE VA EL LÍDER, LA SALA DESAPARECE. Empezada o no.
    //
    // Sin líder no hay quien empiece, ni quien invite, ni quien cambie la
    // apuesta: lo que queda no es una partida, es una fila muerta en la lista de
    // todos los que estaban dentro.
    //
    // Lo que estaba ganado ya está pagado —cada mano se cobra en el momento—,
    // así que lo único pendiente es el bote de un empate. Se reparte antes de
    // borrar: quedárselo al cerrar sería una forma muy tonta de robar.
    if (soyLider) {
        if (sala.bote > 0) {
            const vivos = sala.jugadores.filter(j => j.activo && j.user);
            if (vivos.length > 0) {
                const parte = Math.floor(sala.bote / vivos.length);
                for (const j of vivos) await User.findByIdAndUpdate(j.user, { $inc: { gameCoins: parte } });
            }
        }

        for (const j of sala.jugadores) {
            if (j.user && j.user.toString() !== req.user._id.toString()) {
                notificarA(j.user, {
                    title: '🃏 Partida cerrada',
                    body: 'El líder ha cerrado la sala.',
                    icon: '/assets/icons/icon-192x192.png',
                    url: '/games/carta-alta'
                });
            }
        }

        await CartaAlta.findByIdAndDelete(sala._id);
        return res.json({ message: 'Sala cerrada' });
    }

    if (sala.estado === 'sala') {
        sala.jugadores.splice(miPuesto, 1);
        await sala.save();
        return res.json({ message: 'Has salido de la sala' });
    }

    // Con la partida en marcha no se borra el puesto: se marca inactivo, o el
    // historial de manos apuntaría a puestos que ya no existen.
    sala.jugadores[miPuesto].activo = false;

    const siguenJugando = sala.jugadores.filter(j => j.activo && !j.esMaquina).length;
    if (siguenJugando === 0) {
        sala.estado = 'terminada';
        sala.terminadaEn = new Date();
        sala.bote = 0;
    }
    await sala.save();

    res.json({ message: 'Has abandonado la partida' });
});

/** Mis salas y partidas. */
const misSalas = asyncHandler(async (req, res) => {
    const filas = await CartaAlta.find({
        $or: [{ lider: req.user._id }, { 'jugadores.user': req.user._id }]
    }).sort({ updatedAt: -1 }).limit(20);

    res.json(filas.map(s => vista(s, req.user._id)));
});

/** Una sala concreta. */
const verSala = asyncHandler(async (req, res) => {
    const sala = await cargar(req.params.id);
    if (!sala) { res.status(404); throw new Error('Sala no encontrada'); }

    const dentro = puestoDe(sala, req.user._id) >= 0
        || sala.invitados.some(i => i.toString() === req.user._id.toString());
    if (!dentro) { res.status(403); throw new Error('Esa sala no es tuya'); }

    res.json(vista(sala, req.user._id));
});

/** Invitaciones pendientes, para el buzón. */
const misInvitaciones = asyncHandler(async (req, res) => {
    const filas = await CartaAlta.find({ invitados: req.user._id, estado: 'sala' })
        .populate('lider', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

    res.json(filas.map(f => ({
        _id: f._id,
        de: f.lider?.username || 'Alguien',
        avatar: f.lider?.avatar || '',
        apuesta: f.apuesta,
        jugadores: (f.jugadores || []).length,
        creada: f.createdAt
    })));
});

module.exports = {
    crearSala, invitar, responderInvitacion, expulsar, empezar,
    levantarCarta, salir, misSalas, verSala, misInvitaciones, cambiarApuesta,
    APUESTA_MINIMA, APUESTA_MAXIMA, MAX_JUGADORES, NOMBRE_MAQUINA
};
