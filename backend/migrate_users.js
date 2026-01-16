require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const migrateUsers = async () => {
    try {
        console.log("⏳ Conectando a MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Conectado.");

        const users = await User.find({});
        console.log(`🔍 Encontrados ${users.length} usuarios para revisar.`);

        let updatedCount = 0;

        for (const user of users) {
            // Accedemos a _doc para evitar los virtuals y ver la data real en BD
            const rawStats = user._doc.stats || {};
            let needsSave = false;

            // Si existen datos en stats y los de la raíz son los por defecto, migramos
            if (rawStats.level && (!user.level || user.level === 1)) {
                user.level = rawStats.level;
                needsSave = true;
            }
            if (rawStats.currentXP && (!user.currentXP || user.currentXP === 0)) {
                user.currentXP = rawStats.currentXP;
                needsSave = true;
            }
            if (rawStats.coins && (!user.coins || user.coins === 50)) {
                user.coins = rawStats.coins;
                needsSave = true;
            }
            if (rawStats.gameCoins && (!user.gameCoins || user.gameCoins === 500)) {
                user.gameCoins = rawStats.gameCoins;
                needsSave = true;
            }
            if (rawStats.hp && (!user.hp || user.hp === 100)) {
                user.hp = rawStats.hp;
                user.lives = rawStats.hp; // Sincronizar lives
                needsSave = true;
            }

            // Sincronizar estructura de recompensas diarias si es antigua
            if (!user.dailyRewards || Array.isArray(user.dailyRewards)) {
                // Si era un array antiguo o null, lo convertimos al objeto nuevo
                user.dailyRewards = { claimedDays: [], lastClaimDate: null };
                needsSave = true;
            }

            if (needsSave) {
                // Mongoose detectará los cambios en la raíz.
                // Opcional: Podríamos hacer user.stats = undefined para borrar lo viejo,
                // pero por seguridad lo dejamos un tiempo.
                await user.save();
                updatedCount++;
                console.log(`✅ Usuario migrado: ${user.username}`);
            }
        }

        console.log(`✨ Migración completada. ${updatedCount} usuarios actualizados.`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Error en migración:", error);
        process.exit(1);
    }
};

migrateUsers();