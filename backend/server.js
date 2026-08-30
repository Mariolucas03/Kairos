require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { initScheduledJobs, ponerseAlDia, esperarPuestaAlDia } = require('./utils/scheduler');
const { errorHandler } = require('./middleware/errorMiddleware');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

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
// const eventRoutes = require('./routes/eventRoutes'); // ver mas abajo
const cronRoutes = require('./routes/cron');
const gamesRoutes = require('./routes/games');
const { syncExerciseCatalog } = require('./controllers/gymController');

connectDB();

const app = express();

// --- CONFIGURACIÓN CORS ---
// Lista blanca configurable vía env (ALLOWED_ORIGINS="https://tuapp.vercel.app,https://otro.dominio.com").
// Las apps móviles / cron-job.org / curl no mandan header "Origin", así que siempre se permiten.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

if (allowedOrigins.length === 0 && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  ALLOWED_ORIGINS no está configurado: se rechazarán las peticiones del navegador con Origin. Configúralo con el dominio real del frontend.');
}

app.use(cors({
    origin: (origin, callback) => {
        // Sin header Origin (apps móviles, cron-job.org, curl, server-to-server) -> permitir
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production') return callback(null, true); // conveniencia en desarrollo local
        return callback(new Error('No permitido por CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    // ¡CRÍTICO! Añadimos 'x-cron-secret' para que el Cron Job externo pueda autenticarse
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret']
}));

// 1 MB: las fotos de los entrenos viajan en base64 dentro del JSON y ya vienen
// comprimidas a ~200 KB desde el móvil. Con el límite por defecto (100 KB) el
// servidor las rechazaba con "request entity too large" antes incluso de que
// el controlador pudiera validarlas.
app.use(express.json({ limit: '1mb' }));

// Seguridad: Prevenir inyección NoSQL
app.use(mongoSanitize());

// Seguridad: Límite de peticiones global (protege login, apuestas, etc. de fuerza bruta/spam)
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas peticiones, inténtalo de nuevo más tarde.' }
}));

// ⚠️ Antes de responder NADA de la API se espera a que termine el castigo
// pendiente, si lo hay. Sin esto, la puesta al dia corria en paralelo y el
// servidor podia devolver /users con la vida ANTIGUA: el usuario entraba, veia
// su vida intacta, y solo al recargar aparecia restada.
// Solo espera de verdad la primera peticion tras arrancar; despues la promesa
// ya esta resuelta y no cuesta nada.
app.use('/api', async (req, res, next) => {
    try { await esperarPuestaAlDia(); } catch (e) { /* que un fallo aqui no tumbe la API */ }
    next();
});

// --- 2. DEFINICIÓN DE ENDPOINTS ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', require('./routes/admin'));
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
// ⚠️ DESCONECTADO. /api/events es codigo huerfano: el frontend no lo llama, no
// lo lee nadie mas en el backend y su coleccion esta vacia (0 documentos). El
// evento semanal de clan que SI funciona vive en clanController, y ese calcula
// los puntos desde los entrenos reales.
//
// Se desconecta porque add-points deja que el propio cliente se sume hasta
// 10.000 puntos por llamada. Hoy no paga nada, asi que no da dinero; el dia que
// alguien enganche una recompensa a esos puntos, el grifo ya estaria abierto.
// Los ficheros se quedan para cuando se retome la funcion.
// app.use('/api/events', eventRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/games', gamesRoutes);

// Inicializar Cron Jobs Internos (Como respaldo o para tareas diurnas)
initScheduledJobs();

// El cron interno de las 03:00 NO se ejecuta si Render tiene la instancia
// dormida a esa hora, que es lo normal en el plan gratuito. Al arrancar se
// comprueba si el castigo de ayer quedo pendiente y, si es asi, se ejecuta.
// Es idempotente: lleva su propia marca en base de datos.
ponerseAlDia();

app.get('/', (req, res) => res.send('API NoteGymk funcionando 🚀'));

// Middleware de manejo de errores (SIEMPRE AL FINAL)
app.use(errorHandler);

/**
 * RED DE SEGURIDAD DEL PROCESO.
 *
 * ⚠️ Desde Node 15, una promesa rechazada que nadie recoge TUMBA EL PROCESO
 * ENTERO. Y en esta app hay varias llamadas lanzadas sin esperar respuesta a
 * proposito —limpiar una suscripcion push caducada, avisar a los amigos de un
 * entreno, mandar una notificacion— porque son secundarias y no deben retrasar
 * la respuesta al usuario.
 *
 * Una de esas, fallando por un hipo de la base de datos, dejaba a TODO el mundo
 * sin app hasta que Render reiniciara. Y en el plan gratuito, reiniciar son
 * otros 30-50 segundos de arranque en frio para el siguiente que entre.
 *
 * Esto no oculta el problema: lo escribe en los registros con su traza. Lo que
 * evita es que un fallo de algo accesorio se lleve por delante lo principal.
 */
process.on('unhandledRejection', (motivo) => {
    console.error('⚠️  Promesa rechazada sin recoger (el servidor SIGUE en pie):', motivo);
});

/**
 * Los errores sincronos sueltos si son harina de otro costal: el proceso puede
 * quedar en un estado incoherente, asi que se registra y se sale de forma
 * ordenada para que Render lo levante limpio.
 */
process.on('uncaughtException', (error) => {
    console.error('💥 Error no capturado, cerrando para reiniciar limpio:', error);
    process.exit(1);
});

const PORT = process.env.PORT || 5000;

// Escuchar en 0.0.0.0 es correcto para Render y acceso red local
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor iniciado en puerto ${PORT}`);

    // CATÁLOGO DE EJERCICIOS AL ARRANQUE.
    // La huella es un hash de todo el catálogo, así que esto solo escribe en la
    // base de datos cuando algo ha cambiado de verdad (un ejercicio nuevo, un
    // músculo corregido, los porcentajes...). Antes solo se sincronizaba cuando
    // el primer usuario abría la lista de ejercicios: ese pagaba la espera.
    // Va en segundo plano y con su propio catch: si falla, el servidor sigue
    // en pie y el catálogo se pondrá al día en la primera visita a /exercises.
    syncExerciseCatalog()
        .then(r => {
            if (r.synced) console.log(`🏋️ Catálogo de ejercicios sincronizado (${r.total} ejercicios)`);
            else console.log('🏋️ Catálogo de ejercicios ya al día');
        })
        .catch(err => console.error('⚠️ No se pudo sincronizar el catálogo al arrancar:', err.message));
});

// Endpoint de salud (Health Check)
app.get('/ping', (req, res) => {
    res.send('pong 🏓');
});