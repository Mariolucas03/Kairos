const User = require('../models/User');
const DailyLog = require('../models/DailyLog');
const WorkoutLog = require('../models/WorkoutLog');
const NutritionLog = require('../models/NutritionLog');
const Notification = require('../models/Notification');
const { sendPushToUser, notificarA } = require('./pushController');
const { getMadridDateString, getMadridMonthString } = require('../utils/dateHelpers');
const { getMonthlyRanking, MONTHLY_PRIZES } = require('../services/rankingService');
const { getMuscleRanks } = require('../services/muscleRankService');

// 🔥 Escapa caracteres especiales de regex para evitar ReDoS / patrones inesperados
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const FEED_PAGE_SIZE = 15;

// Da forma a un WorkoutLog para el feed/perfil: cuenta likes/comments sin exponer
// la lista completa de quién ha dado like (privacidad + payload más ligero)
// Cuantos comentarios viajan con cada publicacion del feed. El resto se pediria
// aparte al abrirla; con 20 se ve la conversacion reciente sin traer el hilo
// entero.
const COMENTARIOS_EN_EL_FEED = 20;

// Tope de comentarios por publicacion. No es censura: es que una publicacion con
// miles de comentarios no se puede pintar ni cargar, y es la forma mas facil de
// dejar inservible el feed de otra persona.
const MAX_COMENTARIOS_POR_ENTRENO = 300;

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
        // Contenido del post: foto y músculos trabajados (para el carrusel)
        photo: obj.photo || '',
        musclesWorked: obj.musclesWorked || [],
        secondaryMuscles: obj.secondaryMuscles || [],
        records: obj.records || [],
        likesCount: likes.length,
        likedByMe: likes.some(id => id.toString() === viewerId.toString()),
        // ⚠️ Solo los ULTIMOS, no todos.
        //
        // El feed devolvia los comentarios enteros de cada publicacion, y no hay
        // ningun limite de cuantos puede tener: mil comentarios en un post
        // —spam, o simplemente una publicacion muy comentada— convertian el feed
        // de esa persona en varios megabytes que su movil se descarga entera
        // cada vez que abre la pestana.
        //
        // Se manda el total aparte, para poder poner "ver los 340 comentarios"
        // sin tener que traerlos.
        comentariosTotales: (obj.comments || []).length,
        comments: (obj.comments || [])
            .slice(-COMENTARIOS_EN_EL_FEED)
            .map(c => ({
                _id: c._id,
                text: c.text,
                createdAt: c.createdAt,
                user: c.user
            }))
    };
};

/**
 * ¿Puede `viewerId` ver el CONTENIDO (entrenos, comida, misiones) de `ownerId`?
 *
 * Reglas estilo Instagram:
 *  - Tú mismo: siempre.
 *  - Cuenta pública: cualquiera.
 *  - Cuenta privada: solo sus amigos.
 *
 * La cabecera del perfil (foto, nombre, descripción, contadores) es visible para
 * todos aunque esto devuelva false; eso se decide en getFriendProfile.
 */
// 🔐 Las comprobaciones de privacidad viven en utils/privacidad.js: el gimnasio
// también las necesita y no puede haber dos copias que se desincronicen.
const { canViewContent, canViewSection, SECTION_KEYS } = require('../utils/privacidad');

/**
 * Crea la notificación para el dueño del entreno y le manda el aviso push.
 *
 * Nunca notifica acciones sobre uno mismo (dar me gusta a tu propio entreno no
 * debe generar aviso). Si algo falla, se registra pero NO se propaga: que no
 * llegue una notificación no puede tumbar el me gusta ni el comentario.
 */
const notifyOwner = async ({ ownerId, actorId, type, workout, actor, text = '' }) => {
    try {
        if (ownerId.toString() === actorId.toString()) return;

        await Notification.create({
            user: ownerId,
            actor: actorId,
            type,
            workout: workout._id,
            workoutName: workout.routineName || '',
            text: text.slice(0, 120)
        });

        const owner = await User.findById(ownerId).select('pushSubscriptions username');
        if (owner) {
            const nombre = actor?.username || 'Alguien';
            await sendPushToUser(owner, {
                title: type === 'like' ? '❤️ Nuevo me gusta' : '💬 Nuevo comentario',
                body: type === 'like'
                    ? `A ${nombre} le gusta tu entreno "${workout.routineName || ''}"`
                    : `${nombre}: ${text.slice(0, 60)}`,
                icon: '/assets/icons/icon-192x192.png',
                url: '/social'
            });
        }
    } catch (error) {
        console.error('No se pudo crear la notificación:', error.message);
    }
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

        // ⚠️ El feed NO miraba la visibilidad de cada amigo.
        //
        // En Ajustes se pueden ocultar los entrenos por separado, y esa opcion se
        // respetaba al entrar en el PERFIL de alguien pero no en el feed: quien la
        // activaba seguia apareciendo en el muro de todos sus amigos con sus
        // entrenos, sus pesos y sus fotos. Una opcion de privacidad que solo
        // funciona en la mitad de los sitios es peor que no tenerla, porque la
        // persona cree que esta oculta.
        //
        // Sin el campo (cuentas antiguas) se considera visible, igual que hace la
        // comprobacion del perfil.
        const amigosVisibles = await User.find({
            _id: { $in: friendIds },
            'visibility.workouts': { $ne: false }
        }).select('_id').lean();

        const idsVisibles = amigosVisibles.map(a => a._id);
        if (idsVisibles.length === 0) return res.json({ items: [], hasMore: false });

        const logs = await WorkoutLog.find({ user: { $in: idsVisibles } })
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

        const workout = await WorkoutLog.findById(workoutId).select('user likes routineName');
        if (!workout) return res.status(404).json({ message: 'Entreno no encontrado' });

        const allowed = await canViewContent(userId, workout.user);
        if (!allowed) return res.status(403).json({ message: 'No tienes acceso a este entreno' });

        const alreadyLiked = workout.likes.some(id => id.toString() === userId.toString());

        const updated = await WorkoutLog.findByIdAndUpdate(
            workoutId,
            alreadyLiked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } },
            { new: true }
        ).select('likes');

        // Avisamos solo al DAR me gusta (no al quitarlo) y nunca a uno mismo
        if (!alreadyLiked) {
            await notifyOwner({
                ownerId: workout.user,
                actorId: userId,
                type: 'like',
                workout,
                actor: req.user
            });
        }

        res.json({ likesCount: updated.likes.length, likedByMe: !alreadyLiked });
    } catch (error) {
        console.error('Error en toggleLike:', error);
        res.status(500).json({ message: 'Error al dar like' });
    }
};

/**
 * Borrar un entreno propio del feed.
 *
 * No existia ninguna forma de quitar una publicacion. Se podia borrar una rutina
 * y quitar un amigo, pero un entreno publicado —con su foto— se quedaba ahi para
 * siempre, y la unica salida era escribirle al administrador. Publicar algo por
 * error y no poder retirarlo es la primera queja que llega en cualquier app con
 * un muro.
 *
 * Solo el dueno. Un entreno ajeno lo quita el administrador desde su panel, que
 * es otra cosa y tiene su propia ruta.
 *
 * @route   DELETE /api/social/workout/:workoutId
 */
const borrarMiEntreno = async (req, res) => {
    try {
        const { workoutId } = req.params;

        const entreno = await WorkoutLog.findById(workoutId).select('user');
        if (!entreno) return res.status(404).json({ message: 'Ese entreno ya no existe' });

        if (entreno.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Solo puedes borrar tus propios entrenos' });
        }

        await WorkoutLog.findByIdAndDelete(workoutId);

        // Los avisos que lo anunciaban apuntan a algo que ya no esta: dejarlos
        // llena el buzon de la gente de entradas que no llevan a ningun sitio.
        await Notification.deleteMany({ workout: workoutId });

        res.json({ message: 'Entreno borrado', id: workoutId });
    } catch (error) {
        console.error('Error borrando entreno:', error);
        res.status(500).json({ message: 'Error al borrar' });
    }
};

/**
 * Borrar un comentario.
 *
 * Lo puede quitar quien lo escribio y tambien el dueno del entreno: en su propia
 * publicacion manda el, igual que en cualquier red social. El administrador
 * tiene su propia ruta para moderar lo de los demas.
 *
 * @route   DELETE /api/social/comment/:workoutId/:commentId
 */
const borrarComentarioPropio = async (req, res) => {
    try {
        const { workoutId, commentId } = req.params;
        const userId = req.user._id.toString();

        const entreno = await WorkoutLog.findById(workoutId).select('user comments');
        if (!entreno) return res.status(404).json({ message: 'Ese entreno ya no existe' });

        const comentario = (entreno.comments || []).find(c => c._id.toString() === commentId);
        if (!comentario) return res.status(404).json({ message: 'Ese comentario ya no existe' });

        const esMio = comentario.user?.toString() === userId;
        const esMiEntreno = entreno.user.toString() === userId;

        if (!esMio && !esMiEntreno) {
            return res.status(403).json({ message: 'No puedes borrar este comentario' });
        }

        await WorkoutLog.updateOne(
            { _id: workoutId },
            { $pull: { comments: { _id: commentId } } }
        );

        // El aviso llevaba el texto del comentario dentro: si se queda, el texto
        // sigue visible en el buzon aunque el comentario ya no este.
        await Notification.deleteMany({
            type: 'comment',
            workout: workoutId,
            actor: comentario.user
        });

        res.json({ message: 'Comentario borrado', id: commentId });
    } catch (error) {
        console.error('Error borrando comentario:', error);
        res.status(500).json({ message: 'Error al borrar' });
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

        const workout = await WorkoutLog.findById(workoutId).select('user routineName');
        if (!workout) return res.status(404).json({ message: 'Entreno no encontrado' });

        const allowed = await canViewContent(userId, workout.user);
        if (!allowed) return res.status(403).json({ message: 'No tienes acceso a este entreno' });

        // El tope va en el FILTRO, no en una comprobacion previa: comprobar y
        // despues escribir deja pasar de largo a dos comentarios simultaneos.
        const updated = await WorkoutLog.findOneAndUpdate(
            { _id: workoutId, [`comments.${MAX_COMENTARIOS_POR_ENTRENO}`]: { $exists: false } },
            { $push: { comments: { user: userId, text } } },
            { new: true }
        ).select('comments');

        if (!updated) {
            return res.status(400).json({
                message: 'Esta publicación ya tiene demasiados comentarios'
            });
        }

        const savedComment = updated.comments[updated.comments.length - 1];

        await notifyOwner({
            ownerId: workout.user,
            actorId: userId,
            type: 'comment',
            workout,
            actor: req.user,
            text
        });

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

// @desc    Cabecera del perfil (datos + contadores estilo IG)
// @route   GET /api/social/profile/:userId
const getFriendProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const viewerId = req.user._id;

        // 🔥 La CABECERA del perfil es pública para todo el mundo (como en IG).
        // Antes esto devolvía 403 si no erais amigos y ni siquiera podías ver
        // quién era la persona para mandarle solicitud.
        const profile = await User.findById(userId)
            .select('username avatar frame pet level title bio isPrivate visibility currentXP nextLevelXP streak friends friendRequests clan clanRank')
            .populate('clan', 'name icon')
            .lean();

        if (!profile) return res.status(404).json({ message: 'Usuario no encontrado' });

        const isMe = viewerId.toString() === userId.toString();
        const isFriend = (profile.friends || []).some(f => f.toString() === viewerId.toString());
        // Solo el CONTENIDO (entrenos, comida, misiones) respeta la privacidad
        const canView = isMe || !profile.isPrivate || isFriend;

        const [workoutsCount, missionsAggregate] = await Promise.all([
            WorkoutLog.countDocuments({ user: userId }),
            DailyLog.aggregate([
                { $match: { user: profile._id } },
                { $group: { _id: null, total: { $sum: '$missionStats.completed' } } }
            ])
        ]);

        // La amistad en Kairos es mutua, así que "seguidores" y "seguidos" son el
        // mismo conjunto (tus amigos). Se exponen por separado para la UI estilo IG.
        const friendsCount = (profile.friends || []).length;

        // ¿Ya le he mandado solicitud? Sirve para pintar "Solicitud enviada"
        const requestSent = (profile.friendRequests || []).some(r => r.toString() === viewerId.toString());

        res.json({
            profile: {
                _id: profile._id,
                username: profile.username,
                avatar: profile.avatar,
                frame: profile.frame,
                pet: profile.pet,
                level: profile.level,
                title: profile.title,
                bio: profile.bio || '',
                isPrivate: !!profile.isPrivate,
                currentXP: profile.currentXP,
                nextLevelXP: profile.nextLevelXP,
                streak: profile.streak,
                clan: profile.clan,
                clanRank: profile.clanRank,
                // Qué pestañas tiene sentido enseñar (en tu propio perfil, todas)
                visibility: isMe
                    ? { workouts: true, food: true, missions: true, body: true }
                    : {
                        workouts: profile.visibility?.workouts !== false,
                        food: profile.visibility?.food !== false,
                        missions: profile.visibility?.missions !== false,
                        body: profile.visibility?.body !== false
                    }
            },
            counts: {
                workouts: workoutsCount,
                followers: friendsCount,
                following: friendsCount,
                missions: missionsAggregate[0]?.total || 0
            },
            isMe,
            isFriend,
            requestSent,
            canViewContent: canView
        });
    } catch (error) {
        console.error('Error en getFriendProfile:', error);
        res.status(500).json({ message: 'Error cargando el perfil' });
    }
};

// @desc    Contenido paginado del perfil según pestaña (entrenos / comida / misiones)
// @route   GET /api/social/profile/:userId/items?tab=workouts|food|missions&page=1
const getProfileItems = async (req, res) => {
    try {
        const { userId } = req.params;
        const viewerId = req.user._id;
        const tab = ['workouts', 'food', 'missions', 'body'].includes(req.query.tab) ? req.query.tab : 'workouts';
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const skip = (page - 1) * FEED_PAGE_SIZE;

        // Dos filtros: la cuenta privada solo la ven sus amigos, y además el
        // dueño puede haber escondido esta sección en concreto.
        const allowed = await canViewContent(viewerId, userId);
        if (!allowed) return res.status(403).json({ message: 'Esta cuenta es privada' });

        if (!(await canViewSection(viewerId, userId, tab))) {
            return res.status(403).json({ message: 'Esta sección está oculta', hidden: true });
        }

        // Pestaña "Cuerpo": nivel de cada grupo muscular (no es una lista paginada)
        if (tab === 'body') {
            const ranks = await getMuscleRanks(userId);
            return res.json({ tab, ranks, items: [], hasMore: false });
        }

        if (tab === 'workouts') {
            const logs = await WorkoutLog.find({ user: userId })
                .sort({ date: -1 })
                .skip(skip)
                .limit(FEED_PAGE_SIZE + 1)
                .populate('user', 'username avatar frame level title')
                .populate('comments.user', 'username avatar')
                .lean();

            return res.json({
                tab,
                items: logs.slice(0, FEED_PAGE_SIZE).map(log => shapeFeedItem(log, viewerId)),
                hasMore: logs.length > FEED_PAGE_SIZE
            });
        }

        if (tab === 'food') {
            const logs = await NutritionLog.find({ user: userId, totalCalories: { $gt: 0 } })
                .sort({ date: -1 })
                .skip(skip)
                .limit(FEED_PAGE_SIZE + 1)
                .lean();

            const items = logs.slice(0, FEED_PAGE_SIZE).map(log => ({
                _id: log._id,
                date: log.date,
                totalCalories: Math.round(log.totalCalories || 0),
                totalProtein: Math.round(log.totalProtein || 0),
                totalCarbs: Math.round(log.totalCarbs || 0),
                totalFat: Math.round(log.totalFat || 0),
                // Solo el resumen por comida: no exponemos cada alimento del amigo
                meals: (log.meals || []).map(m => ({
                    name: m.name,
                    itemsCount: (m.foods || []).length,
                    calories: Math.round((m.foods || []).reduce((a, f) => a + (f.calories || 0) * (f.quantity || 1), 0))
                })).filter(m => m.itemsCount > 0)
            }));

            return res.json({ tab, items, hasMore: logs.length > FEED_PAGE_SIZE });
        }

        // tab === 'missions' → días con misiones completadas
        const logs = await DailyLog.find({ user: userId, 'missionStats.completed': { $gt: 0 } })
            .sort({ date: -1 })
            .skip(skip)
            .limit(FEED_PAGE_SIZE + 1)
            .select('date missionStats')
            .lean();

        const items = logs.slice(0, FEED_PAGE_SIZE).map(log => ({
            _id: log._id,
            date: log.date,
            completed: log.missionStats?.completed || 0,
            total: log.missionStats?.total || 0,
            list: (log.missionStats?.listCompleted || [])
                .filter(m => !m.failed)
                .map(m => ({ title: m.title, xpReward: m.xpReward, coinReward: m.coinReward, type: m.type }))
        }));

        return res.json({ tab, items, hasMore: logs.length > FEED_PAGE_SIZE });
    } catch (error) {
        console.error('Error en getProfileItems:', error);
        res.status(500).json({ message: 'Error cargando el contenido del perfil' });
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

        // Sin aviso, la solicitud se queda en el buzon hasta que el otro abra
        // la app por casualidad. No se espera con await: que el push tarde no
        // debe retrasar la respuesta a quien la envia.
        notificarA(targetId, {
            title: '👋 Nueva solicitud de amistad',
            body: (req.user.username || 'Alguien') + ' quiere ser tu amigo.',
            icon: '/assets/icons/icon-192x192.png',
            url: '/social/friends'
        });

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
            .populate('friends', 'username avatar level title frame lastActive hp maxHp')
            .populate('friendRequests', 'username avatar level');

        // 🔥 Ventana de 10 min, no 5: authMiddleware solo reescribe `lastActive` cuando
        // han pasado más de 5 minutos, así que con una ventana de 5 min un usuario
        // realmente conectado parpadeaba a "offline" justo antes de la siguiente escritura.
        const ONLINE_WINDOW = 10 * 60 * 1000;
        const now = new Date();
        const todayStr = getMadridDateString(now);

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
            const isOnline = (now - lastSeen) < ONLINE_WINDOW;
            const stats = logsMap[f._id.toString()] || { completed: 0, total: 0 };

            return {
                _id: f._id,
                username: f.username,
                avatar: f.avatar,
                frame: f.frame,
                level: f.level,
                title: f.title,
                online: isOnline,
                // La vida dice de un vistazo como le va: quien esta a 20 de 100
                // lleva dias fallando misiones. El progreso de misiones se sigue
                // enviando por si alguna pantalla lo necesita.
                hp: f.hp ?? 100,
                maxHp: f.maxHp ?? 100,
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
            // El que la mando no tenia forma de enterarse de que le habian dicho
            // que si, salvo mirando su lista de amigos de vez en cuando.
            notificarA(requesterId, {
                title: '✅ Ya sois amigos',
                body: (req.user.username || 'Alguien') + ' ha aceptado tu solicitud.',
                icon: '/assets/icons/icon-192x192.png',
                url: '/social/friends'
            });

            return res.json({ message: 'Solicitud aceptada' });
        }

        res.json({ message: 'Solicitud rechazada' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error respondiendo' });
    }
};

// @desc    Eliminar amigo (mutuo)
// @route   DELETE /api/social/friends/:friendId
// El frontend ya llamaba a esta ruta, pero no existía: el borrado devolvía 404
// y se deshacía en silencio, así que los amigos nunca se podían eliminar.
const removeFriend = async (req, res) => {
    try {
        const { friendId } = req.params;
        const userId = req.user._id;

        if (userId.toString() === friendId.toString()) {
            return res.status(400).json({ message: 'No puedes eliminarte a ti mismo' });
        }

        // La amistad es mutua: hay que quitarla en los dos sentidos
        await Promise.all([
            User.findByIdAndUpdate(userId, { $pull: { friends: friendId } }),
            User.findByIdAndUpdate(friendId, { $pull: { friends: userId } })
        ]);

        res.json({ message: 'Amigo eliminado' });
    } catch (error) {
        console.error('Error en removeFriend:', error);
        res.status(500).json({ message: 'Error eliminando amigo' });
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

// @desc    Ranking MENSUAL (XP ganado este mes) — el que reparte los premios
// @route   GET /api/social/leaderboard/monthly
const getMonthlyLeaderboard = async (req, res) => {
    try {
        const period = getMadridMonthString();
        const ranking = await getMonthlyRanking(period, 50);
        res.json({ period, prizes: MONTHLY_PRIZES, ranking });
    } catch (error) {
        console.error('Error en getMonthlyLeaderboard:', error);
        res.status(500).json({ message: 'Error obteniendo el ranking mensual' });
    }
};

// @desc    Mis notificaciones de me gusta / comentarios
// @route   GET /api/social/notifications
const getNotifications = async (req, res) => {
    try {
        const [items, unread] = await Promise.all([
            Notification.find({ user: req.user._id })
                .sort({ createdAt: -1 })
                .limit(40)
                .populate('actor', 'username avatar frame')
                .lean(),
            Notification.countDocuments({ user: req.user._id, read: false })
        ]);

        res.json({ items, unread });
    } catch (error) {
        console.error('Error en getNotifications:', error);
        res.status(500).json({ message: 'Error cargando notificaciones' });
    }
};

// @desc    Marcar mis notificaciones como leídas
// @route   POST /api/social/notifications/read
const markNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user._id, read: false },
            { $set: { read: true } }
        );
        res.json({ message: 'Notificaciones marcadas como leídas' });
    } catch (error) {
        console.error('Error en markNotificationsRead:', error);
        res.status(500).json({ message: 'Error actualizando notificaciones' });
    }
};

// @desc    Latido: "sigo con la app abierta"
// @route   POST /api/social/heartbeat
// El indicador de conexión se apoyaba en que alguna pantalla estuviera
// refrescando datos por su cuenta, y `protect` además solo reescribe
// `lastActive` cada 5 minutos. Si te quedabas quieto en una pantalla sin
// sondeos, aparecías desconectado con la app abierta. Esto lo hace explícito:
// el frontend lo llama cada pocos minutos mientras la app está en primer plano.
const heartbeat = async (req, res) => {
    try {
        await User.updateOne({ _id: req.user._id }, { $set: { lastActive: new Date() } });
        res.json({ ok: true });
    } catch (error) {
        console.error('Error en heartbeat:', error);
        res.status(500).json({ message: 'Error registrando actividad' });
    }
};

// @desc    Contador para el puntito rojo (footer y buzón)
// @route   GET /api/social/badge
// Solo cuenta, sin traer documentos: lo pide el footer en TODAS las pantallas,
// así que tiene que ser barato.
const getBadge = async (req, res) => {
    try {
        // ⚠️ Aqui tiene que estar TODO lo que se contesta desde el buzon.
        //
        // Las invitaciones a Carta Alta llegaban al buzon pero no encendian el
        // punto rojo, asi que el invitado no tenia forma de enterarse: alguien
        // le estaba esperando para empezar una partida y el aviso solo existia
        // si le daba por abrir el buzon a ciegas.
        //
        // Al anadir cualquier cosa que se conteste desde ahi, hay que sumarla
        // tambien aqui, o pasa lo mismo.
        const CartaAlta = require('../models/CartaAlta');

        const [actividad, usuario, cartas] = await Promise.all([
            Notification.countDocuments({ user: req.user._id, read: false }),
            User.findById(req.user._id).select('friendRequests missionRequests challengeRequests').lean(),
            CartaAlta.countDocuments({ invitados: req.user._id, estado: 'sala' })
        ]);

        const solicitudes = (usuario?.friendRequests || []).length;
        const misiones = (usuario?.missionRequests || []).length;
        const retos = (usuario?.challengeRequests || []).length;

        res.json({
            activity: actividad,
            requests: solicitudes,
            missions: misiones,
            challenges: retos,
            cartas,
            total: actividad + solicitudes + misiones + retos + cartas
        });
    } catch (error) {
        console.error('Error en getBadge:', error);
        res.status(500).json({ message: 'Error cargando avisos' });
    }
};

module.exports = {
    searchUsers, sendFriendRequest, getFriends, respondToRequest, getRequests, getLeaderboard,
    getFeed, toggleLike, addComment, borrarMiEntreno, borrarComentarioPropio, getFriendProfile, getProfileItems, getMonthlyLeaderboard,
    removeFriend, getNotifications, markNotificationsRead, getBadge, heartbeat
};