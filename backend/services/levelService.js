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

/**
 * El listón del siguiente nivel, puesto si faltaba (cuentas viejas).
 */
const asegurarListon = async (userId, user) => {
    if (user.nextLevelXP) return user;
    const puesto = await User.findByIdAndUpdate(
        userId,
        { $set: { nextLevelXP: calculateNextLevelXP(user.level || 1) } },
        { new: true }
    );
    return puesto || user;
};

/**
 * SUBIR TODOS LOS NIVELES QUE TOQUEN, DE UNO EN UNO.
 *
 * ⚠️ EL NIVEL ACTUAL VA DENTRO DEL FILTRO, Y ESO ES TODO EL TRUCO.
 *
 * Si otro cobro simultáneo ya subió ese escalón, esta escritura no encuentra
 * nada que cambiar: se relee y se vuelve a mirar, en vez de subirlo dos veces.
 * Leer el usuario, calcular en memoria y guardar —que es lo que hacían las dos
 * funciones de aquí abajo, cada una por su cuenta— escribe el total calculado
 * encima de lo que haya puesto otro mientras tanto.
 *
 * El tope de vueltas es una red de seguridad: sin él, un `nextLevelXP` a cero
 * sería un bucle infinito con el servidor dentro.
 *
 * @returns {{ user, levelsGained }}
 */
const TOPE_DE_VUELTAS = 100;

const subirNivelesPendientes = async (userId, usuarioInicial) => {
    let user = usuarioInicial;
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
            // Se nos adelantaron: el nivel lo ha ganado el otro, no este.
            const refrescado = await User.findById(userId);
            if (!refrescado) throw new Error("Usuario no encontrado");
            user = refrescado;
            continue;
        }

        console.log(`¡LEVEL UP! ${user.level} -> ${subido.level}`);
        user = subido;
        levelsGained++;
    }

    return { user, levelsGained };
};

// Auto-reparación (Asegura consistencia al cargar perfil)
/**
 * ⚠️ ESTO CORRE EN CADA CARGA DE PERFIL.
 *
 * Antes leia el usuario, recalculaba los niveles en memoria y lo guardaba. Con
 * un premio llegando en ese mismo instante, el guardado escribia su `currentXP`
 * ya viejo encima del nuevo y el premio desaparecia. Como es de las cosas que
 * mas veces al dia se ejecutan, era de las que mas ocasiones tenia de chocar.
 *
 * Ahora pasa por el mismo camino atomico que `addRewards`. Aqui NO se paga el
 * premio por subir: esto es una reparacion de cuentas descuadradas, no un
 * cobro, y pagar por reparar seria una impresora de monedas con solo abrir el
 * perfil.
 */
const ensureLevelConsistency = async (userId) => {
    let user = await User.findById(userId);
    if (!user) return null;

    user = await asegurarListon(userId, user);
    const { user: puestoAlDia } = await subirNivelesPendientes(userId, user);

    // Aqui habia OTRO `$inc: { totalPower }`, el quinto y ultimo. Mismo motivo
    // que el de `addRewards`: el poder del clan se cuenta, no se acumula.

    return puestoAlDia;
};

/**
 * QUITAR XP, BAJANDO DE NIVEL SI HACE FALTA.
 *
 * Hace falta para poder borrar un entreno de verdad: si al borrarlo el XP se
 * quedara puesto, guardar, borrar y volver a guardar seria una impresora de
 * experiencia.
 *
 * Se baja de nivel igual que se sube, de uno en uno y con el nivel dentro del
 * filtro, para que no se pise con un premio que entre a la vez. En el nivel 1
 * ya no se baja mas: el XP se queda en cero.
 *
 * ⚠️ El premio en monedas y fichas que se cobro al subir NO se devuelve, a
 * proposito: devolverlo podria dejar el saldo en negativo si ya te lo has
 * gastado. Lo que se evita es volver a cobrarlo, con `nivelMaximo`.
 */
const quitarXp = async (userId, xp) => {
    const cantidad = Math.max(0, Math.floor(Number(xp) || 0));
    if (cantidad === 0) return { quitado: 0, user: await User.findById(userId) };

    let user = await User.findByIdAndUpdate(userId, { $inc: { currentXP: -cantidad } }, { new: true });
    if (!user) return { quitado: 0, user: null };

    for (let vuelta = 0; vuelta < TOPE_DE_VUELTAS; vuelta++) {
        if (user.currentXP >= 0 || (user.level || 1) <= 1) break;

        const nivelAnterior = (user.level || 1) - 1;
        const listonAnterior = calculateNextLevelXP(nivelAnterior);

        const bajado = await User.findOneAndUpdate(
            { _id: userId, level: user.level, currentXP: { $lt: 0 } },
            { $inc: { currentXP: listonAnterior, level: -1 }, $set: { nextLevelXP: listonAnterior } },
            { new: true }
        );

        if (!bajado) {
            const refrescado = await User.findById(userId);
            if (!refrescado) break;
            user = refrescado;
            continue;
        }
        user = bajado;
    }

    // Nivel 1 y aun en negativo: no hay mas abajo.
    if (user && user.currentXP < 0) {
        user = await User.findByIdAndUpdate(userId, { $set: { currentXP: 0 } }, { new: true });
    }

    return { quitado: cantidad, user };
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

    user = await asegurarListon(userId, user);

    // 2. LAS SUBIDAS DE NIVEL, por el camino compartido (ver
    //    `subirNivelesPendientes`): de una en una y con el nivel en el filtro.
    const subida = await subirNivelesPendientes(userId, user);
    user = subida.user;
    const levelsGained = subida.levelsGained;
    const leveledUp = levelsGained > 0;

    // 3. EL PREMIO POR SUBIR, una sola vez aunque se hayan subido varios
    //    niveles de golpe: se paga por LLEGAR al nivel nuevo, no por escalón.
    // ⚠️ EL PREMIO SE PAGA POR LLEGAR A UN NIVEL NUEVO, NO POR CRUZAR LA
    // MISMA LINEA DOS VECES.
    //
    // Desde que se pueden borrar entrenos, el XP puede bajar y el nivel con
    // el. Sin este techo, subir al 12, borrar el entreno que te subio y
    // volverlo a guardar pagaria el premio del 12 otra vez. `nivelMaximo` a 0
    // es una cuenta que no lo tiene anotado todavia: se anota sin pagar de
    // menos, usando el nivel de antes de esta subida.
    const techoPrevio = user.nivelMaximo || (user.level - levelsGained) || 1;
    let premio = null;
    if (leveledUp && user.level > techoPrevio) {
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

    // El techo sube siempre que se llegue mas alto, se haya pagado o no.
    if (user && (user.level || 1) > (user.nivelMaximo || 0)) {
        user = await User.findByIdAndUpdate(
            userId, { $set: { nivelMaximo: user.level } }, { new: true }
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
    premioPorNivel, addRewards, ensureLevelConsistency, quitarXp };