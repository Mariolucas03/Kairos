const User = require('../models/User');
const DailyLog = require('../models/DailyLog');
const WorkoutLog = require('../models/WorkoutLog');

// 🔥 Escapa caracteres especiales de regex para evitar ReDoS / patrones inesperados
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const FEED_PAGE_SIZE = 15;

// Da forma a un WorkoutLog para el feed/perfil: cuenta likes/comments sin exponer
// la lista completa de quién ha dado like (privacidad + payload más ligero)
const shapeFeedItem = (log, viewerId) => {
    const obj = log.toObject ? log.toObject() : log;
    const likes = obj.likes || [];
    return {
        _id: obj._id,
        user: obj.user,
        routineName: obj.routineName,
        type: obj.type,
        duration: obj.duration,
        intensity: obj.intensity,
        distance: obj.distance,
        caloriesBurned: obj.caloriesBurned,
        exercises: obj.exercises,
        date: obj.date,
        likesCount: likes.length,
        likedByMe: likes.some(id => id.toString() === viewerId.toString()),
        comments: (obj.comments || []).map(c => ({
            _id: c._id,
            text: c.text,
            createdAt: c.createdAt,
            user: c.user
        }))
    };
};

// Verifica que el dueño del post sea amigo del que consulta, o el propio usuario
const canAccessWorkout = async (viewerId, ownerId) => {
    if (viewerId.toString() === ownerId.toString()) return true;
    const viewer = await User.findById(viewerId).select('friends');
    return viewer.friends.some(f => f.toString() === ownerId.toString());
};

// @desc    Feed de entrenos de tus amigos (estilo IG)
// @route   GET /api/social/feed?page=1
const getFeed = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const friendIds = req.user.friends || [];

        if (friendIds.length === 0) {
            return res.json({ items: [], hasMore: false });
        }

        const logs = await WorkoutLog.find({ user: { $in: friendIds } })
            .sort({ date: -1 })
            .skip((page - 1) * FEED_PAGE_SIZE)
            .limit(FEED_PAGE_SIZE + 1) // Pedimos uno de más para saber si hay más páginas
            .populate('user', 'username avatar frame level title')
            .populate('comments.user', 'username avatar')
            .lean();

        const hasMore = logs.length > FEED_PAGE_SIZE;
        const pageItems = logs.slice(0, FEED_PAGE_SIZE);

        res.json({
            items: pageItems.map(log => shapeFeedItem(log, req.user._id)),
            hasMore
        });
    } catch (error) {
        console.error('Error en getFeed:', error);
        res.status(500).json({ message: 'Error cargando el feed' });
    }
};

// @desc    Dar/quitar like a un entreno
// @route   POST /api/social/feed/:workoutId/like
const toggleLike = async (req, res) => {
    try {
        const { workoutId } = req.params;
        const userId = req.user._id;

        const workout = await WorkoutLog.findById(workoutId).select('user likes');
        if (!workout) return res.status(404).json({ message: 'Entreno no encontrado' });

        const allowed = await canAccessWorkout(userId, workout.user);
        if (!allowed) return res.status(403).json({ message: 'No tienes acceso a este entreno' });

        const alreadyLiked = workout.likes.some(id => id.toString() === userId.toString());

        const updated = await WorkoutLog.findByIdAndUpdate(
            workoutId,
            alreadyLiked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } },
            { new: true }
        ).select('likes');

        res.json({ likesCount: updated.likes.length, likedByMe: !alreadyLiked });
    } catch (error) {
        console.error('Error en toggleLike:', error);
        res.status(500).json({ message: 'Error al dar like' });
    }
};

// @desc    Comentar un entreno
// @route   POST /api/social/feed/:workoutId/comment
const addComment = async (req, res) => {
    try {
        const { workoutId } = req.params;
        const userId = req.user._id;
        const text = (req.body.text || '').trim();

        if (!text) return res.status(400).json({ message: 'El comentario no puede estar vacío' });
        if (text.length > 300) return res.status(400).json({ message: 'Comentario demasiado largo (máx 300 caracteres)' });

        const workout = await WorkoutLog.findById(workoutId).select('user');
        if (!workout) return res.status(404).json({ message: 'Entreno no encontrado' });

        const allowed = await canAccessWorkout(userId, workout.user);
        if (!allowed) return res.status(403).json({ message: 'No tienes acceso a este entreno' });

        const updated = await WorkoutLog.findByIdAndUpdate(
            workoutId,
            { $push: { comments: { user: userId, text } } },
            { new: true }
        ).select('comments');

        const savedComment = updated.comments[updated.comments.length - 1];

        res.status(201).json({
            comment: {
                _id: savedComment._id,
                text: savedComment.text,
                createdAt: savedComment.createdAt,
                user: { _id: userId, username: req.user.username, avatar: req.user.avatar }
            }
        });
    } catch (error) {
        console.error('Error en addComment:', error);
        res.status(500).json({ message: 'Error al comentar' });
    }
};

// @desc    Perfil público de un amigo + su historial de entrenos
// @route   GET /api/social/profile/:userId
const getFriendProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const viewerId = req.user._id;

        const allowed = await canAccessWorkout(viewerId, userId);
        if (!allowed) return res.status(403).json({ message: 'Solo puedes ver el perfil de tus amigos' });

        const page = Math.max(1, parseInt(req.query.page) || 1);

        const [profile, logs] = await Promise.all([
            User.findById(userId).select('username avatar frame level title currentXP nextLevelXP streak'),
            WorkoutLog.find({ user: userId })
                .sort({ date: -1 })
                .skip((page - 1) * FEED_PAGE_SIZE)
                .limit(FEED_PAGE_SIZE + 1)
                .populate('user', 'username avatar frame level title')
                .populate('comments.user', 'username avatar')
                .lean()
        ]);

        if (!profile) return res.status(404).json({ message: 'Usuario no encontrado' });

        const hasMore = logs.length > FEED_PAGE_SIZE;
        const pageItems = logs.slice(0, FEED_PAGE_SIZE);

        res.json({
            profile,
            items: pageItems.map(log => shapeFeedItem(log, viewerId)),
            hasMore
        });
    } catch (error) {
        console.error('Error en getFriendProfile:', error);
        res.status(500).json({ message: 'Error cargando el perfil' });
    }
};

// @desc    Buscar usuarios por nombre o email
const searchUsers = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);
        const safeQuery = escapeRegex(query).slice(0, 100);

        const users = await User.find({
            $or: [
                { username: { $regex: safeQuery, $options: 'i' } },
                { email: { $regex: safeQuery, $options: 'i' } }
            ],
            _id: { $ne: req.user._id }
        })
            .select('username avatar level title frame')
            .limit(20); // 🔥 Límite crítico para no tumbar la BBDD si hay miles de usuarios

        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en la búsqueda' });
    }
};

// @desc    Enviar solicitud (🔥 ATÓMICA Y SIN DUPLICADOS)
const sendFriendRequest = async (req, res) => {
    try {
        const { targetId } = req.body;
        const senderId = req.user._id;

        if (senderId.toString() === targetId.toString()) {
            return res.status(400).json({ message: 'No puedes añadirte a ti mismo' });
        }

        const currentUser = await User.findById(senderId).select('friends friendRequests');
        if (!currentUser) return res.status(404).json({ message: 'Usuario no encontrado' });

        // Validaciones locales rápidas
        if (currentUser.friends.includes(targetId)) {
            return res.status(400).json({ message: 'Ya sois amigos' });
        }
        if (currentUser.friendRequests.includes(targetId)) {
            return res.status(400).json({ message: 'Él ya te envió solicitud. ¡Acéptala en tu buzón!' });
        }

        // 🚀 Operación Atómica: Busca al usuario SOLO si no te tiene ya agregado ni en espera
        const targetUser = await User.findOneAndUpdate(
            {
                _id: targetId,
                friends: { $ne: senderId },
                friendRequests: { $ne: senderId }
            },
            {
                $addToSet: { friendRequests: senderId } // $addToSet es inmune a los multiclics
            },
            { new: true }
        );

        if (!targetUser) {
            // Si devuelve null, es porque la solicitud ya existe, ya sois amigos, o el ID es inválido.
            return res.status(400).json({ message: 'No se pudo enviar (solicitud duplicada o ya sois amigos)' });
        }

        res.json({ message: 'Solicitud enviada con éxito' });

    } catch (error) {
        console.error("Error enviando solicitud:", error);
        res.status(500).json({ message: 'Error interno al enviar solicitud' });
    }
};

// @desc    Obtener amigos + solicitudes
const getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('friends', 'username avatar level title frame lastActive')
            .populate('friendRequests', 'username avatar level');

        const FIVE_MINUTES = 5 * 60 * 1000;
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        const friendIds = user.friends.map(f => f._id);
        const dailyLogs = await DailyLog.find({
            user: { $in: friendIds },
            date: todayStr
        }).select('user missionStats');

        const logsMap = {};
        dailyLogs.forEach(log => {
            logsMap[log.user.toString()] = log.missionStats;
        });

        const friendsList = user.friends.map(f => {
            const lastSeen = f.lastActive ? new Date(f.lastActive) : new Date(0);
            const isOnline = (now - lastSeen) < FIVE_MINUTES;
            const stats = logsMap[f._id.toString()] || { completed: 0, total: 0 };

            return {
                _id: f._id,
                username: f.username,
                avatar: f.avatar,
                frame: f.frame,
                level: f.level,
                title: f.title,
                online: isOnline,
                missionProgress: {
                    completed: stats.completed,
                    total: stats.total || 1
                }
            };
        });

        const requestsList = user.friendRequests.map(u => ({
            _id: u._id,
            username: u.username,
            avatar: u.avatar,
            level: u.level,
            date: new Date()
        }));

        res.json({ friends: friendsList, requests: requestsList });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error obteniendo amigos' });
    }
};

// @desc    Responder solicitud (🔥 ATÓMICA)
const respondToRequest = async (req, res) => {
    try {
        const { requesterId, action } = req.body;
        const userId = req.user._id;

        // 1. Quitar la solicitud de forma atómica
        const userUpdate = await User.findOneAndUpdate(
            { _id: userId, friendRequests: requesterId },
            { $pull: { friendRequests: requesterId } },
            { new: true }
        );

        if (!userUpdate) {
            return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada' });
        }

        if (action === 'accept') {
            // 2. Si acepta, añadimos a ambos de forma paralela y segura con $addToSet
            await Promise.all([
                User.findByIdAndUpdate(userId, { $addToSet: { friends: requesterId } }),
                User.findByIdAndUpdate(requesterId, { $addToSet: { friends: userId } })
            ]);
            return res.json({ message: 'Solicitud aceptada' });
        }

        res.json({ message: 'Solicitud rechazada' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error respondiendo' });
    }
};

// @desc    Obtener solicitudes (Helper)
const getRequests = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('friendRequests', 'username avatar level');
        const requests = user.friendRequests.map(u => ({
            _id: u._id,
            username: u.username,
            avatar: u.avatar,
            level: u.level
        }));
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error cargando solicitudes' });
    }
};

// @desc    Ranking Global
const getLeaderboard = async (req, res) => {
    try {
        const topUsers = await User.find({})
            .sort({ level: -1, currentXP: -1 })
            .limit(50)
            .select('username level currentXP title avatar frame clanRank');

        const leaderboard = topUsers.map(u => ({
            _id: u._id,
            username: u.username,
            level: u.level || 1,
            xp: u.stats?.currentXP || u.currentXP || 0,
            title: u.title || 'Novato',
            avatar: u.avatar,
            frame: u.frame,
            clanRank: u.clanRank
        }));

        res.json(leaderboard);
    } catch (error) {
        res.status(500).json({ message: 'Error obteniendo ranking' });
    }
};

module.exports = {
    searchUsers, sendFriendRequest, getFriends, respondToRequest, getRequests, getLeaderboard,
    getFeed, toggleLike, addComment, getFriendProfile
};