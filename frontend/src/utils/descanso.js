/**
 * CON CUÁNTO DESCANSO ARRANCA UN ENTRENO.
 *
 * ⚠️ EL QUE PONÍAS AL CREAR LA RUTINA NO SE USABA. NUNCA.
 *
 * La cadena entera estaba bien menos el último paso: la pantalla de crear
 * rutinas lo enviaba, el servidor lo validaba y lo guardaba, `getRoutines` lo
 * devolvía... y el entreno lo ignoraba y arrancaba con 60 segundos fijos.
 *
 * Es la cuarta vez que aparece este patrón en el proyecto —un ajuste que la
 * pantalla escribe y nada lee— después del selector de progresión, el tipo de
 * serie y los campos `targetWeight`/`targetSegundos`. Y es el más molesto de los
 * cuatro, porque este SÍ se nota: pones 90 segundos, entrenas, y el cronómetro
 * te da 60 cada vez sin explicar por qué.
 *
 * EL ORDEN, de más específico a más general:
 *
 *   1. Lo que quedó guardado de un entreno a medias. Si estabas descansando 120
 *      segundos y se te cerró la app, al volver siguen siendo 120: cambiártelo
 *      al recuperar la sesión sería perder algo que habías decidido tú.
 *   2. El descanso de la rutina, que es lo que faltaba.
 *   3. 60 segundos, para las rutinas de antes de que existiera el campo.
 *
 * El descanso de CADA ejercicio se decide aparte, en `startRest`: si el
 * ejercicio trae el suyo manda ese, y si vale 0 se usa este.
 */
const POR_DEFECTO = 60;

const segundosValidos = (v) => {
    const n = Number(v);
    // Un descanso de cero o negativo no es un descanso: es no tener cronómetro.
    return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * @param {Object} rutina    la rutina que se está entrenando
 * @param {Object} guardado  el estado de un entreno a medias, si lo hay
 * @returns {number} segundos
 */
export const descansoInicial = (rutina, guardado) =>
    segundosValidos(guardado?.defaultRest)
    ?? segundosValidos(rutina?.defaultRest)
    ?? POR_DEFECTO;

export { POR_DEFECTO };
