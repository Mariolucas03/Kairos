const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Asegúrate de tener: npm install bcryptjs

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    avatar: { type: String, default: null },
    frame: { type: String, default: null },
    pet: { type: String, default: null },
    title: { type: String, default: 'Principiante' },
    theme: { type: String, default: 'dark' },

    // --- PERFIL PÚBLICO (estilo IG) ---
    bio: { type: String, default: '', maxlength: 150 },
    // Público por defecto: cualquiera puede ver tus entrenos.
    // Si se pone en privado, solo tus amigos ven el contenido (la cabecera del
    // perfil sigue siendo visible para todos, como en Instagram).
    isPrivate: { type: Boolean, default: false },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // Protegido

    // Clan System
    clan: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', default: null },
    clanRank: { type: String, enum: ['esclavo', 'recluta', 'guerrero', 'rey', 'dios', null], default: null },

    // Qué secciones de tu perfil pueden ver los demás. Es independiente de
    // `isPrivate`: primero decides SI alguien puede entrar (privado o no) y
    // luego QUÉ le enseñas. Todo visible por defecto.
    visibility: {
        workouts: { type: Boolean, default: true },
        food: { type: Boolean, default: true },
        missions: { type: Boolean, default: true },
        body: { type: Boolean, default: true }
    },

    // Datos Físicos
    physicalStats: {
        age: { type: Number },
        height: { type: Number },
        gender: { type: String, enum: ['male', 'female'] }
    },

    // --- ESTADÍSTICAS RPG ---
    level: { type: Number, default: 1 },
    currentXP: { type: Number, default: 0 },
    nextLevelXP: { type: Number, default: 100 },
    coins: { type: Number, default: 50 },
    gameCoins: { type: Number, default: 500 },
    // Ultimo rango CONOCIDO de cada grupo muscular (indice 0-9).
    // Los rangos se calculan al vuelo desde el historial, asi que sin guardar
    // el anterior no hay forma de saber que acabas de subir. Esto es lo que
    // permite lanzar el aviso y pagar el premio una sola vez.
    muscleRanks: { type: Map, of: Number, default: undefined },

    // --- Administracion ---
    // No existia ningun concepto de administrador: no habia forma de banear a
    // nadie ni de borrar un comentario ajeno. Se pone a mano con
    // `node backend/scripts/hacer-admin.js --usuario <nombre>`, nunca desde la
    // app: un endpoint que reparta permisos de administrador es justo el que no
    // debe existir.
    isAdmin: { type: Boolean, default: false },

    // Cuenta suspendida. `activo` en false (y no borrar el objeto) para que
    // quede el registro de por que se suspendio y cuando.
    baneado: {
        activo: { type: Boolean, default: false },
        motivo: { type: String, default: '' },
        fecha: { type: Date }
    },

    hp: { type: Number, default: 100 },
    maxHp: { type: Number, default: 100 },
    lives: { type: Number, default: 100 },

    // Configuración Nutricional
    macros: {
        calories: { type: Number, default: 2100 },
        protein: { type: Number, default: 150 },
        carbs: { type: Number, default: 200 },
        fat: { type: Number, default: 70 },
        fiber: { type: Number, default: 30 }
    },

    // Inventario
    inventory: [{
        item: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopItem' },
        quantity: { type: Number, default: 1 }
    }],

    // --- 🔥 SEGURIDAD CASINO (NUEVO) ---
    activeGameToken: { type: String, default: null }, // Evita trampas en juegos por turnos

    // Racha
    streak: {
        current: { type: Number, default: 1 },
        lastLogDate: { type: Date, default: Date.now }
    },

    // Última actividad, usada para el indicador "online" de la lista de amigos.
    // ⚠️ Faltaba en el esquema: authMiddleware hacía findByIdAndUpdate({ lastActive })
    // y Mongoose lo descartaba en silencio (modo strict), así que el campo nunca se
    // guardaba y TODOS los amigos aparecían siempre como desconectados.
    lastActive: { type: Date, default: Date.now },

    // Último día en que se giró la ruleta GRATIS ("YYYY-MM-DD", hora de Madrid).
    //
    // ⚠️ Este límite vivía solo en el localStorage del móvil, o sea que no era
    // un límite: borrando una clave del navegador —o llamando a la API a pelo—
    // se giraba sin parar, y la tirada gratis da 32 fichas de media.
    ultimaRuletaDiaria: { type: String, default: null },

    // Recompensas Diarias
    dailyRewards: {
        claimedDays: { type: [Number], default: [] },
        lastClaimDate: { type: Date },
        // 🔥 Día del último reclamo como "YYYY-MM-DD" en hora de Madrid.
        // Guardarlo como string evita depender de la zona horaria al comparar:
        // con Date puro, entre las 00:00 y 02:00 locales el día UTC era el anterior
        // y se podía reclamar dos veces la misma recompensa.
        lastClaimDay: { type: String, default: null },
        // Dia en que empezo el ciclo de 7 ("YYYY-MM-DD", hora de Madrid).
        // El ciclo avanza por dias de CALENDARIO, no por reclamaciones: si te
        // saltas un dia pierdes ESE premio, pero la rueda sigue girando. Antes
        // faltarte un dia devolvia el ciclo al dia 1 y se perdia todo.
        cycleStartDay: { type: String, default: null }
    },

    // Game Over
    redemptionMission: { type: String, default: null },

    // Último periodo "YYYY-MM" cuyo premio de ranking mensual ya cobró este usuario.
    // Sirve de candado para que el reparto sea idempotente aunque se lance varias veces.
    lastMonthlyRewardPeriod: { type: String, default: null },

    // --- SOCIAL ---
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    missionRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mission' }],
    challengeRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' }],

    // Push Notifications
    pushSubscriptions: [{
        endpoint: { type: String, required: true },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true }
        }
    }],

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// --- 🔥 ÍNDICES CRÍTICOS PARA RENDIMIENTO 🔥 ---
userSchema.index({ level: -1, currentXP: -1 });
userSchema.index({ username: 1 });

// --- LÓGICA DE BACKEND ---

// 1. Hash Password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// 2. Método Login
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// 3. Método Subir Nivel (RPG)
userSchema.methods.gainXp = function (amount) {
    this.currentXP += amount;
    let leveledUp = false;

    while (this.currentXP >= this.nextLevelXP) {
        this.currentXP -= this.nextLevelXP;
        this.level += 1;
        this.nextLevelXP = Math.floor(this.nextLevelXP * 1.2);
        this.hp = this.maxHp;
        leveledUp = true;
    }
    return leveledUp;
};

// Virtuals
userSchema.virtual('stats').get(function () {
    return {
        level: this.level,
        currentXP: this.currentXP,
        nextLevelXP: this.nextLevelXP,
        coins: this.coins,
        gameCoins: this.gameCoins,
        hp: this.hp,
        maxHp: this.maxHp
    };
});

module.exports = mongoose.model('User', userSchema);