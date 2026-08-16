const ShopItem = require('../models/ShopItem');
const User = require('../models/User');

/**
 * CATÁLOGO DE LA TIENDA
 *
 * ⚠️ Los iconos son EMOJI, no rutas de imagen. El catálogo antiguo apuntaba a
 * '/avatars/zeus.png', '/chests/gold_chest.png', etc., pero esas carpetas no
 * existen en `frontend/public/`: todos esos items se veían rotos. El frontend
 * ya distingue emoji de ruta (Shop.jsx), así que con emoji se ve todo bien.
 * Si algún día añades los PNG reales, basta con cambiar el campo `icon`.
 */
const SEED_ITEMS = [
    // ================= AVATARES =================
    { name: 'Novato', price: 0, category: 'avatar', icon: '🙂', rarity: 'comun', description: 'Todo el mundo empieza por aquí.' },
    { name: 'Boxeador', price: 150, category: 'avatar', icon: '🥊', rarity: 'comun', description: 'Puños de acero.' },
    { name: 'Corredor', price: 150, category: 'avatar', icon: '🏃', rarity: 'comun', description: 'Kilómetros en las piernas.' },
    { name: 'Halterófilo', price: 250, category: 'avatar', icon: '🏋️', rarity: 'raro', description: 'La barra es tu religión.' },
    { name: 'Ninja', price: 400, category: 'avatar', icon: '🥷', rarity: 'raro', description: 'Entrena de madrugada.' },
    { name: 'Vikingo', price: 600, category: 'avatar', icon: '🪓', rarity: 'raro', description: 'Fuerza bruta del norte.' },
    { name: 'Zeus', price: 900, category: 'avatar', icon: '⚡', rarity: 'epico', description: 'El dios del rayo.' },
    { name: 'Caballero Dorado', price: 1200, category: 'avatar', icon: '🛡️', rarity: 'epico', description: 'Armadura legendaria.' },
    { name: 'Samurái', price: 1400, category: 'avatar', icon: '⚔️', rarity: 'epico', description: 'Disciplina absoluta.' },
    { name: 'Diosa', price: 2100, category: 'avatar', icon: '👑', rarity: 'legendario', description: 'La diosa de la sabiduría.' },
    { name: 'Titán', price: 3000, category: 'avatar', icon: '🗿', rarity: 'legendario', description: 'Inamovible.' },
    { name: 'Fénix', price: 4000, category: 'avatar', icon: '🔥', rarity: 'legendario', description: 'Renace de sus cenizas.' },

    // ================= MARCOS =================
    { name: 'Marco de Hierro', price: 80, category: 'frame', icon: '⬛', rarity: 'comun', description: 'Sencillo y sólido.' },
    { name: 'Marco de Bronce', price: 150, category: 'frame', icon: '🟫', rarity: 'comun', description: 'El primer escalón.' },
    { name: 'Marco de Plata', price: 350, category: 'frame', icon: '⬜', rarity: 'raro', description: 'Brillo discreto.' },
    { name: 'Marco de Rayos', price: 500, category: 'frame', icon: '🌩️', rarity: 'raro', description: 'Energía pura.' },
    { name: 'Marco de Oro', price: 800, category: 'frame', icon: '🟨', rarity: 'epico', description: 'Brillante.' },
    { name: 'Marco de Hielo', price: 900, category: 'frame', icon: '🧊', rarity: 'epico', description: 'Sangre fría.' },
    { name: 'Marco Infernal', price: 1600, category: 'frame', icon: '😈', rarity: 'legendario', description: 'Forjado en llamas.' },
    { name: 'Marco Cósmico', price: 2500, category: 'frame', icon: '🌌', rarity: 'legendario', description: 'Más allá del gimnasio.' },

    // ================= MASCOTAS =================
    { name: 'Gatito Gym', price: 120, category: 'pet', icon: '🐱', rarity: 'comun', description: 'Te mira mientras entrenas.' },
    { name: 'Perro Fiel', price: 120, category: 'pet', icon: '🐶', rarity: 'comun', description: 'Nunca falta a una sesión.' },
    { name: 'Búho Nocturno', price: 300, category: 'pet', icon: '🦉', rarity: 'raro', description: 'Para los turnos de noche.' },
    { name: 'Lobo', price: 450, category: 'pet', icon: '🐺', rarity: 'raro', description: 'Instinto de manada.' },
    { name: 'Serpiente', price: 500, category: 'pet', icon: '🐍', rarity: 'raro', description: 'Sigilosa y letal.' },
    { name: 'Tigre', price: 850, category: 'pet', icon: '🐯', rarity: 'epico', description: 'Explosividad pura.' },
    { name: 'Águila', price: 1000, category: 'pet', icon: '🦅', rarity: 'epico', description: 'Visión de campeón.' },
    { name: 'Dragón Infernal', price: 2200, category: 'pet', icon: '🐉', rarity: 'legendario', description: 'Bestia legendaria.' },

    // ================= TÍTULOS =================
    { name: 'Principiante', price: 0, category: 'title', icon: '🌱', rarity: 'comun', description: 'El principio de todo.' },
    { name: 'Constante', price: 200, category: 'title', icon: '📆', rarity: 'comun', description: 'No fallas ni un día.' },
    { name: 'Sin Excusas', price: 350, category: 'title', icon: '🚫', rarity: 'raro', description: 'Ni lluvia ni pereza.' },
    { name: 'Máquina', price: 500, category: 'title', icon: '🤖', rarity: 'raro', description: 'Funcionas sin descanso.' },
    { name: 'El Veterano', price: 800, category: 'title', icon: '📜', rarity: 'epico', description: 'Para quienes han visto mucho.' },
    { name: 'Bestia Parda', price: 1200, category: 'title', icon: '🐻', rarity: 'epico', description: 'Respeto en la sala.' },
    { name: 'La Leyenda', price: 2000, category: 'title', icon: '👾', rarity: 'legendario', description: 'Legendario.' },
    { name: 'Inmortal', price: 3500, category: 'title', icon: '♾️', rarity: 'legendario', description: 'Ya no eres humano.' },

    // ================= POCIONES =================
    { name: 'Chispa de XP', price: 25, category: 'consumable', icon: '✨', rarity: 'comun', effectType: 'xp', effectValue: 50, description: '+50 XP al instante.' },
    { name: 'Frasco de Sabiduría', price: 40, category: 'consumable', icon: '🧪', rarity: 'comun', effectType: 'xp', effectValue: 100, description: '+100 XP al instante.' },
    { name: 'Elixir de Maestría', price: 150, category: 'consumable', icon: '⚗️', rarity: 'raro', effectType: 'xp', effectValue: 500, description: '+500 XP al instante.' },
    { name: 'Vendaje', price: 60, category: 'consumable', icon: '🩹', rarity: 'comun', effectType: 'heal', effectValue: 10, description: 'Recupera 10 de vida.' },
    { name: 'Poción Vital', price: 100, category: 'consumable', icon: '❤️', rarity: 'raro', effectType: 'heal', effectValue: 25, description: 'Recupera 25 de vida.' },
    { name: 'Néctar de los Dioses', price: 400, category: 'consumable', icon: '🏺', rarity: 'epico', effectType: 'heal', effectValue: 100, description: 'Restaura toda tu vida.' },

    // ================= COFRES =================
    { name: 'Cofre Roñoso', price: 50, category: 'chest', icon: '📦', rarity: 'comun', description: 'Riesgo bajo, premio bajo.' },
    { name: 'Cofre de Plata', price: 120, category: 'chest', icon: '🎁', rarity: 'raro', description: 'Algo mejor que el anterior.' },
    { name: 'Cofre Dorado', price: 250, category: 'chest', icon: '🧰', rarity: 'epico', description: 'Equilibrado.' },
    { name: 'Cofre Legendario', price: 1000, category: 'chest', icon: '💎', rarity: 'legendario', description: 'Alto riesgo, alta recompensa.' },

    // ================= TEMAS =================
    { name: 'Modo Oscuro', price: 0, category: 'theme', icon: '🌙', rarity: 'comun', description: 'El clásico de Kairos.', effectType: 'dark' },
    { name: 'Modo Claro', price: 100, category: 'theme', icon: '☀️', rarity: 'comun', description: 'Para los valientes.', effectType: 'light' },
    { name: 'Neón', price: 600, category: 'theme', icon: '🟪', rarity: 'raro', description: 'Estética arcade.', effectType: 'neon' },
    { name: 'Sangre', price: 900, category: 'theme', icon: '🟥', rarity: 'epico', description: 'Rojo intenso.', effectType: 'blood' },
    { name: 'Oro Puro', price: 1800, category: 'theme', icon: '🟡', rarity: 'legendario', description: 'Lujo absoluto.', effectType: 'gold' },
];

/**
 * Sincroniza el catálogo del sistema con SEED_ITEMS.
 *
 * Antes solo sembraba si la tienda estaba COMPLETAMENTE vacía, así que al
 * ampliar el catálogo los items nuevos no aparecían nunca y los antiguos se
 * quedaban con sus iconos rotos. Ahora hace un upsert por nombre: añade los que
 * falten y actualiza icono/precio/rareza de los existentes, sin tocar las
 * recompensas personales del usuario (category 'reward').
 */
const syncSystemCatalog = async () => {
    const systemItemsCount = await ShopItem.countDocuments({ category: { $ne: 'reward' } });
    if (systemItemsCount === SEED_ITEMS.length) return; // Ya está al día

    console.log(`🏪 Sincronizando catálogo (${systemItemsCount} → ${SEED_ITEMS.length} items)...`);

    await ShopItem.bulkWrite(SEED_ITEMS.map(item => ({
        updateOne: {
            filter: { name: item.name, category: item.category, user: null },
            update: { $set: item },
            upsert: true
        }
    })));

    // Retiramos items de sistema que ya no estén en el catálogo.
    // ⚠️ Y LOS QUITAMOS TAMBIÉN DE LOS INVENTARIOS: si no, el usuario se queda
    // con una entrada apuntando a un item borrado. Al popular llega como null y
    // la tienda del móvil se quedaba en NEGRO nada más comprar algo.
    const obsoletos = await ShopItem.find({
        category: { $ne: 'reward' },
        name: { $nin: SEED_ITEMS.map(i => i.name) }
    }).select('_id').lean();

    if (obsoletos.length > 0) {
        const ids = obsoletos.map(i => i._id);
        await ShopItem.deleteMany({ _id: { $in: ids } });
        await User.updateMany({}, { $pull: { inventory: { item: { $in: ids } } } });
        console.log(`🧹 ${ids.length} items retirados del catálogo y de los inventarios.`);
    }
};

// Devuelve el usuario sin entradas de inventario rotas (item borrado → null).
// El frontend confía en que cada slot tenga su item.
const limpiarInventario = (userDoc) => {
    const obj = userDoc.toObject ? userDoc.toObject() : userDoc;
    obj.inventory = (obj.inventory || []).filter(slot => slot && slot.item);
    delete obj.password;
    return obj;
};

// 1. OBTENER TIENDA
const getShopItems = async (req, res) => {
    try {
        await syncSystemCatalog();

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
        const alreadyOwns = userCheck.inventory.some(entry => entry?.item && entry.item.toString() === itemId);

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
            user: limpiarInventario(updatedUser)
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

        const inventoryIndex = user.inventory.findIndex(i => {
            if (!i?.item) return false; // entrada rota: item retirado del catálogo
            const id = i.item._id ? i.item._id.toString() : i.item.toString();
            return id === itemId;
        });

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
        res.json({ message: msg, user: limpiarInventario(updatedUser), reward: rewardData });

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