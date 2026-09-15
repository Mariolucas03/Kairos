const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. SESIÓN ETERNA (365 Días)
const generateToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('FATAL: JWT_SECRET no definido en variables de entorno');
    }
    // Cambiado de '30d' a '365d' para que no caduque en un año
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '365d' });
};

// @desc    Registrar nuevo usuario
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
    try {
        const { username, email, password, gender } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'El email ya existe' });

        const usernameExists = await User.findOne({ username });
        if (usernameExists) return res.status(400).json({ message: 'El usuario ya existe' });

        const user = await User.create({
            username,
            email,
            password,
            coins: 0,
            gameCoins: 500,
            level: 1,
            hp: 100,
            lives: 100,
            // Hombre o mujer, elegido al crear el personaje: decide que
            // cuerpo se pinta en el mapa muscular. Solo si se dijo.
            ...(gender === 'male' || gender === 'female' ? { physicalStats: { gender } } : {}),
            streak: { current: 0, lastLogDate: new Date(0) }
        });

        if (user) {
            const userResponse = user.toObject();
            delete userResponse.password;

            res.status(201).json({
                ...userResponse,
                token: generateToken(user._id)
            });
        } else {
            res.status(400).json({ message: 'Datos inválidos' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en servidor' });
    }
};

// ... (parte del registro igual)

// @desc    Login usuario
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
    try {
        // 🔥 AQUI: Extraemos username, NO email
        const { username, password } = req.body;

        // 🔥 AQUI: Buscamos por username
        const user = await User.findOne({ username }).select('+password');

        if (user && (await bcrypt.compare(password, user.password))) {
            const userResponse = user.toObject();
            delete userResponse.password;

            res.json({
                ...userResponse,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Credenciales inválidas' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en servidor' });
    }
};

// ...
/**
 * UN VISTAZO ANTES DE ENTRAR.
 *
 * La pantalla de acceso es un panel de control: al escribir tu nombre, el
 * avatar de al lado del formulario se convierte en TU avatar (foto, marco,
 * nivel, cuerpo) antes de poner la contraseña. Es lo mismo que ya se ve de
 * cualquiera en el ranking o en su perfil publico: nada privado. Sin
 * contraseña no se entra, esto solo saluda.
 *
 * @route GET /api/auth/vistazo/:username
 */
const vistazo = async (req, res) => {
    try {
        const nombre = String(req.params.username || '').trim();
        if (nombre.length < 3 || nombre.length > 30) return res.status(404).json({ message: 'Nadie' });
        const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const u = await User.findOne({ username: new RegExp('^' + escapado + '$', 'i') })
            .select('username avatar frame level title physicalStats.gender').lean();
        if (!u) return res.status(404).json({ message: 'Nadie' });
        res.json({ username: u.username, avatar: u.avatar || null, frame: u.frame || null, level: u.level || 1, title: u.title || '', gender: u.physicalStats?.gender || null });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error' });
    }
};

module.exports = { registerUser, loginUser, vistazo };