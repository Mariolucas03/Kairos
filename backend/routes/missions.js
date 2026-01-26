const express = require('express');
const router = express.Router();
const {
    getMissions,
    createMission,
    updateProgress,
    deleteMission,
    respondMissionInvite,
    nukeMyMissions // <--- IMPORTADO
} = require('../controllers/missionController');
const protect = require('../middleware/authMiddleware');

router.get('/', protect, getMissions);
router.post('/', protect, createMission);
router.put('/:id/progress', protect, updateProgress);
router.delete('/:id', protect, deleteMission);
router.post('/respond', protect, respondMissionInvite);

// 🔥 RUTA DE PURGA
router.delete('/nuke', protect, nukeMyMissions);

module.exports = router;