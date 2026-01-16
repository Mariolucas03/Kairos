const express = require('express');
const router = express.Router();
const {
    getMissions,
    createMission,
    updateProgress, // Renombrado de completeMission
    deleteMission,
    respondMissionInvite
} = require('../controllers/missionController');
const protect = require('../middleware/authMiddleware');

router.get('/', protect, getMissions);
router.post('/', protect, createMission);

// 🔥 CAMBIO: Ahora es 'progress' en vez de 'complete' para reflejar que puede ser parcial
router.put('/:id/progress', protect, updateProgress);

router.delete('/:id', protect, deleteMission);

// 🔥 NUEVO: Responder invitación
router.post('/respond', protect, respondMissionInvite);

module.exports = router;