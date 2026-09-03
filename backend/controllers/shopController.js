const ShopItem = require('../models/ShopItem');
const User = require('../models/User');
const { addRewards } = require('../services/levelService');

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
    { name: 'Marco de Rayos', price: 500, category: 'frame', icon: '🌩️', sprite: '/frames/rayos.png', rarity: 'raro', description: 'Energía pura.' },
    { name: 'Marco de Oro', price: 800, category: 'frame', icon: '🟨', sprite: '/frames/marco_oro.png', rarity: 'epico', description: 'Brillante.' },
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

        // ⚠️ IMPRESORA DE MONEDAS. Solo se comprobaba que fuera un numero, y
        // buyItem hace $inc: { coins: -item.price } con el filtro coins >= price.
        // Con precio -5000 el filtro pasa siempre (todo el mundo tiene mas de
        // -5000) y el $inc SUMA 5000. Una recompensa propia a precio negativo,
        // comprada en bucle, daba monedas infinitas.
        if (price < 0) return res.status(400).json({ message: 'El precio no puede ser negativo' });
        if (price > 1000000) return res.status(400).json({ message: 'Precio demasiado alto' });

        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ message: 'Ponle un nombre' });

        const newItem = await ShopItem.create({
            user: req.user._id,
            name: name.slice(0, 60),
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

        // Segunda barrera: si por lo que sea existe ya un item con precio
        // negativo guardado de antes, comprarlo REGALARIA monedas.
        if (!(item.price >= 0)) return res.status(400).json({ message: 'Objeto con precio invalido' });

        const isReward = item.category === 'reward';
        const currencyField = isReward ? 'coins' : 'gameCoins';
        const currencyName = isReward ? 'Monedas' : 'Fichas';

        // B. Verificamos si ya lo tiene (para categorías únicas)
        //
        // Esta comprobación es solo para responder rápido y con un mensaje
        // claro. NO es la que protege: entre leer aquí y escribir abajo hay
        // milisegundos, y en esa rendija caben dos peticiones. La de verdad va
        // dentro del filtro de la escritura, en el punto C.
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
            //
            // ⚠️ En los objetos ÚNICOS, el "no lo tengo ya" entra en el MISMO
            // filtro que el saldo. Comprobarlo arriba y empujar aquí dejaba una
            // rendija real: dos toques seguidos con la conexión lenta —o el
            // doble toque de un móvil que no responde— pasaban los dos por la
            // comprobación antes de que ninguno escribiera, y acababas pagando
            // el Fénix DOS VECES (8.000 fichas) y con dos copias del mismo
            // avatar en el inventario.
            const filtro = { _id: userId, [currencyField]: { $gte: item.price } };
            if (isUniqueCategory) filtro['inventory.item'] = { $ne: itemId };

            updatedUser = await User.findOneAndUpdate(
                filtro,
                {
                    $inc: { [currencyField]: -item.price },
                    $push: { inventory: { item: itemId, quantity: 1 } }
                },
                { new: true }
            ).populate('inventory.item');
        }

        // Si updatedUser es null, la escritura no encontró a nadie. Puede ser por
        // saldo o porque el objeto ya estaba comprado (la carrera de arriba), y
        // decir "no tienes suficientes fichas" cuando lo que pasa es que ya lo
        // tienes manda a buscar un problema de dinero que no existe.
        if (!updatedUser) {
            if (isUniqueCategory) {
                const ahora = await User.findById(userId).select('inventory').lean();
                const loTiene = (ahora?.inventory || []).some(e => e?.item && e.item.toString() === itemId);
                if (loTiene) return res.status(400).json({ message: '¡Ya tienes este objeto!' });
            }
            return res.status(400).json({ message: `No tienes suficientes ${currencyName}.` });
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
/**
 * Lo que devuelve un cofre, a partir de lo que cuesta.
 *
 * ⚠️ Los cuatro cofres daban EXACTAMENTE lo mismo: 100 monedas una de cada
 * cinco veces y 10 el resto, costaran 50 fichas o 1.000. Es decir, el Cofre
 * Legendario costaba VEINTE VECES más que el Roñoso y devolvía lo mismo, con
 * "alto riesgo, alta recompensa" escrito debajo. Comprarlo era tirar el dinero,
 * y no había forma de darse cuenta salvo abriendo unos cuantos y sospechando.
 *
 * Ahora el premio sale del precio, así que:
 *
 *  - La proporción es la misma para los cuatro (56% de media), que es
 *    exactamente la que ya tenía el Roñoso: 50 → 100 ó 10. El cofre barato no
 *    cambia ni un número; los caros dejan de ser una estafa.
 *  - Lo que cambia entre cofres es el TAMAÑO del salto, que es lo que hace que
 *    arriesgar signifique algo: el Legendario da 2.000 ó 200.
 *
 * Se exporta para poder comprobarlo desde las pruebas: un cofre que devuelve de
 * menos no da ningún error, igual que el rasca que devolvía de más.
 */
const premioDeCofre = (precio) => {
    const seguro = Number(precio);
    if (!Number.isFinite(seguro) || seguro <= 0) return 0;
    // Una de cada cinco veces sale el premio gordo
    return Math.round(seguro * (Math.random() > 0.8 ? 2 : 0.2));
};

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

        // Gastar una poción de vida teniéndola llena es tirar el dinero, y el
        // objeto se consumía igual sin decir nada. Se avisa ANTES de gastarla.
        if (item.category === 'consumable' && item.effectType === 'heal') {
            const maxHp = user.maxHp || 100;
            if ((user.hp ?? 0) >= maxHp) {
                return res.status(400).json({ message: 'Ya tienes la vida al máximo' });
            }
        }

        // CONSUMIBLES Y COFRES (Se gastan): descuento atómico (🔥 BLINDADO, igual que buyItem)
        // para que dos peticiones simultáneas con el mismo objeto no dupliquen el premio del
        // cofre ni pisen el descuento de cantidad (lost update).
        if (item.category === 'consumable' || item.category === 'chest') {
            let prize = 0;
            if (item.category === 'chest') {
                prize = premioDeCofre(item.price);
                rewardData = { type: 'coins', value: prize };
                msg = "Cofre abierto";
            } else {
                msg = "Poción usada";
            }

            const inc = { 'inventory.$[elem].quantity': -1 };
            if (prize) inc.coins = prize;

            const updatedForItem = await User.findOneAndUpdate(
                { _id: user._id, inventory: { $elemMatch: { item: itemId, quantity: { $gte: 1 } } } },
                { $inc: inc },
                { new: true, arrayFilters: [{ 'elem.item': itemId, 'elem.quantity': { $gte: 1 } }] }
            );

            if (!updatedForItem) {
                return res.status(400).json({ message: 'No tienes este objeto' });
            }

            // Limpieza: quita del inventario las entradas que se quedaron a 0
            await User.updateOne(
                { _id: user._id },
                { $pull: { inventory: { item: itemId, quantity: { $lte: 0 } } } }
            );

            // ⚠️ AQUÍ NO PASABA NADA. El objeto se descontaba del inventario y
            // se devolvía "Poción usada", pero effectType/effectValue no se leían
            // en ningún sitio del backend: las tres pociones de vida y las tres
            // de XP se gastaban SIN efecto. Comprado, consumido y cero.
            if (item.category === 'consumable' && item.effectValue > 0) {
                if (item.effectType === 'heal') {
                    const maxHp = updatedForItem.maxHp || 100;
                    const hpPrevia = updatedForItem.hp ?? 0;
                    const hpNueva = Math.min(maxHp, hpPrevia + item.effectValue);

                    // lives va en paralelo a hp en el resto del código; si se deja
                    // sin tocar queda un número viejo esperando a que alguien lo lea.
                    await User.updateOne({ _id: user._id }, { $set: { hp: hpNueva, lives: hpNueva } });

                    const curado = hpNueva - hpPrevia;
                    msg = 'Recuperas ' + curado + ' de vida';
                    rewardData = { type: 'hp', value: curado };
                } else if (item.effectType === 'xp') {
                    // Por addRewards y no con un $inc: el XP puede hacer subir de
                    // nivel, y eso arrastra vida al máximo y poder del clan.
                    await addRewards(user._id, item.effectValue, 0, 0);
                    msg = '+' + item.effectValue + ' XP';
                    rewardData = { type: 'xp', value: item.effectValue };
                }
            }

            const updatedUser = await User.findById(user._id).populate('inventory.item');
            return res.json({ message: msg, user: limpiarInventario(updatedUser), reward: rewardData });
        }

        // EQUIPAR (sin problema de concurrencia real: no se gasta nada, solo se asigna)
        if (item.category === 'avatar') { user.avatar = item.icon; msg = `Avatar equipado`; }
        // ⚠️ El DIBUJO si lo tiene, y el emoji si no.
        //
        // Antes guardaba siempre `icon`, que es el emoji del escaparate, y las
        // pantallas lo metian en un <img src>. Un emoji no es una URL: el
        // navegador buscaba un fichero llamado "🌩️", no existia, y alrededor de
        // la cara salia el icono de imagen rota. Comprar un marco te dejaba el
        // perfil peor que antes.
        //
        // Solo dos de los ocho marcos tienen dibujo. Los otros seis se quedan en
        // emoji a proposito, y MarcoPerfil los pinta como texto: es eso o dejar
        // seis productos de la tienda rotos hasta que existan seis imagenes.
        else if (item.category === 'frame') { user.frame = item.sprite || item.icon; msg = `Marco equipado`; }
        else if (item.category === 'pet') { user.pet = item.icon; msg = `Mascota equipada`; }
        else if (item.category === 'title') { user.title = item.name; msg = `Título equipado`; }
        else if (item.category === 'theme') { user.theme = item.effectType || 'dark'; msg = `Tema aplicado`; }

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
        // El número tiene que ser un número. Sin esto, lo que llegue del móvil
        // entra tal cual en la resta: es la misma vía por la que el casino
        // acabó guardando `gameCoins: NaN`, que no da ningún error y deja la
        // cuenta con un saldo que ya no se puede ni gastar ni arreglar.
        const pedido = Math.floor(Number(req.body?.amountGameCoins));
        if (!Number.isFinite(pedido) || pedido < 100) {
            return res.status(400).json({ message: 'Mínimo 100 fichas' });
        }

        const coinsToReceive = Math.floor(pedido / 100);

        // ⚠️ Se cobra el múltiplo, no lo que se pidió.
        //
        // Antes se restaban las fichas PEDIDAS y se entregaban las monedas
        // redondeadas hacia abajo: cambiar 199 fichas daba 1 moneda y la app se
        // quedaba con las otras 99 sin decir nada. Como el mínimo son 100, el
        // caso salta en cuanto alguien escribe "todas mis fichas" y tiene un
        // número que no acaba en dos ceros.
        const aCobrar = coinsToReceive * 100;

        // Actualización Atómica: Busca al usuario SOLO si tiene fichas >= lo que se cobra
        const updatedUser = await User.findOneAndUpdate(
            {
                _id: req.user._id,
                gameCoins: { $gte: aCobrar }
            },
            {
                $inc: { gameCoins: -aCobrar, coins: coinsToReceive }
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({ message: 'Fichas insuficientes o hubo un problema de conexión' });
        }

        res.json({
            message: `Canje exitoso: +${coinsToReceive} Monedas por ${aCobrar} fichas`,
            user: updatedUser
        });
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

module.exports = {
    getShopItems, createCustomReward, buyItem, useItem, seedShop, exchangeCurrency,
    // Se exporta SOLO para las pruebas: los cuatro cofres devolvian lo mismo
    // costaran lo que costaran, y eso no da ningun error.
    premioDeCofre
};