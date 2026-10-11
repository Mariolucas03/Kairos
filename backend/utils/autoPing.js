const { getMadridHour } = require('./dateHelpers');

/**
 * QUE EL SERVIDOR SE MANTENGA DESPIERTO EL SOLO.
 *
 * ⚠️ EL PROBLEMA QUE RESUELVE.
 *
 * Render, en el plan gratuito, duerme la instancia a los 15 minutos sin
 * visitas, y despertarla son 20-45 segundos. Para evitarlo se usaba un cron
 * externo (cron-job.org) que la visitaba cada pocos minutos, y ese montaje se
 * muere solo:
 *
 *   El servidor se duerme -> el cron llega y se encuentra un arranque en frio
 *   -> tarda mas de los 30 segundos que espera el cron -> queda apuntado como
 *   fallo -> con varios fallos seguidos, cron-job.org DESACTIVA el trabajo ->
 *   ya no visita nadie -> el servidor duerme siempre.
 *
 * Es un pez que se muerde la cola: ese cron solo funciona si el servidor ya
 * esta despierto, y el servidor solo esta despierto si ese cron funciona.
 *
 * Asi que lo hace el propio servidor: mientras esta vivo, se visita a si mismo
 * cada pocos minutos. Tiene que ser una peticion HTTP de verdad a su direccion
 * publica; un temporizador suelto no vale, porque Render mira las VISITAS que
 * entran, no si el proceso esta haciendo algo.
 *
 * Esto no despierta nada: si ya esta dormido, aqui no corre nadie. Lo que hace
 * es que, una vez despierto (porque alguien ha abierto la app), SE QUEDE
 * despierto. En la practica: un arranque en frio al dia en vez de uno cada vez
 * que abres la app despues de un rato.
 *
 * ⚠️ LA FRANJA HORARIA NO ES UN CAPRICHO.
 *
 * Render regala 750 horas de instancia al mes. Un mes son 744 horas, asi que
 * tenerla despierta 24/7 se come el presupuesto ENTERO y, si hay otro servicio
 * gratuito en la cuenta, se pasa y Render SUSPENDE el servicio: entonces todo
 * devuelve 503 al instante. De 08:00 a 00:00 son unas 496 horas al mes, que
 * deja margen de sobra, y de madrugada no hay nadie mirando el movil.
 *
 * Se apaga con AUTO_PING=off. Solo corre en Render (necesita
 * RENDER_EXTERNAL_URL), nunca en local ni en las pruebas.
 */

const CADA = 10 * 60 * 1000; // Render duerme a los 15 min: 10 deja margen
const POR_DEFECTO = { desde: 8, hasta: 0 }; // 08:00 -> 00:00 (hora de Madrid)

/**
 * ¿Toca mantenerlo despierto a esta hora?
 *
 * `hasta` es exclusiva y la franja puede cruzar la medianoche (desde 22 hasta
 * 2 son las 22:00, 23:00, 00:00 y 01:00). Si las dos son iguales, es todo el
 * dia.
 */
const dentroDeLaFranja = (hora, desde, hasta) => {
    if (desde === hasta) return true;
    if (desde < hasta) return hora >= desde && hora < hasta;
    return hora >= desde || hora < hasta; // cruza la medianoche
};

/** Lee una hora del entorno, o se queda con la de por defecto si viene mal. */
const horaDelEntorno = (valor, porDefecto) => {
    const n = Number(valor);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : porDefecto;
};

const iniciarAutoPing = () => {
    const base = process.env.RENDER_EXTERNAL_URL;

    if (process.env.AUTO_PING === 'off') {
        console.log('💤 Auto-ping apagado (AUTO_PING=off): la instancia dormira cuando Render quiera.');
        return null;
    }
    if (!base) return null; // En local no hay nada que mantener despierto
    if (typeof fetch !== 'function') {
        console.warn('⚠️  Auto-ping no disponible: esta version de Node no trae fetch.');
        return null;
    }

    const desde = horaDelEntorno(process.env.AUTO_PING_DESDE, POR_DEFECTO.desde);
    const hasta = horaDelEntorno(process.env.AUTO_PING_HASTA, POR_DEFECTO.hasta);
    const url = `${base.replace(/\/+$/, '')}/api/cron/ping`;

    console.log(`⏱️  Auto-ping cada ${CADA / 60000} min de ${desde}:00 a ${hasta}:00 (Madrid) para no dormirse.`);

    let avisadoDelDescanso = false;

    const temporizador = setInterval(() => {
        if (!dentroDeLaFranja(getMadridHour(), desde, hasta)) {
            // Una sola linea al entrar en el descanso, no una cada diez
            // minutos: los registros de Render son para leerlos.
            if (!avisadoDelDescanso) {
                console.log('💤 Fuera de franja: se deja dormir hasta las ' + desde + ':00.');
                avisadoDelDescanso = true;
            }
            return;
        }
        avisadoDelDescanso = false;

        // Silencioso a proposito. Que un ping falle no es noticia (un hipo de
        // red, un despliegue a medias); lo unico que pasa es que la instancia
        // se dormira y la despertara el siguiente que entre.
        fetch(url).catch(() => { });
    }, CADA);

    // Que no sea esto lo que impida al proceso cerrarse cuando toque.
    if (typeof temporizador.unref === 'function') temporizador.unref();

    return temporizador;
};

module.exports = { iniciarAutoPing, dentroDeLaFranja, CADA };
