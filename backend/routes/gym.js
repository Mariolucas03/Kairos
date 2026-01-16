const express = require('express');
const router = express.Router();

const {
    getRoutines,
    createRoutine,
    deleteRoutine,
    updateRoutine,
    getAllExercises,
    createCustomExercise,
    saveWorkoutLog,
    saveSportLog,
    seedExercises,
    getWeeklyStats,
    seedFakeHistory,
    getMuscleProgress,
    getRoutineHistory,
    getExerciseHistory,
    getBodyStatus
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

// Ejercicios
router.get('/exercises', protect, getAllExercises);
router.post('/exercises', protect, createCustomExercise);

// Logs / Registros
// 🛡️ AQUÍ APLICAMOS LA VALIDACIÓN JOI ANTES DEL CONTROLADOR
router.post('/log', protect, validate(workoutLogSchema), saveWorkoutLog);
router.post('/sport', protect, saveSportLog);

// Utilidades
router.get('/seed', seedExercises);

// --- ESTADÍSTICAS Y WIDGETS ---
router.get('/weekly', protect, getWeeklyStats);
router.post('/seed-history', protect, seedFakeHistory);
router.get('/muscle-progress', protect, getMuscleProgress);
router.post('/history-stats', protect, getRoutineHistory);
router.get('/body-status', protect, getBodyStatus);
router.get('/exercise-history', protect, getExerciseHistory);

module.exports = router;