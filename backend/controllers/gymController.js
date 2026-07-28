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
        const { name, exercises, difficulty, color } = req.body;
        const routine = await Routine.create({
            user: req.user._id, name, color: color || 'blue', exercises, difficulty: difficulty || 'Guerrero'
        });
        res.status(201).json(routine);
    } catch (error) {
        res.status(500).json({ message: 'Error creando rutina' });
    }
};

const updateRoutine = async (req, res) => {
    try {
        const { name, exercises, difficulty, color } = req.body;
        let routine = await Routine.findById(req.params.id);
        if (!routine) return res.status(404).json({ message: 'Rutina no encontrada' });
        if (routine.user.toString() !== req.user.id) return res.status(401).json({ message: 'No autorizado' });

        routine.name = name || routine.name;
        routine.exercises = exercises || routine.exercises;
        if (difficulty) routine.difficulty = difficulty;
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

const getAllExercises = async (req, res) => {
    try {
        const { muscle } = req.query;
        let query = {};
        if (muscle && muscle !== 'Todos') query.muscle = muscle;

        const exercises = await Exercise.find({
            ...query,
            $or: [{ user: req.user._id }, { isCustom: false }, { user: null }]
        }).sort({ name: 1 }).lean(); // .lean() para que sea ultrarrápido

        res.json(exercises);
    } catch (error) {
        res.status(500).json({ message: 'Error cargando ejercicios' });
    }
};

const createCustomExercise = async (req, res) => {
    try {
        const { name, muscle, muscleDetail } = req.body;
        if (!name) return res.status(400).json({ message: 'Falta el nombre del ejercicio' });
        if (!muscle && !muscleDetail) return res.status(400).json({ message: 'Falta el músculo' });

        // En modo PRO llega `muscleDetail` (ej: 'Dorsal ancho') y derivamos su
        // grupo padre ('Espalda'); en modo normal llega ya el grupo. En ambos
        // casos `muscle` acaba guardando SIEMPRE un grupo válido, que es lo que
        // usan las estadísticas del cuerpo.
        const grupo = resolveMuscleGroup(muscleDetail || muscle);
        const detalle = muscleDetail && isSpecificMuscle(muscleDetail) ? muscleDetail.trim() : '';

        const exercise = await Exercise.create({
            name: String(name).trim().slice(0, 60),
            muscle: grupo,
            muscleDetail: detalle,
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

// @desc  Catálogo de músculos para que el frontend pinte los selectores
// @route GET /api/gym/muscles
const getMuscleCatalog = async (req, res) => {
    res.json({
        groups: MUSCLE_GROUPS,
        specific: SPECIFIC_MUSCLES,
        // El modo lo decide el usuario en Ajustes
        mode: req.user.gymMode || 'normal'
    });
};

const seedExercises = async (req, res) => {
    try {
        const count = await Exercise.countDocuments();
        if (count > 0) return res.json({ message: 'Ya existen ejercicios' });

        const basics = [
            { name: 'Press de Banca', muscle: 'Pecho', equipment: 'Barra' },
            { name: 'Sentadilla', muscle: 'Pierna', equipment: 'Barra' },
            { name: 'Peso Muerto', muscle: 'Espalda', equipment: 'Barra' },
            { name: 'Press Militar', muscle: 'Hombro', equipment: 'Barra' },
            { name: 'Dominadas', muscle: 'Espalda', equipment: 'Peso Corporal' },
            { name: 'Remo con Barra', muscle: 'Espalda', equipment: 'Barra' },
            { name: 'Curl de Bíceps', muscle: 'Bíceps', equipment: 'Barra' },
            { name: 'Fondos', muscle: 'Tríceps', equipment: 'Peso Corporal' }
        ];
        await Exercise.insertMany(basics);
        res.json({ message: 'Ejercicios base creados' });
    } catch (error) {
        res.status(500).json({ message: 'Error en seed' });
    }
};

// ==========================================
// 7. GUARDAR LOG DE GYM (IA OPTIMIZADA)
// ==========================================
const saveWorkoutLog = async (req, res) => {
    try {
        const { routineId, routineName, duration, exercises, intensity } = req.body;

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
            duration, exercises, type: 'gym', intensity: intensity || 'Media', caloriesBurned, date: new Date()
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
        const { name, time, intensity, distance } = req.body;
        const lastWeightLog = await DailyLog.findOne({ user: req.user._id, weight: { $gt: 0 } }).sort({ date: -1 }).lean();
        const userWeight = lastWeightLog ? lastWeightLog.weight : 75;
        let caloriesBurned = 0;

        const prompt = `Calcula calorías NETAS (sin basal) para:
            - Actividad: "${name}" - Tiempo: ${time} min - Intensidad: ${intensity} - Peso: ${userWeight} kg - Distancia: ${distance || 'N/A'}
            Responde SOLO JSON: { "calories": numero_entero }`;

        const ai = await askAI({
            system: prompt,
            temperature: 0.1,
            validate: (d) => typeof d.calories === 'number' && d.calories > 0
        });

        if (ai.ok) {
            caloriesBurned = Math.round(ai.data.calories);
        } else {
            // Plan B determinista: fórmula MET estándar
            const mets = intensity === 'Media' ? 6 : intensity === 'Alta' ? 8 : 4;
            caloriesBurned = Math.round(mets * userWeight * (time / 60));
        }

        const log = await WorkoutLog.create({
            user: req.user._id, routineName: name, duration: time * 60, intensity, distance, type: 'sport', caloriesBurned, date: new Date()
        });

        await DailyLog.findOneAndUpdate(
            { user: req.user._id, date: getTodayDateString() },
            { $push: { sportWorkouts: { routineName: name, duration: time, intensity, distance, caloriesBurned, timestamp: new Date() } } },
            { upsert: true }
        );

        const xpReward = Math.max(5, Math.ceil(caloriesBurned * 0.50));
        const gameCoinsReward = Math.max(5, Math.ceil(caloriesBurned * 0.35));
        const result = await levelService.addRewards(req.user._id, xpReward, 0, gameCoinsReward);

        res.status(201).json({ message: `Registrado: ${caloriesBurned} kcal`, log, user: result.user, leveledUp: result.leveledUp });
    } catch (error) {
        res.status(500).json({ message: 'Error registrando deporte' });
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
    getRoutines, createRoutine, deleteRoutine, updateRoutine,
    getAllExercises, createCustomExercise, seedExercises, getMuscleCatalog,
    saveWorkoutLog, saveSportLog,
    getWeeklyStats, getMuscleProgress, getRoutineHistory, seedFakeHistory, getExerciseHistory, getBodyStatus,
    chatRoutineGenerator
};