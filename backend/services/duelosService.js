const Challenge = require('../models/Challenge');
const WorkoutLog = require('../models/WorkoutLog');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { volumenDe } = require('../controllers/gymController');

/**
 * QUIÉN GANA EL DUELO, Y QUIÉN COBRA.
 *
 * ⚠️ ANTES NO GANABA NADIE. NUNCA.
 *
 * Se podía retar a un amigo y él podía aceptar, y ahí se terminaba todo: nada
 * ponía fecha de fin, nada comparaba a los dos y la apuesta se comprobaba pero
 * no se cobraba jamás. Los duelos se quedaban "activos" para siempre.
 *
 * Esto es la mitad que faltaba: el que los cierra.
 */

/** Lo que dura un duelo desde que se acepta. */
const DUELO_DIAS = 7;

/** La fecha de fin a partir de la de inicio. Una sola cuenta, en un solo sitio. */
const finDelDuelo = (inicio) => new Date(inicio.getTime() + DUELO_DIAS * 86400000);

/**
 * LOS KILOS QUE MOVIÓ ALGUIEN ENTRE DOS FECHAS.
 *
 * ⚠️ SE USA `volumenDe`, LA MISMA DE SIEMPRE.
 *
 * Sumar aquí peso por repeticiones a mano sería tener la misma cuenta escrita
 * dos veces, y el día que una cambie —ya pasó con los ejercicios de peso
 * corporal y con los de tiempo— el duelo diría un número y los rangos
 * musculares otro. Ese desacuerdo es el fallo que más veces ha aparecido en
 * este proyecto.
 *
 * Solo entrenos de gimnasio: los de deporte no llevan series.
 */
const volumenEntre = async (userId, desde, hasta) => {
    const logs = await WorkoutLog.find({
        user: userId,
        type: 'gym',
        date: { $gte: desde, $lt: hasta }
    }).select('exercises.sets').lean();

    return logs.reduce((total, log) => total + volumenDe(log.exercises || []), 0);
};

/** Suma fichas a alguien. Devuelve si se pudo. */
const abonar = async (userId, fichas) => {
    if (!userId || fichas <= 0) return false;
    const r = await User.updateOne({ _id: userId }, { $inc: { gameCoins: fichas } });
    return r.matchedCount === 1;
};

/**
 * PAGAR EL BOTE.
 *
 * ⚠️ SE RECLAMA EL PAGO ANTES DE PAGAR, Y ESO NO ES UN CAPRICHO.
 *
 * El mantenimiento nocturno se puede ejecutar dos veces —Render reinicia la
 * instancia a menudo y hay una puesta al día al arrancar—. Sin esta marca, un
 * duelo se pagaría cada vez que se pasa por aquí, y eso no es un fallo de
 * pantalla: es fabricar fichas de la nada.
 *
 * `pagado: false` va DENTRO del filtro, no en un `if` antes: entre leer y
 * escribir caben dos ejecuciones a la vez.
 */
const pagarDuelo = async (duelo) => {
    const reclamado = await Challenge.findOneAndUpdate(
        { _id: duelo._id, pagado: false },
        { $set: { pagado: true } }
    );
    if (!reclamado) return false;   // ya lo pagó otra pasada

    const bote = duelo.betAmount * 2;

    if (duelo.winner) {
        await abonar(duelo.winner, bote);
    } else {
        // Empate: cada uno recupera lo suyo. Quedarse el bote la casa sería
        // cobrarle a los dos por entrenar lo mismo.
        await abonar(duelo.challenger, duelo.betAmount);
        await abonar(duelo.opponent, duelo.betAmount);
    }
    return true;
};

/** El aviso del resultado, uno para cada uno, con enlace al duelo. */
const avisarDelResultado = async (duelo) => {
    const partes = [
        { yo: duelo.challenger, el: duelo.opponent },
        { yo: duelo.opponent, el: duelo.challenger }
    ];

    await Promise.all(partes.map(({ yo, el }) => Notification.create({
        user: yo,
        actor: el,
        type: 'duelo',
        challenge: duelo._id,
        // El texto se arma en el móvil a partir del duelo, para poder decir
        // "has ganado" o "has perdido" según quién lo esté leyendo.
        text: ''
    }).catch(() => null)));   // un aviso perdido no puede tumbar un pago
};

/**
 * CIERRA TODOS LOS DUELOS QUE YA HAN VENCIDO.
 *
 * Lo llama el mantenimiento nocturno. Devuelve un resumen para poder verlo en
 * los registros del servidor.
 */
const resolverDuelos = async (ahora = new Date()) => {
    const resumen = { cerrados: 0, pagados: 0, rescatados: 0 };

    // ⚠️ PRIMERO LOS RESCATES.
    //
    // Un duelo que se marcó como terminado pero cuyo pago no llegó a hacerse
    // —el servidor se reinició justo en medio— se quedaría con las fichas de
    // los dos retenidas para siempre. Aquí se recogen.
    const sinPagar = await Challenge.find({ status: 'finished', pagado: false });
    for (const duelo of sinPagar) {
        if (await pagarDuelo(duelo)) resumen.rescatados++;
    }

    const vencidos = await Challenge.find({ status: 'active', endDate: { $lte: ahora } });

    for (const duelo of vencidos) {
        const [volRetador, volRival] = await Promise.all([
            volumenEntre(duelo.challenger, duelo.startDate, duelo.endDate),
            volumenEntre(duelo.opponent, duelo.startDate, duelo.endDate)
        ]);

        // Empate incluye el 0 a 0: si ninguno de los dos entrenó, nadie ha
        // ganado nada y cobrar por eso sería premiar el no hacer nada.
        let ganador = null;
        if (volRetador > volRival) ganador = duelo.challenger;
        else if (volRival > volRetador) ganador = duelo.opponent;

        // Se reclama el cierre con `status: 'active'` dentro del filtro: si dos
        // ejecuciones coinciden, solo una lo cierra.
        const cerrado = await Challenge.findOneAndUpdate(
            { _id: duelo._id, status: 'active' },
            {
                $set: {
                    status: 'finished',
                    winner: ganador,
                    volumenChallenger: volRetador,
                    volumenOpponent: volRival,
                    resueltoEn: ahora
                }
            },
            { new: true }
        );
        if (!cerrado) continue;

        resumen.cerrados++;
        if (await pagarDuelo(cerrado)) resumen.pagados++;
        await avisarDelResultado(cerrado);
    }

    return resumen;
};

module.exports = { resolverDuelos, pagarDuelo, volumenEntre, finDelDuelo, DUELO_DIAS };
