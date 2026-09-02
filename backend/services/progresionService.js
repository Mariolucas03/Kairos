/**
 * QUÉ TOCA HOY
 *
 * Hasta ahora la app era un cuaderno muy bonito: apuntaba lo que habías hecho,
 * pero no te decía qué hacer hoy. Eso lo decidías tú de memoria, que es
 * exactamente donde se estanca la gente: se repite el mismo peso durante meses
 * sin darse cuenta.
 *
 * Esto mira tu última sesión de cada ejercicio y propone la siguiente.
 *
 * ⚠️ NO SE CONFIGURA.
 *
 * Antes había cuatro sistemas a elegir —Lineal, Doble, Greyskull— y eso era el
 * problema: son nombres de métodos de entrenamiento, no opciones de una app.
 * Para elegir bien había que conocerlos de antes, así que en la práctica nadie
 * tocaba el selector y la progresión no se activaba nunca. Ahora hay UNA regla y
 * funciona sola.
 *
 * LA REGLA, en una frase: se busca el número de repeticiones que aguantas en
 * TODAS las series, y cuando lo aguantas, sube el peso.
 *
 * El caso que la explica entero. Sentadilla a 80 kg, objetivo 12:
 *
 *     lunes      80 × 10 · 80 × 10 · 80 × 6
 *     el lunes siguiente  ->  80 kg, busca 8 en las tres
 *
 * ¿Por qué 8 y no 10? Porque 10 ya lo intentaste y a la tercera serie te
 * quedaste en 6: no aguantas 10. Ocho es la media de lo que hiciste de verdad,
 * o sea el número que sí puedes sostener de principio a fin. Cuando saques las
 * tres a 12, sube el peso y se empieza otra vez desde abajo.
 *
 * Manda la PEOR serie, no la mejor: tres buenas y una mala no es una sesión
 * completada. Y no baja nunca de lo que ya hiciste en tu peor serie: la
 * propuesta siempre pide algo más que la última vez, aunque sea una repetición.
 *
 * ⚠️ Propone, no impone. Los campos siguen siendo editables: la sugerencia entra
 * como valor de partida y si hoy no era tu día, la cambias. Una app que te
 * obliga a subir peso cuando has dormido cuatro horas se desinstala.
 */

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
 * Cuánto sube el peso al completar, según lo que ya movías.
 *
 * Antes esto se preguntaba ("¿cuánto sube cada vez?") y venía con 2,5 kg puesto
 * para todo, que en un curl de bíceps es un salto del 15%: te cargas la serie
 * siguiente. El salto sale del propio peso, que es de donde debería haber salido
 * siempre.
 */
const escalonDePeso = (peso) => {
    if (peso < 20) return 1;      // elevaciones laterales, curl con mancuerna
    if (peso < 40) return 2;      // press militar, remo con barra ligera
    return 2.5;                   // el salto de toda la vida: dos discos de 1,25
};

/**
 * Propone la siguiente sesión de un ejercicio.
 *
 * @param {Object} config    lo que dice la rutina: de aquí solo se usa `reps`
 * @param {Array}  ultimas   series de la última vez [{ weight, reps }]
 * @returns {Object|null}    { peso, reps, completada, motivo } o null
 *
 * `motivo` va SIN números a propósito. Lo que devuelve esto lo traduce después
 * el controlador —el peso corporal se resta, los segundos se multiplican, las
 * repeticiones por lado se parten en dos—, así que cualquier cifra metida en el
 * texto contradiría a la de la casilla de al lado. Las cifras las pinta la
 * pantalla, que ya las tiene traducidas.
 */
const sugerirSiguiente = (config = {}, ultimas = []) => {
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

    const { min, max: objetivo } = rangoDeReps(config.reps);

    const peso = Math.max(...validas.map(s => Number(s.weight) || 0));
    if (peso <= 0) return null;

    const reps = validas.map(s => Number(s.reps) || 0);
    const peor = Math.min(...reps);

    // ¿Aguantaste el objetivo en TODAS? Entonces el peso se te ha quedado corto.
    if (peor >= objetivo) {
        return {
            peso: aDiscoReal(peso + escalonDePeso(peso)),
            reps: min,
            completada: true,
            motivo: 'Las aguantaste todas, así que toca subir peso y volver a empezar desde abajo.'
        };
    }

    // Y si no: mismo peso, y de meta lo que de verdad puedes sostener en todas.
    //
    // La media de lo que hiciste. Hacia abajo, porque redondear hacia arriba te
    // devuelve al número con el que ya fallaste.
    const media = Math.floor(reps.reduce((a, b) => a + b, 0) / reps.length);

    // Nunca menos que una más que tu peor serie —la propuesta tiene que pedir
    // algo, aunque sea una repetición— y nunca más que el objetivo, que si no la
    // app te pediría 14 con la rutina puesta en 12.
    const meta = Math.min(Math.max(media, peor + 1), objetivo);

    return {
        peso: aDiscoReal(peso),
        reps: meta,
        completada: false,
        motivo: 'No aguantaste el mismo número en todas: esta es la que sí puedes sostener.'
    };
};

module.exports = { sugerirSiguiente, rangoDeReps, aDiscoReal, escalonDePeso };
