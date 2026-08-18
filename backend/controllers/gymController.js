const Routine = require('../models/Routine');
const Exercise = require('../models/Exercise');
const WorkoutLog = require('../models/WorkoutLog');
const DailyLog = require('../models/DailyLog');
const levelService = require('../services/levelService');

// 🔥 Toda la IA pasa por el servicio único (una sola cascada de modelos gratis)
const { askAI } = require('../services/aiService');

// 🔥 Fecha en hora de Madrid. Este fichero definía su propio
// `new Date().toISOString().split('T')[0]` (UTC), así que un entreno registrado
// entre las 00:00 y las 02:00 se guardaba en el día ANTERIOR.
const { getTodayDateString } = require('../utils/dateHelpers');
const { MUSCLE_GROUPS, SPECIFIC_MUSCLES, resolveMuscleGroup, isSpecificMuscle } = require('../utils/muscles');
const { FAMILIAS, familiaDe } = require('../utils/equipment');
// Catálogo completo (1292): los 141 curados de exerciseCatalog.js con su GIF
// enganchado, más la ampliación de ExerciseGymGifsDB. Lo genera a mano
// scripts/generateExerciseCatalog.js; aquí sólo se lee.
const EXERCISE_CATALOG = require('../data/exercises.json');
const { SPORTS, getSport, estimateCalories } = require('../utils/sportCatalog');
const { getMuscleRanks, getExerciseProgress, RANKS } = require('../services/muscleRankService');

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

const createRoutine = async (req, res) => {
    try {
        // `difficulty` se escribía aquí pero NO existe en el esquema de Routine,
        // así que Mongoose lo descartaba en silencio... y además nadie lo leía
        // en ninguna pantalla. Se elimina en vez de añadirlo: era campo muerto.
        const { name, exercises, color, defaultRest } = req.body;
        const routine = await Routine.create({
            user: req.user._id,
            name,
            color: color || 'blue',
            exercises,
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
        const { name, exercises, color } = req.body;
        let routine = await Routine.findById(req.params.id);
        if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
        if (routine.user.toString() !== req.user.id) return res.status(401).json({ message: 'No autorizado' });

        routine.name = name || routine.name;
        routine.exercises = exercises || routine.exercises;
        if (color) routine.color = color;

        const updatedRoutine = await routine.save();
        res.json(updatedRoutine);
    } catch (error) {
        res.status(500).json({ message: 'Error actualizando rutina' });
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

let ultimaHuellaSincronizada = null;

const syncExerciseCatalog = async ({ force = false } = {}) => {
    if (!force && ultimaHuellaSincronizada === CATALOG_FINGERPRINT) {
        return { synced: false, total: EXERCISE_CATALOG.length };
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
const saveWorkoutLog = async (req, res) => {
    try {
        const { routineId, routineName, duration, exercises, intensity, photo } = req.body;

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
        const nombres = (exercises || []).map(e => (e.name || '').toLowerCase());
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
        const nombresReales = (exercises || []).map(e => e.name).filter(Boolean);
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
        (exercises || []).forEach(ex => {
            const sets = ex.sets || [];
            if (!sets.length) return;
            const mejor = sets.reduce((a, s) => (s.weight > a.weight ? s : a), sets[0]);
            const anterior = maxPrevio[ex.name];
            if (anterior > 0 && mejor.weight > anterior) {
                records.push({ name: ex.name, weight: mejor.weight, reps: mejor.reps, previous: anterior });
            }
        });

        const lastWeightLog = await DailyLog.findOne({ user: req.user._id, weight: { $gt: 0 } }).sort({ date: -1 }).lean();
        const userWeight = lastWeightLog ? lastWeightLog.weight : 75;

        let caloriesBurned = 0;

        const exercisesDescription = exercises.map(ex => {
            const setsDesc = ex.sets.map(s => `${s.weight}kg x ${s.reps}`).join(', ');
            return `- ${ex.name}: [${setsDesc}]`;
        }).join('\n');

        const prompt = `
            Calcula las calorías NETAS quemadas en esta sesión de pesas.
            - Peso Atleta: ${userWeight} kg
            - Duración: ${Math.floor(duration / 60)} min
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

        if (ai.ok) {
            caloriesBurned = Math.round(ai.data.calories);
        } else {
            // Plan B determinista: estimación por duración, intensidad y peso
            const durationMin = duration / 60;
            let factor = 3.5;
            if (intensity === 'Baja') factor = 2.5;
            if (intensity === 'Alta') factor = 6;
            caloriesBurned = Math.round(durationMin * factor * (userWeight / 75));
        }

        const log = await WorkoutLog.create({
            user: req.user._id, routine: routineId, routineName: routineName || 'Entrenamiento Libre',
            duration, exercises, type: 'gym', intensity: intensity || 'Media', caloriesBurned, date: new Date(),
            photo: fotoFinal,
            musclesWorked: [...principales],
            secondaryMuscles: [...secundarios],
            records
        });

        const today = getTodayDateString();

        await DailyLog.findOneAndUpdate(
            { user: req.user._id, date: today },
            {
                $push: {
                    gymWorkouts: {
                        name: routineName, duration: duration, caloriesBurned: caloriesBurned, intensity: intensity || 'Media',
                        exercises: exercises.map(ex => ({ name: ex.name, sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })) })),
                        timestamp: new Date()
                    }
                }
            },
            { upsert: true }
        );

        const xpReward = Math.max(5, Math.ceil(caloriesBurned * 0.50));
        const gameCoinsReward = Math.max(5, Math.ceil(caloriesBurned * 0.35));

        const result = await levelService.addRewards(req.user._id, xpReward, 0, gameCoinsReward);

        res.status(201).json({ message: `Entreno guardado: ${caloriesBurned} kcal`, log, user: result.user, leveledUp: result.leveledUp });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error guardando entrenamiento' });
    }
};

const saveSportLog = async (req, res) => {
    try {
        const { sportId, name, time, intensity, distance, calories } = req.body;

        const minutos = Number(time) || 0;
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
            // 1º Las que trae el usuario (reloj / pulsómetro): mandan siempre
            caloriesBurned = Math.round(Number(calories));
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

        await DailyLog.findOneAndUpdate(
            { user: req.user._id, date: getTodayDateString() },
            { $push: { sportWorkouts: { routineName: nombreFinal, duration: minutos, intensity, distance, caloriesBurned, timestamp: new Date() } } },
            { upsert: true }
        );

        const xpReward = Math.max(5, Math.ceil(caloriesBurned * 0.50));
        const gameCoinsReward = Math.max(5, Math.ceil(caloriesBurned * 0.35));
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
            .select('date exercises.name exercises.sets')
            .sort({ date: 1 })
            .lean();

        logs.forEach(log => {
            log.exercises.forEach(ex => {
                if (exercises.includes(ex.name)) {
                    if (!stats[ex.name]) {
                        stats[ex.name] = { lastSets: [], bestSet: { weight: 0, reps: 0, value1RM: 0 } };
                    }

                    const validSets = ex.sets.map(s => ({ weight: s.weight, reps: s.reps }));
                    if (validSets.length > 0) {
                        stats[ex.name].lastSets = validSets;
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

        res.json(stats);

    } catch (error) {
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
    const { prompt } = req.body;

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
    getRoutines, createRoutine, deleteRoutine, updateRoutine,
    getAllExercises, getExerciseById, createCustomExercise, seedExercises, getMuscleCatalog, getMuscleRanksController,
    saveWorkoutLog, saveSportLog, getSportCatalog,
    getExerciseProgressController, getTrainedExercises,
    getWeeklyStats, getMuscleProgress, getRoutineHistory, seedFakeHistory, getExerciseHistory, getBodyStatus,
    chatRoutineGenerator
};