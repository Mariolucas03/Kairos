require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { initScheduledJobs } = require('./utils/scheduler');
const { errorHandler } = require('./middleware/errorMiddleware');
const mongoSanitize = require('express-mongo-sanitize');

// --- 1. IMPORTACIÓN DE RUTAS ---
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const dailyRoutes = require('./routes/daily');
const gymRoutes = require('./routes/gym');
const foodRoutes = require('./routes/food');
const socialRoutes = require('./routes/social');
const missionRoutes = require('./routes/missions');
const shopRoutes = require('./routes/shop');
const clanRoutes = require('./routes/clans');
const challengeRoutes = require('./routes/challenges');
const pushRoutes = require('./routes/push');
const eventRoutes = require('./routes/eventRoutes');
const cronRoutes = require('./routes/cron');

connectDB();

const app = express();

// --- CONFIGURACIÓN CORS (MODIFICADO) ---
// Usamos la opción "Permisiva Explícita" para evitar errores en el primer despliegue
app.use(cors({
    origin: '*', // Permite tráfico desde Vercel, Móvil y Cron-Job.org
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    // ¡CRÍTICO! Añadimos 'x-cron-secret' para que el Cron Job externo pueda autenticarse
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret']
}));

app.use(express.json());

// Seguridad: Prevenir inyección NoSQL
app.use(mongoSanitize());

// --- 2. DEFINICIÓN DE ENDPOINTS ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/daily', dailyRoutes);
app.use('/api/gym', gymRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/clans', clanRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/cron', cronRoutes);

// Inicializar Cron Jobs Internos (Como respaldo o para tareas diurnas)
initScheduledJobs();

app.get('/', (req, res) => res.send('API NoteGymk funcionando 🚀'));

// Middleware de manejo de errores (SIEMPRE AL FINAL)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Escuchar en 0.0.0.0 es correcto para Render y acceso red local
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Servidor iniciado en puerto ${PORT}`));

// Endpoint de salud (Health Check)
app.get('/ping', (req, res) => {
    res.send('pong 🏓');
});