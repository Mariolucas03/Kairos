/**
 * EL 1RM ESTIMADO, EN UN SOLO SITIO.
 *
 * ⚠️ ESTABA ESCRITO TRES VECES, Y UNA DE LAS TRES NO SE PARECIA A LAS OTRAS.
 *
 * La formula de Epley vivia copiada en `getExerciseHistory` (la grafica del
 * perfil), en `getFuerzaRelativa` (cuantas veces tu peso) y en el movil
 * (`utils/estadisticas.js`). Las dos ultimas cortaban por encima de 12
 * repeticiones; la del perfil no cortaba nada, asi que:
 *
 *     40 kg x 15  ->  el perfil decia "PR: 60 kg"
 *                     estadisticas decia "aqui no se puede estimar"
 *
 * El mismo levantamiento con dos respuestas distintas segun la pantalla, y la
 * del perfil inflada. Es el mismo fallo que ya ha aparecido cinco veces en este
 * proyecto: el mismo numero calculado en dos sitios acaba dando dos numeros.
 *
 * ⚠️ POR QUE SE CORTA EN 12.
 *
 * Epley se dispara a partir de ahi y empieza a inventar: una serie de 20 daria
 * 1,67 veces el peso, que no se parece a lo que levantarias de verdad. Antes que
 * enseñar un numero falso con pinta de record, no se enseña ninguno.
 *
 * La copia del movil sigue existiendo porque es otro paquete y no puede importar
 * de aqui, pero hay una prueba que fija los dos a los mismos valores: si algun
 * dia dejan de coincidir, salta.
 */
const TOPE_DE_REPS_FIABLE = 12;

/**
 * @param {number} peso  kilos de la serie
 * @param {number} reps  repeticiones
 * @returns {number|null} el maximo estimado a una repeticion, o null si no se
 *                        puede estimar de forma honesta
 */
const unaRepeticionMaxima = (peso, reps) => {
    const kg = Number(peso) || 0;
    const r = Number(reps) || 0;

    // Sin peso no hay 1RM: los de peso corporal no se estiman.
    if (kg <= 0 || r <= 0) return null;
    // Una sola repeticion YA es tu 1RM. Aplicar la formula lo inflaria un 3%.
    if (r === 1) return kg;
    if (r > TOPE_DE_REPS_FIABLE) return null;

    return Math.round(kg * (1 + r / 30));
};

module.exports = { unaRepeticionMaxima, TOPE_DE_REPS_FIABLE };
