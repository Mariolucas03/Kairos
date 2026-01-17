const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('FATAL: JWT_SECRET no definido en variables de entorno');
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Registrar nuevo usuario
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 1. Validar duplicados
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'El usuario ya existe' });
        }

        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
            return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
        }

        // 2. Crear Usuario
        // 🔥 CORRECCIÓN: Pasamos la contraseña "plana".
        // El hook 'pre save' del modelo User.js se encargará de encriptarla automáticamente.
        const user = await User.create({
            username,
            email,
            password, // <--- AQUÍ ESTABA EL ERROR (Antes enviabas hashedPassword)
            coins: 0,
            gameCoins: 500,
            level: 1,
            hp: 100,
            lives: 100,
            streak: { current: 1, lastLogDate: new Date() }
        });

        if (user) {
            const userResponse = user.toObject();
            delete userResponse.password;

            res.status(201).json({
                ...userResponse,
                token: generateToken(user._id)
            });
        } else {
            res.status(400).json({ message: 'Datos inválidos al crear usuario' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en servidor' });
    }
};

// @desc    Login usuario
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Buscamos usuario y solicitamos el password
        const user = await User.findOne({ email }).select('+password');

        // bcrypt.compare encriptará 'password' una vez y lo comparará con el hash de la BD
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

module.exports = { registerUser, loginUser };