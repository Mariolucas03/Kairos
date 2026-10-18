/**
 * CAMBIAR Y AÑADIR EJERCICIOS DURANTE EL ENTRENO.
 *
 * Esto vivía dentro de ActiveWorkout y por eso no había forma de probarlo.
 * Son las dos operaciones que más se usan en mitad de una sesión —la máquina
 * está ocupada y haces otra cosa, o te apetece meter un ejercicio más— y las
 * dos tenían un fallo que solo se nota entrenando.
 */

/** Identificador de un hueco de la lista. Ver por qué en ActiveWorkout. */
let contador = 0;
export const nuevoUid = () => `ej-${Date.now().toString(36)}-${contador++}`;

/** Series vacías, tantas como se pidan. */
const seriesEnBlanco = (cuantas) =>
    Array.from({ length: Math.max(1, cuantas) }, () => ({ kg: '', reps: '', completed: false, type: 'N' }));

/**
 * El ejercicio que ocupa un hueco cuando lo cambias por otro.
 *
 * ⚠️ EL EJERCICIO NUEVO ES NUEVO, NO EL VIEJO CON OTRO NOMBRE.
 *
 * Antes esto era `{ ...viejo, name, muscle, setsData, pr }`: se quedaba TODO
 * lo demás del anterior. Cambiabas una plancha (por tiempo) por un press de
 * banca y el press te seguía pidiendo segundos. Cambiabas unas dominadas (peso
 * corporal) por una polea y seguía sumándote tu propio peso al volumen. Y la
 * sugerencia y las "últimas series" que se quedaban en pantalla eran las del
 * OTRO ejercicio.
 *
 * Del hueco se conserva solo lo que es del hueco y no del ejercicio: su
 * identidad, cuántas series tiene, el descanso y la superserie a la que
 * pertenece. Todo lo demás sale del ejercicio nuevo o se pone a cero.
 */
export const ejercicioCambiado = (hueco, nuevo) => ({
    // Del hueco
    uid: hueco.uid,
    superserie: hueco.superserie || '',
    rest: hueco.rest,
    reps: hueco.reps || '10-12',
    setsData: seriesEnBlanco((hueco.setsData || []).length || 3),

    // Del ejercicio nuevo
    name: nuevo.name,
    muscle: nuevo.muscle,
    muscleDetail: nuevo.muscleDetail || '',
    secondary: nuevo.secondary || [],

    // Ajustes del anterior: se tiran. No están en el catálogo, son de cómo
    // haces TÚ ese ejercicio concreto, así que no se heredan.
    esPorTiempo: false,
    esPesoCorporal: false,
    porLado: false,

    // Y lo que venía de su historial, también.
    pr: null,
    sugerencia: null,
    ultimasSeries: [],
    lastWeights: []
});

/** Un ejercicio recién añadido a mitad de entreno. */
export const ejercicioNuevo = (nuevo, descanso) => ({
    uid: nuevoUid(),
    name: nuevo.name,
    muscle: nuevo.muscle,
    muscleDetail: nuevo.muscleDetail || '',
    secondary: nuevo.secondary || [],
    reps: '10-12',
    rest: descanso,
    esPorTiempo: false,
    esPesoCorporal: false,
    porLado: false,
    superserie: '',
    setsData: seriesEnBlanco(3),
    pr: null
});

/**
 * Coloca lo de la última vez (marca, series previas, sugerencia) en su sitio.
 *
 * ⚠️ POR `uid` Y NO POR POSICIÓN.
 *
 * La petición al servidor tarda, y mientras tanto la lista se mueve: añades un
 * ejercicio, borras otro, o cambias un segundo antes de que vuelva lo del
 * primero. Escribiendo por posición, lo que vuelve se mete en el hueco que
 * ocupe ese número EN ESE MOMENTO, que ya no es el mismo ejercicio. Es decir:
 * los kilos y la marca del ejercicio 2 acababan escritos en el 1.
 *
 * Con el uid, lo que llega tarde va a su ejercicio o no va a ninguno.
 *
 * @param {Array}  lista        los ejercicios tal como están ahora
 * @param {Object} datos        respuesta del servidor, por nombre de ejercicio
 * @param {Object} uidPorNombre a qué hueco iba cada nombre cuando se pidió
 */
export const aplicarHistorial = (lista, datos, uidPorNombre) =>
    lista.map(ex => {
        const esperado = uidPorNombre[ex.name];
        // Ni es el hueco al que iba, ni el ejercicio que había cuando se pidió.
        if (!esperado || esperado !== ex.uid) return ex;

        const history = datos?.[ex.name];
        if (!history) return ex;

        const ultimas = history.lastSets || [];
        const setsData = (ex.setsData || []).map((set, i) => {
            const ultima = ultimas[i] || ultimas[ultimas.length - 1];
            return ultima ? { ...set, kg: ultima.weight, reps: ultima.reps } : set;
        });

        return {
            ...ex,
            pr: history.bestSet,
            setsData,
            sugerencia: history.sugerencia || null,
            ultimasSeries: ultimas
        };
    });
