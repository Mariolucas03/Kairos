const ShopItem = require('../models/ShopItem');
const User = require('../models/User');

// --- DATOS SEMILLA (Auto-relleno) ---
const SEED_ITEMS = [
    { name: 'Caballero Dorado', price: 500, category: 'avatar', icon: '/avatars/caballero_dorado.png', description: 'Armadura legendaria.' },
    { name: 'Zeus', price: 10, category: 'avatar', icon: '/avatars/zeus.png', description: 'El dios del rayo.' },
    { name: 'Diosa', price: 2100, category: 'avatar', icon: '/avatars/ari.png', description: 'La diosa de la sabiduría.' },
    { name: 'Frasco de Sabiduría', price: 40, category: 'consumable', icon: '/consumables/xp_potion.png', effectType: 'xp', effectValue: 100, description: '+100 XP.' },
    { name: 'Poción Vital', price: 100, category: 'consumable', icon: '/consumables/life_potion.png', description: '+1 HP.', effectType: 'heal', effectValue: 1 },
    { name: 'Marco de Oro', price: 300, category: 'frame', icon: '/frames/marco_oro.png', description: 'Brillante.' },
    { name: 'Marco de rayos', price: 10, category: 'frame', icon: '/frames/rayos.png', description: 'Energía pura.' },
    { name: 'Dragón Infernal', price: 1, category: 'pet', icon: '/pets/dragon.png', description: 'Bestia legendaria.' },
    { name: 'Serpiente de Dragón', price: 1, category: 'pet', icon: '/pets/snake.png', description: 'Sigilosa y letal.' },
    { name: 'El Veterano', price: 500, category: 'title', icon: '📜', description: 'Para quienes han visto mucho.' },
    { name: 'La Leyenda', price: 2000, category: 'title', icon: '👾', description: 'Legendario.' },
    { name: 'Cofre Roñoso', price: 50, category: 'chest', icon: '/chests/wood_chest.png', description: 'Riesgo bajo.' },
    { name: 'Cofre Dorado', price: 250, category: 'chest', icon: '/chests/gold_chest.png', description: 'Equilibrado.' },
    { name: 'Cofre Legendario', price: 1000, category: 'chest', icon: '/chests/legendary_chest.png', description: 'Alto riesgo.' },
    { name: 'Modo Oscuro', price: 0, category: 'theme', icon: '🌙', description: 'Clásico.', effectType: 'dark' },
    { name: 'Modo Claro', price: 1, category: 'theme', icon: '☀️', description: 'Brillante.', effectType: 'light' },
];

// 1. OBTENER TIENDA
const getShopItems = async (req, res) => {
    try {
        const systemItemsCount = await ShopItem.countDocuments({ category: { $ne: 'reward' } });

        if (systemItemsCount === 0) {
            console.log("🏪 Inicializando tienda del sistema...");
            await ShopItem.insertMany(SEED_ITEMS);
        }

        const items = await ShopItem.find({
            $or: [
                { user: req.user._id },
                { category: { $ne: 'reward' } }
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

// 3. COMPRAR (🔥 BLINDADO CON OPERACIONES ATÓMICAS)
const buyItem = async (req, res) => {
    try {
        const { itemId } = req.body;
        const userId = req.user._id;

        // A. Validar ítem
        const item = await ShopItem.findById(itemId);
        if (!item) return res.status(404).json({ message: 'Objeto no encontrado' });

        const isReward = item.category === 'reward';
        const currencyField = isReward ? 'coins' : 'gameCoins';
        const currencyName = isReward ? 'Monedas' : 'Fichas';

        // B. Verificamos si ya lo tiene (para categorías únicas)
        const userCheck = await User.findById(userId).select('inventory');
        const isUniqueCategory = ['avatar', 'frame', 'theme', 'title', 'pet'].includes(item.category);
        const alreadyOwns = userCheck.inventory.some(entry => entry.item.toString() === itemId);

        if (isUniqueCategory && alreadyOwns) {
            return res.status(400).json({ message: '¡Ya tienes este objeto!' });
        }

        // C. EJECUTAR COMPRA DE FORMA ATÓMICA
        // La consulta busca al usuario SOLO si tiene dinero suficiente.
        // Si no tiene dinero, la consulta no actualiza nada y devuelve null.
        let updatedUser;

        if (alreadyOwns && !isUniqueCategory) {
            // Ya lo tiene y es consumible -> Incrementamos cantidad y restamos dinero
            updatedUser = await User.findOneAndUpdate(
                {
                    _id: userId,
                    "inventory.item": itemId,
                    [currencyField]: { $gte: item.price } // CONDICIÓN ATÓMICA: Saldo >= Precio
                },
                {
                    $inc: { [currencyField]: -item.price, "inventory.$.quantity": 1 }
                },
                { new: true }
            ).populate('inventory.item');
        } else {
            // Es nuevo -> Añadimos al array y restamos dinero
            updatedUser = await User.findOneAndUpdate(
                {
                    _id: userId,
                    [currencyField]: { $gte: item.price } // CONDICIÓN ATÓMICA: Saldo >= Precio
                },
                {
                    $inc: { [currencyField]: -item.price },
                    $push: { inventory: { item: itemId, quantity: 1 } }
                },
                { new: true }
            ).populate('inventory.item');
        }

        // Si updatedUser es null, significa que la condición de saldo ($gte) falló o el usuario no existe
        if (!updatedUser) {
            return res.status(400).json({ message: `No tienes suficientes ${currencyName} o hubo un error de sincronización.` });
        }

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
            if (item.category === 'chest') {
                const roll = Math.random();
                let prize = 10;
                if (roll > 0.8) prize = 100;
                user.coins += prize;
                rewardData = { type: 'coins', value: prize };
                msg = "Cofre abierto";
            } else {
                msg = "Poción usada";
            }

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

// 5. INTERCAMBIO (🔥 BLINDADO)
const exchangeCurrency = async (req, res) => {
    try {
        const { amountGameCoins } = req.body;
        if (!amountGameCoins || amountGameCoins < 100) return res.status(400).json({ message: 'Mínimo 100 fichas' });

        const coinsToReceive = Math.floor(amountGameCoins / 100);

        // Actualización Atómica: Busca al usuario SOLO si tiene fichas >= amountGameCoins
        const updatedUser = await User.findOneAndUpdate(
            {
                _id: req.user._id,
                gameCoins: { $gte: amountGameCoins }
            },
            {
                $inc: { gameCoins: -amountGameCoins, coins: coinsToReceive }
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({ message: 'Fichas insuficientes o hubo un problema de conexión' });
        }

        res.json({ message: `Canje exitoso: +${coinsToReceive} Monedas`, user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Error en intercambio' });
    }
};

// 6. SEED MANUAL
const seedShop = async (req, res) => {
    try {
        await ShopItem.deleteMany({ category: { $ne: 'reward' } });
        await ShopItem.insertMany(SEED_ITEMS);
        res.json({ message: 'Tienda reiniciada.' });
    } catch (error) { res.status(500).json({ message: 'Error en seed' }); }
};

module.exports = { getShopItems, createCustomReward, buyItem, useItem, seedShop, exchangeCurrency };