const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { playDice, playScratch, playSlots, playRoulette, playFortuneWheel, playBlackjack } = require('../controllers/gamesController');

router.post('/dice', protect, playDice);
router.post('/scratch', protect, playScratch);
router.post('/slots', protect, playSlots);
router.post('/roulette', protect, playRoulette);
router.post('/fortune', protect, playFortuneWheel);
router.post('/blackjack', protect, playBlackjack);

module.exports = router;