const User = require('../models/User');
const DailyLog = require('../models/DailyLog');

// @desc    Buscar usuarios por nombre o email
const searchUsers = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
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
    searchUsers, sendFriendRequest, getFriends, respondToRequest, getRequests, getLeaderboard
};