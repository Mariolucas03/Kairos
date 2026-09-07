const User = require('../models/User');
const DailyLog = require('../models/DailyLog');
const { getMadridDateString } = require('../utils/dateHelpers');

const calculateNextLevelXP = (level) => level * 100;

/**
 * EL PREMIO POR SUBIR DE NIVEL.
 *
 * ⚠️ ANTES NO HABIA NINGUNO.
 *
 * Subir de nivel te restauraba la vida y nada mas. Ni siquiera se te decia:
 * `addRewards` devolvia `leveledUp` y en el movil no lo miraba nadie, asi que
 * el momento mas gordo del juego pasaba en absoluto silencio.
 *
 * Crece con el nivel porque cada uno cuesta mas que el anterior (el XP que hace
 * falta es nivel x 100, o sea que el 20 cuesta el doble que el 10), pero se
 * TOPA: sin tope, un nivel 200 pagaria mas que un dia entero de misiones y las
 * fichas del casino dejarian de valer nada. La barrera esta puesta donde un
 * premio sigue siendo un premio y no una impresora.
 */
const TOPE_MONEDAS = 300;
const TOPE_FICHAS = 600;

const premioPorNivel = (nivel) => {
    const n = Math.max(1, Math.floor(Number(nivel)) || 1);
    return {
        monedas: Math.min(40 + n * 5, TOPE_MONEDAS),
        fichas: Math.min(80 + n * 10, TOPE_FICHAS)
    };
};

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

    // Aqui habia OTRO `$inc: { totalPower }`, el quinto y ultimo. Mismo motivo
    // que el de `addRewards`: el poder del clan se cuenta, no se acumula.

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

    // ⚠️ AQUI HABIA UN `$inc: { totalPower }` SOBRE EL CLAN. YA NO HACE FALTA.
    //
    // Era el cuarto sitio que movia ese contador a mano, y el que se escapo al
    // limpiar los otros tres porque vive en este servicio y no en
    // clanController. El poder de un clan ya no se acumula: se cuenta sumando el
    // nivel de quien esta dentro, cada vez que se lee (ver `poderDe` y
    // `repasarClan`). Sumar aqui no rompia nada —la derivacion lo corregia en la
    // siguiente lectura— pero deja escrito que es un contador, que es justo la
    // idea que llevo al poder a ponerse en negativo.

    // El premio, una sola vez aunque se hayan subido varios niveles de golpe:
    // se paga por LLEGAR al nivel nuevo, no por cada escalon.
    let premio = null;
    if (levelsGained > 0) {
        premio = premioPorNivel(user.level);
        user.coins += premio.monedas;
        user.gameCoins += premio.fichas;
        user.ultimaSubidaDeNivel = {
            nivel: user.level,
            monedas: premio.monedas,
            fichas: premio.fichas,
            fecha: new Date()
        };
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
        levelsGained,
        premioDeNivel: premio,
        rewards: { xp: xpReward, coins: coinReward, gameCoins: gameCoinReward }
    };
};

module.exports = {
    premioPorNivel, addRewards, ensureLevelConsistency };