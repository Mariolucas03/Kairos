const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Poker = require('../models/Poker');
const User = require('../models/User');
const { mazoNuevo, mejorMano, nombreDe } = require('../services/pokerManos');
const mesaSvc = require('../services/pokerMesa');
const { notificarA } = require('./pushController');

/**
 * PÓQUER — mesas entre amigos.
 *
 * ⚠️ LO QUE NO SALE DE AQUÍ: el mazo y las cartas tapadas de los demás.
 *
 * `vista()` monta cada respuesta a mano y cada jugador solo ve las suyas. Las de
 * los rivales aparecen únicamente cuando se enseñan en el showdown, y entonces
 * ya son públicas. Devolver el documento tal cual sería regalar la partida.
 *
 * LAS CUENTAS: se entra con fichas y se sale con lo que quede. Al sentarte se te
 * descuentan del saldo y pasan a tu montón; al levantarte vuelven. Así la suma
 * de los montones más el bote es siempre lo que entró, y se puede comprobar.
 */

const CIEGA_MINIMA = 2;
const CIEGA_MAXIMA = 500;
const MAX_JUGADORES = 8;

// Se entra con al menos veinte ciegas grandes: con menos, la primera mano ya te
// deja all-in y no hay juego.
const CIEGAS_DE_ENTRADA = 20;

/** Lo que se le manda al móvil. */
const vista = (mesa, yoId) => {
    const yo = yoId.toString();
    const miPuesto = mesa.jugadores.findIndex(j => j.user && j.user.toString() === yo);
    const soyLider = mesa.lider.toString() === yo;
    const jugando = mesa.estado === 'jugando';
    const enShowdown = mesa.fase === 'showdown' || mesa.fase === 'entremanos';

    const mio = miPuesto >= 0 ? mesa.jugadores[miPuesto] : null;
    const meToca = jugando && mesa.turno === miPuesto && !mio?.retirado && !mio?.allIn;

    const porIgualar = mio ? Math.max(0, mesa.apuestaActual - mio.apostadoRonda) : 0;

    return {
        _id: mesa._id,
        estado: mesa.estado,
        fase: mesa.fase,
        ciegaGrande: mesa.ciegaGrande,
        ciegaPequena: Math.floor(mesa.ciegaGrande / 2),
        entradaMesa: mesa.entradaMesa,
        soyLider,
        miPuesto,
        manoNumero: mesa.manoNumero,

        bote: mesa.bote,
        apuestaActual: mesa.apuestaActual,
        subidaMinima: mesa.subidaMinima,
        comunitarias: mesa.comunitarias,

        // Lo que puedo hacer ahora mismo, calculado aquí y no en el móvil: si lo
        // decidiera el cliente, bastaría con tocarlo para apostar de más.
        meToca,
        porIgualar,
        puedoPasar: meToca && porIgualar === 0,
        subidaMaxima: mio ? mio.fichas : 0,

        jugadores: mesa.jugadores.map((j, i) => ({
            puesto: i,
            nombre: j.nombre,
            avatar: j.avatar,
            soyYo: i === miPuesto,
            esLider: !!(j.user && j.user.toString() === mesa.lider.toString()),
            fichas: j.fichas,
            ganancia: j.fichas - j.entrada,
            apostadoRonda: j.apostadoRonda,
            retirado: j.retirado,
            allIn: j.allIn,
            sentado: j.sentado,
            esBoton: i === mesa.boton,
            leToca: jugando && mesa.turno === i && !j.retirado && !j.allIn,
            // ⚠️ Las cartas SOLO las tuyas. Las de los demás, nunca — salvo las
            // que se enseñaron al final de una mano, que van en ultimoResultado.
            cartas: i === miPuesto ? j.cartas : [],
            tieneCartas: j.cartas.length > 0,
            _id: j.user
        })),

        // Mi mejor jugada ahora mismo, para no tener que llevar la cuenta a mano
        miJugada: (mio && mio.cartas.length === 2 && mesa.comunitarias.length >= 3)
            ? mejorMano([...mio.cartas, ...mesa.comunitarias])?.texto
            : null,

        invitadosPendientes: mesa.invitados.length,
        plazasLibres: Math.max(0, MAX_JUGADORES - mesa.jugadores.length - mesa.invitados.length),
        maxJugadores: MAX_JUGADORES,

        ultimoResultado: enShowdown || !jugando ? mesa.ultimoResultado : null,
        creada: mesa.createdAt
    };
};

const cargar = (id) => Poker.findById(id);
const puestoDe = (mesa, userId) =>
    mesa.jugadores.findIndex(j => j.user && j.user.toString() === userId.toString());

/** Crea la mesa. Quien la crea se sienta el primero. */
const crearMesa = asyncHandler(async (req, res) => {
    const ciega = Math.floor(Number(req.body?.ciegaGrande));
    if (!Number.isFinite(ciega) || ciega < CIEGA_MINIMA || ciega > CIEGA_MAXIMA) {
        res.status(400);
        throw new Error(`La ciega grande va de ${CIEGA_MINIMA} a ${CIEGA_MAXIMA} fichas`);
    }

    const entrada = ciega * CIEGAS_DE_ENTRADA;
    const yo = await User.findById(req.user._id).select('username avatar gameCoins').lean();
    if ((yo.gameCoins || 0) < entrada) {
        res.status(400);
        throw new Error(`Necesitas ${entrada} fichas para sentarte a esta mesa`);
    }

    const abierta = await Poker.findOne({ lider: req.user._id, estado: { $in: ['sala', 'jugando'] } }).lean();
    if (abierta) { res.status(400); throw new Error('Ya tienes una mesa abierta'); }

    // Se cobra la entrada AQUÍ, con la condición de saldo dentro del filtro.
    const cobrado = await User.findOneAndUpdate(
        { _id: req.user._id, gameCoins: { $gte: entrada } },
        { $inc: { gameCoins: -entrada } },
        { new: true }
    );
    if (!cobrado) { res.status(400); throw new Error('No te llegan las fichas'); }

    const mesa = await Poker.create({
        lider: req.user._id,
        ciegaGrande: ciega,
        entradaMesa: entrada,
        estado: 'sala',
        jugadores: [{
            user: yo._id, nombre: yo.username, avatar: yo.avatar || '',
            fichas: entrada, entrada
        }]
    });

    res.status(201).json(vista(mesa, req.user._id));
});

/** Invitar a un amigo. */
const invitar = asyncHandler(async (req, res) => {
    const { amigoId } = req.body || {};
    if (!mongoose.isValidObjectId(amigoId)) { res.status(400); throw new Error('Elige a quién invitas'); }

    const mesa = await cargar(req.params.id);
    if (!mesa) { res.status(404); throw new Error('Mesa no encontrada'); }
    if (mesa.lider.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Solo el líder invita'); }
    if (mesa.estado !== 'sala') { res.status(400); throw new Error('La partida ya ha empezado'); }
    if (mesa.jugadores.length + mesa.invitados.length >= MAX_JUGADORES) {
        res.status(400); throw new Error(`La mesa está llena (máximo ${MAX_JUGADORES})`);
    }
    if (puestoDe(mesa, amigoId) >= 0) { res.status(400); throw new Error('Ya está en la mesa'); }
    if (mesa.invitados.some(i => i.toString() === amigoId.toString())) {
        res.status(400); throw new Error('Ya le has invitado');
    }

    const yo = await User.findById(req.user._id).select('friends username').lean();
    if (!(yo.friends || []).some(f => f.toString() === amigoId.toString())) {
        res.status(403); throw new Error('Solo puedes invitar a tus amigos');
    }

    const amigo = await User.findById(amigoId).select('username gameCoins').lean();
    if (!amigo) { res.status(404); throw new Error('Ese usuario ya no existe'); }
    if ((amigo.gameCoins || 0) < mesa.entradaMesa) {
        res.status(400);
        throw new Error(`A ${amigo.username} no le llegan las ${mesa.entradaMesa} fichas de entrada`);
    }

    mesa.invitados.push(amigoId);
    await mesa.save();

    notificarA(amigoId, {
        title: '♠️ Te invitan a una mesa de póquer',
        body: `${yo.username} monta una mesa. Entrada: ${mesa.entradaMesa} fichas.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/games/poker'
    });

    res.json(vista(mesa, req.user._id));
});

/** Aceptar o rechazar. Al aceptar se paga la entrada. */
const responderInvitacion = asyncHandler(async (req, res) => {
    const acepta = req.body?.respuesta === 'aceptar';
    const mesa = await cargar(req.params.id);

    if (!mesa || mesa.estado !== 'sala') { res.status(404); throw new Error('Esa mesa ya no está disponible'); }
    if (!mesa.invitados.some(i => i.toString() === req.user._id.toString())) {
        res.status(404); throw new Error('No tienes ninguna invitación a esa mesa');
    }

    mesa.invitados = mesa.invitados.filter(i => i.toString() !== req.user._id.toString());

    if (!acepta) {
        await mesa.save();
        return res.json({ message: 'Invitación rechazada' });
    }

    if (mesa.jugadores.length >= MAX_JUGADORES) {
        await mesa.save();
        res.status(400); throw new Error('La mesa se ha llenado');
    }

    const cobrado = await User.findOneAndUpdate(
        { _id: req.user._id, gameCoins: { $gte: mesa.entradaMesa } },
        { $inc: { gameCoins: -mesa.entradaMesa } },
        { new: true }
    ).select('username avatar');
    if (!cobrado) {
        await mesa.save();
        res.status(400); throw new Error(`Necesitas ${mesa.entradaMesa} fichas para sentarte`);
    }

    mesa.jugadores.push({
        user: cobrado._id, nombre: cobrado.username, avatar: cobrado.avatar || '',
        fichas: mesa.entradaMesa, entrada: mesa.entradaMesa
    });
    await mesa.save();

    notificarA(mesa.lider, {
        title: '♠️ Se han sentado',
        body: `${cobrado.username} entra en tu mesa.`,
        icon: '/assets/icons/icon-192x192.png',
        url: '/games/poker'
    });

    res.json(vista(mesa, req.user._id));
});

/** Expulsar, o retirar una invitación. Solo el líder y solo antes de empezar. */
const expulsar = asyncHandler(async (req, res) => {
    const { jugadorId } = req.body || {};
    const mesa = await cargar(req.params.id);

    if (!mesa) { res.status(404); throw new Error('Mesa no encontrada'); }
    if (mesa.lider.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Solo el líder expulsa'); }
    if (mesa.estado !== 'sala') { res.status(400); throw new Error('Con la partida empezada ya no se puede expulsar'); }
    if (jugadorId?.toString() === req.user._id.toString()) {
        res.status(400); throw new Error('No puedes expulsarte a ti mismo. Cierra la mesa.');
    }

    const puesto = puestoDe(mesa, jugadorId);
    if (puesto >= 0) {
        // Se le devuelve su entrada: no ha llegado a jugar nada.
        await User.findByIdAndUpdate(jugadorId, { $inc: { gameCoins: mesa.jugadores[puesto].fichas } });
        mesa.jugadores.splice(puesto, 1);
    } else {
        const antes = mesa.invitados.length;
        mesa.invitados = mesa.invitados.filter(i => i.toString() !== jugadorId?.toString());
        if (antes === mesa.invitados.length) { res.status(404); throw new Error('Esa persona no está en la mesa'); }
    }

    await mesa.save();
    res.json(vista(mesa, req.user._id));
});

/** Empezar a jugar. */
const empezar = asyncHandler(async (req, res) => {
    const mesa = await cargar(req.params.id);
    if (!mesa) { res.status(404); throw new Error('Mesa no encontrada'); }
    if (mesa.lider.toString() !== req.user._id.toString()) { res.status(403); throw new Error('Solo el líder empieza'); }
    if (mesa.estado !== 'sala') { res.status(400); throw new Error('La partida ya ha empezado'); }
    if (mesa.jugadores.length < 2) {
        res.status(400);
        throw new Error('Hacen falta al menos dos. El póquer no se juega solo.');
    }

    mesa.invitados = [];
    mesa.estado = 'jugando';
    mesa.boton = mesa.jugadores.length - 1;   // la primera mano el botón es el último
    mesaSvc.repartirMano(mesa, mazoNuevo);
    await mesa.save();

    for (const j of mesa.jugadores) {
        if (j.user && j.user.toString() !== req.user._id.toString()) {
            notificarA(j.user, {
                title: '♠️ Empieza la partida',
                body: 'Ya se reparten cartas.',
                icon: '/assets/icons/icon-192x192.png',
                url: '/games/poker'
            });
        }
    }

    res.json(vista(mesa, req.user._id));
});

/** Cierra la mano y paga, ya sea por retirada o por showdown. */
const cerrarMano = (mesa) => {
    const vivos = mesaSvc.enMano(mesa);

    if (vivos.length === 1) {
        // Todos se retiraron: se lleva el bote sin enseñar nada. Y NO se enseñan
        // sus cartas: nadie pagó por verlas.
        const ganador = mesa.jugadores.indexOf(vivos[0]);
        mesa.jugadores[ganador].fichas += mesa.bote;
        mesa.ultimoResultado = {
            porRetirada: true,
            ganadores: [{ puesto: ganador, nombre: vivos[0].nombre, fichas: mesa.bote, jugada: null }],
            bote: mesa.bote,
            manos: []
        };
        mesa.bote = 0;
    } else {
        const pagos = mesaSvc.repartirBote(mesa);

        // Se junta lo que cobra cada uno. Con botes laterales, el mismo jugador
        // puede llevarse dos o tres, y enseñarlo como "Ana, Ana, Ana" parece un
        // fallo: lo que hay que contar es cuánto se lleva Ana en total.
        const porPuesto = new Map();
        for (const pago of pagos) {
            pago.puestos.forEach((p, i) => {
                const cantidad = pago.porCabeza + (i === 0 ? (pago.resto || 0) : 0);
                mesa.jugadores[p].fichas += cantidad;
                const previo = porPuesto.get(p);
                porPuesto.set(p, {
                    puesto: p,
                    nombre: mesa.jugadores[p].nombre,
                    fichas: (previo?.fichas || 0) + cantidad,
                    jugada: pago.texto
                });
            });
        }
        const ganadores = [...porPuesto.values()];
        mesa.ultimoResultado = {
            porRetirada: false,
            ganadores,
            bote: mesa.bote,
            // Aquí SÍ se enseñan las cartas de quien llegó al final: es el
            // showdown, y en el showdown son públicas.
            manos: mesa.jugadores
                .map((j, i) => ({ puesto: i, nombre: j.nombre, cartas: j.cartas, retirado: j.retirado }))
                .filter(m => !m.retirado && m.cartas.length > 0)
        };
        mesa.bote = 0;
    }

    mesa.fase = 'entremanos';

    // Quien se quedó sin fichas se levanta: no puede seguir apostando.
    for (const j of mesa.jugadores) {
        if (j.sentado && j.fichas <= 0) j.sentado = false;
    }

    if (mesa.jugadores.filter(j => j.sentado).length < 2) {
        mesa.estado = 'terminada';
        mesa.terminadaEn = new Date();
    }
};

/** Avanza la mano tras una acción: siguiente turno, siguiente calle o final. */
const avanzar = (mesa) => {
    if (mesaSvc.enMano(mesa).length <= 1) { cerrarMano(mesa); return; }

    if (!mesaSvc.rondaTerminada(mesa)) {
        mesa.turno = mesaSvc.siguientePuesto(mesa, mesa.turno);
        // Si no queda nadie que pueda hablar, se sigue abriendo cartas
        if (mesa.turno < 0) mesa.turno = mesa.boton;
        else return;
    }

    // Ronda cerrada: se abren cartas hasta el river o hasta el showdown
    while (true) {
        const hay = mesaSvc.abrirCartas(mesa);
        if (!hay) { cerrarMano(mesa); return; }
        // Si solo queda uno sin estar all-in, no hay más apuestas: se sigue
        // abriendo hasta el final.
        if (mesaSvc.puedenApostar(mesa).length > 1) return;
    }
};

/** Una acción: retirarse, pasar, igualar o subir. */
const actuar = asyncHandler(async (req, res) => {
    const { accion, cantidad } = req.body || {};
    const mesa = await cargar(req.params.id);

    if (!mesa) { res.status(404); throw new Error('Mesa no encontrada'); }
    if (mesa.estado !== 'jugando') { res.status(400); throw new Error('Esta mesa no está en juego'); }

    const miPuesto = puestoDe(mesa, req.user._id);
    if (miPuesto < 0) { res.status(403); throw new Error('No juegas en esta mesa'); }
    if (mesa.turno !== miPuesto) { res.status(400); throw new Error('No es tu turno'); }

    const yo = mesa.jugadores[miPuesto];
    if (yo.retirado || yo.allIn) { res.status(400); throw new Error('Ya no puedes actuar en esta mano'); }

    const porIgualar = Math.max(0, mesa.apuestaActual - yo.apostadoRonda);

    if (accion === 'retirarse') {
        yo.retirado = true;
        yo.haActuado = true;
    } else if (accion === 'pasar') {
        if (porIgualar > 0) { res.status(400); throw new Error(`No puedes pasar: te faltan ${porIgualar}`); }
        yo.haActuado = true;
    } else if (accion === 'igualar') {
        if (porIgualar === 0) { res.status(400); throw new Error('No hay nada que igualar: pasa'); }
        mesaSvc.ponerFichas(mesa, miPuesto, porIgualar);
        yo.haActuado = true;
    } else if (accion === 'subir') {
        const subida = Math.floor(Number(cantidad));
        if (!Number.isFinite(subida) || subida <= 0) { res.status(400); throw new Error('Indica cuánto subes'); }

        const total = porIgualar + subida;
        const esAllIn = total >= yo.fichas;

        // Una subida tiene que ser de al menos la anterior, salvo que te quedes
        // sin fichas: ir all-in con menos siempre está permitido.
        if (!esAllIn && subida < mesa.subidaMinima) {
            res.status(400);
            throw new Error(`La subida mínima es ${mesa.subidaMinima}`);
        }

        const puesto = mesaSvc.ponerFichas(mesa, miPuesto, Math.min(total, yo.fichas));
        const nuevaApuesta = yo.apostadoRonda;

        if (nuevaApuesta > mesa.apuestaActual) {
            mesa.subidaMinima = Math.max(mesa.subidaMinima, nuevaApuesta - mesa.apuestaActual);
            mesa.apuestaActual = nuevaApuesta;
            // Una subida reabre la ronda: todos vuelven a tener que hablar.
            for (const j of mesa.jugadores) {
                if (j !== yo && !j.retirado && !j.allIn) j.haActuado = false;
            }
        }
        yo.haActuado = true;
        if (puesto === 0) { res.status(400); throw new Error('No te quedan fichas'); }
    } else {
        res.status(400); throw new Error('Acción no válida');
    }

    avanzar(mesa);
    await mesa.save();

    res.json(vista(mesa, req.user._id));
});

/** Repartir la mano siguiente. Cualquiera de la mesa puede pedirlo. */
const siguienteMano = asyncHandler(async (req, res) => {
    const mesa = await cargar(req.params.id);
    if (!mesa) { res.status(404); throw new Error('Mesa no encontrada'); }
    if (mesa.estado !== 'jugando') { res.status(400); throw new Error('Esta mesa no está en juego'); }
    if (puestoDe(mesa, req.user._id) < 0) { res.status(403); throw new Error('No juegas en esta mesa'); }
    if (mesa.fase !== 'entremanos') { res.status(400); throw new Error('La mano todavía no ha terminado'); }

    if (!mesaSvc.repartirMano(mesa, mazoNuevo)) {
        mesa.estado = 'terminada';
        mesa.terminadaEn = new Date();
    }
    await mesa.save();

    res.json(vista(mesa, req.user._id));
});

/** Levantarse. Las fichas del montón vuelven al saldo. */
const levantarse = asyncHandler(async (req, res) => {
    const mesa = await cargar(req.params.id);
    if (!mesa) { res.status(404); throw new Error('Mesa no encontrada'); }

    const miPuesto = puestoDe(mesa, req.user._id);
    if (miPuesto < 0) { res.status(403); throw new Error('No estás en esa mesa'); }

    const soyLider = mesa.lider.toString() === req.user._id.toString();

    // Si se va el líder, se cierra la mesa y TODOS recuperan su montón. Sin
    // líder no hay quien reparta la siguiente mano: lo que queda es una mesa
    // muerta con el dinero de la gente dentro.
    if (soyLider) {
        for (const j of mesa.jugadores) {
            if (j.user && j.fichas > 0) {
                await User.findByIdAndUpdate(j.user, { $inc: { gameCoins: j.fichas } });
            }
            if (j.user && j.user.toString() !== req.user._id.toString()) {
                notificarA(j.user, {
                    title: '♠️ Mesa cerrada',
                    body: 'El líder ha cerrado la mesa. Tus fichas han vuelto a tu saldo.',
                    icon: '/assets/icons/icon-192x192.png',
                    url: '/games/poker'
                });
            }
        }
        // El bote de una mano a medias se devuelve a quien lo puso
        if (mesa.bote > 0) {
            for (const j of mesa.jugadores) {
                if (j.user && j.apostadoMano > 0) {
                    await User.findByIdAndUpdate(j.user, { $inc: { gameCoins: j.apostadoMano } });
                }
            }
        }
        await Poker.findByIdAndDelete(mesa._id);
        return res.json({ message: 'Mesa cerrada' });
    }

    const yo = mesa.jugadores[miPuesto];
    // Lo que tenga en el bote de la mano en curso se queda: retirarse a mitad
    // de una mano no devuelve lo apostado, igual que en una mesa de verdad.
    if (yo.fichas > 0) await User.findByIdAndUpdate(yo.user, { $inc: { gameCoins: yo.fichas } });
    yo.fichas = 0;
    yo.sentado = false;
    yo.retirado = true;

    if (mesa.estado === 'jugando') {
        if (mesa.turno === miPuesto) avanzar(mesa);
        if (mesa.jugadores.filter(j => j.sentado).length < 2) {
            mesa.estado = 'terminada';
            mesa.terminadaEn = new Date();
        }
    } else {
        mesa.jugadores.splice(miPuesto, 1);
    }

    await mesa.save();
    res.json({ message: 'Te has levantado de la mesa' });
});

/** Mis mesas. */
const misMesas = asyncHandler(async (req, res) => {
    const filas = await Poker.find({
        $or: [{ lider: req.user._id }, { 'jugadores.user': req.user._id }]
    }).sort({ updatedAt: -1 }).limit(10);

    res.json(filas.map(m => vista(m, req.user._id)));
});

/** Una mesa. Es la que se pide en bucle mientras juegas. */
const verMesa = asyncHandler(async (req, res) => {
    const mesa = await cargar(req.params.id);
    if (!mesa) { res.status(404); throw new Error('Mesa no encontrada'); }

    const dentro = puestoDe(mesa, req.user._id) >= 0
        || mesa.invitados.some(i => i.toString() === req.user._id.toString());
    if (!dentro) { res.status(403); throw new Error('Esa mesa no es tuya'); }

    res.json(vista(mesa, req.user._id));
});

/** Invitaciones pendientes, para el buzón. */
const misInvitaciones = asyncHandler(async (req, res) => {
    const filas = await Poker.find({ invitados: req.user._id, estado: 'sala' })
        .populate('lider', 'username avatar')
        .sort({ createdAt: -1 }).limit(20).lean();

    res.json(filas.map(f => ({
        _id: f._id,
        de: f.lider?.username || 'Alguien',
        avatar: f.lider?.avatar || '',
        ciegaGrande: f.ciegaGrande,
        entrada: f.entradaMesa,
        jugadores: (f.jugadores || []).length,
        creada: f.createdAt
    })));
});

module.exports = {
    crearMesa, invitar, responderInvitacion, expulsar, empezar,
    actuar, siguienteMano, levantarse, misMesas, verMesa, misInvitaciones,
    CIEGA_MINIMA, CIEGA_MAXIMA, MAX_JUGADORES, CIEGAS_DE_ENTRADA
};
