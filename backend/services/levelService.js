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

/**
 * DAR UNA RECOMPENSA.
 *
 * Por aqui pasa TODO lo que se cobra en la app: misiones, entrenos, duelos,
 * casino, cofres, el evento del clan y la recompensa diaria.
 *
 * ⚠️ POR QUE NO SE LEE, SE SUMA Y SE GUARDA.
 *
 * Eso es lo que hacia antes, y es seguro mientras solo llegue un cobro a la
 * vez. Si llegan dos, los dos leen el MISMO saldo de partida y el segundo en
 * guardar escribe su total encima del del primero. Mongoose no manda "sumale
 * cien": manda "el saldo es 100", con el numero que calculo en memoria.
 *
 * Medido con diez cobros simultaneos de diez monedas: quedaban 20 de 100. Se
 * perdian ocho de cada diez, sin error, sin aviso y sin nada en los registros.
 * Y no es un caso de laboratorio: la cola de envios sin conexion suelta de
 * golpe todo lo pendiente en cuanto vuelve la cobertura, y una mision
 * compartida paga a varios en el mismo instante.
 *
 * Ahora la suma la hace Mongo con $inc, que no puede pisar a nadie, y cada
 * subida de nivel va con el nivel dentro del filtro: si dos premios llegan
 * juntos, solo uno sube cada escalon y el otro se encuentra el trabajo hecho.
 */
const addRewards = async (userId, xpReward, coinReward, gameCoinReward = 0) => {
    const xp = parseInt(xpReward) || 0;
    const monedas = parseInt(coinReward) || 0;
    const fichas = parseInt(gameCoinReward) || 0;

    // 1. LA SUMA. Una sola escritura y la hace Mongo, no nosotros.
    let user = await User.findByIdAndUpdate(
        userId,
        { $inc: { currentXP: xp, coins: monedas, gameCoins: fichas } },
        { new: true }
    );
    if (!user) throw new Error("Usuario no encontrado");

    // Cuentas viejas sin el listón del siguiente nivel puesto.
    if (!user.nextLevelXP) {
        user = await User.findByIdAndUpdate(
            userId,
            { $set: { nextLevelXP: calculateNextLevelXP(user.level || 1) } },
            { new: true }
        ) || user;
    }

    // 2. LAS SUBIDAS DE NIVEL, UNA A UNA.
    //
    // El nivel actual va DENTRO del filtro. Si otro premio simultáneo ya subió
    // ese escalón, esta escritura no encuentra nada que cambiar: se relee y se
    // mira otra vez, en vez de subirlo dos veces. El tope de vueltas es una red
    // de seguridad: sin él, un nextLevelXP corrupto a 0 sería un bucle infinito
    // con el servidor dentro.
    const TOPE_DE_VUELTAS = 100;
    let levelsGained = 0;

    for (let vuelta = 0; vuelta < TOPE_DE_VUELTAS; vuelta++) {
        const liston = user.nextLevelXP || calculateNextLevelXP(user.level || 1);
        if (liston <= 0 || user.currentXP < liston) break;

        // Al subir se restaura la vida. `lives` se escribe junto a `hp` porque
        // el castigo nocturno, la diaria y el revivir escriben los dos: dejar
        // uno sin tocar deja un número viejo esperando a que alguien lo lea.
        const vidaLlena = user.maxHp || 100;

        const subido = await User.findOneAndUpdate(
            { _id: userId, level: user.level, currentXP: { $gte: liston } },
            {
                $inc: { currentXP: -liston, level: 1 },
                $set: {
                    nextLevelXP: calculateNextLevelXP((user.level || 1) + 1),
                    hp: vidaLlena,
                    lives: vidaLlena
                }
            },
            { new: true }
        );

        if (!subido) {
            // Se nos adelantaron: el nivel lo ha ganado el otro cobro, no este.
            const refrescado = await User.findById(userId);
            if (!refrescado) throw new Error("Usuario no encontrado");
            user = refrescado;
            continue;
        }

        console.log(`¡LEVEL UP! ${user.level} -> ${subido.level}`);
        user = subido;
        levelsGained++;
    }

    const leveledUp = levelsGained > 0;

    // 3. EL PREMIO POR SUBIR, una sola vez aunque se hayan subido varios
    //    niveles de golpe: se paga por LLEGAR al nivel nuevo, no por escalón.
    let premio = null;
    if (leveledUp) {
        premio = premioPorNivel(user.level);
        user = await User.findByIdAndUpdate(
            userId,
            {
                $inc: { coins: premio.monedas, gameCoins: premio.fichas },
                $set: {
                    ultimaSubidaDeNivel: {
                        nivel: user.level,
                        monedas: premio.monedas,
                        fichas: premio.fichas,
                        fecha: new Date()
                    }
                }
            },
            { new: true }
        ) || user;
    }

    const savedUser = user;

    // --- 📒 REGISTRO DIARIO DE LO GANADO ---
    // ⚠️ `gains.xp` y `gains.coins` se creaban a 0 y nadie los volvía a tocar.
    // De ahí colgaban dos cosas que por tanto siempre daban cero: el evento
    // semanal de clan "Era de Sabiduría" (imposible de completar, así que sus
    // recompensas eran inalcanzables) y el ranking mensual, que agrega
    // justamente este campo. Se apunta aquí, que es por donde pasan todas las
    // recompensas del juego.
    if (xp || monedas) {
        try {
            await DailyLog.updateOne(
                { user: userId, date: getMadridDateString() },
                { $inc: { 'gains.xp': xp, 'gains.coins': monedas } },
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