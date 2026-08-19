const express = require('express');
const router = express.Router();

const {
    getRoutines,
    createRoutine,
    deleteRoutine,
    copyWorkoutToRoutine,
    updateRoutine,
    getAllExercises,
    getExerciseById,
    createCustomExercise,
    saveWorkoutLog,
    saveSportLog,
    seedExercises,
    getWeeklyStats,
    seedFakeHistory,
    getMuscleProgress,
    getRoutineHistory,
    getExerciseHistory,
    getBodyStatus,
    chatRoutineGenerator,
    getMuscleCatalog,
    getMuscleRanksController,
    getSportCatalog,
    getExerciseProgressController,
    getTrainedExercises
} = require('../controllers/gymController');

const protect = require('../middleware/authMiddleware');

// 🔥 IMPORTACIONES DE SEGURIDAD NUEVAS
const validate = require('../middleware/validate');
const { workoutLogSchema } = require('../schemas/gymSchemas');

// Rutinas
router.get('/routines', protect, getRoutines);
router.post('/routines', protect, createRoutine);
router.put('/routines/:id', protect, updateRoutine);
router.delete('/routines/:id', protect, deleteRoutine);
// Copiar a tus rutinas el entreno de otra persona. Va antes que /routines/:id
// no haría falta (métodos distintos), pero se deja junto al resto de rutinas.
router.post('/routines/from-log/:logId', protect, copyWorkoutToRoutine);

// Ejercicios
router.get('/exercises', protect, getAllExercises);
// Catálogo de músculos + modo del usuario (normal / pro)
router.get('/muscles', protect, getMuscleCatalog);
// Nivel/rango de cada grupo muscular
router.get('/muscle-ranks', protect, getMuscleRanksController);
router.post('/exercises', protect, createCustomExercise);
// Ficha de un ejercicio (GIF + instrucciones). Va DESPUÉS de las rutas fijas
// como /exercises/muscles para que ":id" no se las trague.
router.get('/exercises/:id', protect, getExerciseById);

// Logs / Registros
// 🛡️ AQUÍ APLICAMOS LA VALIDACIÓN JOI ANTES DEL CONTROLADOR
router.post('/log', protect, validate(workoutLogSchema), saveWorkoutLog);
router.post('/sport', protect, saveSportLog);
// Catálogo de deportes de la pestaña "Otros"
router.get('/sports', protect, getSportCatalog);

// Progreso por ejercicio (gráficas de la pestaña "Cuerpo")
router.get('/progress', protect, getTrainedExercises);
router.get('/progress/:name', protect, getExerciseProgressController);

// Generador de rutinas con IA.
// La función existía en el controlador pero NUNCA se enrutó: el endpoint
// devolvía "Cannot POST", así que la feature era inalcanzable.
router.post('/chat-routine', protect, chatRoutineGenerator);

// Utilidades
router.get('/seed', protect, seedExercises);

// --- ESTADÍSTICAS Y WIDGETS ---
router.get('/weekly', protect, getWeeklyStats);
router.post('/seed-history', protect, seedFakeHistory);
router.get('/muscle-progress', protect, getMuscleProgress);
router.post('/history-stats', protect, getRoutineHistory);
router.get('/body-status', protect, getBodyStatus);
router.get('/exercise-history', protect, getExerciseHistory);

module.exports = router;