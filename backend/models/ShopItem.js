const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null = Item del sistema, ID = Recompensa personal
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: {
        type: String,
        required: true,
        // LAS 8 CATEGORÍAS EXACTAS
        enum: [
            'reward',      // Recompensas personales
            'consumable',  // Pociones
            'avatar',      // Skins
            'frame',       // Marcos
            'theme',       // Temas
            'chest',       // Cofres
            'pet',         // Mascotas
            'title'        // Títulos
        ]
    },
    icon: { type: String, default: '📦' },
    sprite: { type: String }, // Aquí irá la TIRA DE IMÁGENES (Animación)
    description: { type: String, default: '' },
    // Para lógica de uso (ej: 'heal', 'xp', 'random_low')
    effectType: { type: String, default: 'cosmetic' },
    // Valor numérico (ej: 10 de vida)
    effectValue: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ShopItem', shopItemSchema);