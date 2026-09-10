const asyncHandler = require('express-async-handler');
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const {
    finDelDuelo, pagarDuelo, marcadorEnVivo, MEDIDAS, TIPOS, catalogoDeMedidas, DUELO_DIAS
} = require('../services/duelosService');
const { sendPushToUser } = require('./pushController');

/**
 * COBRAR LA APUESTA.
 *
 * ⚠️ EL SALDO SE COMPRUEBA DENTRO DEL FILTRO, NO EN UN `if` ANTES.
 *
 * Leer las fichas, decidir que llegan y despues restarlas son tres pasos, y
 * entre ellos cabe otra peticion. Con dos duelos aceptados a la vez, o con una
 * partida de poker en marcha, los dos pasarian la comprobacion antes de que
 * ninguno hubiera escrito y el saldo acabaria en negativo. Con la condicion
 * dentro del filtro, Mongo solo deja pasar a uno.
 */
const cobrarFichas = async (userId, fichas) => {
    const r = await User.updateOne(
        { _id: userId, gameCoins: { $gte: fichas } },
        { $inc: { gameCoins: -fichas } }
    );
    return r.modifiedCount === 1;
};

/** Deshacer un cobro. Sin condicion: devolver siempre se puede. */
const devolverFichas = (userId, fichas) =>
    User.updateOne({ _id: userId }, { $inc: { gameCoins: fichas } });

/**
 * El usuario recien leido, para devolverlo con la respuesta.
 *
 * ⚠️ EL SALDO NUEVO LO DICE EL SERVIDOR, NO LO CALCULA LA PANTALLA.
 *
 * Aceptar un duelo mueve fichas, asi que la cabecera tiene que enseñar otro
 * numero al instante. La alternativa —restar la apuesta en el movil— seria
 * tener la misma cuenta en dos sitios, y bastaria con que el servidor rechazara
 * el cobro para que la pantalla enseñara un saldo que no es el tuyo.
 *
 * Es lo mismo que ya hacen los juegos y el entreno: responden con el usuario
 * entero y la pantalla llama a `setUser`.
 */
const usuarioAlDia = (userId) => User.findById(userId).select('-password');

/**
 * ¿Este reto es tuyo?
 *
 * ⚠️ NINGUNA de las rutas de retos lo comprobaba. Con la sesión normal y un id
 * cualquiera se podía aceptar, modificar o BORRAR el reto de otras dos personas.
 * Y updateChallenge además pasaba req.body entero al update, así que se podían
 * reescribir la apuesta, el estado y hasta el ganador.
 *
 * Hoy los retos no mueven fichas (la función está a medias y no tiene pantalla),
 * así que no había dinero en juego. Se cierra igual: el día que se termine, el
 * agujero ya estaría dentro.
 */
const esParte = (challenge, userId) =>
    challenge.challenger?.toString() === userId.toString() ||
    challenge.opponent?.toString() === userId.toString();

// @desc    Obtener todos los desafíos
// @route   GET /api/challenges
// @access  Private
const getChallenges = asyncHandler(async (req, res) => {
    // Buscamos desafíos donde el usuario sea retador U oponente
    const duelos = await Challenge.find({
        $or: [{ challenger: req.user.id }, { opponent: req.user.id }]
    })
        .populate('challenger', 'username avatar')
        .populate('opponent', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(50);   // el historial no crece sin fin en la pantalla

    // ⚠️ LA DURACION LA DICE EL SERVIDOR.
    //
    // La pantalla necesita poder escribir "dura 7 dias" en un duelo que aun no
    // ha empezado (todavia no tiene fecha de fin). Escribir ese 7 a mano en el
    // movil seria tener la regla en dos sitios, y el dia que cambie aqui la
    // pantalla seguiria prometiendo una semana.
    // ⚠️ EL MARCADOR DE LOS QUE ESTAN EN MARCHA.
    //
    // Solo de esos: los pendientes no han empezado y los terminados ya tienen
    // sus numeros guardados. Va aqui y no en una peticion aparte porque el
    // servidor gratuito tarda en despertar, y dos viajes para pintar una
    // pantalla se notan.
    const conMarcador = await Promise.all(duelos.map(async (d) => {
        if (d.status !== 'active') return d;
        return { ...d.toObject(), marcador: await marcadorEnVivo(d) };
    }));

    // Las medidas tambien salen del servidor, por lo mismo que la duracion: la
    // pantalla pinta las etiquetas y las unidades que le den, y asi el dia que
    // se añada un tipo de duelo no hay que tocar el movil.
    res.status(200).json({
        duelos: conMarcador,
        duracionDias: DUELO_DIAS,
        medidas: catalogoDeMedidas()
    });
});

// @desc    Crear un nuevo desafío
// @route   POST /api/challenges
// @access  Private
const createChallenge = asyncHandler(async (req, res) => {
    const { opponentId, type, betAmount } = req.body;

    if (!opponentId || !type || !betAmount) {
        res.status(400);
        throw new Error('Faltan datos para el desafío');
    }

    // El tipo decide QUE se mide, y de eso depende quien cobra. Se comprueba
    // aqui y no solo en el esquema para poder decir cual es el problema: un
    // rechazo de Mongoose llegaria al movil como "Error creando desafio".
    if (!TIPOS.includes(type)) {
        res.status(400);
        throw new Error('Ese tipo de duelo no existe');
    }

    if (!mongoose.Types.ObjectId.isValid(opponentId)) {
        res.status(400);
        throw new Error('Rival inválido');
    }

    if (opponentId.toString() === req.user._id.toString()) {
        res.status(400);
        throw new Error('No puedes retarte a ti mismo');
    }

    const rival = await User.findById(opponentId).select('_id');
    if (!rival) { res.status(404); throw new Error('Ese usuario no existe'); }

    // ⚠️ SOLO A AMIGOS.
    //
    // La pantalla solo ofrece retar desde la lista de amigos, pero la ruta
    // aceptaba cualquier id: sin esto, cualquiera podia llenarle el buzon de
    // retos a un desconocido. Y un duelo con alguien a quien no ves entrenar no
    // tiene ninguna gracia.
    const yo = await User.findById(req.user._id).select('friends').lean();
    const somosAmigos = (yo?.friends || []).some(f => f.toString() === opponentId.toString());
    if (!somosAmigos) {
        res.status(403);
        throw new Error('Solo puedes retar a tus amigos');
    }

    // Uno cada vez con la misma persona. Con varios a la vez, los siete dias se
    // solapan y los mismos kilos contarian para dos duelos distintos.
    const yaHayUno = await Challenge.findOne({
        status: { $in: ['pending', 'active'] },
        $or: [
            { challenger: req.user._id, opponent: opponentId },
            { challenger: opponentId, opponent: req.user._id }
        ]
    }).select('_id status').lean();

    if (yaHayUno) {
        res.status(409);
        throw new Error(yaHayUno.status === 'active'
            ? 'Ya tenéis un duelo en marcha'
            : 'Ya hay un duelo esperando respuesta entre vosotros');
    }

    // La apuesta llega del cliente: sin esto entraban textos, negativos e
    // Infinity, que quedaban guardados esperando a que algún día se pagaran.
    const apuesta = Number(betAmount);
    if (!Number.isFinite(apuesta) || apuesta <= 0) {
        res.status(400);
        throw new Error('Apuesta inválida');
    }

    // Verificar saldo del retador
    if (req.user.stats.gameCoins < apuesta) {
        res.status(400);
        throw new Error('No tienes suficientes fichas para esta apuesta');
    }

    const challenge = await Challenge.create({
        challenger: req.user.id,
        opponent: opponentId,
        type,
        betAmount: apuesta,
        status: 'pending'
    });


    // ⚠️ SIN ESTO, QUE TE RETEN NO SE NOTA.
    //
    // Un reto se queda esperando en una pantalla a la que hay que entrar a
    // proposito. Sin aviso, el retado no se entera nunca y el duelo se muere
    // solo: el que reta cree que el otro pasa de el, y el otro ni lo ha visto.
    //
    // Va sin `await` y con su catch: el reto YA esta creado y un aviso perdido
    // no puede convertirse en un error que haga pensar que no se ha enviado.
    Notification.create({
        user: opponentId,
        actor: req.user._id,
        type: 'reto',
        challenge: challenge._id
    }).catch(e => console.error('No se pudo avisar del reto:', e.message));

    // Y el push, que es el que hace que se entere hoy y no pasado mañana. Un
    // reto sin contestar no le cuesta nada al que reta, pero se queda parado: el
    // duelo no empieza hasta que el otro dice que si.
    (async () => {
        const persona = await User.findById(opponentId).select('username pushSubscriptions');
        if (!persona) return;
        const medida = MEDIDAS[type] || MEDIDAS.gym;
        await sendPushToUser(persona, {
            title: `⚔️ ${req.user.username} te ha retado`,
            body: `${medida.etiqueta} durante ${DUELO_DIAS} días, ${apuesta} fichas cada uno. Acepta o pasa.`,
            icon: '/assets/icons/ficha.png',
            url: '/social/duelos'
        });
    })().catch(e => console.error('No se pudo mandar el push del reto:', e.message));

    res.status(201).json(challenge);
});


// @desc    Actualizar desafío (Aceptar/Huir/Modificar)
// @route   PUT /api/challenges/:id
// @access  Private
const updateChallenge = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 1. VALIDACIÓN TÉCNICA
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400);
        throw new Error('ID de desafío inválido');
    }

    // 2. BÚSQUEDA
    const challenge = await Challenge.findById(id);

    // 3. VALIDACIÓN DE EXISTENCIA
    if (!challenge) {
        res.status(404);
        throw new Error('El desafío ya no existe');
    }

    if (!esParte(challenge, req.user._id)) {
        res.status(403);
        throw new Error('Ese desafío no es tuyo');
    }

    // El cuerpo de la petición YA NO se escribe. Antes se pasaba entero al
    // update, y no hay ningún campo del reto que el cliente deba poder fijar a
    // mano: ni la apuesta, ni el estado, ni el ganador. Cuando la función se
    // termine, cada cambio tendrá su propia ruta con sus reglas.
    res.status(200).json(challenge);
});

// @desc    Eliminar desafío / Responder (Lógica combinada para limpiar)
// @route   DELETE /api/challenges/:id
const deleteChallenge = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400);
        throw new Error('ID de desafío inválido');
    }

    const challenge = await Challenge.findById(id);

    if (!challenge) {
        res.status(404);
        throw new Error('Desafío no encontrado');
    }

    if (!esParte(challenge, req.user._id)) {
        res.status(403);
        throw new Error('Ese desafío no es tuyo');
    }

    // Igual que arriba: borrar un duelo aceptado se llevaria las fichas
    // retenidas de los dos. Para salirse de uno empezado esta 'flee', que al
    // menos le da el bote a alguien.
    if (challenge.status !== 'pending') {
        res.status(400);
        throw new Error(challenge.status === 'active'
            ? 'Ese duelo ya está en marcha. Puedes rendirte, pero no borrarlo.'
            : 'Un duelo terminado no se borra: es parte de tu historial.');
    }

    await challenge.deleteOne();

    res.status(200).json({ id: id });
});

// --- NUEVO: Manejar respuesta (Aceptar/Rechazar) ---
const respondChallenge = asyncHandler(async (req, res) => {
    const { challengeId, action } = req.body;

    if (!mongoose.Types.ObjectId.isValid(challengeId)) {
        res.status(400);
        throw new Error('ID inválido');
    }

    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
        res.status(404);
        throw new Error('El desafío ha expirado o no existe');
    }

    // Aceptar o rechazar solo lo hace el retado. El retador puede retirarlo,
    // que es lo que hace 'flee'.
    const soyElRetado = challenge.opponent?.toString() === req.user._id.toString();

    if (!esParte(challenge, req.user._id)) {
        res.status(403);
        throw new Error('Ese desafío no es tuyo');
    }

    if (action === 'accept' && !soyElRetado) {
        res.status(403);
        throw new Error('Solo puede aceptar quien recibe el reto');
    }

    // El aviso de "te ha retado" pide que hagas algo, y ya lo has hecho. Dejarlo
    // en el buzon seria tenerte pidiendo una respuesta que ya diste.
    Notification.deleteMany({ type: 'reto', challenge: challenge._id })
        .catch(e => console.error('No se pudo limpiar el aviso del reto:', e.message));

    if (action === 'accept') {
        // ⚠️ EL RELOJ ARRANCA AQUI, NO AL RETAR.
        //
        // Si contara desde que se envia el reto, el que tarda un dia en
        // contestar empezaria perdiendo un dia. Los siete dias son iguales para
        // los dos porque empiezan en el mismo instante.
        const inicio = new Date();

        // Se reclama el duelo ANTES de tocar fichas: `status: 'pending'` va
        // dentro del filtro para que dos toques seguidos al boton no cobren dos
        // veces la apuesta.
        const reclamado = await Challenge.findOneAndUpdate(
            { _id: challenge._id, status: 'pending' },
            { $set: { status: 'active', startDate: inicio, endDate: finDelDuelo(inicio) } },
            { new: true }
        );
        if (!reclamado) {
            res.status(409);
            throw new Error('Ese duelo ya no está esperando respuesta');
        }

        const apuesta = reclamado.betAmount;

        // Primero el que acepta, que es el que esta delante de la pantalla: si
        // no le llegan las fichas se entera en el acto y el duelo sigue
        // esperando por si consigue mas.
        const pagaElRetado = apuesta === 0 || await cobrarFichas(reclamado.opponent, apuesta);
        if (!pagaElRetado) {
            await Challenge.updateOne(
                { _id: reclamado._id },
                { $set: { status: 'pending' }, $unset: { startDate: '', endDate: '' } }
            );
            res.status(400);
            throw new Error('No te llegan las fichas para esta apuesta');
        }

        // ⚠️ Y AHORA EL RETADOR, QUE PUEDE HABERSE GASTADO LAS SUYAS.
        //
        // Entre retar y que le contesten pueden pasar dias, y en ese rato ha
        // podido perderlas en el casino. Sus fichas se comprueban al crear el
        // reto, pero esa comprobacion caduca: la unica que vale es esta.
        const pagaElRetador = apuesta === 0 || await cobrarFichas(reclamado.challenger, apuesta);
        if (!pagaElRetador) {
            await devolverFichas(reclamado.opponent, apuesta);
            await reclamado.deleteOne();
            res.status(409);
            throw new Error('Quien te retó ya no tiene fichas para su apuesta. El duelo se cancela.');
        }

        res.status(200).json({ duelo: reclamado, user: await usuarioAlDia(req.user._id) });
    } else if (action === 'reject' || action === 'flee') {
        // ⚠️ AQUI SE BORRABA EL DUELO SIN MIRAR EN QUE ESTADO ESTABA.
        //
        // Con el duelo ya aceptado eso se llevaba por delante las fichas de los
        // DOS, que estan retenidas dentro del documento. Desaparecian sin ir a
        // ninguna parte.
        if (challenge.status === 'pending') {
            // Nadie ha pagado nada todavia: rechazar es no jugar.
            await challenge.deleteOne();
            res.status(200).json({ message: 'Duelo rechazado' });
            return;
        }

        if (challenge.status === 'active') {
            // Huir de un duelo empezado es rendirse, y rendirse cuesta la
            // apuesta: es lo que significa la palabra. El bote entero se lo
            // lleva el que se queda.
            const elOtro = challenge.challenger.toString() === req.user._id.toString()
                ? challenge.opponent
                : challenge.challenger;

            const cerrado = await Challenge.findOneAndUpdate(
                { _id: challenge._id, status: 'active' },
                { $set: { status: 'finished', winner: elOtro, resueltoEn: new Date() } },
                { new: true }
            );
            if (cerrado) await pagarDuelo(cerrado);

            res.status(200).json({
                message: 'Te has rendido. El bote es para tu rival.',
                user: await usuarioAlDia(req.user._id)
            });
            return;
        }

        res.status(400);
        throw new Error('Ese duelo ya está terminado');
    } else {
        res.status(400);
        throw new Error('Acción no válida');
    }
});

module.exports = {
    getChallenges,
    createChallenge,
    updateChallenge,
    deleteChallenge,
    respondChallenge // <--- Asegúrate de exportar esto
};