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
    getFriendProfile,
    getProfileItems,
    getMonthlyLeaderboard,
    removeFriend,
    getNotifications,
    markNotificationsRead,
    getBadge,
    heartbeat,
    borrarMiEntreno,
    borrarComentarioPropio,
    toggleLikeComentario
} = require('../controllers/socialController');
const protect = require('../middleware/authMiddleware');

router.get('/friends', protect, getFriends);
router.get('/requests', protect, getRequests); // <--- Para las notificaciones
router.post('/request', protect, sendFriendRequest);
router.post('/respond', protect, respondToRequest);
router.get('/search', protect, searchUsers);
router.delete('/friends/:friendId', protect, removeFriend);

// Borrar lo tuyo. El entreno solo su dueno; el comentario, quien lo escribio o
// el dueno del entreno donde esta.
router.delete('/workout/:workoutId', protect, borrarMiEntreno);
router.delete('/comment/:workoutId/:commentId', protect, borrarComentarioPropio);
router.get('/leaderboard', protect, getLeaderboard);
router.get('/leaderboard/monthly', protect, getMonthlyLeaderboard);

// 🔥 Feed social (estilo IG)
router.get('/feed', protect, getFeed);
router.post('/feed/:workoutId/like', protect, toggleLike);
router.post('/feed/:workoutId/comment', protect, addComment);
router.post('/comment/:workoutId/:commentId/like', protect, toggleLikeComentario);
router.get('/profile/:userId', protect, getFriendProfile);
router.get('/profile/:userId/items', protect, getProfileItems);

// Notificaciones de me gusta y comentarios
router.get('/notifications', protect, getNotifications);
router.post('/notifications/read', protect, markNotificationsRead);
// Contador ligero para el punto rojo del footer
router.get('/badge', protect, getBadge);
// Latido de "estoy conectado" (indicador verde en la lista de amigos)
router.post('/heartbeat', protect, heartbeat);

module.exports = router;