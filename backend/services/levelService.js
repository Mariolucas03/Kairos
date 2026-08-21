const User = require('../models/User');
const Clan = require('../models/Clan'); // <--- IMPORTANTE: Importar modelo Clan
const DailyLog = require('../models/DailyLog');
const { getMadridDateString } = require('../utils/dateHelpers');

const calculateNextLevelXP = (level) => level * 100;

// Auto-reparación (Asegura consistencia al cargar perfil)
const ensureLevelConsistency = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return null;

    let changed = false;
    if (!user.nextLevelXP || user.nextLevelXP === 0) {
        user.nextLevelXP = calculateNextLevelXP(user.level || 1);
        changed = true;
    }

    // Lógica de subir nivel (en caso de desincronización)
    let levelsGained = 0;
    while (user.currentXP >= user.nextLevelXP) {
        console.log(`🔧 NIVEL UP (Fix): ${user.level} -> ${user.level + 1}`);
        user.currentXP -= user.nextLevelXP;
        user.level = (user.level || 1) + 1;
        user.nextLevelXP = calculateNextLevelXP(user.level);
        user.hp = user.maxHp; // Restaurar vida completa
        user.lives = user.hp;   // El resto del código escribe los dos; dejar uno
                                // sin tocar deja un numero viejo esperando a que
                                // alguien lo lea y muestre una vida que no es.

        levelsGained++;
        changed = true;
    }

    // Si hubo subida de nivel en la reparación, actualizamos el clan también
    if (levelsGained > 0 && user.clan) {
        const powerIncrease = levelsGained * 100;
        await Clan.findByIdAndUpdate(user.clan, {
            $inc: { totalPower: powerIncrease }
        });
        console.log(`🏰 Clan actualizado (Fix): +${powerIncrease} poder`);
    }

    if (changed) await user.save();
    return user;
};

// Función principal para dar recompensas
const addRewards = async (userId, xpReward, coinReward, gameCoinReward = 0) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("Usuario no encontrado");

    // Sumar recursos directamente a la raíz
    user.currentXP += parseInt(xpReward) || 0;
    user.coins += parseInt(coinReward) || 0;
    user.gameCoins += parseInt(gameCoinReward) || 0;

    let leveledUp = false;
    if (!user.nextLevelXP) user.nextLevelXP = calculateNextLevelXP(user.level);

    // --- LÓGICA DE LEVEL UP ---
    let levelsGained = 0;

    while (user.currentXP >= user.nextLevelXP) {
        console.log(`¡LEVEL UP! ${user.level} -> ${user.level + 1}`);
        user.currentXP -= user.nextLevelXP;
        user.level += 1;
        user.nextLevelXP = calculateNextLevelXP(user.level);

        // Restaurar vida al subir de nivel
        user.hp = user.maxHp;
        user.lives = user.hp; // Estaba comentado con un "con hp basta", pero el
                              // castigo nocturno, la diaria y el revivir SÍ lo
                              // escriben: quedaba desincronizado solo aquí.

        levelsGained++; // Contamos cuántos niveles ha subido
        leveledUp = true;
    }

    // --- 🔥 ACTUALIZAR PODER DEL CLAN 🔥 ---
    // Si el usuario subió de nivel y pertenece a un clan, sumamos poder
    if (levelsGained > 0 && user.clan) {
        const powerIncrease = levelsGained * 100; // 1 Nivel = 100 Poder
        await Clan.findByIdAndUpdate(user.clan, {
            $inc: { totalPower: powerIncrease }
        });
        console.log(`🏰 Clan actualizado: +${powerIncrease} de poder por subida de nivel de ${user.username}`);
    }

    const savedUser = await user.save();

    // --- 📒 REGISTRO DIARIO DE LO GANADO ---
    // ⚠️ `gains.xp` y `gains.coins` se creaban a 0 y nadie los volvía a tocar.
    // De ahí colgaban dos cosas que por tanto siempre daban cero: el evento
    // semanal de clan "Era de Sabiduría" (imposible de completar, así que sus
    // recompensas eran inalcanzables) y el ranking mensual, que agrega
    // justamente este campo. Se apunta aquí, que es por donde pasan todas las
    // recompensas del juego.
    const xpGanado = parseInt(xpReward) || 0;
    const monedasGanadas = parseInt(coinReward) || 0;

    if (xpGanado || monedasGanadas) {
        try {
            await DailyLog.updateOne(
                { user: userId, date: getMadridDateString() },
                { $inc: { 'gains.xp': xpGanado, 'gains.coins': monedasGanadas } },
                { upsert: true }
            );
        } catch (e) {
            // Que no se pierda la recompensa por no poder apuntarla en el diario
            console.error('No se pudo registrar gains del día:', e.message);
        }
    }

    return {
        user: savedUser,
        leveledUp,
        rewards: { xp: xpReward, coins: coinReward, gameCoins: gameCoinReward }
    };
};

module.exports = { addRewards, ensureLevelConsistency };