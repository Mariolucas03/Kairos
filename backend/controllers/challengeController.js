const asyncHandler = require('express-async-handler');
const Challenge = require('../models/Challenge'); // <--- CORREGIDO AQUÍ (Coincide con tu archivo real)
const mongoose = require('mongoose');

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

    // Verificar saldo del retador
    if (req.user.stats.gameCoins < betAmount) {
        res.status(400);
        throw new Error('No tienes suficientes fichas para esta apuesta');
    }

    const challenge = await Challenge.create({
        challenger: req.user.id,
        opponent: opponentId,
        type,
        betAmount,
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

    // Aquí iría tu lógica específica de update si la necesitas
    // Por ahora devolvemos el desafío encontrado para evitar errores
    const updatedChallenge = await Challenge.findByIdAndUpdate(
        id,
        req.body,
        { new: true }
    );

    res.status(200).json(updatedChallenge);
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