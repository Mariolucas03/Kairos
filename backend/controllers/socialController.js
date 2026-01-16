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
        }).select('username avatar level title frame');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en la búsqueda' });
    }
};

// @desc    Enviar solicitud (VERSIÓN ROBUSTA)
const sendFriendRequest = async (req, res) => {
    try {
        const { targetId } = req.body;
        const senderId = req.user._id.toString(); // Convertimos mi ID a texto

        // 1. Validación básica
        if (senderId === targetId) {
            return res.status(400).json({ message: 'No puedes añadirte a ti mismo' });
        }

        const targetUser = await User.findById(targetId);
        const currentUser = await User.findById(senderId);

        if (!targetUser) return res.status(404).json({ message: 'Usuario no encontrado' });

        // 2. CONVERTIR ARRAYS A TEXTO PARA COMPARAR (Esto arregla el error 400 falso)
        const myFriends = currentUser.friends.map(id => id.toString());
        const myRequests = currentUser.friendRequests.map(id => id.toString());
        const targetRequests = targetUser.friendRequests.map(id => id.toString());

        // 3. Validaciones lógicas
        if (myFriends.includes(targetId)) {
            return res.status(400).json({ message: 'Ya sois amigos' });
        }

        if (targetRequests.includes(senderId)) {
            return res.status(400).json({ message: 'Ya enviaste una solicitud' });
        }

        if (myRequests.includes(targetId)) {
            return res.status(400).json({ message: 'Él ya te envió solicitud. ¡Acéptala en tu buzón!' });
        }

        // 4. Enviar solicitud (Guardar ID puro)
        targetUser.friendRequests.push(senderId);
        await targetUser.save();

        res.json({ message: 'Solicitud enviada' });

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

        // Obtener logs de amigos para la barra de misiones
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

// @desc    Responder solicitud
const respondToRequest = async (req, res) => {
    try {
        const { requesterId, action } = req.body;
        const userId = req.user._id;
        const user = await User.findById(userId);
        const requester = await User.findById(requesterId);

        // Convertir a Strings para buscar seguro
        const currentRequests = user.friendRequests.map(id => id.toString());

        if (!currentRequests.includes(requesterId)) {
            return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada' });
        }

        // Eliminar usando filtro de Strings
        user.friendRequests = user.friendRequests.filter(id => id.toString() !== requesterId);

        if (action === 'accept') {
            // Verificar duplicados antes de empujar
            const myFriends = user.friends.map(id => id.toString());
            const theirFriends = requester.friends.map(id => id.toString());

            if (!myFriends.includes(requesterId)) user.friends.push(requesterId);
            if (!theirFriends.includes(userId.toString())) requester.friends.push(userId);

            await requester.save();
            await user.save();
            return res.json({ message: 'Solicitud aceptada' });
        }

        await user.save();
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