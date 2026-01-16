const ShopItem = require('../models/ShopItem');
const User = require('../models/User');

// 1. OBTENER TIENDA
const getShopItems = async (req, res) => {
    try {
        const items = await ShopItem.find({
            $or: [{ user: req.user._id }, { category: { $ne: 'reward' } }]
        });
        res.json(items);
    } catch (error) {
        console.error("Error getShopItems:", error);
        res.status(500).json({ message: 'Error cargando tienda' });
    }
};

// 2. CREAR RECOMPENSA (CORREGIDO)
const createCustomReward = async (req, res) => {
    try {
        // Aseguramos que el precio sea un número
        const price = parseInt(req.body.price);

        if (isNaN(price)) {
            return res.status(400).json({ message: 'El precio debe ser un número válido' });
        }

        const newItem = await ShopItem.create({
            user: req.user._id,
            name: req.body.name,
            price: price,
            category: 'reward', // Importante para que use Monedas Reales
            icon: '🎟️',
            description: 'Recompensa personal creada por el usuario.'
        });

        console.log("Recompensa creada:", newItem);
        res.status(201).json(newItem);

    } catch (error) {
        // 🔥 ESTO TE DIRÁ EL ERROR EXACTO EN LA TERMINAL DEL SERVIDOR
        console.error("ERROR CRÍTICO AL CREAR RECOMPENSA:", error);
        res.status(500).json({ message: 'Error creando recompensa: ' + error.message });
    }
};

// 3. COMPRAR (LÓGICA BLINDADA DE RESTA)
const buyItem = async (req, res) => {
    try {
        const { itemId } = req.body;
        const userId = req.user._id;

        // A. Validar ítem
        const item = await ShopItem.findById(itemId);
        if (!item) return res.status(404).json({ message: 'Objeto no encontrado' });

        // B. Determinar dónde está el dinero
        const userCheck = await User.findById(userId);
        const isReward = item.category === 'reward';

        // Detección automática de la ruta de las fichas (gameCoins vs stats.gameCoins)
        let coinsPath = 'coins'; // Por defecto Monedas
        let currentBalance = 0;
        let currencyName = 'Monedas';

        if (isReward) {
            // Premios usan Monedas (Coins)
            coinsPath = 'coins';
            currentBalance = userCheck.coins || 0;
            currencyName = 'Monedas';
        } else {
            // Tienda usa Fichas (GameCoins)
            currencyName = 'Fichas';
            if (userCheck.gameCoins !== undefined) {
                coinsPath = 'gameCoins'; // Está en la raíz
                currentBalance = userCheck.gameCoins;
            } else if (userCheck.stats && userCheck.stats.gameCoins !== undefined) {
                coinsPath = 'stats.gameCoins'; // Está anidado
                currentBalance = userCheck.stats.gameCoins;
            } else {
                // No existe el campo, asumimos raíz e inicializamos a 0 virtualmente
                coinsPath = 'gameCoins';
                currentBalance = 0;
            }
        }

        // C. Verificar saldo antes de tocar la DB
        if (currentBalance < item.price) {
            return res.status(400).json({ message: `No tienes suficientes ${currencyName}` });
        }

        // D. Validar inventario (Objetos Únicos)
        const isUniqueCategory = ['avatar', 'frame', 'theme', 'title', 'pet'].includes(item.category);
        const alreadyOwns = userCheck.inventory.some(entry => entry.item.toString() === itemId);

        if (isUniqueCategory && alreadyOwns) {
            return res.status(400).json({ message: '¡Ya tienes este objeto único!' });
        }

        // E. EJECUTAR COMPRA (Atomic Update)
        const filter = { _id: userId };
        // Aseguramos que tenga saldo en la query también para evitar condiciones de carrera
        filter[coinsPath] = { $gte: item.price };

        const updateActions = {
            $inc: { [coinsPath]: -item.price } // Resta dinámica en el path correcto
        };

        let updatedUser;

        if (alreadyOwns && !isUniqueCategory) {
            // Si ya lo tiene y es consumible/stackeable, sumamos cantidad
            // Necesitamos un filtro especial para el array
            const arrayFilter = { _id: userId, "inventory.item": itemId };
            arrayFilter[coinsPath] = { $gte: item.price }; // Re-aplicamos filtro de saldo

            updateActions.$inc["inventory.$.quantity"] = 1;

            // Nota: delete updateActions.$inc[coinsPath] NO hacer esto, queremos restar dinero Y sumar item
            // Pero findOneAndUpdate con array filter es complejo si mezclamos paths.
            // Simplificación segura: Usamos el filtro base y asumimos consistencia en arrays

            updatedUser = await User.findOneAndUpdate(
                { _id: userId, "inventory.item": itemId }, // Filtro busca el usuario Y el item
                {
                    $inc: {
                        [coinsPath]: -item.price,
                        "inventory.$.quantity": 1
                    }
                },
                { new: true }
            ).populate('inventory.item');

        } else {
            // Si es nuevo, hacemos push
            updateActions.$push = { inventory: { item: itemId, quantity: 1 } };
            updatedUser = await User.findOneAndUpdate(filter, updateActions, { new: true }).populate('inventory.item');
        }

        if (!updatedUser) {
            return res.status(400).json({ message: "Error en la transacción o saldo insuficiente." });
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
        const user = await User.findById(req.user._id);
        const item = await ShopItem.findById(itemId);

        if (!item) return res.status(404).json({ message: 'Objeto no encontrado' });

        const inventoryIndex = user.inventory.findIndex(i => i.item.toString() === itemId);
        if (inventoryIndex === -1) {
            return res.status(400).json({ message: 'No tienes este objeto' });
        }

        let msg = 'Objeto usado';
        let rewardData = null;

        // LÓGICA SEGÚN CATEGORÍA
        if (item.category === 'avatar') { user.avatar = item.icon; msg = `¡Avatar equipado!`; }
        else if (item.category === 'frame') { user.frame = item.icon; msg = `¡Marco equipado!`; }
        else if (item.category === 'pet') { user.pet = item.icon; msg = `¡Mascota equipada!`; }
        else if (item.category === 'title') { user.title = item.name; msg = `¡Título establecido!`; }
        else if (item.category === 'theme') { user.theme = item.effectType || 'dark'; msg = `¡Tema aplicado!`; }

        // CONSUMIBLES
        else if (item.category === 'consumable') {
            if (item.effectType === 'heal') {
                // Detectar dónde está la vida
                const currentHp = user.stats?.hp ?? user.hp ?? 0;
                const maxHp = user.stats?.maxHp ?? user.maxHp ?? 100;

                if (currentHp >= maxHp) return res.status(400).json({ message: 'Salud al máximo' });

                const newHp = Math.min(currentHp + item.effectValue, maxHp);

                if (user.stats) user.stats.hp = newHp;
                else user.hp = newHp;

                msg = `Recuperaste ${item.effectValue} HP ❤️`;
            } else if (item.effectType === 'xp') {
                user.currentXP += item.effectValue;
                msg = `Ganaste ${item.effectValue} XP ✨`;
            }
            user.inventory[inventoryIndex].quantity -= 1;
        }

        // COFRES
        else if (item.category === 'chest') {
            const roll = Math.random();
            let prizeCoins = 0;
            let prizeXP = 0;

            if (item.name.includes('Legendario')) {
                if (roll < 0.2) { prizeCoins = 1; msg = "Mala suerte... 1 moneda."; }
                else if (roll < 0.6) { prizeXP = 1000; msg = "+1000 XP!"; }
                else { prizeCoins = 5000; msg = "¡JACKPOT! 5000 Monedas"; }
            } else if (item.name.includes('Dorado')) {
                if (roll < 0.4) { prizeCoins = 50; msg = "+50 Monedas"; }
                else if (roll < 0.8) { prizeXP = 200; msg = "+200 XP"; }
                else { prizeCoins = 500; msg = "¡GRAN PREMIO! 500 Monedas"; }
            } else {
                if (roll < 0.5) { prizeCoins = 10; msg = "+10 Monedas"; }
                else if (roll < 0.9) { prizeXP = 50; msg = "+50 XP"; }
                else { prizeCoins = 100; msg = "¡Suerte! +100 Monedas"; }
            }

            if (prizeCoins > 0) {
                user.coins += prizeCoins;
                rewardData = { type: 'coins', value: prizeCoins };
            }
            if (prizeXP > 0) {
                user.currentXP += prizeXP;
                rewardData = { type: 'xp', value: prizeXP };
            }

            user.inventory[inventoryIndex].quantity -= 1;
        }

        // Limpieza inventario
        if (user.inventory[inventoryIndex].quantity <= 0) {
            user.inventory.splice(inventoryIndex, 1);
        }

        // Level Up Check
        if (user.currentXP >= user.nextLevelXP) {
            user.currentXP -= user.nextLevelXP;
            user.level += 1;
            user.nextLevelXP = Math.floor(user.nextLevelXP * 1.5);
            // Restaurar vida al subir nivel
            if (user.stats) user.stats.hp = user.stats.maxHp;
            else if (user.hp !== undefined) user.hp = user.maxHp;
            msg += " ¡SUBISTE DE NIVEL!";
        }

        await user.save();
        const updatedUser = await User.findById(user._id).populate('inventory.item');
        res.json({ message: msg, user: updatedUser, reward: rewardData });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error usando objeto' });
    }
};

// 5. INTERCAMBIO (100 FICHAS = 1 MONEDA)
const exchangeCurrency = async (req, res) => {
    try {
        const { amountGameCoins } = req.body;

        if (!amountGameCoins || amountGameCoins < 100) {
            return res.status(400).json({ message: 'Mínimo 100 fichas' });
        }

        const user = await User.findById(req.user._id);

        // Detector de path para fichas
        let gameCoinsPath = 'gameCoins';
        let currentFichas = 0;

        if (user.gameCoins !== undefined) {
            currentFichas = user.gameCoins;
            gameCoinsPath = 'gameCoins';
        } else if (user.stats && user.stats.gameCoins !== undefined) {
            currentFichas = user.stats.gameCoins;
            gameCoinsPath = 'stats.gameCoins';
        }

        if (currentFichas < amountGameCoins) {
            return res.status(400).json({ message: 'No tienes suficientes fichas' });
        }

        const coinsToReceive = Math.floor(amountGameCoins / 100);

        // Usamos $inc para seguridad atómica
        const update = {
            $inc: {
                [gameCoinsPath]: -amountGameCoins,
                coins: coinsToReceive
            }
        };

        const updatedUser = await User.findByIdAndUpdate(req.user._id, update, { new: true });

        res.json({ message: `Canje exitoso: +${coinsToReceive} Monedas`, user: updatedUser });

    } catch (error) {
        console.error("Error exchange:", error);
        res.status(500).json({ message: 'Error en intercambio' });
    }
};

// 6. SEED
const seedShop = async (req, res) => {
    try {
        await ShopItem.deleteMany({ category: { $ne: 'reward' } });

        const items = [
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
            { name: 'Serpiente de Dragón', price: 1, category: 'pet', icon: '/pets/snake.png', description: 'Sigilosa y letal.', effectType: 'cosmetic' },
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

        await ShopItem.insertMany(items);
        res.json({ message: '🧹 Tienda reiniciada.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en seed' });
    }
};

module.exports = { getShopItems, createCustomReward, buyItem, useItem, seedShop, exchangeCurrency };