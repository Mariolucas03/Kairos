const Challenge = require('../models/Challenge');
const WorkoutLog = require('../models/WorkoutLog');
const DailyLog = require('../models/DailyLog');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { volumenDe } = require('../controllers/gymController');
const { getMadridDateString } = require('../utils/dateHelpers');
const { sendPushToUser } = require('../controllers/pushController');

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

/** Cuantas sesiones de gimnasio hizo entre dos fechas. */
const entrenosEntre = (userId, desde, hasta) => WorkoutLog.countDocuments({
    user: userId,
    type: 'gym',
    date: { $gte: desde, $lt: hasta }
});

/**
 * SUMA UN CONTADOR DIARIO A LO LARGO DEL DUELO.
 *
 * ⚠️ AQUI SE MIDE POR DIAS ENTEROS, Y NO ES LO MISMO QUE ARRIBA.
 *
 * La XP y las misiones no viven en un registro con hora: se acumulan en el
 * `DailyLog`, que va por dia y guarda la fecha como texto "AAAA-MM-DD". Asi que
 * un duelo de XP cuenta los siete DIAS de Madrid que toca el duelo, no las 168
 * horas exactas.
 *
 * Es justo aunque no sea exacto: los dos jugadores comparten las MISMAS fechas,
 * porque salen del mismo duelo. Lo unico que se cuela es la XP que el retado ya
 * hubiera hecho el dia que acepto, y eso le pasa igual a los dos.
 */
const sumaDiaria = async (userId, desde, hasta, campo) => {
    // El ultimo instante que todavia esta dentro, para no arrastrar el dia
    // siguiente cuando el duelo termina justo a medianoche.
    const primerDia = getMadridDateString(desde);
    const ultimoDia = getMadridDateString(new Date(new Date(hasta).getTime() - 1));

    const [r] = await DailyLog.aggregate([
        { $match: { user: userId, date: { $gte: primerDia, $lte: ultimoDia } } },
        { $group: { _id: null, total: { $sum: { $ifNull: [campo, 0] } } } }
    ]);
    return r?.total || 0;
};

/**
 * LO QUE SE PUEDE MEDIR EN UN DUELO.
 *
 * ⚠️ LO QUE ESTA AQUI TIENE QUE CALCULARLO EL SERVIDOR.
 *
 * Esa es la unica regla. En esta app casi todo lo escribes tu, y mientras
 * compitas contigo mismo da igual: mentir solo te perjudica. Con una apuesta de
 * por medio, mentir es quitarle fichas a un amigo.
 *
 * Los kilos y los entrenos salen de los entrenos guardados —con techo por sesion
 * y con la misma cuenta que mueve los rangos—. La XP y las misiones las reparte
 * el servidor y no hay ninguna casilla donde teclearlas.
 *
 * Por eso NO estan los pasos ni los kilometros, que el modelo declaraba al
 * principio: los dos salen de una casilla donde escribes un numero a mano. Un
 * duelo de pasos seria "quien teclea el numero mas grande".
 */
const MEDIDAS = {
    gym: {
        etiqueta: 'Kilos movidos',
        pista: 'Gana quien más peso levante en total',
        unidad: 'kg',
        medir: volumenEntre
    },
    entrenos: {
        etiqueta: 'Entrenos',
        pista: 'Gana quien más veces vaya al gimnasio',
        unidad: 'entrenos',
        medir: entrenosEntre
    },
    xp: {
        etiqueta: 'Experiencia',
        pista: 'Todo suma: gimnasio, misiones y comida',
        unidad: 'XP',
        medir: (u, d, h) => sumaDiaria(u, d, h, '$gains.xp')
    },
    misiones: {
        etiqueta: 'Misiones',
        pista: 'Gana quien más misiones complete',
        unidad: 'misiones',
        medir: (u, d, h) => sumaDiaria(u, d, h, '$missionStats.completed')
    }
};

const TIPOS = Object.keys(MEDIDAS);

/** El catálogo tal y como lo necesita la pantalla, sin las funciones. */
const catalogoDeMedidas = () => TIPOS.map(clave => ({
    clave,
    etiqueta: MEDIDAS[clave].etiqueta,
    pista: MEDIDAS[clave].pista,
    unidad: MEDIDAS[clave].unidad
}));

/**
 * COMO VA LA COSA AHORA MISMO.
 *
 * ⚠️ SIN ESTO, UN DUELO ES SIETE DIAS SIN QUE PASE NADA.
 *
 * Aceptabas, y hasta la noche del septimo dia no sabias absolutamente nada. Eso
 * no es un duelo, es una espera: lo que hace que quieras volver al gimnasio es
 * ver que vas dos mil kilos por detras y que quedan tres dias.
 *
 * Se mide con la MISMA funcion que decide quien gana al cerrarlo. Calcularlo de
 * otra manera aqui —o peor, en el movil— haria que el marcador que miras toda
 * la semana no fuera el que reparte el bote.
 *
 * Se corta en `endDate` aunque se mire despues: pasada esa hora ya no cuenta
 * nada, y seguir sumando seria enseñar un marcador que no es el que paga.
 */
const marcadorEnVivo = async (duelo, ahora = new Date()) => {
    const medida = MEDIDAS[duelo.type] || MEDIDAS.gym;
    const hasta = new Date(Math.min(new Date(duelo.endDate).getTime(), ahora.getTime()));

    const [retador, rival] = await Promise.all([
        medida.medir(duelo.challenger?._id || duelo.challenger, duelo.startDate, hasta),
        medida.medir(duelo.opponent?._id || duelo.opponent, duelo.startDate, hasta)
    ]);

    return { retador, rival, unidad: medida.unidad, etiqueta: medida.etiqueta };
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

/** "12.400 kg", "5 entrenos". Igual que en la pantalla. */
const conUnidad = (n, unidad) => `${Math.round(n || 0).toLocaleString('es-ES')} ${unidad}`;

/**
 * EL AVISO DEL RESULTADO.
 *
 * ⚠️ VA POR DOS SITIOS, Y NO ES DUPLICAR.
 *
 * La notificacion del buzon se queda —es el historial, y esta ahi cuando entres
 * mañana—. El push es el que TE ENTERA: un duelo que se resuelve de madrugada y
 * no avisa al movil es un duelo del que te enteras tres dias despues, cuando ya
 * no significa nada.
 *
 * Cada uno recibe SU frase. "Has ganado" y "has perdido" son el mismo suceso
 * leido por dos personas, y por eso el texto no se guarda en la notificacion
 * sino que se arma aqui para el push y en el movil para el buzon.
 */
const avisarDelResultado = async (duelo) => {
    const medida = MEDIDAS[duelo.type] || MEDIDAS.gym;
    const partes = [
        { yo: duelo.challenger, el: duelo.opponent, mio: duelo.volumenChallenger, suyo: duelo.volumenOpponent },
        { yo: duelo.opponent, el: duelo.challenger, mio: duelo.volumenOpponent, suyo: duelo.volumenChallenger }
    ];

    await Promise.all(partes.map(async ({ yo, el, mio, suyo }) => {
        // El buzon primero: es lo que queda, y no depende de que el movil tenga
        // los avisos activados.
        await Notification.create({
            user: yo, actor: el, type: 'duelo', challenge: duelo._id, text: ''
        }).catch(() => null);

        // Y el push, que es el que te entera. Hace falta el usuario entero
        // porque las suscripciones viven dentro de el.
        try {
            const persona = await User.findById(yo).select('username pushSubscriptions');
            if (!persona) return;

            const gane = duelo.winner && duelo.winner.toString() === yo.toString();
            const empate = !duelo.winner;
            const rival = await User.findById(el).select('username').lean();
            const contra = rival?.username || 'tu rival';

            const marcador = `${conUnidad(mio, medida.unidad)} contra ${conUnidad(suyo, medida.unidad)}.`;

            await sendPushToUser(persona, {
                title: empate
                    ? `🤝 Empate contra ${contra}`
                    : gane
                        ? `🏆 Has ganado el duelo contra ${contra}`
                        : `Has perdido el duelo contra ${contra}`,
                body: empate
                    ? `${marcador} Cada uno recupera sus ${duelo.betAmount} fichas.`
                    : gane
                        ? `${marcador} El bote de ${duelo.betAmount * 2} fichas es tuyo.`
                        : `${marcador} Se lleva el bote.`,
                icon: '/assets/icons/ficha.png',
                url: '/social/duelos'
            });
        } catch (e) {
            // Un aviso perdido no puede tumbar un pago: el bote YA esta repartido.
            console.error('No se pudo avisar del duelo:', e.message);
        }
    }));
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
        // Cada tipo de duelo mide una cosa distinta, pero el resto —quien gana,
        // como se paga, como se avisa— es exactamente igual. Por eso la medida
        // es un dato y no un `if` por cada tipo repartido por el fichero.
        const medida = MEDIDAS[duelo.type] || MEDIDAS.gym;

        const [volRetador, volRival] = await Promise.all([
            medida.medir(duelo.challenger, duelo.startDate, duelo.endDate),
            medida.medir(duelo.opponent, duelo.startDate, duelo.endDate)
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

module.exports = {
    resolverDuelos, pagarDuelo, volumenEntre, finDelDuelo, marcadorEnVivo,
    MEDIDAS, TIPOS, catalogoDeMedidas, DUELO_DIAS
};
