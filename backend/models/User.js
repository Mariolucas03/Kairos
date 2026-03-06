const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Asegúrate de tener: npm install bcryptjs

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    avatar: { type: String, default: null },
    frame: { type: String, default: null },
    pet: { type: String, default: null },
    title: { type: String, default: 'Principiante' },
    theme: { type: String, default: 'dark' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // Protegido

    // Clan System
    clan: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan', default: null },
    clanRank: { type: String, enum: ['esclavo', 'recluta', 'guerrero', 'rey', 'dios', null], default: null },

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

    // Racha
    streak: {
        current: { type: Number, default: 1 },
        lastLogDate: { type: Date, default: Date.now }
    },

    // Recompensas Diarias
    dailyRewards: {
        claimedDays: { type: [Number], default: [] },
        lastClaimDate: { type: Date }
    },

    // Game Over
    redemptionMission: { type: String, default: null },

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

// --- 🔥 ÍNDICES CRÍTICOS PARA RENDIMIENTO (NUEVO) 🔥 ---
// 1. Índice Compuesto para el Leaderboard (Ordena instantáneamente sin colapsar la BD)
userSchema.index({ level: -1, currentXP: -1 });

// 2. Índice de Texto para buscar amigos rapidísimo por nombre
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