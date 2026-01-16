const express = require('express');
const router = express.Router();
const {
    getFriends,
    sendFriendRequest,
    respondToRequest,
    getLeaderboard,
    searchUsers,
    getRequests
} = require('../controllers/socialController');
const protect = require('../middleware/authMiddleware');

router.get('/friends', protect, getFriends);
router.get('/requests', protect, getRequests); // <--- Para las notificaciones
router.post('/request', protect, sendFriendRequest);
router.post('/respond', protect, respondToRequest);
router.get('/search', protect, searchUsers);
router.get('/leaderboard', protect, getLeaderboard);

module.exports = router;