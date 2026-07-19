const express = require('express');
const router = express.Router();
const {
    getFriends,
    sendFriendRequest,
    respondToRequest,
    getLeaderboard,
    searchUsers,
    getRequests,
    getFeed,
    toggleLike,
    addComment,
    getFriendProfile
} = require('../controllers/socialController');
const protect = require('../middleware/authMiddleware');

router.get('/friends', protect, getFriends);
router.get('/requests', protect, getRequests); // <--- Para las notificaciones
router.post('/request', protect, sendFriendRequest);
router.post('/respond', protect, respondToRequest);
router.get('/search', protect, searchUsers);
router.get('/leaderboard', protect, getLeaderboard);

// 🔥 Feed social (estilo IG)
router.get('/feed', protect, getFeed);
router.post('/feed/:workoutId/like', protect, toggleLike);
router.post('/feed/:workoutId/comment', protect, addComment);
router.get('/profile/:userId', protect, getFriendProfile);

module.exports = router;