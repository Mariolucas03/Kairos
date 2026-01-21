const ShopItem = require('../models/ShopItem');
const User = require('../models/User');

// --- DATOS SEMILLA (Auto-relleno) ---
const SEED_ITEMS = [
    // AVATARES
    { name: 'Caballero Dorado', price: 500, category: 'avatar', icon: '/avatars/caballero_dorado.png', description: 'Armadura legendaria.' },
    { name: 'Zeus', price: 10, category: 'avatar', icon: '/avatars/zeus.png', description: 'El dios del rayo.' },
    { name: 'Diosa', price: 2100, category: 'avatar', icon: '/avatars/ari.png', description: 'La diosa de la sabiduría.' },
    // POCIONES
    { name: 'Frasco de Sabiduría', price: 40, category: 'consumable', icon: '/consumables/xp_potion.png', effectType: 'xp', effectValue: 100, description: '+100 XP.' },
    { name: 'Poción Vital', price: 100, category: 'consumable', icon: '/consumables/life_potion.png', description: '+1 HP.', effectType: 'heal', effectValue: 1 },
    // MARCOS
    { name: 'Marco de Oro', price: 300, category: 'frame', icon: '/frames/marco_oro.png', description: 'Brillante.' },
    { name: 'Marco de rayos', price: 10, category: 'frame', icon: '/frames/rayos.png', description: 'Energía pura.' },
    // MASCOTAS
    { name: 'Dragón Infernal', price: 1, category: 'pet', icon: '/pets/dragon.png', description: 'Bestia legendaria.' },
    { name: 'Serpiente de Dragón', price: 1, category: 'pet', icon: '/pets/snake.png', description: 'Sigilosa y letal.' },
    // TITULOS
    { name: 'El Veterano', price: 500, category: 'title', icon: '📜', description: 'Para quienes han visto mucho.' },
    { name: 'La Leyenda', price: 2000, category: 'title', icon: '👾', description: 'Legendario.' },
    // COFRES
    { name: 'Cofre Roñoso', price: 50, category: 'chest', icon: '/chests/wood_chest.png', description: 'Riesgo bajo.' },
    { name: 'Cofre Dorado', price: 250, category: 'chest', icon: '/chests/gold_chest.png', description: 'Equilibrado.' },
    { name: 'Cofre Legendario', price: 1000, category: 'chest', icon: '/chests/legendary_chest.png', description: 'Alto riesgo.' },
    // TEMA
    { name: 'Modo Oscuro', price: 0, category: 'theme', icon: '🌙', description: 'Clásico.', effectType: 'dark' },
    { name: 'Modo Claro', price: 1, category: 'theme', icon: '☀️', description: 'Brillante.', effectType: 'light' },
];

// 1. OBTENER TIENDA (CON AUTO-SEED ROBUSTO)
const getShopItems = async (req, res) => {
    try {
        // Verificar si existen ítems del sistema (no recompensas personales)
        const systemItemsCount = await ShopItem.countDocuments({ category: { $ne: 'reward' } });

        // 🔥 AUTO-FIX: Si no hay ítems del sistema, los creamos ahora mismo
        if (systemItemsCount === 0) {
            console.log("🏪 Inicializando tienda del sistema...");
            await ShopItem.insertMany(SEED_ITEMS);
        }

        // Ahora buscamos todo: los del sistema + los personalizados del usuario
        const items = await ShopItem.find({
            $or: [
                { user: req.user._id },       // Creados por mí
                { category: { $ne: 'reward' } } // O ítems del sistema
            ]
        });

        res.json(items);
    } catch (error) {
        console.error("Error getShopItems:", error);
        res.status(500).json({ message: 'Error cargando tienda' });
    }
};

// 2. CREAR RECOMPENSA
const createCustomReward = async (req, res) => {
    try {
        const price = parseInt(req.body.price);
        if (isNaN(price)) return res.status(400).json({ message: 'Precio inválido' });

        const newItem = await ShopItem.create({
            user: req.user._id,
            name: req.body.name,
            price: price,
            category: 'reward',
            icon: '🎟️',
            description: 'Recompensa personal.'
        });
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: 'Error creando recompensa' });
    }
};

// 3. COMPRAR (LÓGICA CORREGIDA)
const buyItem = async (req, res) => {
    try {
        const { itemId } = req.body;
        const userId = req.user._id;

        // A. Validar ítem
        const item = await ShopItem.findById(itemId);
        if (!item) return res.status(404).json({ message: 'Objeto no encontrado' });

        // B. Determinar moneda (Según esquema User.js)
        const userCheck = await User.findById(userId);
        const isReward = item.category === 'reward';

        // Si es recompensa personal -> usa 'coins' (Monedas)
        // Si es item de la tienda -> usa 'gameCoins' (Fichas)
        const currencyField = isReward ? 'coins' : 'gameCoins';
        const currentBalance = userCheck[currencyField];
        const currencyName = isReward ? 'Monedas' : 'Fichas';

        // C. Verificar saldo
        if (currentBalance < item.price) {
            return res.status(400).json({ message: `No tienes suficientes ${currencyName}` });
        }

        // D. Validar únicos (Evitar comprar 2 veces el mismo avatar)
        const isUniqueCategory = ['avatar', 'frame', 'theme', 'title', 'pet'].includes(item.category);
        const alreadyOwns = userCheck.inventory.some(entry => entry.item.toString() === itemId);

        if (isUniqueCategory && alreadyOwns) {
            return res.status(400).json({ message: '¡Ya tienes este objeto!' });
        }

        // E. EJECUTAR COMPRA
        const updateActions = {
            $inc: { [currencyField]: -item.price } // Resta el dinero
        };

        if (alreadyOwns && !isUniqueCategory) {
            // Si ya lo tiene y es consumible (poción/cofre), sumamos cantidad
            await User.updateOne(
                { _id: userId, "inventory.item": itemId },
                {
                    $inc: { [currencyField]: -item.price, "inventory.$.quantity": 1 }
                }
            );
        } else {
            // Si es nuevo, lo añadimos al array
            updateActions.$push = { inventory: { item: itemId, quantity: 1 } };
            await User.findByIdAndUpdate(userId, updateActions);
        }

        // 🔥 RETORNAR USUARIO ACTUALIZADO (Con inventario populado para que el frontend lo detecte)
        // Usamos findById nuevamente para asegurar que devolvemos el estado final exacto
        const updatedUser = await User.findById(userId).populate('inventory.item');

        res.json({
            message: `¡Compraste ${item.name}!`,
            user: updatedUser
        });

    } catch (error) {
        console.error("Error en buyItem:", error);
        res.status(500).json({ message: 'Error en la compra' });
    }
};

// 4. USAR / EQUIPAR
const useItem = async (req, res) => {
    try {
        const { itemId } = req.body;
        const user = await User.findById(req.user._id).populate('inventory.item');
        const item = await ShopItem.findById(itemId);

        if (!item) return res.status(404).json({ message: 'Objeto no encontrado' });

        const inventoryIndex = user.inventory.findIndex(i =>
            (i.item._id && i.item._id.toString() === itemId) ||
            (i.item.toString() === itemId)
        );

        if (inventoryIndex === -1) {
            return res.status(400).json({ message: 'No tienes este objeto' });
        }

        let msg = 'Objeto usado';
        let rewardData = null;

        // LÓGICA
        if (item.category === 'avatar') { user.avatar = item.icon; msg = `Avatar equipado`; }
        else if (item.category === 'frame') { user.frame = item.icon; msg = `Marco equipado`; }
        else if (item.category === 'pet') { user.pet = item.icon; msg = `Mascota equipada`; }
        else if (item.category === 'title') { user.title = item.name; msg = `Título equipado`; }
        else if (item.category === 'theme') { user.theme = item.effectType || 'dark'; msg = `Tema aplicado`; }

        // CONSUMIBLES Y COFRES (Se gastan)
        else if (item.category === 'consumable' || item.category === 'chest') {
            // Lógica de cofres y pociones (reutilizada de tu código anterior)
            if (item.category === 'chest') {
                // ... Lógica simple de cofre ...
                const roll = Math.random();
                let prize = 10;
                if (roll > 0.8) prize = 100;
                user.coins += prize;
                rewardData = { type: 'coins', value: prize };
                msg = "Cofre abierto";
            } else {
                msg = "Poción usada";
            }

            // Reducir cantidad
            user.inventory[inventoryIndex].quantity -= 1;
            if (user.inventory[inventoryIndex].quantity <= 0) {
                user.inventory.splice(inventoryIndex, 1);
            }
        }

        await user.save();

        const updatedUser = await User.findById(user._id).populate('inventory.item');
        res.json({ message: msg, user: updatedUser, reward: rewardData });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error usando objeto' });
    }
};

// 5. INTERCAMBIO
const exchangeCurrency = async (req, res) => {
    try {
        const { amountGameCoins } = req.body;
        if (!amountGameCoins || amountGameCoins < 100) return res.status(400).json({ message: 'Mínimo 100 fichas' });

        const user = await User.findById(req.user._id);
        if (user.gameCoins < amountGameCoins) return res.status(400).json({ message: 'Fichas insuficientes' });

        const coinsToReceive = Math.floor(amountGameCoins / 100);

        const updatedUser = await User.findByIdAndUpdate(req.user._id, {
            $inc: { gameCoins: -amountGameCoins, coins: coinsToReceive }
        }, { new: true });

        res.json({ message: `Canje exitoso: +${coinsToReceive} Monedas`, user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Error en intercambio' });
    }
};

// 6. SEED MANUAL (Legacy)
const seedShop = async (req, res) => {
    try {
        await ShopItem.deleteMany({ category: { $ne: 'reward' } });
        await ShopItem.insertMany(SEED_ITEMS);
        res.json({ message: 'Tienda reiniciada.' });
    } catch (error) { res.status(500).json({ message: 'Error en seed' }); }
};

module.exports = { getShopItems, createCustomReward, buyItem, useItem, seedShop, exchangeCurrency };