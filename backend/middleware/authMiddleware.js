const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 1. Obtener el token del header (Bearer <token>)
            token = req.headers.authorization.split(' ')[1];

            // 2. Verificar que existe el secreto (Seguridad)
            if (!process.env.JWT_SECRET) {
                throw new Error('FATAL: JWT_SECRET no definido en el entorno');
            }

            // 3. Decodificar el token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 4. Obtener el ID del usuario del payload del token
            // Soporta varios formatos de payload por si acaso (id, user.id, _id)
            const userId = decoded.id || decoded.user?.id || decoded._id || decoded.user;

            // 5. Buscar el usuario en la base de datos (sin la contraseña)
            req.user = await User.findById(userId).select('-password');

            if (!req.user) {
                res.status(401);
                throw new Error('Usuario no encontrado en base de datos');
            }

            // 🔥🔥🔥 AÑADIDO CLAVE PARA SOCIAL: ACTUALIZAR "LAST ACTIVE" 🔥🔥🔥
            // Cada vez que el usuario hace una petición autenticada, actualizamos su fecha
            await User.findByIdAndUpdate(userId, { lastActive: new Date() });

            next();

        } catch (error) {
            console.error('Error en authMiddleware:', error.message);
            res.status(401);
            throw new Error('No autorizado, token fallido');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('No autorizado, no hay token');
    }
});

module.exports = protect;