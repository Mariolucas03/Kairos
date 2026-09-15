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
module.exports = { registerUser, loginUser };