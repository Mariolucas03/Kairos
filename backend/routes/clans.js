const express = require('express');
const router = express.Router();
const {
    getMyClan,
    createClan,
    searchClans,
    joinClan,
    leaveClan,
    updateMemberRank,
    kickMember,
    previewClan, // Se mantiene por compatibilidad
    claimEventReward,
    getClanDetails, // 🔥 La nueva función
    updateClan
} = require('../controllers/clanController');
const protect = require('../middleware/authMiddleware');

router.get('/me', protect, getMyClan);
router.get('/', protect, searchClans);

// Ruta para ver detalles (espiar/previsualizar)
router.get('/:id', protect, getClanDetails);
// Ruta legacy (por si acaso)
router.get('/preview/:id', protect, previewClan);

router.post('/', protect, createClan);
router.post('/:id/join', protect, joinClan);
router.post('/leave', protect, leaveClan);
router.post('/kick', protect, kickMember);
router.post('/event/claim', protect, claimEventReward);

router.put('/rank', protect, updateMemberRank);
router.put('/', protect, updateClan);

module.exports = router;