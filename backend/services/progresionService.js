/**
 * PROGRESIÓN AUTOMÁTICA
 *
 * Hasta ahora la app era un cuaderno muy bonito: apuntaba lo que habías hecho,
 * pero no te decía qué hacer hoy. Eso lo decidías tú de memoria, que es
 * exactamente donde se estanca la gente: se repite el mismo peso durante meses
 * sin darse cuenta.
 *
 * Esto mira tu última sesión de cada ejercicio y propone la siguiente.
 *
 * ⚠️ Propone, no impone. Los campos siguen siendo editables: la sugerencia entra
 * como valor de partida y si hoy no era tu día, la cambias. Una app que te
 * obliga a subir peso cuando has dormido cuatro horas se desinstala.
 */

/** Sistemas disponibles, con la explicación que se enseña al elegirlos. */
const SISTEMAS = {
    ninguna: 'Sin sugerencia: lo decides tú',
    lineal: 'Sube el peso cada vez que completas todas las series',
    doble: 'Primero sube repeticiones hasta el tope, y solo entonces el peso',
    greyskull: 'Como lineal, pero si fallas baja un 10% y vuelves a subir'
};

/**
 * Saca el rango de repeticiones de un texto tipo "8-12", "10" o "AMRAP".
 * Es lo que ya se escribe en las rutinas, así que no hace falta pedirlo aparte.
 */
const rangoDeReps = (texto) => {
    const limpio = String(texto || '').trim();
    const numeros = limpio.match(/\d+/g);

    if (!numeros || numeros.length === 0) return { min: 8, max: 12 };
    if (numeros.length === 1) {
        const n = Number(numeros[0]);
        return { min: n, max: n };
    }
    // Ordenados a la fuerza: alguien escribe "12-8" pensando "de 12 a 8" y sin
    // esto el tope quedaba por debajo del suelo, asi que la app daba la serie por
    // completada SIEMPRE y subia peso cada sesion.
    const a = Number(numeros[0]);
    const b = Number(numeros[1]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
};

/** Redondea a medios kilos: no existen las mancuernas de 41,3 kg. */
const aDiscoReal = (kg) => Math.max(0, Math.round(kg * 2) / 2);

/**
 * Propone la siguiente sesión de un ejercicio.
 *
 * @param {Object} config    lo que dice la rutina: sistema, incremento y reps
 * @param {Array}  ultimas   series de la última vez [{ weight, reps }]
 * @returns {Object|null}    { peso, reps, motivo } o null si no hay sugerencia
 */
const sugerirSiguiente = (config = {}, ultimas = []) => {
    const sistema = config.progresion || 'ninguna';
    if (sistema === 'ninguna' || !SISTEMAS[sistema]) return null;

    // Sin historial no se sugiere nada: la primera vez la decides tú, que es la
    // única forma de saber por dónde andas.
    //
    // Se descartan las series a cero: una serie apuntada sin repeticiones (o a
    // medio rellenar) no dice nada de tu fuerza, y colandose en el calculo hacia
    // que la peor serie fuera siempre esa y la app propusiera repetir peso
    // eternamente.
    const validas = (Array.isArray(ultimas) ? ultimas : [])
        .filter(s => Number(s?.reps) > 0 && Number.isFinite(Number(s?.weight)));

    if (validas.length === 0) return null;
    ultimas = validas;

    const incremento = Number(config.incremento) > 0 ? Number(config.incremento) : 2.5;
    const { min, max } = rangoDeReps(config.reps);

    const peso = Math.max(...ultimas.map(s => Number(s.weight) || 0));
    const repsMinimas = Math.min(...ultimas.map(s => Number(s.reps) || 0));

    if (peso <= 0) return null;

    // ¿Cumpliste el objetivo en TODAS las series? La peor serie manda: tres
    // series buenas y una mala no es una sesión completada.
    const completado = repsMinimas >= max;

    if (sistema === 'doble') {
        if (completado) {
            return {
                peso: aDiscoReal(peso + incremento),
                reps: min,
                motivo: `Llegaste a ${max} repeticiones: toca subir peso y volver a ${min}`
            };
        }
        return {
            peso: aDiscoReal(peso),
            reps: Math.min(repsMinimas + 1, max),
            motivo: `Mismo peso, una repetición más (objetivo ${max})`
        };
    }

    if (sistema === 'greyskull' && !completado) {
        // Al fallar se baja un 10% y se vuelve a subir desde ahí. Es lo que
        // evita quedarse semanas atascado intentando el mismo peso.
        return {
            peso: aDiscoReal(peso * 0.9),
            reps: max,
            motivo: 'No salieron todas: se baja un 10% para volver a coger carrerilla'
        };
    }

    // Lineal (y Greyskull cuando sí completaste)
    if (completado) {
        return {
            peso: aDiscoReal(peso + incremento),
            reps: max,
            motivo: `Completaste la última: +${incremento} kg`
        };
    }

    return {
        peso: aDiscoReal(peso),
        reps: max,
        motivo: `Repetir peso hasta llegar a ${max} repeticiones`
    };
};

module.exports = { sugerirSiguiente, SISTEMAS, rangoDeReps, aDiscoReal };
