const Routine = require('../models/Routine');
const Exercise = require('../models/Exercise');
const WorkoutLog = require('../models/WorkoutLog');
const User = require('../models/User');
const { sendPushToUser } = require('./pushController');
const DailyLog = require('../models/DailyLog');
const SystemState = require('../models/SystemState');
const levelService = require('../services/levelService');

// 🔥 Toda la IA pasa por el servicio único (una sola cascada de modelos gratis)
const { askAI } = require('../services/aiService');
const { sugerirSiguiente } = require('../services/progresionService');

/**
 * Techos de cordura para lo que manda el movil.
 *
 * ⚠️ Las calorias de una sesion se convierten en XP (kcal x 0,5), y en deporte
 * las que trae el usuario "mandan siempre" sin mirar cuanto valen. Una peticion
 * con calories: 9999999 daba cinco millones de XP: decenas de niveles de golpe,
 * la vida al maximo en cada uno y la cima del ranking mensual. Lo mismo por el
 * otro lado con una duracion enorme, que inflaba la estimacion.
 *
 * 15 kcal/min sostenidos ya es ritmo de competicion; por encima de eso lo que
 * hay es un reloj roto o un dato inventado. Y 10 horas de sesion es un techo que
 * nadie honesto va a rozar.
 */
const MAX_KCAL_POR_MINUTO = 15;
const MAX_MINUTOS_SESION = 600;

const minutosSeguros = (minutos) => {
    const n = Number(minutos);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, MAX_MINUTOS_SESION);
};

/**
 * Limpia las series que llegan del movil.
 *
 * ⚠️ No se validaba NADA. Y el volumen (kg x reps) de estas series es lo que
 * decide el rango muscular, que es el premio grande del gimnasio: hasta 1.350
 * monedas por escalon y unas 54.000 sumando los nueve de los ocho grupos. Una
 * sola serie inventada de 999.999 kg x 999.999 reps subia los ocho grupos al
 * maximo de golpe y vaciaba la tienda. De paso ensuciaba las marcas personales,
 * las graficas de volumen y el 1RM para siempre, porque el historial no se
 * recalcula: se acumula.
 *
 * Los topes son generosos a proposito: 500 kg pasa por encima del record
 * mundial de sentadilla, y 200 repeticiones de una serie no las hace nadie. Lo
 * que cae fuera de ahi no es un entreno.
 */
// 1000 kg y no 500: en la base ya hay un registro real de 543 kg, que en prensa
// de piernas es de lo mas normal. Un tope de 500 habria recortado en silencio un
// entreno de verdad. Da igual ser generoso aqui: quien manda numeros inventados
// choca contra el techo de volumen de la sesion, que es el que protege el rango.
const MAX_PESO_KG = 1000;
const MAX_REPS = 200;
const MAX_SERIES = 30;
const MAX_EJERCICIOS = 50;

// Los topes por serie NO bastan por si solos: 500 kg y 200 reps son creibles
// por separado, pero su producto no lo hace nadie, y con 50 ejercicios de 30
// series se llegaba a 150 millones de volumen. El rango maximo (Leyenda) pide
// 1.000.000, asi que una sola sesion seguia subiendo los ocho grupos de golpe.
// 100.000 por sesion ya es una barbaridad honesta: cien series de 100 kg x 10.
const MAX_VOLUMEN_SESION = 100000;

const volumenDe = (ejercicios) => ejercicios.reduce(
    (total, ex) => total + (ex.sets || []).reduce((t, s) => t + (s.weight || 0) * (s.reps || 0), 0),
    0
);

const MAX_SEGUNDOS_SERIE = 3600;   // una hora aguantando algo ya no es una serie
const MAX_LASTRE_KG = 200;

/**
 * Cuántos segundos se consideran una repetición en los ejercicios de tiempo.
 *
 * Hace falta una equivalencia porque TODO lo que mide el progreso —volumen
 * semanal, rangos musculares, gráficas— está construido sobre peso x
 * repeticiones. Sin esto, una plancha de tres minutos valdría exactamente cero y
 * el usuario vería que entrenar abdomen no le sube nada.
 *
 * ⚠️ 10 y no 3, que es la equivalencia habitual para isométricos. Con 3, y
 * midiendo con datos reales, una plancha de 90 segundos daba 2.400 de volumen
 * contra los 800 de una serie dura de press banca: tres veces más. Como el
 * volumen es lo que sube los rangos musculares y los rangos PAGAN monedas,
 * aguantar planchas se habría convertido en la forma más rentable de progresar
 * en la app. Con 10, esa misma plancha da 720: comparable a la serie de press,
 * que es lo que de verdad se parece en esfuerzo.
 */
const SEGUNDOS_POR_REPETICION = 10;

/**
 * Limpia las series que llegan del móvil y las deja en la forma que entiende el
 * resto de la app.
 *
 * ⚠️ CLAVE: `weight` y `reps` se guardan siempre como PESO Y REPETICIONES
 * EQUIVALENTES, es decir, lo que de verdad se ha movido:
 *
 *   - Peso corporal  -> weight = tu peso + el lastre
 *   - Por lado       -> reps = las que hiciste x 2
 *   - Por tiempo     -> reps = segundos / 3
 *
 * Se hace así a propósito. El volumen se calcula en CUATRO sitios distintos
 * (el tope de sesión, los rangos musculares, la gráfica semanal y el resumen del
 * entreno), y uno de ellos es una consulta de agregación de Mongo. Convertir
 * aquí, una vez, deja los cuatro correctos sin tocarlos; convertir en cada uno
 * era garantía de que tarde o temprano se quedaría alguno atrás.
 *
 * Lo que escribió el usuario NO se pierde: `segundos`, `lastre` y `porLado` se
 * guardan aparte, y la pantalla enseña eso ("10 por lado", "3:00").
 */
const ejerciciosSeguros = (lista, pesoUsuario = 0) => {
    if (!Array.isArray(lista)) return [];

    const acotar = (valor, maximo, minimo = 0) => {
        const n = Number(valor);
        if (!Number.isFinite(n)) return minimo;
        return Math.min(Math.max(n, minimo), maximo);
    };

    return lista.slice(0, MAX_EJERCICIOS).map(ex => {
        const sets = Array.isArray(ex?.sets) ? ex.sets.slice(0, MAX_SERIES) : [];
        const esPorTiempo = !!ex?.esPorTiempo;
        const esPesoCorporal = !!ex?.esPesoCorporal;

        return {
            ...ex,
            name: String(ex?.name || '').trim().slice(0, 120),
            esPorTiempo,
            esPesoCorporal,
            superserie: String(ex?.superserie || '').trim().slice(0, 2),
            sets: sets.map(set => {
                // El lastre puede llegar en su propio campo o en la casilla de kg
                // (que es lo que el usuario ve al escribirlo). Aceptar las dos
                // formas evita perder el dato en silencio si alguna pantalla lo
                // manda de la otra manera.
                const lastre = esPesoCorporal
                    ? acotar(set?.lastre !== undefined && set?.lastre !== null && set?.lastre !== '' ? set.lastre : set?.weight, MAX_LASTRE_KG)
                    : 0;
                const segundos = esPorTiempo ? Math.round(acotar(set?.segundos, MAX_SEGUNDOS_SERIE)) : 0;
                const porLado = !!set?.porLado;

                // Peso realmente movido
                const peso = esPesoCorporal
                    ? acotar(pesoUsuario, MAX_PESO_KG) + lastre
                    : acotar(set?.weight, MAX_PESO_KG);

                // Repeticiones equivalentes
                let reps;
                if (esPorTiempo) {
                    reps = Math.round(segundos / SEGUNDOS_POR_REPETICION);
                } else {
                    reps = Math.round(acotar(set?.reps, MAX_REPS)) * (porLado ? 2 : 1);
                }

                const esfuerzo = set?.esfuerzo === undefined || set?.esfuerzo === null || set?.esfuerzo === ''
                    ? undefined
                    : acotar(set.esfuerzo, 10);

                const tipoEsfuerzo = ['RIR', 'RPE'].includes(set?.tipoEsfuerzo) ? set.tipoEsfuerzo : '';

                return {
                    ...set,
                    weight: Math.min(peso, MAX_PESO_KG),
                    reps: Math.min(reps, MAX_REPS * 2),
                    segundos,
                    lastre,
                    porLado,
                    ...(esfuerzo !== undefined ? { esfuerzo, tipoEsfuerzo } : {})
                };
            })
        };
    }).filter(ex => ex.name);
};

const caloriasSeguras = (kcal, minutos) => {
    const n = Number(kcal);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(Math.round(n), Math.round(minutosSeguros(minutos) * MAX_KCAL_POR_MINUTO));
};

/**
 * Avisa a los amigos de que acaba de subir un entreno.
 *
 * Es el aviso con mas riesgo de cansar de todos los que hay: alguien con
 * quince amigos que entrenen a diario recibe quince notificaciones. Por eso
 * solo salta al REGISTRAR el entreno (una vez por sesion, nunca al editarlo) y
 * respeta la privacidad: si tiene oculta la seccion de entrenos, avisar de algo
 * que el amigo no puede abrir es peor que no avisar.
 *
 * No se espera con await en quien lo llama: el entreno ya esta guardado y que
 * el push tarde no puede retrasar la respuesta al que acaba de entrenar.
 */
const avisarAmigosDelEntreno = async (autorId, nombreEntreno) => {
    try {
        const autor = await User.findById(autorId).select('username friends visibility');
        if (!autor?.friends?.length) return;
        if (autor.visibility?.workouts === false) return;

        const amigos = await User.find({
            _id: { $in: autor.friends },
            'pushSubscriptions.0': { $exists: true }
        }).select('username pushSubscriptions');

        await Promise.allSettled(amigos.map(amigo => sendPushToUser(amigo, {
            title: '💪 ' + autor.username + ' ha entrenado',
            body: (nombreEntreno || 'Entreno') + '. Míralo en el feed.',
            icon: '/assets/icons/icon-192x192.png',
            url: '/social'
        })));
    } catch (error) {
        console.error('No se pudo avisar a los amigos del entreno:', error.message);
    }
};


// 🔥 Fecha en hora de Madrid. Este fichero definía su propio
// `new Date().toISOString().split('T')[0]` (UTC), así que un entreno registrado
// entre las 00:00 y las 02:00 se guardaba en el día ANTERIOR.
const { getTodayDateString } = require('../utils/dateHelpers');
const { MUSCLE_GROUPS, SPECIFIC_MUSCLES, resolveMuscleGroup, isSpecificMuscle } = require('../utils/muscles');
const { FAMILIAS, familiaDe } = require('../utils/equipment');
const { canViewSection } = require('../utils/privacidad');
// Catálogo completo (1292): los 141 curados de exerciseCatalog.js con su GIF
// enganchado, más la ampliación de ExerciseGymGifsDB. Lo genera a mano
// scripts/generateExerciseCatalog.js; aquí sólo se lee.
const EXERCISE_CATALOG = require('../data/exercises.json');
const { SPORTS, getSport, estimateCalories } = require('../utils/sportCatalog');
const { getMuscleRanks, getExerciseProgress, RANKS } = require('../services/muscleRankService');
const { revisarSubidasDeRango } = require('../services/rankUpService');

// ==========================================
// 1. OBTENER RUTINAS
// ==========================================
const getRoutines = async (req, res) => {
    try {
        const routines = await Routine.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(routines);
    } catch (error) {
        res.status(500).json({ message: 'Error al cargar rutinas' });
    }
};

/** Dias de la semana que llegan del cliente: enteros 0-6, sin repetir. */
const diasSeguros = (lista) => Array.isArray(lista)
    ? [...new Set(lista.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))]
    : [];

const createRoutine = async (req, res) => {
    try {
        // `difficulty` se escribía aquí pero NO existe en el esquema de Routine,
        // así que Mongoose lo descartaba en silencio... y además nadie lo leía
        // en ninguna pantalla. Se elimina en vez de añadirlo: era campo muerto.
        const { name, exercises, color, defaultRest, dias } = req.body;
        const routine = await Routine.create({
            user: req.user._id,
            name,
            color: color || 'blue',
            exercises,
            dias: diasSeguros(dias),
            // El descanso lo enviaba el frontend pero aquí se ignoraba
            defaultRest: parseInt(defaultRest) || 60
        });
        res.status(201).json(routine);
    } catch (error) {
        res.status(500).json({ message: 'Error creando rutina' });
    }
};

const updateRoutine = async (req, res) => {
    try {
        const { name, exercises, color, defaultRest, dias } = req.body;
        let routine = await Routine.findById(req.params.id);
        if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
        if (routine.user.toString() !== req.user.id) return res.status(401).json({ message: 'No autorizado' });

        routine.name = name || routine.name;
        routine.exercises = exercises || routine.exercises;
        if (color) routine.color = color;
        // Los dias y el descanso tambien se editan: antes se mandaban desde la
        // pantalla de editar y aqui se tiraban a la basura en silencio.
        if (dias !== undefined) routine.dias = diasSeguros(dias);
        if (defaultRest !== undefined) routine.defaultRest = parseInt(defaultRest) || routine.defaultRest;

        const updatedRoutine = await routine.save();
        res.json(updatedRoutine);
    } catch (error) {
        res.status(500).json({ message: 'Error actualizando rutina' });
    }
};

/**
 * Copia el entreno de otra persona a TUS rutinas.
 *
 * Se hace entero en el servidor a propósito:
 *  - La privacidad se comprueba aquí. El cliente no decide si puede ver ese
 *    entreno; si la cuenta es privada o tiene los entrenos ocultos, 403.
 *  - Los músculos se derivan del catálogo, no de lo que mande el navegador.
 *    Un cliente manipulado podría inventarse los grupos e inflar sus rangos.
 *
 * Un log guarda cada serie con su peso y reps; una rutina guarda cuántas series
 * y un rango de reps. La conversión toma el número de series realizadas y las
 * repeticiones más frecuentes, que es lo que describe el entreno.
 */
const copyWorkoutToRoutine = async (req, res) => {
    try {
        const log = await WorkoutLog.findById(req.params.logId)
            .populate('user', 'username')
            .lean();

        if (!log) return res.status(404).json({ message: 'Entreno no encontrado' });

        // 🔐 ¿Puedo ver los entrenos de esta persona?
        if (!(await canViewSection(req.user._id, log.user._id, 'workouts'))) {
            return res.status(403).json({ message: 'No puedes ver los entrenos de esta cuenta' });
        }

        const ejercicios = (log.exercises || []).filter(e => e?.name && (e.sets || []).length > 0);
        if (!ejercicios.length) {
            return res.status(400).json({ message: 'Este entreno no tiene ejercicios que copiar' });
        }

        // Los músculos salen del catálogo, buscando por nombre igual que hace
        // saveWorkoutLog. Sin esto la rutina copiada no pintaría el cuerpo.
        const fichas = await Exercise.find({
            name: { $in: ejercicios.map(e => e.name) },
            $or: [{ user: req.user._id }, { isCustom: false }, { user: null }]
        }).select('name muscle muscleDetail secondary').lean();

        const porNombre = new Map(fichas.map(f => [f.name.toLowerCase(), f]));

        const repsMasFrecuentes = (sets) => {
            const cuenta = {};
            sets.forEach(s => {
                const r = Number(s.reps) || 0;
                if (r > 0) cuenta[r] = (cuenta[r] || 0) + 1;
            });
            const claves = Object.keys(cuenta);
            if (!claves.length) return '10-12';
            return String(claves.sort((a, b) => cuenta[b] - cuenta[a] || b - a)[0]);
        };

        const exercises = ejercicios.map(e => {
            const ficha = porNombre.get(e.name.toLowerCase());
            return {
                name: e.name,
                muscle: ficha?.muscle || 'Pecho',
                muscleDetail: ficha?.muscleDetail || '',
                secondary: ficha?.secondary || [],
                sets: e.sets.length,
                reps: repsMasFrecuentes(e.sets),
                // El peso del otro es una referencia, no un objetivo: se deja a 0
                // para que cada uno ponga el suyo en vez de arrastrar el ajeno.
                targetWeight: 0,
                rest: 0
            };
        });

        const autor = log.user?.username || 'otro';
        const base = (log.routineName || 'Entreno').trim();
        const nombre = `${base} · de ${autor}`.slice(0, 60);

        const routine = await Routine.create({
            user: req.user._id,
            name: nombre,
            color: 'blue',
            exercises,
            defaultRest: 60
        });

        res.status(201).json({ message: `Guardada como "${nombre}"`, routine });
    } catch (error) {
        console.error('Error copiando entreno a rutina:', error);
        res.status(500).json({ message: 'No se pudo guardar la rutina' });
    }
};

const deleteRoutine = async (req, res) => {
    try {
        await Routine.deleteOne({ _id: req.params.id, user: req.user._id });
        res.json({ message: 'Rutina eliminada' });
    } catch (error) {
        res.status(500).json({ message: 'Error eliminando rutina' });
    }
};

// Sin esto, un usuario que busque "press (" hace que `new RegExp` reviente
const escaparRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Tope de resultados de una búsqueda. Con 1292 ejercicios, devolverlos todos
// son cientos de KB por petición y una lista que nadie va a recorrer entera.
const LIMITE_BUSQUEDA = 300;

/**
 * Lista de ejercicios para el selector.
 *
 * El catálogo pasó de 82 a 1292 al integrar los GIFs, así que ya no se puede
 * devolver entero en cada apertura:
 *  - Sin filtros manda los 141 curados (isCore) más los del usuario.
 *  - Con búsqueda o grupo concreto busca en todo el catálogo, con tope.
 *  - `instructions` nunca viaja aquí: son 5 frases por ejercicio y sólo hacen
 *    falta en la ficha, que se pide de una en una.
 */
const getAllExercises = async (req, res) => {
    try {
        // Nos aseguramos de que el catálogo base esté al día sin que el usuario
        // tenga que llamar a /seed a mano (solo hace trabajo si falta algo).
        await syncExerciseCatalog();

        const { muscle, q, all } = req.query;
        const busqueda = (q || '').trim();
        const grupo = muscle && muscle !== 'Todos' ? muscle : null;

        // ¿Hay que salir del catálogo base? Sólo si el usuario ha pedido algo.
        const ampliar = !!busqueda || !!grupo || all === '1';

        const query = {
            $or: [{ user: req.user._id }, { isCustom: false }, { user: null }]
        };
        if (grupo) query.muscle = grupo;
        if (busqueda) query.name = new RegExp(escaparRegex(busqueda), 'i');
        // Los propios del usuario se ven siempre, estén o no en el catálogo base
        if (!ampliar) query.$and = [{ $or: [{ isCore: true }, { isCustom: true }] }];

        const exercises = await Exercise.find(query)
            .select('-instructions')
            // Primero los de siempre, y dentro de cada bloque por nombre
            .sort({ isCore: -1, name: 1 })
            .limit(ampliar ? LIMITE_BUSQUEDA : 0)
            .lean();

        res.json(exercises);
    } catch (error) {
        res.status(500).json({ message: 'Error cargando ejercicios' });
    }
};

/**
 * Ficha completa de un ejercicio: es la única que trae las instrucciones.
 */
const getExerciseById = async (req, res) => {
    try {
        const ejercicio = await Exercise.findOne({
            _id: req.params.id,
            $or: [{ user: req.user._id }, { isCustom: false }, { user: null }]
        }).lean();

        if (!ejercicio) return res.status(404).json({ message: 'Ejercicio no encontrado' });
        res.json(ejercicio);
    } catch (error) {
        res.status(500).json({ message: 'Error cargando el ejercicio' });
    }
};

const createCustomExercise = async (req, res) => {
    try {
        const { name, muscle, muscleDetail, secondary, equipment } = req.body;
        if (!name) return res.status(400).json({ message: 'Falta el nombre del ejercicio' });
        if (!muscle && !muscleDetail) return res.status(400).json({ message: 'Falta el músculo' });

        // `muscle` acaba guardando SIEMPRE un grupo válido, que es lo que usan
        // las estadísticas del cuerpo. Si llega un músculo concreto se deriva su
        // grupo padre; si no se reconoce, se respeta el grupo recibido en vez de
        // caer en el genérico y mandar el ejercicio a un grupo equivocado.
        const grupoBase = resolveMuscleGroup(muscle);
        const grupo = resolveMuscleGroup(muscleDetail || muscle, grupoBase);
        const detalle = muscleDetail && isSpecificMuscle(muscleDetail) ? muscleDetail.trim() : '';

        // Músculos secundarios: reciben una fracción del volumen en los rangos.
        // Es lo que permite que un press militar cuente para hombro Y para pecho.
        const secundarios = [...new Set(
            (Array.isArray(secondary) ? secondary : [])
                .map(s => resolveMuscleGroup(s, null))
                .filter(g => g && g !== grupo)
        )];

        const nombreLimpio = String(name).trim().slice(0, 60);
        const yaExiste = await Exercise.findOne({
            name: new RegExp(`^${nombreLimpio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            $or: [{ user: req.user._id }, { isCustom: false }, { user: null }]
        }).lean();
        if (yaExiste) return res.status(409).json({ message: 'Ya existe un ejercicio con ese nombre' });

        // Sin esto el ejercicio se guardaba con equipment 'Barra' (el defecto del
        // esquema) pero equipmentGroup 'Otros', y aparecía en la sección
        // equivocada del selector.
        const equipo = equipment || 'Barra';

        const exercise = await Exercise.create({
            name: nombreLimpio,
            muscle: grupo,
            muscleDetail: detalle,
            secondary: secundarios,
            equipment: equipo,
            equipmentGroup: familiaDe(equipo),
            category: 'strength',
            user: req.user._id,
            isCustom: true
        });

        res.status(201).json(exercise);
    } catch (error) {
        console.error('Error creando ejercicio:', error);
        res.status(500).json({ message: 'Error creando ejercicio' });
    }
};

// @desc  Rangos de cada grupo muscular (nivel según kg, reps y constancia)
// @route GET /api/gym/muscle-ranks
const getMuscleRanksController = async (req, res) => {
    try {
        const ranks = await getMuscleRanks(req.user._id);
        res.json({ ranks, tiers: RANKS });
    } catch (error) {
        console.error('Error en getMuscleRanks:', error);
        res.status(500).json({ message: 'Error calculando los rangos musculares' });
    }
};

// @desc  Catálogo de músculos para que el frontend pinte los selectores
// @route GET /api/gym/muscles
const getMuscleCatalog = async (req, res) => {
    // Ya no hay modo normal/pro: siempre se ven los 8 grupos y, al crear un
    // ejercicio, los músculos secundarios que quieras añadirle.
    res.json({
        groups: MUSCLE_GROUPS,
        specific: SPECIFIC_MUSCLES,
        // El orden de las secciones de equipamiento lo manda el servidor, para
        // que no haya dos listas que mantener en sitios distintos.
        equipmentGroups: FAMILIAS
    });
};

/**
 * Sincroniza el catálogo base de ejercicios.
 *
 * Antes solo sembraba si la colección estaba VACÍA, así que ampliar la lista no
 * servía de nada (los ejercicios nuevos no llegaban nunca). Ahora hace upsert
 * por nombre, igual que el catálogo de la tienda, y respeta los ejercicios
 * personalizados del usuario (isCustom: true), que nunca se tocan.
 */
// Huella del catálogo: si cambia cualquier dato (músculo, secundarios,
// equipamiento...) cambia la huella y se vuelve a sincronizar.
// ⚠️ Antes se comparaba solo el NÚMERO de ejercicios, así que corregir los
// músculos de un ejercicio que ya existía no llegaba nunca a la base de datos:
// el catálogo seguía teniendo la versión vieja para siempre.
const CATALOG_FINGERPRINT = require('crypto')
    .createHash('sha1')
    .update(JSON.stringify(EXERCISE_CATALOG))
    .digest('hex');

const CLAVE_HUELLA_CATALOGO = 'catalogo-ejercicios';
let ultimaHuellaSincronizada = null;

const syncExerciseCatalog = async ({ force = false } = {}) => {
    if (!force && ultimaHuellaSincronizada === CATALOG_FINGERPRINT) {
        return { synced: false, total: EXERCISE_CATALOG.length };
    }

    // ⚠️ La marca de "ya esta sincronizado" vivia SOLO en memoria, asi que se
    // perdia en cada reinicio y el arranque reescribia los 1.292 ejercicios otra
    // vez. Medido: un segundo entero de arranque y miles de escrituras que no
    // cambiaban nada.
    //
    // En Render gratuito la instancia se reinicia a menudo, y el arranque en frio
    // es justo lo que mas se sufre en esta app. Con la huella guardada en la base,
    // un reinicio con el catalogo intacto no escribe nada.
    if (!force) {
        try {
            const guardada = await SystemState.findOne({ key: CLAVE_HUELLA_CATALOGO }).lean();
            if (guardada?.value === CATALOG_FINGERPRINT) {
                ultimaHuellaSincronizada = CATALOG_FINGERPRINT;
                return { synced: false, total: EXERCISE_CATALOG.length };
            }
        } catch (e) {
            // Si no se puede leer, se sincroniza igual: es lento, pero deja el
            // catalogo correcto, que es lo que importa.
            console.warn('No se pudo leer la huella del catalogo:', e.message);
        }
    }

    // El filtro sigue siendo el NOMBRE, no el slug: las rutinas y el historial
    // de entrenos referencian los ejercicios por nombre, así que los 82 de
    // siempre tienen que seguir siendo el mismo documento y conservar su _id.
    await Exercise.bulkWrite(EXERCISE_CATALOG.map(ex => {
        const campos = {
            name: ex.name,
            muscle: ex.muscle,
            muscleDetail: ex.muscleDetail || '',
            secondary: ex.secondary || [],
            equipment: ex.equipment || 'Barra',
            equipmentGroup: ex.equipmentGroup || familiaDe(ex.equipment),
            isCardio: !!ex.isCardio,
            category: ex.isCardio ? 'cardio' : 'strength',
            slug: ex.slug || null,
            gif: ex.gif || '',
            thumb: ex.thumb || '',
            instructions: ex.instructions || [],
            bodyPart: ex.bodyPart || '',
            isCore: !!ex.isCore,
            isCustom: false,
            user: null
        };

        // `shares` (reparto del esfuerzo por músculo concreto) sólo lo traen los
        // ejercicios curados, y es lo que usan los rangos musculares. La clave
        // se añade SÓLO si existe: ponerla a `undefined` para los demás la
        // guardaba como null y dejaba sin reparto a ejercicios que sí lo tenían.
        if (ex.shares) campos.shares = ex.shares;

        return {
            updateOne: {
                filter: { name: ex.name, isCustom: { $ne: true } },
                update: { $set: campos },
                upsert: true
            }
        };
    }), { ordered: false });

    // 🧹 LIMPIEZA: fuera los del catálogo BASE que ya no están en la lista.
    //
    // El sync sólo hacía upsert, nunca borraba: un ejercicio retirado del
    // catálogo se quedaba en la base para siempre y seguía saliendo en el
    // selector. Así se acumularon los restos de versiones anteriores.
    //
    // ⚠️ Sólo toca los del sistema (isCustom !== true). Los que crea el usuario
    // NO se borran jamás, aunque no estén en el catálogo: son suyos.
    const nombresDelCatalogo = EXERCISE_CATALOG.map(ex => ex.name);
    const borrados = await Exercise.deleteMany({
        isCustom: { $ne: true },
        name: { $nin: nombresDelCatalogo }
    });

    ultimaHuellaSincronizada = CATALOG_FINGERPRINT;

    // Se anota DESPUES de escribir: si el proceso muere a medias, el siguiente
    // arranque vuelve a sincronizar en vez de dar por bueno un catalogo incompleto.
    try {
        await SystemState.updateOne(
            { key: CLAVE_HUELLA_CATALOGO },
            { $set: { value: CATALOG_FINGERPRINT, updatedAt: new Date() } },
            { upsert: true }
        );
    } catch (e) {
        console.warn('No se pudo guardar la huella del catalogo:', e.message);
    }
    return { synced: true, total: EXERCISE_CATALOG.length, borrados: borrados.deletedCount };
};

const seedExercises = async (req, res) => {
    try {
        // Llamarlo a mano siempre reescribe, para poder forzar la corrección
        const result = await syncExerciseCatalog({ force: true });
        res.json({
            message: result.synced
                ? `Catálogo sincronizado (${result.total} ejercicios${result.borrados ? `, ${result.borrados} retirados` : ''})`
                : 'El catálogo ya está al día',
            total: result.total,
            borrados: result.borrados || 0
        });
    } catch (error) {
        console.error('Error en seed de ejercicios:', error);
        res.status(500).json({ message: 'Error en seed' });
    }
};

// ==========================================
// 7. GUARDAR LOG DE GYM (IA OPTIMIZADA)
// ==========================================
/**
 * Qué tocará el próximo día, calculado con la sesión que se acaba de guardar.
 *
 * Se manda en la respuesta del guardado, no en una petición aparte, por dos
 * razones. La primera es que es el único momento en que hace falta: es lo que
 * cierra el resumen del entreno. La segunda es el servidor gratuito, que tarda
 * en despertar: pedirlo por separado justo al terminar significaría una pantalla
 * de resumen esperando medio minuto a una frase.
 *
 * La regla vive en el servidor y solo en el servidor —ver progresionService—.
 * La pantalla podría calcularla sola, pero entonces habría dos copias de la
 * misma regla, y el día que cambie una se quedaría la otra diciendo otra cosa.
 *
 * Si algo falla, se devuelve un objeto vacío: el entreno YA está guardado y una
 * frase de más no puede tumbar la respuesta que confirma eso.
 */
const queTocaraLaProximaVez = async (userId, routineId, ejercicios, logGuardado) => {
    try {
        const porNombre = {};
        if (routineId) {
            const rutina = await Routine.findOne({ _id: routineId, user: userId })
                .select('exercises').lean();
            for (const ex of (rutina?.exercises || [])) porNombre[ex.name] = ex;
        }

        // Las sesiones ANTERIORES de cada ejercicio, para poder decir "llevas
        // tres semanas clavado, baja el peso". Sin esto, esta pantalla proponia
        // repetir el mismo peso y al entrar al entreno la app decia otra cosa:
        // dos numeros distintos para la misma pregunta.
        //
        // Una sola consulta para todos los ejercicios, y del reves (de la mas
        // nueva a la mas vieja) para poder cortar por las que hacen falta. Se le
        // da la vuelta despues, que es como lo espera la progresion.
        const nombres = (ejercicios || []).map(e => e.name);
        const anteriores = {};
        if (nombres.length > 0) {
            const previos = await WorkoutLog.find({
                user: userId,
                _id: { $ne: logGuardado },        // la de hoy va aparte
                'exercises.name': { $in: nombres }
            })
                .select('date exercises.name exercises.sets')
                .sort({ date: -1 })
                .limit(SESIONES_QUE_SE_MIRAN * 3)   // margen: no todos los ejercicios salen en todos
                .lean();

            for (const log of previos) {
                for (const ex of (log.exercises || [])) {
                    if (!nombres.includes(ex.name)) continue;
                    if (!anteriores[ex.name]) anteriores[ex.name] = [];
                    if (anteriores[ex.name].length >= SESIONES_QUE_SE_MIRAN) continue;
                    anteriores[ex.name].push((ex.sets || []).map(x => ({ weight: x.weight, reps: x.reps })));
                }
            }
        }

        const salida = {};
        for (const ex of (ejercicios || [])) {
            const config = porNombre[ex.name] || {};
            const previas = (anteriores[ex.name] || []).slice().reverse();
            const propuesta = sugerirSiguiente({ reps: config.reps }, ex.sets || [], previas);
            if (!propuesta) continue;

            // Las mismas traducciones que en el historial: lo que se guarda es lo
            // que de verdad se movió, y lo que se enseña es lo que se escribe.
            if (config.esPesoCorporal) {
                const pesado = await DailyLog.findOne({ user: userId, weight: { $gt: 0 } })
                    .sort({ date: -1 }).lean();
                propuesta.peso = Math.max(0, Math.round((propuesta.peso - (pesado?.weight || 75)) * 2) / 2);
            }
            if (config.esPorTiempo) {
                propuesta.reps = Math.round(propuesta.reps * SEGUNDOS_POR_REPETICION);
            } else if ((ex.sets || []).some(x => x.porLado)) {
                propuesta.reps = Math.round(propuesta.reps / 2);
            }

            salida[ex.name] = propuesta;
        }
        return salida;
    } catch (e) {
        console.error('No se pudo calcular la proxima sesion:', e.message);
        return {};
    }
};

// Sesiones que se guardan de cada ejercicio para decidir si estas atascado. Con
// tres seguidas se descarga, asi que con cuatro sobra; guardar el historial
// entero seria mandarle al movil meses de series para mirar tres.
const SESIONES_QUE_SE_MIRAN = 4;

const saveWorkoutLog = async (req, res) => {
    try {
        const { routineId, routineName, duration, exercises, intensity, photo, clienteId } = req.body;

        // ⚠️ EL MISMO ENTRENO NO SE GUARDA DOS VECES.
        //
        // Esto va lo PRIMERO, antes de tocar nada: el resto de la funcion da
        // XP, sube rangos, paga monedas y escribe en el registro del dia.
        // Repetirlo seria regalar todo eso.
        //
        // Hace falta porque el movil puede reintentar: si se guarda bien pero
        // la respuesta se pierde por el camino (cobertura de gimnasio,
        // ascensor, el servidor durmiendose), la app no tiene forma de saber si
        // llego. Sin esta comprobacion, la unica salida segura seria no
        // reintentar nunca y perder el entreno.
        if (clienteId) {
            const yaGuardado = await WorkoutLog.findOne({ user: req.user._id, clienteId }).lean();
            if (yaGuardado) {
                // Se responde 200 y no 201: no se ha creado nada. Para la app es
                // un exito igual, que es lo que importa — su entreno esta a salvo.
                //
                // No se devuelven rankUps: los premios ya se dieron en el envio
                // bueno. Volver a mandarlos relanzaria la animacion de subida de
                // rango por algo que ya paso.
                return res.status(200).json({
                    message: 'Este entreno ya estaba guardado',
                    log: yaGuardado,
                    duplicado: true,
                    rankUps: []
                });
            }
        }

        // Se usan estas y no `duration`/`exercises` a partir de aqui: lo que
        // llega del movil alimenta las calorias (y de ahi el XP) y el volumen
        // (y de ahi el rango muscular, que paga monedas).
        const duracionSegura = minutosSeguros(Number(duration) / 60) * 60;

        // El peso corporal hace falta ANTES de limpiar las series: en los
        // ejercicios de peso corporal es lo que decide cuánto has movido.
        const pesoRegistrado = await DailyLog.findOne({ user: req.user._id, weight: { $gt: 0 } })
            .sort({ date: -1 }).lean();
        const pesoUsuario = pesoRegistrado ? pesoRegistrado.weight : 75;

        const ejercicios = ejerciciosSeguros(exercises, pesoUsuario);

        // El volumen de esta sesion decide el rango muscular, y el rango paga
        // monedas. Por encima de este techo no hay entreno posible: hay alguien
        // mandando numeros a mano.
        const volumenSesion = volumenDe(ejercicios);
        if (volumenSesion > MAX_VOLUMEN_SESION) {
            return res.status(400).json({
                message: 'Esos pesos y repeticiones no cuadran con un entreno real. Revisalos.'
            });
        }

        // 📸 La foto llega ya comprimida desde el móvil. Aquí solo validamos:
        // ~400 KB en base64 es el techo, para que la base de datos no se dispare.
        let fotoFinal = '';
        if (photo) {
            if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
                return res.status(400).json({ message: 'Formato de imagen no válido' });
            }
            if (photo.length > 400 * 1024) {
                return res.status(413).json({ message: 'La foto pesa demasiado. Inténtalo de nuevo.' });
            }
            fotoFinal = photo;
        }

        // 💪 Músculos trabajados: se derivan EN EL SERVIDOR desde el catálogo,
        // no de lo que diga el cliente (que podría mentir para inflar rangos).
        const nombres = ejercicios.map(e => (e.name || '').toLowerCase());
        const fichas = await Exercise.find({
            $or: [{ user: req.user._id }, { isCustom: false }, { user: null }]
        }).select('name muscle secondary').lean();

        const principales = new Set();
        const secundarios = new Set();
        fichas.forEach(f => {
            if (!nombres.includes(f.name.toLowerCase())) return;
            principales.add(resolveMuscleGroup(f.muscle));
            (f.secondary || []).forEach(s => secundarios.add(resolveMuscleGroup(s)));
        });
        // Un músculo principal no debe aparecer también como secundario
        principales.forEach(m => secundarios.delete(m));

        // 🏆 RÉCORDS PERSONALES
        // Se comparan los kilos de esta sesión con el máximo histórico de cada
        // ejercicio ANTES de guardar este log (si no, el propio entreno sería su
        // propio récord). Solo cuenta si ya había marca previa: la primera vez
        // que haces un ejercicio no es una mejora, es un punto de partida.
        const nombresReales = ejercicios.map(e => e.name).filter(Boolean);
        const marcasPrevias = await WorkoutLog.aggregate([
            { $match: { user: req.user._id, 'exercises.name': { $in: nombresReales } } },
            { $unwind: '$exercises' },
            { $match: { 'exercises.name': { $in: nombresReales } } },
            { $unwind: '$exercises.sets' },
            { $group: { _id: '$exercises.name', max: { $max: '$exercises.sets.weight' } } }
        ]);
        const maxPrevio = {};
        marcasPrevias.forEach(m => { maxPrevio[m._id] = m.max || 0; });

        const records = [];
        ejercicios.forEach(ex => {
            const sets = ex.sets || [];
            if (!sets.length) return;
            const mejor = sets.reduce((a, s) => (s.weight > a.weight ? s : a), sets[0]);
            const anterior = maxPrevio[ex.name];
            if (anterior > 0 && mejor.weight > anterior) {
                records.push({ name: ex.name, weight: mejor.weight, reps: mejor.reps, previous: anterior });
            }
        });

        // Ya se busco arriba, para poder calcular el peso de las series de peso
        // corporal antes de limpiarlas.
        const userWeight = pesoUsuario;

        let caloriesBurned = 0;

        const exercisesDescription = ejercicios.map(ex => {
            const setsDesc = ex.sets.map(s => `${s.weight}kg x ${s.reps}`).join(', ');
            return `- ${ex.name}: [${setsDesc}]`;
        }).join('\n');

        const prompt = `
            Calcula las calorías NETAS quemadas en esta sesión de pesas.
            - Peso Atleta: ${userWeight} kg
            - Duración: ${Math.floor(duracionSegura / 60)} min
            - Intensidad: ${intensity}
            - Ejercicios:
            ${exercisesDescription}

            Sé conservador. El gym quema menos que el cardio.
            Responde SOLO JSON: { "calories": numero_entero }
        `;

        const ai = await askAI({
            system: prompt,
            temperature: 0.1,
            validate: (d) => typeof d.calories === 'number' && d.calories > 0
        });

        const durationMin = duracionSegura / 60;

        if (ai.ok) {
            caloriesBurned = Math.round(ai.data.calories);
        } else {
            // Plan B determinista: estimación por duración, intensidad y peso
            let factor = 3.5;
            if (intensity === 'Baja') factor = 2.5;
            if (intensity === 'Alta') factor = 6;
            caloriesBurned = Math.round(durationMin * factor * (userWeight / 75));
        }

        // La IA se valida solo con "> 0", y su prompt lleva datos del cliente:
        // el techo se aplica igual venga de donde venga.
        caloriesBurned = caloriasSeguras(caloriesBurned, durationMin);

        const log = await WorkoutLog.create({
            user: req.user._id, routine: routineId, routineName: routineName || 'Entrenamiento Libre',
            clienteId: clienteId || undefined,
            duration: duracionSegura, exercises: ejercicios, type: 'gym', intensity: intensity || 'Media', caloriesBurned, date: new Date(),
            photo: fotoFinal,
            musclesWorked: [...principales],
            secondaryMuscles: [...secundarios],
            records
        });

        avisarAmigosDelEntreno(req.user._id, routineName || 'Entrenamiento Libre');

        const today = getTodayDateString();

        await DailyLog.findOneAndUpdate(
            { user: req.user._id, date: today },
            {
                $push: {
                    gymWorkouts: {
                        name: routineName, duration: duracionSegura, caloriesBurned: caloriesBurned, intensity: intensity || 'Media',
                        exercises: ejercicios.map(ex => ({ name: ex.name, sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })) })),
                        timestamp: new Date()
                    }
                }
            },
            { upsert: true }
        );

        // El entreno da XP y NADA mas, a proposito:
        //  - Monedas: ya daba 0. La tienda se gana con constancia (misiones),
        //    no con una sesion suelta.
        //  - Fichas: se quitan. Daban ~175 por entreno y con las misiones se
        //    juntaban mas de 1.000 al dia; con apuesta minima de 10, el casino
        //    no costaba nada. Las fichas se ganan jugando y en la racha diaria.
        //  - XP: se queda. Es una app de gimnasio; que entrenar no mueva el
        //    nivel seria contraintuitivo, y el premio grande del entreno son
        //    los rangos musculares.
        const xpReward = Math.max(5, Math.ceil(caloriesBurned * 0.50));
        const gameCoinsReward = 0;

        const result = await levelService.addRewards(req.user._id, xpReward, 0, gameCoinsReward);

        // ¿Ha subido de rango algun grupo muscular con este entreno? Es el
        // premio grande del gimnasio, y se cobra aqui una sola vez.
        const { subidas, monedas, user: usuarioTrasPremio } = await revisarSubidasDeRango(req.user._id);

        res.status(201).json({
            message: `Entreno guardado: ${caloriesBurned} kcal`,
            log,
            user: usuarioTrasPremio || result.user,
            leveledUp: result.leveledUp,
            // El frontend usa esto para lanzar el aviso de subida de rango
            rankUps: subidas,
            rankUpCoins: monedas,
            // Y lo que tocara el proximo dia de cada ejercicio
            proximaVez: await queTocaraLaProximaVez(req.user._id, routineId, ejercicios, log._id)
        });
    } catch (error) {
        // Dos reintentos que salen a la vez pasan los dos la comprobacion de
        // arriba antes de que ninguno escriba; el indice unico para al segundo.
        // No es un error: es la red haciendo su trabajo, y el entreno del
        // usuario esta guardado.
        if (error?.code === 11000) {
            const yaGuardado = await WorkoutLog.findOne({
                user: req.user._id, clienteId: req.body?.clienteId
            }).lean();
            return res.status(200).json({
                message: 'Este entreno ya estaba guardado',
                log: yaGuardado, duplicado: true, rankUps: []
            });
        }
        console.error(error);
        res.status(500).json({ message: 'Error guardando entrenamiento' });
    }
};

const saveSportLog = async (req, res) => {
    try {
        const { sportId, name, time, intensity, distance, calories } = req.body;

        const minutos = minutosSeguros(time);
        if (minutos <= 0) return res.status(400).json({ message: 'Indica cuántos minutos has entrenado' });

        const sport = getSport(sportId);
        const nombreFinal = (name || sport?.name || 'Actividad').trim();

        const lastWeightLog = await DailyLog.findOne({ user: req.user._id, weight: { $gt: 0 } }).sort({ date: -1 }).lean();
        const userWeight = lastWeightLog ? lastWeightLog.weight : 75;

        // Estimación propia por MET: sirve de plan B y de tope de cordura
        const estimadas = estimateCalories({ sportId, minutes: minutos, weightKg: userWeight, intensity });

        let caloriesBurned;
        let origen;

        if (Number(calories) > 0) {
            // 1º Las que trae el usuario (reloj / pulsómetro): mandan, pero con
            // techo. Un reloj puede discrepar de la fórmula MET; lo que no puede
            // es decir que has quemado un millón en media hora.
            caloriesBurned = caloriasSeguras(calories, minutos);
            origen = 'reloj';
        } else {
            const prompt = `Calcula calorías NETAS (sin basal) para:
            - Actividad: "${nombreFinal}" - Tiempo: ${minutos} min - Intensidad: ${intensity} - Peso: ${userWeight} kg - Distancia: ${distance || 'N/A'}
            Responde SOLO JSON: { "calories": numero_entero }`;

            const ai = await askAI({
                system: prompt,
                temperature: 0.1,
                // Se descarta cualquier disparate: la IA a veces devuelve 5.000 kcal
                // por media hora de yoga. Solo vale si está entre la mitad y el
                // triple de lo que dice la fórmula MET.
                validate: (d) => typeof d.calories === 'number'
                    && d.calories > estimadas * 0.4
                    && d.calories < estimadas * 3
            });

            if (ai.ok) {
                caloriesBurned = Math.round(ai.data.calories);
                origen = 'ia';
            } else {
                caloriesBurned = estimadas;
                origen = 'formula';
            }
        }

        const log = await WorkoutLog.create({
            user: req.user._id, routineName: nombreFinal, duration: minutos * 60, intensity, distance, type: 'sport', caloriesBurned, date: new Date()
        });

        avisarAmigosDelEntreno(req.user._id, nombreFinal);

        await DailyLog.findOneAndUpdate(
            { user: req.user._id, date: getTodayDateString() },
            { $push: { sportWorkouts: { routineName: nombreFinal, duration: minutos, intensity, distance, caloriesBurned, timestamp: new Date() } } },
            { upsert: true }
        );

        // El entreno da XP y NADA mas, a proposito:
        //  - Monedas: ya daba 0. La tienda se gana con constancia (misiones),
        //    no con una sesion suelta.
        //  - Fichas: se quitan. Daban ~175 por entreno y con las misiones se
        //    juntaban mas de 1.000 al dia; con apuesta minima de 10, el casino
        //    no costaba nada. Las fichas se ganan jugando y en la racha diaria.
        //  - XP: se queda. Es una app de gimnasio; que entrenar no mueva el
        //    nivel seria contraintuitivo, y el premio grande del entreno son
        //    los rangos musculares.
        const xpReward = Math.max(5, Math.ceil(caloriesBurned * 0.50));
        const gameCoinsReward = 0;
        const result = await levelService.addRewards(req.user._id, xpReward, 0, gameCoinsReward);

        res.status(201).json({
            message: `Registrado: ${caloriesBurned} kcal`,
            calorieSource: origen,   // reloj | ia | formula, para poder avisar en pantalla
            log, user: result.user, leveledUp: result.leveledUp
        });
    } catch (error) {
        console.error('Error en saveSportLog:', error);
        res.status(500).json({ message: 'Error registrando deporte' });
    }
};

// @desc    Catálogo de deportes para la pestaña "Otros"
// @route   GET /api/gym/sports
const getSportCatalog = async (req, res) => {
    res.json(SPORTS);
};

// @desc    Progreso histórico de un ejercicio (para las gráficas)
// @route   GET /api/gym/progress/:name
const getExerciseProgressController = async (req, res) => {
    try {
        const data = await getExerciseProgress(req.user._id, req.params.name);
        res.json(data);
    } catch (error) {
        console.error('Error en getExerciseProgress:', error);
        res.status(500).json({ message: 'Error cargando el progreso' });
    }
};

// @desc    Ejercicios que el usuario ha hecho alguna vez (para elegir gráfica)
// @route   GET /api/gym/progress
const getTrainedExercises = async (req, res) => {
    try {
        const filas = await WorkoutLog.aggregate([
            { $match: { user: req.user._id, type: 'gym' } },
            { $unwind: '$exercises' },
            { $group: { _id: '$exercises.name', sesiones: { $sum: 1 }, ultima: { $max: '$date' } } },
            { $sort: { sesiones: -1 } },
            { $limit: 60 }
        ]);
        res.json(filas.map(f => ({ name: f._id, sessions: f.sesiones, last: f.ultima })));
    } catch (error) {
        console.error('Error en getTrainedExercises:', error);
        res.status(500).json({ message: 'Error cargando ejercicios' });
    }
};

const getWeeklyStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date();
        const diffToMonday = today.getDay() === 0 ? -6 : 1 - today.getDay();
        const startOfThisWeek = new Date(today);
        startOfThisWeek.setHours(0, 0, 0, 0);
        startOfThisWeek.setDate(today.getDate() + diffToMonday);
        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

        const stats = await WorkoutLog.aggregate([
            { $match: { user: userId, type: 'gym', date: { $gte: startOfLastWeek } } },
            { $unwind: "$exercises" },
            { $unwind: "$exercises.sets" },
            {
                $group: {
                    _id: null,
                    currentVolume: {
                        $sum: { $cond: [{ $gte: ["$date", startOfThisWeek] }, { $multiply: [{ $ifNull: ["$exercises.sets.weight", 0] }, { $ifNull: ["$exercises.sets.reps", 0] }] }, 0] }
                    },
                    lastVolume: {
                        $sum: { $cond: [{ $lt: ["$date", startOfThisWeek] }, { $multiply: [{ $ifNull: ["$exercises.sets.weight", 0] }, { $ifNull: ["$exercises.sets.reps", 0] }] }, 0] }
                    }
                }
            }
        ]);

        const result = stats[0] || { currentVolume: 0, lastVolume: 0 };
        let percentage = 0;
        if (result.lastVolume > 0) percentage = ((result.currentVolume - result.lastVolume) / result.lastVolume) * 100;
        else if (result.currentVolume > 0) percentage = 100;

        res.json({ currentVolume: result.currentVolume, percentage: Math.round(percentage) });

    } catch (error) {
        res.status(500).json({ message: 'Error calculando stats semanales' });
    }
};

// ==========================================
// 🔥 OPTIMIZACIÓN DE MEMORIA: .lean() y .select()
// ==========================================
const getMuscleProgress = async (req, res) => {
    try {
        const { muscle } = req.query;
        const userId = req.user._id;

        const exercises = await Exercise.find({
            muscle: muscle,
            $or: [{ user: userId }, { isCustom: false }, { user: null }]
        }).select('name').lean();

        const exerciseNames = exercises.map(e => e.name);

        // SOLO traemos fecha y los sets de los ejercicios específicos, nada de documentos completos
        const logs = await WorkoutLog.find({
            user: userId,
            'exercises.name': { $in: exerciseNames }
        })
            .select('date exercises.name exercises.sets')
            .sort({ date: 1 })
            .lean();

        const history = logs.map(log => {
            let sessionVolume = 0;
            log.exercises.forEach(ex => {
                if (exerciseNames.includes(ex.name)) {
                    ex.sets.forEach(s => {
                        sessionVolume += (s.weight || 0) * (s.reps || 0);
                    });
                }
            });
            if (sessionVolume > 0) return { date: log.date, volume: sessionVolume };
            return null;
        }).filter(item => item !== null);

        res.json(history.slice(-10));

    } catch (error) {
        res.status(500).json({ message: 'Error cargando progreso muscular' });
    }
};

// 11. OBTENER HISTORIAL (🔥 BLINDADO CONTRA OOM)
const getRoutineHistory = async (req, res) => {
    try {
        const { exercises } = req.body;
        const userId = req.user._id;
        const stats = {};

        const calc1RM = (w, r) => {
            if (r === 0) return 0;
            if (r === 1) return w;
            return Math.round(w / (1.0278 - 0.0278 * r));
        };

        // 🔥 CRÍTICO: .lean() evita que Node.js colapse con miles de registros
        const logs = await WorkoutLog.find({
            user: userId,
            'exercises.name': { $in: exercises }
        })
            .select('date exercises.name exercises.sets exercises.esPorTiempo exercises.esPesoCorporal')
            .sort({ date: 1 })
            .lean();

        // Si se manda la rutina, sabemos ademas cuantas repeticiones pide en
        // cada ejercicio, que es lo que marca cuando esta completada una sesion.
        // Sin rutina se propone igual, con el rango de siempre (8-12).
        const configPorEjercicio = {};
        const banderasPorEjercicio = {};
        if (req.body?.routineId) {
            const rutina = await Routine.findOne({ _id: req.body.routineId, user: userId })
                .select('exercises').lean();
            for (const ex of (rutina?.exercises || [])) {
                configPorEjercicio[ex.name] = { reps: ex.reps };
            }
        }

        logs.forEach(log => {
            log.exercises.forEach(ex => {
                if (exercises.includes(ex.name)) {
                    if (!stats[ex.name]) {
                        stats[ex.name] = { lastSets: [], bestSet: { weight: 0, reps: 0, value1RM: 0 } };
                    }

                    // Las banderas del ejercicio, para saber cómo traducir
                    banderasPorEjercicio[ex.name] = {
                        esPorTiempo: !!ex.esPorTiempo,
                        esPesoCorporal: !!ex.esPesoCorporal,
                        porLado: (ex.sets || []).some(s => s.porLado)
                    };

                    // ⚠️ Se devuelve lo que el usuario ESCRIBIÓ, no lo que se guardó.
                    //
                    // Desde que existen los ejercicios por tiempo, de peso corporal
                    // y por lado, `weight` y `reps` guardan lo que de VERDAD se
                    // movió: el peso corporal ya sumado, las repeticiones de los dos
                    // lados, los segundos convertidos. Devolver eso tal cual para
                    // rellenar las casillas creaba una bola de nieve en cada sesión:
                    //
                    //   por lado    12 -> se guarda 24 -> la casilla muestra 24
                    //               -> se guarda 48 -> 96... se duplica cada vez
                    //   corporal    lastre 15 con 80 kg de peso -> se guarda 95
                    //               -> la casilla de lastre muestra 95 -> 175 -> 255
                    //   por tiempo  90 s -> se guarda 9 -> la casilla muestra 9 s
                    //               -> se guarda 0,9... se desploma a cero
                    //
                    // La conversión va aquí, en el ÚNICO sitio que alimenta las
                    // casillas, y no en la pantalla: así el móvil sigue sin tener
                    // que saber nada de cómo se guardan las cosas.
                    const validSets = ex.sets.map(s => ({
                        weight: ex.esPesoCorporal ? (s.lastre || 0) : s.weight,
                        reps: ex.esPorTiempo
                            ? (s.segundos || 0)
                            : (s.porLado ? Math.round((s.reps || 0) / 2) : s.reps)
                    }));
                    if (validSets.length > 0) {
                        stats[ex.name].lastSets = validSets;
                        // En bruto, para que la progresión compare peso real con
                        // peso real y no lastre con lastre.
                        stats[ex.name].brutas = ex.sets.map(s => ({ weight: s.weight, reps: s.reps }));

                        // Y las últimas sesiones, para saber si llevas varias
                        // clavado en el mismo peso. Los `logs` vienen ordenados
                        // de más viejo a más nuevo, así que esto se apila solo en
                        // el orden que espera la progresión.
                        if (!stats[ex.name].sesiones) stats[ex.name].sesiones = [];
                        stats[ex.name].sesiones.push(stats[ex.name].brutas);
                        if (stats[ex.name].sesiones.length > SESIONES_QUE_SE_MIRAN) {
                            stats[ex.name].sesiones.shift();
                        }
                    }

                    ex.sets.forEach(set => {
                        const rm = calc1RM(set.weight, set.reps);
                        if (rm > stats[ex.name].bestSet.value1RM) {
                            stats[ex.name].bestSet = { weight: set.weight, reps: set.reps, value1RM: rm };
                        }
                    });
                }
            });
        });

        // La sugerencia se calcula al final, cuando ya tenemos las ultimas series
        // de cada ejercicio. Va DENTRO del mismo endpoint y no en uno aparte para
        // no obligar al movil a hacer dos viajes justo al empezar a entrenar,
        // que es cuando el servidor gratuito peor responde.
        // El peso corporal hace falta para traducir la sugerencia de los
        // ejercicios de peso corporal: ahí lo que se escribe es el LASTRE.
        const pesoRegistrado = await DailyLog.findOne({ user: userId, weight: { $gt: 0 } })
            .sort({ date: -1 }).lean();
        const pesoUsuario = pesoRegistrado ? pesoRegistrado.weight : 75;

        for (const nombre of Object.keys(stats)) {
            // Un ejercicio que no esta en la rutina —uno cambiado sobre la marcha,
            // o el historial pedido sin rutina— se propone igual con el rango por
            // defecto. Antes se saltaba, y cambiar un ejercicio a mitad de entreno
            // te dejaba sin propuesta el resto de la sesion.
            const config = configPorEjercicio[nombre] || {};

            // La progresión razona sobre lo que de verdad se movió (por eso
            // recibe las series en bruto), pero lo que devuelve va a una casilla,
            // así que se traduce igual que arriba.
            // Las anteriores son todas menos la de hoy, que va aparte.
            const previas = (stats[nombre].sesiones || []).slice(0, -1);
            const sugerencia = sugerirSiguiente(config, stats[nombre].brutas || stats[nombre].lastSets, previas);
            if (!sugerencia) continue;

            const flags = banderasPorEjercicio[nombre] || {};

            if (flags.esPesoCorporal) {
                sugerencia.peso = Math.max(0, Math.round((sugerencia.peso - pesoUsuario) * 2) / 2);
            }
            if (flags.esPorTiempo) {
                sugerencia.reps = Math.round(sugerencia.reps * SEGUNDOS_POR_REPETICION);
            } else if (flags.porLado) {
                sugerencia.reps = Math.round(sugerencia.reps / 2);
            }

            stats[nombre].sugerencia = sugerencia;
            delete stats[nombre].brutas;
        }

        // `sesiones` era material de trabajo para decidir la descarga: no sale de
        // aquí. Mandarlo serían cuatro sesiones de cada ejercicio viajando al
        // móvil para que no las use nadie.
        for (const nombre of Object.keys(stats)) {
            delete stats[nombre].sesiones;
            delete stats[nombre].brutas;
        }

        res.json(stats);

    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({ message: 'Error obteniendo historial' });
    }
};

const seedFakeHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const allExercises = await Exercise.find({ $or: [{ user: userId }, { isCustom: false }, { user: null }] });
        const targetNames = allExercises.map(e => e.name);

        const dateOld = new Date(); dateOld.setDate(dateOld.getDate() - 15);
        await WorkoutLog.create({
            user: userId, type: 'gym', routineName: 'Entreno Inicio (Test)', duration: 3000, date: dateOld,
            exercises: targetNames.map(name => ({ name: name, sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 10 }] }))
        });

        const dateRecent = new Date(); dateRecent.setDate(dateRecent.getDate() - 7);
        await WorkoutLog.create({
            user: userId, type: 'gym', routineName: 'Entreno Progreso (Test)', duration: 3500, date: dateRecent,
            exercises: targetNames.map(name => ({ name: name, sets: [{ weight: 25, reps: 10 }, { weight: 30, reps: 8 }] }))
        });

        res.json({ message: `✅ Historial inyectado` });
    } catch (error) { res.status(500).json({ message: 'Error en seed: ' + error.message }); }
};

// 13. ESTADÍSTICAS DETALLADAS (🔥 BLINDADO)
const getExerciseHistory = async (req, res) => {
    try {
        const { exerciseName } = req.query;
        const userId = req.user._id;
        if (!exerciseName) return res.status(400).json({ message: 'Falta nombre' });

        const logs = await WorkoutLog.find({ user: userId, 'exercises.name': exerciseName })
            .select('date exercises.name exercises.sets')
            .sort({ date: 1 })
            .lean();

        const data = logs.map(log => {
            const exData = log.exercises.find(e => e.name === exerciseName);
            if (!exData) return null;
            let max1RM = 0; let maxWeight = 0;
            exData.sets.forEach(s => {
                const w = s.weight || 0; const r = s.reps || 0;
                if (w > maxWeight) maxWeight = w;
                const rm = r === 1 ? w : w * (1 + r / 30);
                if (rm > max1RM) max1RM = rm;
            });
            return {
                date: new Date(log.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
                pr: Math.round(max1RM),
                weight: maxWeight
            };
        }).filter(item => item !== null);

        res.json(data);
    } catch (error) { res.status(500).json({ message: 'Error cargando stats' }); }
};

const getBodyStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const sinceDate = new Date(); sinceDate.setDate(sinceDate.getDate() - 30);

        const logs = await WorkoutLog.find({ user: userId, type: 'gym', date: { $gte: sinceDate } })
            .select('exercises.name exercises.sets')
            .lean();

        const allExercises = await Exercise.find({ $or: [{ user: userId }, { isCustom: false }, { user: null }] }).lean();

        const exerciseToMuscle = {};
        allExercises.forEach(ex => { exerciseToMuscle[ex.name] = ex.muscle; });

        // Se construye desde el vocabulario único, así que incluye 'Glúteo':
        // antes estaba fuera de esta lista y esos ejercicios no contaban nunca.
        const muscleStats = MUSCLE_GROUPS.reduce((acc, g) => ({ ...acc, [g]: 0 }), {});

        logs.forEach(log => {
            log.exercises.forEach(ex => {
                const muscle = exerciseToMuscle[ex.name];
                if (muscle && muscleStats[muscle] !== undefined) { muscleStats[muscle] += ex.sets.length; }
            });
        });
        res.json(muscleStats);
    } catch (error) { res.status(500).json({ message: 'Error estado del cuerpo' }); }
};

const chatRoutineGenerator = async (req, res) => {
    // Lo que escribe el usuario acaba dentro del prompt: sin tope, cada peticion
    // podia arrastrar hasta 1 MB de texto a la cuenta de IA.
    const prompt = String(req.body.prompt || '').trim().slice(0, 300);

    const SYSTEM_PROMPT = `
    Eres un Entrenador Personal de Élite. TU OBJETIVO: Crear una rutina basada en: "${prompt}".
    REGLAS:
    1. Genera 5-7 ejercicios lógicos.
    2. Especifica el grupo muscular ("muscle") de entre: 'Pecho', 'Espalda', 'Pierna', 'Hombro', 'Bíceps', 'Tríceps', 'Abdomen', 'Cardio'.
    3. Devuelve SOLO JSON. FORMATO: { "name": "Nombre", "difficulty": "Novato|Guerrero|Leyenda", "exercises": [{ "name": "Press", "muscle": "Pecho", "sets": 4, "reps": "8-10", "rest": 90 }], "message": "Motivación" }
    `;

    const ai = await askAI({
        system: SYSTEM_PROMPT,
        temperature: 0.7,
        validate: (d) => Array.isArray(d.exercises) && d.exercises.length > 0
    });

    if (ai.ok) return res.json(ai.data);

    // Plan B: rutina full-body sensata en vez de dejar al usuario sin nada
    return res.json({
        name: "Rutina Full Body",
        difficulty: "Novato",
        message: "La IA no está disponible ahora mismo, te dejo una rutina base que puedes editar.",
        exercises: [
            { name: "Sentadilla", muscle: "Pierna", sets: 4, reps: "10-12", rest: 90 },
            { name: "Press Banca", muscle: "Pecho", sets: 4, reps: "8-10", rest: 90 },
            { name: "Remo con Barra", muscle: "Espalda", sets: 4, reps: "10-12", rest: 90 },
            { name: "Press Militar", muscle: "Hombro", sets: 3, reps: "10-12", rest: 60 },
            { name: "Curl de Bíceps", muscle: "Bíceps", sets: 3, reps: "12", rest: 60 },
            { name: "Plancha", muscle: "Abdomen", sets: 3, reps: "45s", rest: 45 }
        ]
    });
};

module.exports = {
    // Se exporta para poder sincronizar el catálogo en el arranque del servidor
    // (server.js), y no solo cuando el primer usuario abre la lista.
    syncExerciseCatalog,
    // Se exportan para poder comprobarlos sueltos: son la barrera entre lo que
    // manda el movil y el XP que se reparte.
    minutosSeguros, caloriasSeguras, ejerciciosSeguros, volumenDe, MAX_VOLUMEN_SESION,
    getRoutines, createRoutine, deleteRoutine, updateRoutine, copyWorkoutToRoutine,
    getAllExercises, getExerciseById, createCustomExercise, seedExercises, getMuscleCatalog, getMuscleRanksController,
    saveWorkoutLog, saveSportLog, getSportCatalog,
    getExerciseProgressController, getTrainedExercises,
    getWeeklyStats, getMuscleProgress, getRoutineHistory, seedFakeHistory, getExerciseHistory, getBodyStatus,
    chatRoutineGenerator
};