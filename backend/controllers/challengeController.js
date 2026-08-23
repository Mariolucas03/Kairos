const asyncHandler = require('express-async-handler');
const Challenge = require('../models/Challenge'); // <--- CORREGIDO AQUÍ (Coincide con tu archivo real)
const User = require('../models/User');
const mongoose = require('mongoose');

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
    const challenges = await Challenge.find({
        $or: [{ challenger: req.user.id }, { opponent: req.user.id }]
    })
        .populate('challenger', 'username avatar')
        .populate('opponent', 'username avatar')
        .sort({ createdAt: -1 });

    res.status(200).json(challenges);
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

    if (action === 'accept') {
        challenge.status = 'active';
        challenge.startDate = new Date();
        await challenge.save();
        res.status(200).json(challenge);
    } else if (action === 'reject' || action === 'flee') {
        await challenge.deleteOne(); // Si rechaza, lo borramos
        res.status(200).json({ message: 'Desafío rechazado' });
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