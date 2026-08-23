const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    getNutritionLog,
    addMealCategory,
    seedFoods,
    analyzeImage,
    getSavedFoods,
    saveCustomFood,
    deleteSavedFood,
    updateSavedFood,
    chatMacroCalculator,
    addFoodToLog,
    searchFoods,
    addFoodEntry,
    analyzeFoodText,
    removeFoodFromLog
} = require('../controllers/foodController');
const protect = require('../middleware/authMiddleware');
const { protectCron } = require('../middleware/cronMiddleware');
const aiLimiter = require('../middleware/aiLimiter');

// 🔥 FIX ARQUITECTÓNICO: Usar memoria en lugar de disco (Ultra rápido para Serverless)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de seguridad: 5MB máximo por foto
});

router.get('/log', protect, getNutritionLog);
router.post('/add', protect, addFoodEntry);
router.post('/category', protect, addMealCategory);
// Ya devuelve 'Seed desactivado', pero se cierra igual: si algun dia se
// reactiva, no debe quedar abierto a cualquiera con sesion.
router.post('/seed', protectCron, seedFoods);

// Le pasamos el multer en memoria
router.post('/analyze', protect, aiLimiter, upload.single('image'), analyzeImage);

// RUTAS DE GUARDADO Y BÚSQUEDA
router.post('/log/:mealId', protect, addFoodToLog);
router.delete('/log/:mealId/:foodItemId', protect, removeFoodFromLog); // Aseguramos que exista la ruta delete
router.get('/search', protect, searchFoods);

// RUTA NUEVA IA TEXTO
router.post('/analyze-text', protect, aiLimiter, analyzeFoodText);

// Mis Comidas
router.get('/saved', protect, getSavedFoods);
router.post('/save', protect, saveCustomFood);
router.delete('/saved/:id', protect, deleteSavedFood);
router.put('/saved/:id', protect, updateSavedFood);

// Chat Perfil
router.post('/chat-macros', protect, aiLimiter, chatMacroCalculator);

module.exports = router;